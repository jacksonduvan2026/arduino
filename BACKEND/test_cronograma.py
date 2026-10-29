import pytest
import os
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, ejecutar_migraciones_seguras
from models import Producto, Cronograma, CronogramaItem, HistorialConteo
from services.cronograma_service import generar_cronograma_algoritmo, validar_cronograma_generado, calcular_cuotas_semanales
from routers.cronograma import (
    get_cronograma_activo,
    generar_vista_previa,
    iniciar_nuevo_ciclo,
    registrar_conteo_fisico,
    reprogramar_asignacion,
    anular_asignacion,
    get_referencia_historial,
    PreviewRequest,
    IniciarCicloRequest,
    ConteoRegister,
    ReprogramarRequest,
    AnularRequest
)
from fastapi import HTTPException

# Test Database setup (isolated in-memory or temporary file)
TEST_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture
def db_session():
    engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    Base.metadata.create_all(bind=engine)

    # Safe column checks if needed
    from sqlalchemy import inspect, text
    with engine.connect() as conn:
        inspector = inspect(conn)
        cols_p = [c["name"] for c in inspector.get_columns("productos")]
        if "activo" not in cols_p:
            conn.execute(text("ALTER TABLE productos ADD COLUMN activo BOOLEAN DEFAULT 1"))

        cols_c = [c["name"] for c in inspector.get_columns("cronogramas")]
        if "fecha_inicio" not in cols_c:
            conn.execute(text("ALTER TABLE cronogramas ADD COLUMN fecha_inicio DATETIME"))
        if "estado" not in cols_c:
            conn.execute(text("ALTER TABLE cronogramas ADD COLUMN estado VARCHAR DEFAULT 'ACTIVO'"))

        cols_i = [c["name"] for c in inspector.get_columns("cronograma_items")]
        if "fecha_programada" not in cols_i:
            conn.execute(text("ALTER TABLE cronograma_items ADD COLUMN fecha_programada DATETIME"))
        if "fecha_confirmacion" not in cols_i:
            conn.execute(text("ALTER TABLE cronograma_items ADD COLUMN fecha_confirmacion DATETIME"))

        conn.commit()

    session = TestingSessionLocal()

    # Populate test products (600 references)
    prods = [
        Producto(
            codigo=f"REF-{i+1:03d}",
            descripcion=f"Producto Test {i+1:03d}",
            categoria="General",
            stock_actual=100.0,
            activo=True
        )
        for i in range(600)
    ]
    session.bulk_save_objects(prods)
    session.commit()

    try:
        yield session
    finally:
        session.close()

def test_algoritmo_600_referencias_3000_asignaciones():
    refs = [f"REF-{i+1:03d}" for i in range(600)]
    f_start = datetime(2026, 2, 1)

    crono_dict, cuotas, resumen = generar_cronograma_algoritmo(refs, f_start, counts_per_ref=5)

    assert resumen["num_referencias"] == 600
    assert resumen["total_asignaciones"] == 3000
    assert resumen["total_semanas"] == 49

    # First 48 weeks must have 62 assignments, week 49 must have 24
    assert cuotas[:48] == [62] * 48
    assert cuotas[48] == 24

    # Each week must match its quota
    for week in range(1, 50):
        assert len(crono_dict[week]) == (62 if week < 49 else 24)

    # Check each reference appears exactly 5 times and never twice in the same week
    counts = {r: 0 for r in refs}
    for week, items in crono_dict.items():
        week_refs = [it["codigo_referencia"] for it in items]
        assert len(week_refs) == len(set(week_refs)), f"Duplicado en semana {week}"
        for r in week_refs:
            counts[r] += 1

    for r, cnt in counts.items():
        assert cnt == 5, f"La referencia {r} tiene {cnt} asignaciones en lugar de 5"

def test_referencia_no_elegible_no_se_incorpora():
    refs_elegibles = [f"REF-{i+1:03d}" for i in range(10)]
    ref_invalida = "REF-INACTIVA-999"

    crono_dict, cuotas, resumen = generar_cronograma_algoritmo(refs_elegibles, datetime.now())

    all_assigned_refs = set()
    for items in crono_dict.values():
        for it in items:
            all_assigned_refs.add(it["codigo_referencia"])

    assert ref_invalida not in all_assigned_refs
    assert len(all_assigned_refs) == 10

