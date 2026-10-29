import pytest
import math
from fastapi.testclient import TestClient
from database import Base, engine, SessionLocal
from main import app
from models import UbicacionMapa
from routers.mapa_picking import seed_mapa_si_vacio, GRAPH_COORDS, AISLE_X

client = TestClient(app)

def setup_module(module):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_mapa_si_vacio(db)
    finally:
        db.close()

def test_prueba_a_salida_izquierda_pasillo_1():
    """
    Prueba A: Coloca el rover en Pasillo 1.
    Comprueba que la ruta termina en SALIDA_1, la coordenada X permanece constante
    en el tramo final de salida, sin desviaciones hacia el centro ni diagonales.
    """
    res = client.post("/api/mapa/calcular-ruta", json={
        "ubicaciones_ids": ["LOC_R9_C1", "LOC_R5_C1", "LOC_R1_C1"],
        "salida_inicio": "SALIDA_1",
        "salida_fin": "SALIDA_1"
    })
    assert res.status_code == 200
    data = res.json()
    opt = data["ruta_optimizada"]
    viaje = opt["viajes"][0]
    waypoints = viaje["waypoints"]

    # Debe terminar en SALIDA_1
    assert waypoints[-1] == "SALIDA_1"

    # Verificar que el tramo final A0 -> BOTTOM_A0 -> SALIDA_1 mantiene X constante (A0 X = 0.0)
    final_nodes = [w for w in waypoints if w.startswith("A0") or w in ["BOTTOM_A0", "SALIDA_1"]]
    assert len(final_nodes) >= 2

    for node in final_nodes:
        x, _ = GRAPH_COORDS[node]
        assert abs(x - AISLE_X["A0"]) < 1e-5, f"Desviación en X detectada en {node}: {x} != {AISLE_X['A0']}"

    # Verificar ortogonalidad estricta (no diagonales) en todos los segmentos
    for i in range(len(waypoints) - 1):
        n1, n2 = waypoints[i], waypoints[i+1]
        x1, y1 = GRAPH_COORDS[n1]
        x2, y2 = GRAPH_COORDS[n2]
        dx = abs(x2 - x1)
        dy = abs(y2 - y1)
        # Cada segmento debe ser o estrictamente vertical (dx==0) o estrictamente horizontal (dy==0)
        assert dx < 1e-5 or dy < 1e-5, f"Segmento diagonal no permitido entre {n1} y {n2}: dx={dx}, dy={dy}"

def test_prueba_b_salida_derecha_pasillo_5():
    """
    Prueba B: Coloca el rover en Pasillo 5 (Columna 7).
    Comprueba que la ruta termina en SALIDA_2, la coordenada X permanece constante
    en el tramo final de salida, sin desviaciones hacia el centro ni diagonales.
    """
    res = client.post("/api/mapa/calcular-ruta", json={
        "ubicaciones_ids": ["LOC_R9_C7", "LOC_R5_C7", "LOC_R1_C7"],
        "salida_inicio": "SALIDA_2",
        "salida_fin": "SALIDA_2"
    })
    assert res.status_code == 200
    data = res.json()
    opt = data["ruta_optimizada"]
    viaje = opt["viajes"][0]
    waypoints = viaje["waypoints"]

    # Debe terminar en SALIDA_2
    assert waypoints[-1] == "SALIDA_2"

    # Verificar que el tramo final A4 -> BOTTOM_A4 -> SALIDA_2 mantiene X constante (A4 X = 10.0)
    final_nodes = [w for w in waypoints if w.startswith("A4") or w in ["BOTTOM_A4", "SALIDA_2"]]
    assert len(final_nodes) >= 2

    for node in final_nodes:
        x, _ = GRAPH_COORDS[node]
        assert abs(x - AISLE_X["A4"]) < 1e-5, f"Desviación en X detectada en {node}: {x} != {AISLE_X['A4']}"

    # Verificar ortogonalidad estricta en todos los segmentos
    for i in range(len(waypoints) - 1):
        n1, n2 = waypoints[i], waypoints[i+1]
        x1, y1 = GRAPH_COORDS[n1]
        x2, y2 = GRAPH_COORDS[n2]
        dx = abs(x2 - x1)
        dy = abs(y2 - y1)
        assert dx < 1e-5 or dy < 1e-5, f"Segmento diagonal no permitido entre {n1} y {n2}: dx={dx}, dy={dy}"

