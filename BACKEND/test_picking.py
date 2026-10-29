import pytest
from fastapi.testclient import TestClient
from database import Base, engine, SessionLocal
from main import app
from models import UbicacionMapa, ParametrosSimulacion

client = TestClient(app)

def setup_module(module):
    # Asegurar que las tablas estén creadas y con datos de semilla
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        from routers.mapa_picking import seed_mapa_si_vacio
        seed_mapa_si_vacio(db)
    finally:
        db.close()

def test_1_ubicacion_amarilla_nivel_1():
    db = SessionLocal()
    u = db.query(UbicacionMapa).filter(UbicacionMapa.id == "LOC_R1_C1").first()
    u.nivel = "NIVEL_1"
    db.commit()
    db.close()

    res = client.post("/api/mapa/calcular-ruta", json={
        "ubicaciones_ids": ["LOC_R1_C1"],
        "salida_inicio": "SALIDA_1",
        "salida_fin": "SALIDA_1",
        "velocidad_rover_ms": 1.0,
        "tiempo_pick_nivel_1_s": 15.0,
        "tiempo_pick_nivel_2_s": 45.0
    })
    assert res.status_code == 200
    data = res.json()
    opt = data["ruta_optimizada"]
    assert opt["tiempo_recogida_s"] == 15.0
    assert opt["numero_viajes"] == 1

    # Verificar instrucciones de Arduino
    instr = opt["instrucciones_arduino"]
    assert "RECOGER;NIVEL_1" in instr["comandos_texto"]
    assert "PITIDO;1" in instr["comandos_texto"]

def test_2_ubicacion_roja_nivel_2():
    db = SessionLocal()
    u = db.query(UbicacionMapa).filter(UbicacionMapa.id == "LOC_R1_C2").first()
    u.nivel = "NIVEL_2"
    db.commit()
    db.close()

    res = client.post("/api/mapa/calcular-ruta", json={
        "ubicaciones_ids": ["LOC_R1_C2"],
        "salida_inicio": "SALIDA_1",
        "salida_fin": "SALIDA_1",
        "velocidad_rover_ms": 1.0,
        "tiempo_pick_nivel_1_s": 15.0,
        "tiempo_pick_nivel_2_s": 45.0
    })
    assert res.status_code == 200
    data = res.json()
    opt = data["ruta_optimizada"]
    assert opt["tiempo_recogida_s"] == 45.0 # 3x 15s

    instr = opt["instrucciones_arduino"]
    assert "RECOGER;NIVEL_2" in instr["comandos_texto"]
    assert "PITIDO;2" in instr["comandos_texto"]

def test_3_ubicacion_naranja_ambos_niveles():
    db = SessionLocal()
    u = db.query(UbicacionMapa).filter(UbicacionMapa.id == "LOC_R1_C3").first()
    u.nivel = "AMBOS"
    db.commit()
    db.close()

    res = client.post("/api/mapa/calcular-ruta", json={
        "ubicaciones_ids": ["LOC_R1_C3"],
        "salida_inicio": "SALIDA_1",
        "salida_fin": "SALIDA_1",
        "velocidad_rover_ms": 1.0,
        "tiempo_pick_nivel_1_s": 15.0,
        "tiempo_pick_nivel_2_s": 45.0
    })
    assert res.status_code == 200
    data = res.json()
    opt = data["ruta_optimizada"]
    assert opt["tiempo_recogida_s"] == 60.0 # 15s + 45s = 60s

    instr = opt["instrucciones_arduino"]
    # Debe contener 2 operaciones de recogida y patrón con pausa breve
    assert "RECOGER;NIVEL_1" in instr["comandos_texto"]
    assert "RECOGER;NIVEL_2" in instr["comandos_texto"]
    assert "PAUSA;0.5" in instr["comandos_texto"]

