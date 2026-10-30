from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import io
import csv

from database import get_db
from models import Cronograma, CronogramaItem, HistorialConteo, Producto, UbicacionMapa
from services.cronograma_service import generar_cronograma_algoritmo, calcular_cuotas_semanales
from services.import_service import generar_y_guardar_cronograma

router = APIRouter(prefix="/api/cronograma", tags=["Cronograma Cíclico"])

class ConteoRegister(BaseModel):
    cronograma_item_id: int
    cantidad_fisica: float
    observaciones: Optional[str] = ""
    usuario: Optional[str] = "Operador"

class PreviewRequest(BaseModel):
    fecha_inicio: str # YYYY-MM-DD

class IniciarCicloRequest(BaseModel):
    fecha_inicio: str # YYYY-MM-DD
    nombre: Optional[str] = "Cronograma Cíclico Anual"
    confirmar_sobrescribir: Optional[bool] = False

class ReprogramarRequest(BaseModel):
    cronograma_item_id: int
    nueva_semana: int
    motivo: Optional[str] = ""

class AnularRequest(BaseModel):
    cronograma_item_id: int
    justificacion: str

@router.get("")
def get_cronograma_activo(
    semana: Optional[int] = Query(None, ge=1),
    q: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    ubicacion: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    crono = db.query(Cronograma).filter(Cronograma.activo == True).order_by(Cronograma.id.desc()).first()
    if not crono:
        crono = generar_y_guardar_cronograma(db)

    f_inicio = crono.fecha_inicio or crono.fecha_creacion
    hoy = datetime.utcnow()
    dias_transcurridos = (hoy - f_inicio).days
    semana_actual = max(1, (dias_transcurridos // 7) + 1)

    # Todos los ítems del cronograma
    all_items_query = db.query(CronogramaItem).filter(CronogramaItem.cronograma_id == crono.id)
    all_items = all_items_query.all()

    total_programados = len(all_items)
    conteos_confirmados = sum(1 for it in all_items if it.estado == "COMPLETADO")
    conteos_anulados = sum(1 for it in all_items if it.estado == "ANULADO")

    # Referencias elegibles involucradas
    codigos_refs = list(set([it.codigo_referencia for it in all_items]))
    referencias_elegibles = len(codigos_refs)

    # Conteo por referencia de conteos completados
    conteos_completados_por_ref = {}
    for it in all_items:
        if it.estado == "COMPLETADO":
            conteos_completados_por_ref[it.codigo_referencia] = conteos_completados_por_ref.get(it.codigo_referencia, 0) + 1

    referencias_completadas_5 = sum(1 for code, cnt in conteos_completados_por_ref.items() if cnt >= 5)

    # Conteos por estado/semana
    conteos_pendientes = 0
    conteos_atrasados = 0

    for it in all_items:
        if it.estado in ["PROGRAMADO", "PENDIENTE"]:
            if it.semana < semana_actual:
                conteos_atrasados += 1
            else:
                conteos_pendientes += 1

    progreso_general = round((conteos_confirmados / total_programados * 100), 1) if total_programados > 0 else 0.0

    # Cumplimiento semana actual
    items_sem_actual = [it for it in all_items if it.semana == semana_actual]
    comp_sem_actual = sum(1 for it in items_sem_actual if it.estado == "COMPLETADO")
    tot_sem_actual = len(items_sem_actual)
    cumplimiento_semanal = round((comp_sem_actual / tot_sem_actual * 100), 1) if tot_sem_actual > 0 else 0.0

    # Resumen por semanas
    max_semana = max([it.semana for it in all_items]) if all_items else 49
    semanas_summary = []
    for s in range(1, max_semana + 1):
        items_s = [it for it in all_items if it.semana == s]
        tot_s = len(items_s)
        comp_s = sum(1 for it in items_s if it.estado == "COMPLETADO")
        anul_s = sum(1 for it in items_s if it.estado == "ANULADO")
        pend_s = sum(1 for it in items_s if it.estado in ["PROGRAMADO", "PENDIENTE"] and s >= semana_actual)
        atras_s = sum(1 for it in items_s if it.estado in ["PROGRAMADO", "PENDIENTE"] and s < semana_actual)
        f_prog_s = (f_inicio + timedelta(days=7 * (s - 1))).strftime("%Y-%m-%d")

        semanas_summary.append({
            "semana": s,
            "fecha_programada": f_prog_s,
            "total_items": tot_s,
            "completados": comp_s,
            "pendientes": pend_s,
            "atrasados": atras_s,
            "anulados": anul_s
        })

    # Filtrar para la tabla
    filtered_query = db.query(CronogramaItem).filter(CronogramaItem.cronograma_id == crono.id)

    if semana is not None and isinstance(semana, int):
        filtered_query = filtered_query.filter(CronogramaItem.semana == semana)

    if q is not None and isinstance(q, str) and q.strip():
        search_pattern = f"%{q.strip()}%"
        filtered_query = filtered_query.filter(CronogramaItem.codigo_referencia.ilike(search_pattern))

    if estado is not None and isinstance(estado, str) and estado != "TODOS":
        if estado == "ATRASADO":
            filtered_query = filtered_query.filter(
                CronogramaItem.estado.in_(["PROGRAMADO", "PENDIENTE"]),
                CronogramaItem.semana < semana_actual
            )
        elif estado == "PENDIENTE":
            filtered_query = filtered_query.filter(
                CronogramaItem.estado.in_(["PROGRAMADO", "PENDIENTE"]),
                CronogramaItem.semana >= semana_actual
            )
        else:
            filtered_query = filtered_query.filter(CronogramaItem.estado == estado)

    items_filtrados = filtered_query.order_by(CronogramaItem.semana.asc(), CronogramaItem.id.asc()).all()

    # Cargar información de productos y ubicaciones
    codigos_fit = list(set([it.codigo_referencia for it in items_filtrados]))
    prods_map = {p.codigo: p for p in db.query(Producto).filter(Producto.codigo.in_(codigos_fit)).all()} if codigos_fit else {}

    # Mapeo de ubicaciones desde UbicacionMapa
    locs_map = {}
    if codigos_fit:
        locs_query = db.query(UbicacionMapa).filter(UbicacionMapa.producto_codigo.in_(codigos_fit)).all()
        for loc in locs_query:
            locs_map[loc.producto_codigo] = f"Pos {loc.codigo_visible} (Fila {loc.fila}, Col {loc.columna})"

    if ubicacion is not None and isinstance(ubicacion, str) and ubicacion != "TODAS":
        search_loc = ubicacion.lower()
        items_filtrados = [
            it for it in items_filtrados
            if search_loc in locs_map.get(it.codigo_referencia, "").lower()
            or search_loc in (prods_map.get(it.codigo_referencia).ubicacion if prods_map.get(it.codigo_referencia) else "").lower()
        ]

    total_items_filtrados = len(items_filtrados)

    # Paginación
    page_num = page if isinstance(page, int) else 1
    limit_num = limit if isinstance(limit, int) else 50
    offset = (page_num - 1) * limit_num
    page_items = items_filtrados[offset : offset + limit_num]

    items_response = []
    for it in page_items:
        prod = prods_map.get(it.codigo_referencia)
        ubic_str = locs_map.get(it.codigo_referencia) or (prod.ubicacion if prod else "Almacén Principal")
        conf_count = conteos_completados_por_ref.get(it.codigo_referencia, 0)

        # Determinar estado efectivo (ATRASADO vs PENDIENTE)
        estado_efectivo = it.estado
        if it.estado in ["PROGRAMADO", "PENDIENTE"]:
            estado_efectivo = "ATRASADO" if it.semana < semana_actual else "PENDIENTE"

        fecha_prog_item = it.fecha_programada or (f_inicio + timedelta(days=7 * (it.semana - 1)))

        items_response.append({
            "id": it.id,
            "semana": it.semana,
            "fecha_programada": fecha_prog_item.strftime("%Y-%m-%d"),
            "fecha_confirmacion": it.fecha_confirmacion.strftime("%Y-%m-%d %H:%M") if it.fecha_confirmacion else None,
            "codigo_referencia": it.codigo_referencia,
            "descripcion": prod.descripcion if prod else "N/A",
            "categoria": prod.categoria if prod else "General",
            "ubicacion": ubic_str,
            "stock_sistema": prod.stock_actual if prod else 0.0,
            "numero_conteo": it.numero_conteo,
            "conteos_confirmados_ref": conf_count,
            "conteos_restantes_ref": max(0, 5 - conf_count),
            "estado": estado_efectivo,
            "estado_raw": it.estado
        })

    return {
        "cronograma_id": crono.id,
        "nombre": crono.nombre,
        "fecha_inicio": f_inicio.strftime("%Y-%m-%d"),
        "fecha_creacion": crono.fecha_creacion.strftime("%Y-%m-%d %H:%M"),
        "estado": crono.estado,
        "semana_actual": semana_actual,
        "kpis": {
            "referencias_elegibles": referencias_elegibles,
            "referencias_completadas_5": referencias_completadas_5,
            "conteos_confirmados": conteos_confirmados,
            "conteos_programados": total_programados,
            "conteos_pendientes": conteos_pendientes,
            "conteos_atrasados": conteos_atrasados,
            "conteos_anulados": conteos_anulados,
            "progreso_general": progreso_general,
            "cumplimiento_semanal": cumplimiento_semanal
        },
        "semanas_resumen": semanas_summary,
        "pagination": {
            "total": total_items_filtrados,
            "page": page_num,
            "limit": limit_num,
            "total_pages": (total_items_filtrados + limit_num - 1) // limit_num if limit_num > 0 else 1
        },
        "items": items_response
    }

@router.post("/preview")
def generar_vista_previa(req: PreviewRequest, db: Session = Depends(get_db)):
    try:
        f_inicio = datetime.strptime(req.fecha_inicio, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Utilice YYYY-MM-DD.")

    # Verificar si existe ciclo activo
    crono_activo = db.query(Cronograma).filter(Cronograma.activo == True).first()

    prods_elegibles = db.query(Producto.codigo).filter(Producto.activo == True).order_by(Producto.codigo.asc()).all()
    referencias = [p[0] for p in prods_elegibles]

    if not referencias:
        raise HTTPException(status_code=400, detail="No se encontraron referencias elegibles en el catálogo.")

    try:
        cronograma_dict, cuotas, resumen = generar_cronograma_algoritmo(
            referencias=referencias,
            fecha_inicio=f_inicio,
            counts_per_ref=1
        )
        es_valido = True
        msg_val = "Vista previa del cronograma generada y validada correctamente con las referencias reales elegibles."
    except Exception as e:
        es_valido = False
        msg_val = str(e)
        cuotas = []
        resumen = {
            "num_referencias": len(referencias),
            "total_asignaciones": len(referencias),
            "total_semanas": 52
        }

    return {
        "tiene_ciclo_activo": crono_activo is not None,
        "ciclo_activo_id": crono_activo.id if crono_activo else None,
        "ciclo_activo_nombre": crono_activo.nombre if crono_activo else None,
        "fecha_inicio_seleccionada": req.fecha_inicio,
        "referencias_elegibles": len(referencias),
        "total_conteos_objetivo": len(referencias),
        "total_semanas_estimadas": resumen.get("total_semanas", 52),
        "fecha_fin_estimada": (f_inicio + timedelta(days=7 * resumen.get("total_semanas", 52))).strftime("%Y-%m-%d"),
        "cuotas_semanales": cuotas,
        "es_valido": es_valido,
        "mensaje_validacion": msg_val
    }

@router.post("/iniciar")
def iniciar_nuevo_ciclo(req: IniciarCicloRequest, db: Session = Depends(get_db)):
    try:
        f_inicio = datetime.strptime(req.fecha_inicio, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Utilice YYYY-MM-DD.")

    crono_activo = db.query(Cronograma).filter(Cronograma.activo == True).first()
    if crono_activo and not req.confirmar_sobrescribir:
        raise HTTPException(
            status_code=400,
            detail=f"Ya existe un ciclo activo (ID: {crono_activo.id} - '{crono_activo.nombre}'). Debe confirmar explícitamente para iniciar un nuevo ciclo."
        )

    nuevo_crono = generar_y_guardar_cronograma(
        db,
        nombre=req.nombre or "Cronograma Cíclico Anual",
        fecha_inicio=f_inicio
    )

    return {
        "message": "Nuevo ciclo de inventario cíclico iniciado y guardado exitosamente.",
        "cronograma_id": nuevo_crono.id,
        "nombre": nuevo_crono.nombre,
        "fecha_inicio": f_inicio.strftime("%Y-%m-%d"),
        "fecha_creacion": nuevo_crono.fecha_creacion.strftime("%Y-%m-%d %H:%M")
    }

@router.post("/conteo")
def registrar_conteo_fisico(conteo: ConteoRegister, db: Session = Depends(get_db)):
    item = db.query(CronogramaItem).filter(CronogramaItem.id == conteo.cronograma_item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Ítem de cronograma no encontrado")

    # Control de idempotencia / Prevención de doble confirmación
    if item.estado == "COMPLETADO":
        raise HTTPException(
            status_code=400,
            detail="El conteo físico para esta asignación ya fue registrado y confirmado previamente."
        )

    prod = db.query(Producto).filter(Producto.codigo == item.codigo_referencia).first()
    stock_sis = prod.stock_actual if prod else 0.0

    diferencia = conteo.cantidad_fisica - stock_sis

    historial = HistorialConteo(
        cronograma_item_id=item.id,
        fecha_conteo=datetime.utcnow(),
        cantidad_sistema=stock_sis,
        cantidad_fisica=conteo.cantidad_fisica,
        diferencia=diferencia,
        observaciones=conteo.observaciones,
        usuario=conteo.usuario or "Operador"
    )

    db.add(historial)

    item.estado = "COMPLETADO"
    item.fecha_confirmacion = datetime.utcnow()

    # Actualizar stock del producto con la cantidad contada
    if prod:
        prod.stock_actual = conteo.cantidad_fisica

    db.commit()

    # Conteos confirmados de esta referencia en el ciclo activo
    conteos_confirmados_ref = db.query(func.count(CronogramaItem.id)).filter(
        CronogramaItem.cronograma_id == item.cronograma_id,
        CronogramaItem.codigo_referencia == item.codigo_referencia,
        CronogramaItem.estado == "COMPLETADO"
    ).scalar() or 0

    return {
        "message": "Conteo físico confirmado y registrado exitosamente.",
        "item_id": item.id,
        "codigo_referencia": item.codigo_referencia,
        "cantidad_sistema": stock_sis,
        "cantidad_fisica": conteo.cantidad_fisica,
        "diferencia": diferencia,
        "conteos_confirmados_ref": conteos_confirmados_ref,
        "conteos_restantes_ref": max(0, 5 - conteos_confirmados_ref)
    }

@router.post("/reprogramar")
def reprogramar_asignacion(req: ReprogramarRequest, db: Session = Depends(get_db)):
    item = db.query(CronogramaItem).filter(CronogramaItem.id == req.cronograma_item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Ítem de cronograma no encontrado")

    if item.estado == "COMPLETADO":
        raise HTTPException(status_code=400, detail="No se puede reprogramar una asignación que ya ha sido completada.")

    # Validar que la referencia no esté ya asignada en la nueva semana
    duplicado = db.query(CronogramaItem).filter(
        CronogramaItem.cronograma_id == item.cronograma_id,
        CronogramaItem.semana == req.nueva_semana,
        CronogramaItem.codigo_referencia == item.codigo_referencia,
        CronogramaItem.id != item.id
    ).first()

    if duplicado:
        raise HTTPException(
            status_code=400,
            detail=f"La referencia {item.codigo_referencia} ya está programada en la semana {req.nueva_semana}."
        )

    crono = db.query(Cronograma).filter(Cronograma.id == item.cronograma_id).first()
    f_inicio = (crono.fecha_inicio or crono.fecha_creacion) if crono else datetime.utcnow()
    nueva_fecha_prog = f_inicio + timedelta(days=7 * (req.nueva_semana - 1))

    semana_anterior = item.semana
    item.semana = req.nueva_semana
    item.fecha_programada = nueva_fecha_prog

    db.commit()

    return {
        "message": f"Asignación reprogramada con éxito de la semana {semana_anterior} a la semana {req.nueva_semana}.",
        "item_id": item.id,
        "codigo_referencia": item.codigo_referencia,
        "semana_anterior": semana_anterior,
        "nueva_semana": req.nueva_semana,
        "nueva_fecha_programada": nueva_fecha_prog.strftime("%Y-%m-%d")
    }

@router.post("/anular")
def anular_asignacion(req: AnularRequest, db: Session = Depends(get_db)):
    if not req.justificacion or not req.justificacion.strip():
        raise HTTPException(status_code=400, detail="Se requiere una justificación obligatoria para anular un conteo.")

    item = db.query(CronogramaItem).filter(CronogramaItem.id == req.cronograma_item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Ítem de cronograma no encontrado")

    if item.estado == "COMPLETADO":
        raise HTTPException(status_code=400, detail="No se puede anular una asignación que ya ha sido completada.")

    item.estado = "ANULADO"
    db.commit()

    return {
        "message": "Asignación anulada correctamente.",
        "item_id": item.id,
        "codigo_referencia": item.codigo_referencia,
        "justificacion": req.justificacion
    }

@router.get("/referencia/{codigo}")
def get_referencia_historial(codigo: str, db: Session = Depends(get_db)):
    code_str = codigo.strip()

    prod = db.query(Producto).filter(Producto.codigo == code_str).first()
    if not prod:
        raise HTTPException(status_code=404, detail=f"Referencia '{code_str}' no encontrada en el inventario.")

    crono = db.query(Cronograma).filter(Cronograma.activo == True).order_by(Cronograma.id.desc()).first()

    items = []
    if crono:
        items = db.query(CronogramaItem).filter(
            CronogramaItem.cronograma_id == crono.id,
            CronogramaItem.codigo_referencia == code_str
        ).order_by(CronogramaItem.semana.asc()).all()

    # Ubicación en mapa
    loc = db.query(UbicacionMapa).filter(UbicacionMapa.producto_codigo == code_str).first()
    ubic_str = f"Pos {loc.codigo_visible} (Fila {loc.fila}, Col {loc.columna})" if loc else prod.ubicacion

    f_inicio = (crono.fecha_inicio or crono.fecha_creacion) if crono else datetime.utcnow()

    semanas_detalle = []
    for it in items:
        # Consultar historial
        hist = db.query(HistorialConteo).filter(HistorialConteo.cronograma_item_id == it.id).order_by(HistorialConteo.fecha_conteo.desc()).first()
        f_prog = it.fecha_programada or (f_inicio + timedelta(days=7 * (it.semana - 1)))

        semanas_detalle.append({
            "cronograma_item_id": it.id,
            "semana": it.semana,
            "numero_conteo": it.numero_conteo,
            "fecha_programada": f_prog.strftime("%Y-%m-%d"),
            "fecha_confirmacion": it.fecha_confirmacion.strftime("%Y-%m-%d %H:%M") if it.fecha_confirmacion else None,
            "estado": it.estado,
            "cantidad_sistema": hist.cantidad_sistema if hist else prod.stock_actual,
            "cantidad_fisica": hist.cantidad_fisica if hist else None,
            "diferencia": hist.diferencia if hist else None,
            "observaciones": hist.observaciones if hist else None,
            "usuario": hist.usuario if hist else None
        })

    conteos_confirmados = sum(1 for it in items if it.estado == "COMPLETADO")

    return {
        "codigo_referencia": code_str,
        "descripcion": prod.descripcion,
        "categoria": prod.categoria or "General",
        "ubicacion": ubic_str,
        "stock_actual": prod.stock_actual,
        "activo": prod.activo,
        "metricas_ciclo": {
            "total_asignaciones_ciclo": len(items),
            "conteos_confirmados": conteos_confirmados,
            "conteos_pendientes": max(0, len(items) - conteos_confirmados),
            "conteos_restantes_objetivo": max(0, 5 - conteos_confirmados),
            "objetivo_alcanzado": conteos_confirmados >= 5
        },
        "historial_asignaciones": semanas_detalle
    }

@router.get("/export/csv")
def export_cronograma_csv(db: Session = Depends(get_db)):
    crono = db.query(Cronograma).filter(Cronograma.activo == True).order_by(Cronograma.id.desc()).first()
    if not crono:
        raise HTTPException(status_code=404, detail="No hay cronograma activo para exportar.")

    items = db.query(CronogramaItem).filter(CronogramaItem.cronograma_id == crono.id).order_by(CronogramaItem.semana.asc(), CronogramaItem.id.asc()).all()

    f_inicio = crono.fecha_inicio or crono.fecha_creacion

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow(["Semana", "Fecha Programada", "Codigo Referencia", "Numero Conteo", "Estado", "Fecha Confirmacion"])

    for it in items:
        f_prog = it.fecha_programada or (f_inicio + timedelta(days=7 * (it.semana - 1)))
        writer.writerow([
            it.semana,
            f_prog.strftime("%Y-%m-%d"),
            it.codigo_referencia,
            it.numero_conteo,
            it.estado,
            it.fecha_confirmacion.strftime("%Y-%m-%d %H:%M") if it.fecha_confirmacion else ""
        ])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=inventario_ciclico_crono_{crono.id}.csv"}
    )
