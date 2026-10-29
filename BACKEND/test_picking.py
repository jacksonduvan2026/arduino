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
    # Amarillo = solo nivel N1, tiempo de recogida de 3t (3 * 15s = 45s)
    assert opt["tiempo_recogida_t"] == 3.0
    assert opt["tiempo_recogida_s"] == 45.0
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
    # Rojo = solo nivel N2, tiempo de recogida de 1t (1 * 15s = 15s)
    assert opt["tiempo_recogida_t"] == 1.0
    assert opt["tiempo_recogida_s"] == 15.0

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
    # Naranja = requiere N1 y N2 como una sola operación lógica de 4t (4 * 15s = 60s)
    assert opt["tiempo_recogida_t"] == 4.0
    assert opt["tiempo_recogida_s"] == 60.0

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

def test_13_regla_tiempos_recogida_t_y_validacion_referencia():
    # Probar las reglas obligatorias de picking:
    # Rojo: solo nivel N2, tiempo de recogida de 1t.
    # Amarillo: solo nivel N1, tiempo de recogida de 3t.
    # Naranja: requiere N1 y N2 como una sola operación lógica de 4t.
    from routers.mapa_picking import calcular_costo_recogida_t
    c1 = calcular_costo_recogida_t("AMARILLO", "NIVEL_1")
    assert c1["tiempo_t"] == 3.0
    assert c1["advertencia"] is None

    c2 = calcular_costo_recogida_t("ROJO", "NIVEL_2")
    assert c2["tiempo_t"] == 1.0
    assert c2["advertencia"] is None

    c3 = calcular_costo_recogida_t("NARANJA", "AMBOS")
    assert c3["tiempo_t"] == 4.0
    assert c3["advertencia"] is None

    # Advertencias de descalificación o desajuste de nivel/categoría
    c_invalid = calcular_costo_recogida_t("ROJO", "NIVEL_1")
    assert c_invalid["tiempo_t"] == 1.0
    assert c_invalid["advertencia"] is not None

    c_sin_nivel = calcular_costo_recogida_t(None, "SIN_NIVEL")
    assert c_sin_nivel["advertencia"] is not None

    # Probar endpoint calcular-ruta con 9 ubicaciones únicas que identifican el pedido de referencia
    res = client.post("/api/mapa/calcular-ruta", json={
        "ubicaciones_ids": ["LOC_R8_C7", "LOC_R3_C7", "LOC_R6_C6", "LOC_R5_C5", "LOC_R2_C6", "LOC_R4_C3", "LOC_R2_C4", "LOC_R6_C2", "LOC_R8_C1"],
        "salida_inicio": "SALIDA_1",
        "salida_fin": "SALIDA_1",
        "velocidad_rover_ms": 1.0,
        "tiempo_pick_nivel_1_s": 1.0,
        "tiempo_pick_nivel_2_s": 3.0
    }).json()

    assert "validacion_referencia" in res
    ref_info = res["validacion_referencia"]["referencia_documentada"]
    assert ref_info["distancia_m"] == 185.1
    assert ref_info["tiempo_recogida_t"] == 20.0
    assert ref_info["numero_viajes"] == 4

    opt = res["ruta_optimizada"]
    assert opt["numero_viajes"] == 4
    assert len(opt["lista_despacho"]) == 12
    assert opt["tiempo_recogida_t"] == 20.0

    dif = res["validacion_referencia"]["diferencias"]
    assert dif["diferencia_distancia_abs_m"] > 0
    assert "explicacion_discrepancia" in dif

def test_14_pedido_referencia_12_lineas_4_viajes():
    # Petición con las 12 líneas de recogida del pedido de referencia documentado
    res = client.post("/api/mapa/calcular-ruta", json={
        "lineas": [
            {"ubicacion_id": "LOC_R8_C7", "nivel": "NIVEL_1"},
            {"ubicacion_id": "LOC_R8_C7", "nivel": "NIVEL_1"},
            {"ubicacion_id": "LOC_R3_C7", "nivel": "NIVEL_2"},
            {"ubicacion_id": "LOC_R6_C6", "nivel": "NIVEL_2"},
            {"ubicacion_id": "LOC_R5_C5", "nivel": "NIVEL_2"},
            {"ubicacion_id": "LOC_R2_C6", "nivel": "NIVEL_2"},
            {"ubicacion_id": "LOC_R4_C3", "nivel": "NIVEL_1"},
            {"ubicacion_id": "LOC_R4_C3", "nivel": "NIVEL_2"},
            {"ubicacion_id": "LOC_R2_C4", "nivel": "NIVEL_2"},
            {"ubicacion_id": "LOC_R6_C2", "nivel": "NIVEL_2"},
            {"ubicacion_id": "LOC_R8_C1", "nivel": "NIVEL_1"},
            {"ubicacion_id": "LOC_R8_C1", "nivel": "NIVEL_2"}
        ],
        "salida_inicio": "SALIDA_1",
        "salida_fin": "SALIDA_1",
        "velocidad_rover_ms": 1.0,
        "tiempo_pick_nivel_1_s": 1.0,
        "tiempo_pick_nivel_2_s": 3.0
    })
    assert res.status_code == 200
    data = res.json()
    opt = data["ruta_optimizada"]

    # Verificar que el resultado de la ruta produce exactamente 4 viajes, 12 líneas y 20t
    assert opt["numero_viajes"] == 4
    assert len(opt["lista_despacho"]) == 12
    assert opt["tiempo_recogida_t"] == 20.0

    # Verificar los cuatro grupos de viaje establecidos en la documentación
    grupos_esperados = [
        ["60", "60", "55"],
        ["41", "44", "49"],
        ["25", "25", "21"],
        ["7", "4", "4"]
    ]

    for idx, v in enumerate(opt["viajes"]):
        pos_obtenidas = [p["codigo_ubicacion"] for p in v["pasos"] if p["tipo"] == "RECOGIDA"]
        assert pos_obtenidas == grupos_esperados[idx]

    # Comprobar tiempos t individuales por viaje
    assert opt["viajes"][0]["tiempo_recogida_t"] == 7.0
    assert opt["viajes"][1]["tiempo_recogida_t"] == 3.0
    assert opt["viajes"][2]["tiempo_recogida_t"] == 5.0
    assert opt["viajes"][3]["tiempo_recogida_t"] == 5.0
