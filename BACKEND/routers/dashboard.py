from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import Venta, Producto, ProductoAIncluir, CronogramaItem

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

@router.get("")
def get_dashboard_summary(db: Session = Depends(get_db)):
    total_ventas_count = db.query(func.count(Venta.id)).scalar() or 0
    total_monto_ventas = db.query(func.sum(Venta.valor_total_ref)).scalar() or 0.0
    total_referencias_ventas = db.query(func.count(func.distinct(Venta.codigo_referencia))).scalar() or 0
    total_productos_catalogo = db.query(func.count(Producto.codigo)).scalar() or 0
    total_productos_incluir = db.query(func.count(ProductoAIncluir.codigo)).scalar() or 0

    # Progreso de Cronograma
    total_conteos_programados = db.query(func.count(CronogramaItem.id)).scalar() or 0
    total_conteos_completados = db.query(func.count(CronogramaItem.id)).filter(CronogramaItem.estado == "COMPLETADO").scalar() or 0

    # Distribución de ventas por ciudad
    ventas_por_ciudad_raw = db.query(Venta.ciudad, func.sum(Venta.valor_total_ref))\
        .group_by(Venta.ciudad).all()
    ventas_por_ciudad = [{"ciudad": c or "N/A", "total": float(t or 0)} for c, t in ventas_por_ciudad_raw]

    # Distribución de ventas por empresa
    ventas_por_empresa_raw = db.query(Venta.empresa, func.sum(Venta.valor_total_ref))\
        .group_by(Venta.empresa).all()
    ventas_por_empresa = [{"empresa": e or "N/A", "total": float(t or 0)} for e, t in ventas_por_empresa_raw]

    # Últimas 5 ventas
    ultimas_ventas = db.query(Venta).order_by(Venta.fecha.desc()).limit(5).all()
    recent_sales = [{
        "id": v.id,
        "no_orden": v.no_orden,
        "fecha": v.fecha.strftime("%Y-%m-%d") if v.fecha else "",
        "codigo_referencia": v.codigo_referencia,
        "descripcion": v.descripcion_referencia,
        "empresa": v.empresa,
        "ciudad": v.ciudad,
        "valor_total_ref": v.valor_total_ref
    } for v in ultimas_ventas]

    return {
        "kpis": {
            "total_ventas_registros": total_ventas_count,
            "total_monto_ventas": round(total_monto_ventas, 2),
            "total_referencias_distintas": total_referencias_ventas,
            "total_productos_catalogo": total_productos_catalogo,
            "total_productos_a_incluir": total_productos_incluir,
            "cronograma_programados": total_conteos_programados,
            "cronograma_completados": total_conteos_completados,
            "cronograma_progreso_porcentaje": round((total_conteos_completados / total_conteos_programados * 100), 1) if total_conteos_programados > 0 else 0
        },
        "ventas_por_ciudad": ventas_por_ciudad,
        "ventas_por_empresa": ventas_por_empresa,
        "ultimas_ventas": recent_sales
    }