def test_fecha_programada_no_incrementa_conteo_confirmado(db_session):
    f_today = datetime.utcnow().strftime("%Y-%m-%d")
    req_iniciar = IniciarCicloRequest(fecha_inicio=f_today, nombre="Ciclo Test")
    res_init = iniciar_nuevo_ciclo(req_iniciar, db=db_session)

    crono_res = get_cronograma_activo(db=db_session)

    assert crono_res["kpis"]["conteos_programados"] == 3000
    assert crono_res["kpis"]["conteos_confirmados"] == 0
    assert crono_res["kpis"]["conteos_pendientes"] + crono_res["kpis"]["conteos_atrasados"] == 3000

def test_confirmacion_idempotente_y_incremento_progreso(db_session):
    f_today = datetime.utcnow().strftime("%Y-%m-%d")
    iniciar_nuevo_ciclo(IniciarCicloRequest(fecha_inicio=f_today), db=db_session)
    crono_res = get_cronograma_activo(db=db_session)
    item_id = crono_res["items"][0]["id"]

    # 1. Registrar conteo valido
    conteo_req = ConteoRegister(cronograma_item_id=item_id, cantidad_fisica=105.0, observaciones="Todo ok")
    res_conteo = registrar_conteo_fisico(conteo_req, db=db_session)

    assert res_conteo["cantidad_fisica"] == 105.0

    # Verificar KPI incrementado exactamente 1 vez
    crono_after = get_cronograma_activo(db=db_session)
    assert crono_after["kpis"]["conteos_confirmados"] == 1
    assert crono_after["kpis"]["conteos_pendientes"] + crono_after["kpis"]["conteos_atrasados"] == 2999

    # 2. Re-confirmar duplicadamente debe ser rechazado con HTTP 400
    with pytest.raises(HTTPException) as exc_info:
        registrar_conteo_fisico(conteo_req, db=db_session)
    assert exc_info.value.status_code == 400
    assert "ya fue registrado y confirmado" in exc_info.value.detail

def test_reprogramacion_sin_duplicado_semanal(db_session):
    f_today = datetime.utcnow().strftime("%Y-%m-%d")
    iniciar_nuevo_ciclo(IniciarCicloRequest(fecha_inicio=f_today), db=db_session)
    crono_res = get_cronograma_activo(db=db_session)
    item = crono_res["items"][0]

    ref_code = item["codigo_referencia"]

    # Obtener semanas donde ref_code esta asignado actualmente
    items_ref = db_session.query(CronogramaItem).filter(
        CronogramaItem.cronograma_id == crono_res["cronograma_id"],
        CronogramaItem.codigo_referencia == ref_code
    ).all()
    semanas_ocupadas = {it.semana for it in items_ref}
    semanas_libres = [s for s in range(1, 50) if s not in semanas_ocupadas]

    semana_destino = semanas_libres[0]

    # Reprogramar a semana destino libre
    req_reprog = ReprogramarRequest(cronograma_item_id=item["id"], nueva_semana=semana_destino, motivo="Cambio de turno")
    res_reprog = reprogramar_asignacion(req_reprog, db=db_session)

    assert res_reprog["nueva_semana"] == semana_destino

    # Intentar reprogramar de nuevo a una semana que YA tiene esa referencia asignada debe fallar
    otra_semana_ocupada = [s for s in semanas_ocupadas if s != item["semana"]][0]

    with pytest.raises(HTTPException) as exc_info:
        reprogramar_asignacion(ReprogramarRequest(cronograma_item_id=item["id"], nueva_semana=otra_semana_ocupada), db=db_session)
    assert exc_info.value.status_code == 400
    assert "ya está programada en la semana" in exc_info.value.detail

def test_calculo_fechas_semanales_usuario(db_session):
    fecha_user = "2026-05-11" # Lunes
    res_preview = generar_vista_previa(PreviewRequest(fecha_inicio=fecha_user), db=db_session)

    assert res_preview["fecha_inicio_seleccionada"] == fecha_user
    assert res_preview["es_valido"] is True
    assert res_preview["total_semanas_estimadas"] == 49

    res_iniciar = iniciar_nuevo_ciclo(IniciarCicloRequest(fecha_inicio=fecha_user), db=db_session)
    assert res_iniciar["fecha_inicio"] == fecha_user