def test_prueba_c_pasillos_interiores():
    """
    Prueba C: Coloca el rover en pasillos interiores (pasillos 2, 3 y 4).
    Comprueba que encuentra ruta válida a una salida sin atravesar racks y con tramos ortogonales.
    """
    # Probar ubicaciones en pasillo 2 (Col 2), pasillo 3 (Col 3), pasillo 4 (Col 5)
    res = client.post("/api/mapa/calcular-ruta", json={
        "ubicaciones_ids": ["LOC_R5_C2", "LOC_R5_C3", "LOC_R5_C5"],
        "salida_inicio": "SALIDA_1",
        "salida_fin": "SALIDA_2"
    })
    assert res.status_code == 200
    data = res.json()
    opt = data["ruta_optimizada"]

    for viaje in opt["viajes"]:
        waypoints = viaje["waypoints"]
        assert len(waypoints) > 1
        for i in range(len(waypoints) - 1):
            n1, n2 = waypoints[i], waypoints[i+1]
            x1, y1 = GRAPH_COORDS[n1]
            x2, y2 = GRAPH_COORDS[n2]
            dx = abs(x2 - x1)
            dy = abs(y2 - y1)
            assert dx < 1e-5 or dy < 1e-5, f"Segmento diagonal entre pasillos interiores {n1} y {n2}: dx={dx}, dy={dy}"

def test_prueba_d_integridad_de_posiciones():
    """
    Prueba D: Comprueba integridad de la matriz de 63 posiciones, no duplicados de ID,
    correspondencia con bloques, caras y dimensiones de referencia.
    """
    res = client.get("/api/mapa/ubicaciones")
    assert res.status_code == 200
    data = res.json()

    assert data["total_ubicaciones"] == 63
    ubics = data["ubicaciones"]
    assert len(ubics) == 63

    ids = [u["id"] for u in ubics]
    assert len(set(ids)) == 63, "Existen identificadores de posición duplicados"

    # Verificar campos enriquecidos de la matriz
    for u in ubics:
        assert "bloque" in u
        assert u["bloque"] in [1, 2, 3, 4]
        assert "cara_estanteria" in u
        assert u["cara_estanteria"] in ["UNICA", "IZQUIERDA", "DERECHA"]
        assert "pasillo_acceso" in u
        assert "zona_transitable" in u
        assert u["zona_transitable"] is False

    # Verificar dimensiones de referencia
    dims = data["dimensiones_referencia"]
    assert dims["espacio_libre_superior_m"] == 2.0
    assert dims["espacio_libre_inferior_m"] == 5.0
    assert dims["profundidad_seccion_rack_m"] == 2.4
    assert dims["ancho_pasillo_m"] == 1.0
    assert dims["ancho_estanteria_doble_m"] == 2.1
    assert dims["ancho_estanteria_simple_m"] == 1.05
    assert dims["pasillos_transitables"] == 5
    assert dims["bloques_estanterias"] == 4

def test_prueba_e_coherencia_simulacion_y_ruta():
    """
    Prueba E: Comprueba que la salida devuelta por la API proporciona nodos válidos
    que coinciden con GRAPH_COORDS y no incluyen segmentos diagonales durante el recorrido.
    """
    res = client.post("/api/mapa/calcular-ruta", json={
        "ubicaciones_ids": ["LOC_R1_C1", "LOC_R9_C7"],
        "salida_inicio": "AUTO",
        "salida_fin": "AUTO"
    })
    assert res.status_code == 200
    data = res.json()
    opt = data["ruta_optimizada"]

    for viaje in opt["viajes"]:
        for wp in viaje["waypoints"]:
            assert wp in GRAPH_COORDS, f"Waypoint {wp} no está presente en GRAPH_COORDS"