def test_4_tres_ubicaciones_un_viaje():
    res = client.post("/api/mapa/calcular-ruta", json={
        "ubicaciones_ids": ["LOC_R1_C1", "LOC_R1_C2", "LOC_R1_C3"],
        "salida_inicio": "SALIDA_1",
        "salida_fin": "SALIDA_1"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["ruta_optimizada"]["numero_viajes"] == 1

def test_5_cuatro_ubicaciones_dos_viajes():
    res = client.post("/api/mapa/calcular-ruta", json={
        "ubicaciones_ids": ["LOC_R1_C1", "LOC_R1_C2", "LOC_R1_C3", "LOC_R1_C4"],
        "salida_inicio": "SALIDA_1",
        "salida_fin": "SALIDA_1"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["ruta_optimizada"]["numero_viajes"] == 2
    assert len(data["ruta_optimizada"]["viajes"][0]["pasos"]) > 0
    assert len(data["ruta_optimizada"]["viajes"][1]["pasos"]) > 0

def test_6_diferentes_salidas():
    res_mismasalida = client.post("/api/mapa/calcular-ruta", json={
        "ubicaciones_ids": ["LOC_R1_C1", "LOC_R1_C7"],
        "salida_inicio": "SALIDA_1",
        "salida_fin": "SALIDA_1"
    }).json()

    res_diferentesalida = client.post("/api/mapa/calcular-ruta", json={
        "ubicaciones_ids": ["LOC_R1_C1", "LOC_R1_C7"],
        "salida_inicio": "SALIDA_1",
        "salida_fin": "SALIDA_2"
    }).json()

    # Distancias deben ser diferentes cuando la salida final cambia de SALIDA_1 a SALIDA_2
    dist_1 = res_mismasalida["ruta_optimizada"]["distancia_total_m"]
    dist_2 = res_diferentesalida["ruta_optimizada"]["distancia_total_m"]
    assert dist_1 != dist_2

def test_7_optimizacion_de_recorrido():
    # Probar que la ruta optimizada no es peor que la inicial
    res = client.post("/api/mapa/calcular-ruta", json={
        "ubicaciones_ids": ["LOC_R9_C1", "LOC_R1_C1", "LOC_R9_C2"],
        "salida_inicio": "SALIDA_1",
        "salida_fin": "SALIDA_1"
    }).json()

    t_inicial = res["ruta_inicial"]["tiempo_total_s"]
    t_opt = res["ruta_optimizada"]["tiempo_total_s"]
    assert t_opt <= t_inicial

def test_8_ubicaciones_duplicadas_22_35():
    # LOC_R2_C3 tiene código visible 22; LOC_R3_C4 tiene código visible 22
    # LOC_R9_C3 tiene código visible 35; LOC_R9_C5 tiene código visible 35
    res = client.post("/api/mapa/calcular-ruta", json={
        "ubicaciones_ids": ["LOC_R2_C3", "LOC_R3_C4", "LOC_R9_C3", "LOC_R9_C5"],
        "salida_inicio": "SALIDA_1",
        "salida_fin": "SALIDA_1"
    })
    assert res.status_code == 200
    data = res.json()
    opt = data["ruta_optimizada"]
    despacho_ids = [task["ubicacion_id"] for task in opt["lista_despacho"]]
    assert "LOC_R2_C3" in despacho_ids
    assert "LOC_R3_C4" in despacho_ids
    assert "LOC_R9_C3" in despacho_ids
    assert "LOC_R9_C5" in despacho_ids

def test_10_coincidencia_instrucciones_arduino():
    res = client.post("/api/mapa/calcular-ruta", json={
        "ubicaciones_ids": ["LOC_R2_C1", "LOC_R2_C2"],
        "salida_inicio": "SALIDA_1",
        "salida_fin": "SALIDA_2"
    }).json()

    instr = res["ruta_optimizada"]["instrucciones_arduino"]
    assert "INICIAR_VIAJE;1;SALIDA_1" in instr["comandos_texto"]
    assert "REGRESAR;SALIDA_2" in instr["comandos_texto"]
    assert len(instr["pasos"]) > 0

def test_11_geometria_cinco_pasillos_y_seleccion_auto_salida():
    # 1. Verificar endpoint de ubicaciones para total de 63 posiciones y 5 pasillos
    res = client.get("/api/mapa/ubicaciones").json()
    assert res["total_ubicaciones"] == 63

    # Verificar que cada posición tiene ID único y que los duplicados 22 y 35 están marcados
    ubics = res["ubicaciones"]
    ids = set(u["id"] for u in ubics)
    assert len(ids) == 63

    dup_22 = [u for u in ubics if u["codigo_visible"] == "22" and u["es_duplicado"]]
    dup_35 = [u for u in ubics if u["codigo_visible"] == "35" and u["es_duplicado"]]
    assert len(dup_22) > 0
    assert len(dup_35) > 0

    # 2. Selección automática de salida (modo AUTO)
    res_auto = client.post("/api/mapa/calcular-ruta", json={
        "ubicaciones_ids": ["LOC_R1_C7"], # Ubicación en la extrema derecha (columna 7)
        "salida_inicio": "AUTO",
        "salida_fin": "AUTO"
    }).json()

    # Para una ubicación en la columna 7 (derecha), la mejor salida elegida automáticamente debe ser SALIDA_2
    assert res_auto["salida_inicio"] == "SALIDA_2"
    assert res_auto["salida_fin"] == "SALIDA_2"

def test_12_ubicaciones_sin_nivel_blancas():
    db = SessionLocal()
    u = db.query(UbicacionMapa).filter(UbicacionMapa.id == "LOC_R5_C5").first()
    u.nivel = "SIN_NIVEL"
    db.commit()
    db.close()

    res = client.get("/api/mapa/ubicaciones").json()
    u_data = next(x for x in res["ubicaciones"] if x["id"] == "LOC_R5_C5")
    assert u_data["nivel"] == "SIN_NIVEL"
