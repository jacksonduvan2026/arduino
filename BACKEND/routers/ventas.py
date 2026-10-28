from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import Optional, List
from datetime import datetime
import io
import csv

from database import get_db
from models import Venta

router = APIRouter(prefix="/api/ventas", tags=["Ventas"])

@router.get("")
def list_ventas(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    q: Optional[str] = Query(None),
    empresa: Optional[str] = Query(None),
    ciudad: Optional[str] = Query(None),
    moneda: Optional[str] = Query(None),
    fecha_inicio: Optional[str] = Query(None),
    fecha_fin: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("fecha"),
    order: Optional[str] = Query("desc"),
    db: Session = Depends(get_db)
):
    query = db.query(Venta)

    if q:
        search_pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Venta.no_orden.ilike(search_pattern),
                Venta.codigo_referencia.ilike(search_pattern),
                Venta.descripcion_referencia.ilike(search_pattern)
            )
        )

    if empresa and empresa != "TODAS":
        query = query.filter(Venta.empresa == empresa)

    if ciudad and ciudad != "TODAS":
        query = query.filter(Venta.ciudad == ciudad)

    if moneda and moneda != "TODAS":
        query = query.filter(Venta.moneda == moneda)

    if fecha_inicio:
        try:
            dt_inicio = datetime.strptime(fecha_inicio, "%Y-%m-%d")
            query = query.filter(Venta.fecha >= dt_inicio)
        except ValueError:
            pass

    if fecha_fin:
        try:
            dt_fin = datetime.strptime(fecha_fin, "%Y-%m-%d")
            query = query.filter(Venta.fecha <= dt_fin)
        except ValueError:
            pass

    total = query.count()

    # Ordenamiento
    sort_column = getattr(Venta, sort_by, Venta.fecha)
    if order == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    offset = (page - 1) * limit
    items = query.offset(offset).limit(limit).all()

    # Filtros disponibles
    empresas = [e[0] for e in db.query(func.distinct(Venta.empresa)).all() if e[0]]
    ciudades = [c[0] for c in db.query(func.distinct(Venta.ciudad)).all() if c[0]]
    monedas = [m[0] for m in db.query(func.distinct(Venta.moneda)).all() if m[0]]

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit if limit > 0 else 1,
        "filtros_disponibles": {
            "empresas": sorted(empresas),
            "ciudades": sorted(ciudades),
            "monedas": sorted(monedas)
        },
        "items": [
            {
                "id": v.id,
                "no_orden": v.no_orden,
                "fecha": v.fecha.strftime("%Y-%m-%d") if v.fecha else "",
                "valor_total_orden": v.valor_total_orden,
                "moneda": v.moneda,
                "codigo_referencia": v.codigo_referencia,
                "descripcion_referencia": v.descripcion_referencia,
                "cantidad": v.cantidad,
                "valor_total_ref": v.valor_total_ref,
                "empresa": v.empresa,
                "ciudad": v.ciudad,
                "categoria": v.categoria or "General",
                "valor_unitario": v.valor_unitario
            }
            for v in items
        ]
    }

@router.get("/{venta_id}")
def get_venta_detalle(venta_id: int, db: Session = Depends(get_db)):
    v = db.query(Venta).filter(Venta.id == venta_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Registro de venta no encontrado")

    # Mismas referencias de la misma orden
    mismas_ordenes = db.query(Venta).filter(Venta.no_orden == v.no_orden).all()

    return {
        "id": v.id,
        "no_orden": v.no_orden,
        "fecha": v.fecha.strftime("%Y-%m-%d") if v.fecha else "",
        "valor_total_orden": v.valor_total_orden,
        "moneda": v.moneda,
        "codigo_referencia": v.codigo_referencia,
        "descripcion_referencia": v.descripcion_referencia,
        "cantidad": v.cantidad,
        "valor_total_ref": v.valor_total_ref,
        "empresa": v.empresa,
        "ciudad": v.ciudad,
        "categoria": v.categoria or "General",
        "valor_unitario": v.valor_unitario,
        "items_de_orden": [
            {
                "id": item.id,
                "codigo_referencia": item.codigo_referencia,
                "descripcion": item.descripcion_referencia,
                "cantidad": item.cantidad,
                "valor_total_ref": item.valor_total_ref
            } for item in mismas_ordenes
        ]
    }

@router.get("/export/csv")
def export_ventas_csv(
    q: Optional[str] = Query(None),
    empresa: Optional[str] = Query(None),
    ciudad: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Venta)
    if q:
        search_pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Venta.no_orden.ilike(search_pattern),
                Venta.codigo_referencia.ilike(search_pattern)
            )
        )
    if empresa and empresa != "TODAS":
        query = query.filter(Venta.empresa == empresa)
    if ciudad and ciudad != "TODAS":
        query = query.filter(Venta.ciudad == ciudad)

    items = query.limit(10000).all()

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow(["No Orden", "Fecha", "Moneda", "Codigo Ref", "Descripcion", "Cantidad", "Valor Total Ref", "Empresa", "Ciudad", "Valor Unitario"])

    for v in items:
        writer.writerow([
            v.no_orden,
            v.fecha.strftime("%Y-%m-%d") if v.fecha else "",
            v.moneda,
            v.codigo_referencia,
            v.descripcion_referencia,
            v.cantidad,
            v.valor_total_ref,
            v.empresa,
            v.ciudad,
            v.valor_unitario
        ])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=ventas_export.csv"}
    )
