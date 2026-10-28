from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import io
import csv

from database import get_db
from models import Cronograma, CronogramaItem, HistorialConteo, Producto
from services.import_service import generar_y_guardar_cronograma

router = APIRouter(prefix="/api/cronograma", tags=["Cronograma Cíclico"])

class ConteoRegister(BaseModel):
    cronograma_item_id: int
    cantidad_fisica: float
    observaciones: Optional[str] = ""

@router.get("")
def get_cronograma_activo(
    semana: Optional[int] = Query(None, ge=1, le=49),
    q: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    crono = db.query(Cronograma).filter(Cronograma.activo == True).order_by(Cronograma.id.desc()).first()
    if not crono:
        crono = generar_y_guardar_cronograma(db)

    query = db.query(CronogramaItem).filter(CronogramaItem.cronograma_id == crono.id)

    if semana:
        query = query.filter(CronogramaItem.semana == semana)

    if q:
        search_pattern = f"%{q.strip()}%"
        query = query.filter(CronogramaItem.codigo_referencia.ilike(search_pattern))

    if estado and estado != "TODOS":
        query = query.filter(CronogramaItem.estado == estado)

    items = query.all()

    # Mapear con información de producto
    codigos = list(set([it.codigo_referencia for it in items]))
    prods = {p.codigo: p for p in db.query(Producto).filter(Producto.codigo.in_(codigos)).all()} if codigos else {}

    items_response = []
    for it in items:
        prod = prods.get(it.codigo_referencia)
        items_response.append({
            "id": it.id,
            "semana": it.semana,
            "codigo_referencia": it.codigo_referencia,
            "descripcion": prod.descripcion if prod else "N/A",
            "categoria": prod.categoria if prod else "General",
            "stock_sistema": prod.stock_actual if prod else 0.0,
            "numero_conteo": it.numero_conteo,
            "estado": it.estado
        })

    # Resumen por semanas (totales, programados, completados)
    semanas_summary = []
    if not semana and not q and not estado:
        for s in range(1, 50):
            tot_sem = db.query(func.count(CronogramaItem.id)).filter(CronogramaItem.cronograma_id == crono.id, CronogramaItem.semana == s).scalar() or 0
            comp_sem = db.query(func.count(CronogramaItem.id)).filter(CronogramaItem.cronograma_id == crono.id, CronogramaItem.semana == s, CronogramaItem.estado == "COMPLETADO").scalar() or 0
            semanas_summary.append({
                "semana": s,
                "total_items": tot_sem,
                "completados": comp_sem,
                "pendientes": tot_sem - comp_sem
            })

    total_programados = db.query(func.count(CronogramaItem.id)).filter(CronogramaItem.cronograma_id == crono.id).scalar() or 0
    total_completados = db.query(func.count(CronogramaItem.id)).filter(CronogramaItem.cronograma_id == crono.id, CronogramaItem.estado == "COMPLETADO").scalar() or 0

    return {
        "cronograma_id": crono.id,
        "nombre": crono.nombre,
        "fecha_creacion": crono.fecha_creacion.strftime("%Y-%m-%d %H:%M"),
        "kpis": {
            "total_programados": total_programados,
            "total_completados": total_completados,
            "total_pendientes": total_programados - total_completados
        },
        "semanas_resumen": semanas_summary,
        "items": items_response
    }

@router.get("/referencia/{codigo}")
def get_referencia_cronograma(codigo: str, db: Session = Depends(get_db)):
    crono = db.query(Cronograma).filter(Cronograma.activo == True).order_by(Cronograma.id.desc()).first()
    if not crono:
        raise HTTPException(status_code=404, detail="No hay cronograma activo")

    code_str = codigo.strip().upper()
    if not code_str.startswith("REF-") and code_str.isdigit():
        code_str = f"REF-{int(code_str):03d}"

    items = db.query(CronogramaItem).filter(
        CronogramaItem.cronograma_id == crono.id,
        CronogramaItem.codigo_referencia == code_str
    ).order_by(CronogramaItem.semana.asc()).all()

    prod = db.query(Producto).filter(Producto.codigo == code_str).first()

    return {
        "codigo_referencia": code_str,
        "descripcion": prod.descripcion if prod else "No registrada",
        "categoria": prod.categoria if prod else "General",
        "total_conteos_programados": len(items),
        "semanas": [
            {
                "cronograma_item_id": it.id,
                "semana": it.semana,
                "numero_conteo": it.numero_conteo,
                "estado": it.estado
            } for it in items
        ]
    }

@router.post("/regenerar")
def regenerar_cronograma(db: Session = Depends(get_db)):
    nuevo_crono = generar_y_guardar_cronograma(db, nombre="Cronograma Regenerado")
    return {
        "message": "Cronograma cíclico regenerado exitosamente",
        "cronograma_id": nuevo_crono.id,
        "fecha_creacion": nuevo_crono.fecha_creacion.strftime("%Y-%m-%d %H:%M")
    }

@router.post("/conteo")
def registrar_conteo_fisico(conteo: ConteoRegister, db: Session = Depends(get_db)):
    item = db.query(CronogramaItem).filter(CronogramaItem.id == conteo.cronograma_item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Ítem de cronograma no encontrado")

    prod = db.query(Producto).filter(Producto.codigo == item.codigo_referencia).first()
    stock_sis = prod.stock_actual if prod else 0.0

    diferencia = conteo.cantidad_fisica - stock_sis

    historial = HistorialConteo(
        cronograma_item_id=item.id,
        fecha_conteo=datetime.utcnow(),
        cantidad_sistema=stock_sis,
        cantidad_fisica=conteo.cantidad_fisica,
        diferencia=diferencia,
        observaciones=conteo.observaciones
    )

    db.add(historial)
    item.estado = "COMPLETADO"

    # Actualizar stock en producto
    if prod:
        prod.stock_actual = conteo.cantidad_fisica

    db.commit()

    return {
        "message": "Conteo físico registrado y stock actualizado con éxito",
        "item_id": item.id,
        "codigo_referencia": item.codigo_referencia,
        "cantidad_fisica": conteo.cantidad_fisica,
        "diferencia": diferencia
    }

@router.get("/export/csv")
def export_cronograma_csv(db: Session = Depends(get_db)):
    crono = db.query(Cronograma).filter(Cronograma.activo == True).order_by(Cronograma.id.desc()).first()
    if not crono:
        raise HTTPException(status_code=404, detail="No hay cronograma activo")

    items = db.query(CronogramaItem).filter(CronogramaItem.cronograma_id == crono.id).order_by(CronogramaItem.semana.asc()).all()

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow(["Semana", "Codigo Referencia", "Numero Conteo", "Estado"])

    for it in items:
        writer.writerow([
            it.semana,
            it.codigo_referencia,
            it.numero_conteo,
            it.estado
        ])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=cronograma_ciclico_crono_{crono.id}.csv"}
    )
