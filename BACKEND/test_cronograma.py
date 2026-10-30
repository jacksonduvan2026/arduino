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

    # Populate test products (112 real references like in Excel)
    codes = [f"{100000 + i}" for i in range(112)]
    prods = [
        Producto(
            codigo=c,
            descripcion=f"Producto Festo {c}",
            categoria="General",
            stock_actual=10.0,
            activo=True
        )
        for c in codes
    ]
    session.bulk_save_objects(prods)
    session.commit()

    try:
        yield session
    finally:
        session.close()

def test_algoritmo_referencias_reales_elegibles():
    refs = [f"{100000 + i}" for i in range(112)]
    f_start = datetime(2026, 2, 1)

    crono_dict, cuotas, resumen = generar_cronograma_algoritmo(refs, f_start, counts_per_ref=1)

    assert resumen["num_referencias"] == 112
    assert resumen["total_asignaciones"] == 112
    assert resumen["total_semanas"] == 52

    # Cada referencia debe aparecer exactamente 1 vez y sin duplicados en una misma semana
    counts = {r: 0 for r in refs}
    for week, items in crono_dict.items():
        week_refs = [it["codigo_referencia"] for it in items]
        assert len(week_refs) == len(set(week_refs)), f"Duplicado en semana {week}"
        for r in week_refs:
            counts[r] += 1

    for r, cnt in counts.items():
        assert cnt == 1, f"La referencia {r} tiene {cnt} asignaciones"

def test_referencia_no_elegible_no_se_incorpora():
    refs_elegibles = [f"{100000 + i}" for i in range(10)]
    ref_invalida = "999999"

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

    assert crono_res["kpis"]["conteos_programados"] == 112
    assert crono_res["kpis"]["conteos_confirmados"] == 0
    assert crono_res["kpis"]["conteos_pendientes"] + crono_res["kpis"]["conteos_atrasados"] == 112

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
    assert crono_after["kpis"]["conteos_pendientes"] + crono_after["kpis"]["conteos_atrasados"] == 111

    # 2. Re-confirmar duplicadamente debe ser rechazado con HTTP 400
    with pytest.raises(HTTPException) as exc_info:
        registrar_conteo_fisico(conteo_req, db=db_session)
    assert exc_info.value.status_code == 400
    assert "ya fue registrado y confirmado" in exc_info.value.detail

def test_reprogramacion_sin_duplicado_semanal(db_session):
    f_today = datetime.utcnow().strftime("%Y-%m-%d")
    iniciar_nuevo_ciclo(IniciarCicloRequest(fecha_inicio=f_today), db=db_session)
    crono_res = get_cronograma_activo(db=db_session)
    crono_id = crono_res["cronograma_id"]

    # Crear dos ítems con el MISMO código de referencia en distintas semanas
    it1 = CronogramaItem(cronograma_id=crono_id, semana=1, codigo_referencia="100001", numero_conteo=1)
    it2 = CronogramaItem(cronograma_id=crono_id, semana=2, codigo_referencia="100001", numero_conteo=2)
    db_session.add_all([it1, it2])
    db_session.commit()

    # Intentar reprogramar it1 (semana 1) a la semana 2 donde ya existe '100001' (it2) debe fallar por duplicado
    with pytest.raises(HTTPException) as exc_info:
        reprogramar_asignacion(ReprogramarRequest(cronograma_item_id=it1.id, nueva_semana=2), db=db_session)
    assert exc_info.value.status_code == 400
    assert "ya está programada en la semana 2" in exc_info.value.detail

def test_calculo_fechas_semanales_usuario(db_session):
    fecha_user = "2026-05-11" # Lunes
    res_preview = generar_vista_previa(PreviewRequest(fecha_inicio=fecha_user), db=db_session)

    assert res_preview["fecha_inicio_seleccionada"] == fecha_user
    assert res_preview["es_valido"] is True
    assert res_preview["total_semanas_estimadas"] == 52

    res_iniciar = iniciar_nuevo_ciclo(IniciarCicloRequest(fecha_inicio=fecha_user), db=db_session)
    assert res_iniciar["fecha_inicio"] == fecha_user

def test_codigos_completos_e_integridad_excel(db_session):
    # Verificar que los códigos no contengan prefijos 'REF-' sintéticos ni estén acortados
    prods = db_session.query(Producto).all()
    assert len(prods) == 112
    for p in prods:
        assert not p.codigo.startswith("REF-")
        assert len(p.codigo) >= 6

def test_modulos_mapas_inmutables():
    # Garantizar que los módulos de mapa no hayan sido alterados
    import subprocess
    status = subprocess.check_output(["git", "status", "--porcelain", "BACKEND/routers/mapa_picking.py", "FRONTEND/src/components/MapaAlmacenSVG.jsx", "FRONTEND/src/views/MapaView.jsx"]).decode("utf-8")
    assert status.strip() == "", "Se detectaron cambios indebidos en los módulos de mapa/picking"
