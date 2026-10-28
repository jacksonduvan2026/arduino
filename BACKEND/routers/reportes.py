from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from database import get_db
from models import Venta, ProductoAIncluir, CronogramaItem, Cronograma

router = APIRouter(prefix="/api/reportes", tags=["Reportes"])

@router.get("/ventas-periodo")
def reportes_ventas_periodo(db: Session = Depends(get_db)):
    # Agrupar ventas por mes
    ventas_raw = db.query(
        func.strftime("%Y-%m", Venta.fecha).label("mes"),
        func.sum(Venta.valor_total_ref).label("total_monto"),
        func.count(Venta.id).label("total_transacciones")
    ).group_by("mes").order_by("mes").all()

    return {
        "reporte": "Ventas por Periodo Mensual",
        "datos": [
            {
                "mes": r.mes,
                "total_monto": float(r.total_monto or 0),
                "total_transacciones": r.total_transacciones
            } for r in ventas_raw
        ]
    }

@router.get("/ventas-ciudad-empresa")
def reportes_ventas_ciudad_empresa(db: Session = Depends(get_db)):
    por_ciudad = db.query(
        Venta.ciudad,
        func.sum(Venta.valor_total_ref).label("total")
    ).group_by(Venta.ciudad).all()

    por_empresa = db.query(
        Venta.empresa,
        func.sum(Venta.valor_total_ref).label("total")
    ).group_by(Venta.empresa).all()

    return {
        "por_ciudad": [{"ciudad": c or "N/A", "total": float(t or 0)} for c, t in por_ciudad],
        "por_empresa": [{"empresa": e or "N/A", "total": float(t or 0)} for e, t in por_empresa]
    }

@router.get("/top-referencias")
def reportes_top_referencias(limit: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)):
    top_ventas = db.query(
        Venta.codigo_referencia,
        Venta.descripcion_referencia,
        func.sum(Venta.cantidad).label("total_cantidad"),
        func.sum(Venta.valor_total_ref).label("total_monto")
    ).group_by(Venta.codigo_referencia, Venta.descripcion_referencia)\
     .order_by(func.sum(Venta.valor_total_ref).desc()).limit(limit).all()

    return {
        "top_referencias": [
            {
                "codigo": r.codigo_referencia,
                "descripcion": r.descripcion_referencia,
                "cantidad_vendida": float(r.total_cantidad or 0),
                "monto_total": float(r.total_monto or 0)
            } for r in top_ventas
        ]
    }

@router.get("/cronograma-resumen")
def reportes_cronograma_resumen(db: Session = Depends(get_db)):
    crono = db.query(Cronograma).filter(Cronograma.activo == True).order_by(Cronograma.id.desc()).first()
    if not crono:
        return {"semanas": []}

    resumen_semanal = db.query(
        CronogramaItem.semana,
        func.count(CronogramaItem.id).label("total"),
        func.sum(func.case((CronogramaItem.estado == "COMPLETADO", 1), else_=0)).label("completados")
    ).filter(CronogramaItem.cronograma_id == crono.id)\
     .group_by(CronogramaItem.semana).order_by(CronogramaItem.semana).all()

    return {
        "semanas": [
            {
                "semana": r.semana,
                "total": r.total,
                "completados": int(r.completados or 0),
                "pendientes": r.total - int(r.completados or 0)
            } for r in resumen_semanal
        ]
    }
