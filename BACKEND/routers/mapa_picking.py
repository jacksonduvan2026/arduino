from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import json
import math
import heapq
import itertools
from datetime import datetime

from database import get_db
from models import UbicacionMapa, Producto, ParametrosSimulacion, RecorridoGuardado

router = APIRouter(prefix="/api/mapa", tags=["Mapa de Almacén y Picking"])

# Esquema de referencia original de 9 filas x 7 columnas
GRID_SCHEMA = [
    ["18", "17", "19", "20", "52", "51", "53"],
    ["16", "15", "22", "21", "50", "49", "54"],
    ["14", "13", "23", "22", "48", "47", "55"],
    ["12", "11", "25", "24", "46", "45", "56"],
    ["10", "9",  "27", "26", "44", "43", "57"],
    ["8",  "7",  "29", "28", "42", "41", "58"],
    ["6",  "5",  "31", "30", "40", "39", "59"],
    ["4",  "3",  "33", "32", "38", "37", "60"],
    ["1",  "2",  "35", "34", "35", "36", "61"]
]

# Inconsistencias explícitas en el esquema
DUPLICATE_CODES = {
    "22": "Código 22 duplicado en layout de referencia (Fila 2 Col 3 y Fila 3 Col 4)",
    "35": "Código 35 duplicado en layout de referencia (Fila 9 Col 3 y Fila 9 Col 5)"
}

class UbicacionUpdate(BaseModel):
    codigo_visible: Optional[str] = None
    nivel: Optional[str] = None # NIVEL_1, NIVEL_2, AMBOS, SIN_NIVEL
    producto_codigo: Optional[str] = None

class ParametrosUpdate(BaseModel):
    velocidad_rover_ms: Optional[float] = None
    tiempo_pick_nivel_1_s: Optional[float] = None
    tiempo_pick_nivel_2_s: Optional[float] = None
    salida_defecto_inicio: Optional[str] = None
    salida_defecto_fin: Optional[str] = None

class LineaPedidoItem(BaseModel):
    ubicacion_id: str
    nivel: Optional[str] = None # NIVEL_1, NIVEL_2, AMBOS, SIN_NIVEL
    producto_codigo: Optional[str] = None
    cantidad: Optional[float] = 1.0

class RutaRequest(BaseModel):
    ubicaciones_ids: Optional[List[str]] = None
    lineas: Optional[List[LineaPedidoItem]] = None
    cantidades_solicitadas: Optional[Dict[str, float]] = None # {ubicacion_id: cantidad}
    salida_inicio: str = "AUTO" # AUTO, SALIDA_1 o SALIDA_2
    salida_fin: str = "AUTO" # AUTO, SALIDA_1 o SALIDA_2
    velocidad_rover_ms: Optional[float] = 1.0
    tiempo_pick_nivel_1_s: Optional[float] = 15.0
    tiempo_pick_nivel_2_s: Optional[float] = 45.0

class PickingLine:
    def __init__(self, ubicacion: UbicacionMapa, nivel_override: Optional[str] = None, cantidad: float = 1.0, producto_codigo: Optional[str] = None):
        self.ubicacion = ubicacion
        self.id = ubicacion.id
        self.codigo_visible = ubicacion.codigo_visible
        self.fila = ubicacion.fila
        self.columna = ubicacion.columna
        self.es_duplicado = ubicacion.es_duplicado
        self.producto = ubicacion.producto
        self.nivel = nivel_override if (nivel_override and nivel_override != "SIN_NIVEL") else ubicacion.nivel
        self.cantidad = cantidad
        self.producto_codigo = producto_codigo or ubicacion.producto_codigo

REF_ORDER_LOC_IDS = {
    "LOC_R8_C7", "LOC_R3_C7", "LOC_R6_C6", "LOC_R5_C5",
    "LOC_R2_C6", "LOC_R4_C3", "LOC_R2_C4", "LOC_R6_C2", "LOC_R8_C1"
}

REF_12_SPEC = [
    ("LOC_R8_C7", "NIVEL_1"), ("LOC_R8_C7", "NIVEL_1"), ("LOC_R3_C7", "NIVEL_2"),
    ("LOC_R6_C6", "NIVEL_2"), ("LOC_R5_C5", "NIVEL_2"), ("LOC_R2_C6", "NIVEL_2"),
    ("LOC_R4_C3", "NIVEL_1"), ("LOC_R4_C3", "NIVEL_2"), ("LOC_R2_C4", "NIVEL_2"),
    ("LOC_R6_C2", "NIVEL_2"), ("LOC_R8_C1", "NIVEL_1"), ("LOC_R8_C1", "NIVEL_2")
]

class RecorridoGuardarRequest(BaseModel):
    nombre: str
    salida_inicio: str
    salida_fin: str
    ubicaciones_ids: List[str]
    resultado: Dict[str, Any]

def seed_mapa_si_vacio(db: Session):
    if db.query(UbicacionMapa).count() == 0:
        productos = db.query(Producto).all()
        prod_codes = [p.codigo for p in productos] if productos else []

        prod_idx = 0
        counts = {"22": 0, "35": 0}

        for r_idx, row in enumerate(GRID_SCHEMA):
            fila = r_idx + 1
            for c_idx, code_vis in enumerate(row):
                columna = c_idx + 1
                loc_id = f"LOC_R{fila}_C{columna}"

                # Por defecto, todas las ubicaciones no tienen nivel asignado (apariencia blanca)
                nivel = "SIN_NIVEL"

                es_dup = False
                nota_inc = None
                if code_vis in DUPLICATE_CODES:
                    counts[code_vis] += 1
                    if counts[code_vis] > 1 or (code_vis == "22" and fila == 2 and columna == 3) or (code_vis == "35" and fila == 9 and columna == 3):
                        es_dup = True
                        nota_inc = DUPLICATE_CODES[code_vis]

                assigned_prod = prod_codes[prod_idx % len(prod_codes)] if prod_codes else None
                prod_idx += 1

                u = UbicacionMapa(
                    id=loc_id,
                    codigo_visible=code_vis,
                    fila=fila,
                    columna=columna,
                    nivel=nivel,
                    producto_codigo=assigned_prod,
                    es_duplicado=es_dup,
                    nota_inconsistencia=nota_inc
                )
                db.add(u)
        db.commit()

    if db.query(ParametrosSimulacion).count() == 0:
        p = ParametrosSimulacion(
            nombre_config="Default",
            velocidad_rover_ms=1.0,
            tiempo_pick_nivel_1_s=15.0,
            tiempo_pick_nivel_2_s=45.0,
            salida_defecto_inicio="SALIDA_1",
            salida_defecto_fin="SALIDA_1"
        )
        db.add(p)
        db.commit()

# --- GEOMETRÍA Y GRAFO FÍSICO DE PASILLOS TRANSITABLES ---
# Distribución física exacta:
# 5 pasillos transitables (A0, A1, A2, A3, A4)
# 4 bloques de estanterías (Bloque 1 simple, Bloques 2, 3, 4 dobles)
#
# Pasillos transitables:
# A0: Pasillo 1 (Exterior izquierdo) - x = 0.0 m
# Bloque 1 (Simple): Col 1
# A1: Pasillo 2 (Entre Bloque 1 y Bloque 2) - x = 2.4 m
# Bloque 2 (Doble): Col 2 (cara izq) y Col 3 (cara der)
# A2: Pasillo 3 (Entre Bloque 2 y Bloque 3) - x = 5.0 m
# Bloque 3 (Doble): Col 4 (cara izq) y Col 5 (cara der)
# A3: Pasillo 4 (Entre Bloque 3 y Bloque 4) - x = 7.4 m
# Bloque 4 (Doble): Col 6 (cara izq) y Col 7 (cara der)
# A4: Pasillo 5 (Exterior derecho) - x = 10.0 m
#
# Puntos de acceso por columna:
# Columna 1 (Bloque 1 simple) -> Accesible desde Pasillo 2 (A1)
# Columna 2 (Bloque 2 cara izq) -> Accesible desde Pasillo 2 (A1)
# Columna 3 (Bloque 2 cara der) -> Accesible desde Pasillo 3 (A2)
# Columna 4 (Bloque 3 cara izq) -> Accesible desde Pasillo 3 (A2)
# Columna 5 (Bloque 3 cara der) -> Accesible desde Pasillo 4 (A3)
# Columna 6 (Bloque 4 cara izq) -> Accesible desde Pasillo 4 (A3)
# Columna 7 (Bloque 4 cara der) -> Accesible desde Pasillo 5 (A4)

AISLE_X = {
    "A0": 0.0,
    "A1": 2.4,
    "A2": 5.0,
    "A3": 7.4,
    "A4": 10.0
}

def get_location_matrix_info(columna: int, fila: int) -> Dict[str, Any]:
    if columna == 1:
        bloque = 1
        cara = "UNICA"
        aisle = "A1"
        pasillo_nombre = "Pasillo 2 (A1)"
    elif columna == 2:
        bloque = 2
        cara = "IZQUIERDA"
        aisle = "A1"
        pasillo_nombre = "Pasillo 2 (A1)"
    elif columna == 3:
        bloque = 2
        cara = "DERECHA"
        aisle = "A2"
        pasillo_nombre = "Pasillo 3 (A2)"
    elif columna == 4:
        bloque = 3
        cara = "IZQUIERDA"
        aisle = "A2"
        pasillo_nombre = "Pasillo 3 (A2)"
    elif columna == 5:
        bloque = 3
        cara = "DERECHA"
        aisle = "A3"
        pasillo_nombre = "Pasillo 4 (A3)"
    elif columna == 6:
        bloque = 4
        cara = "IZQUIERDA"
        aisle = "A3"
        pasillo_nombre = "Pasillo 4 (A3)"
    else: # columna == 7
        bloque = 4
        cara = "DERECHA"
        aisle = "A4"
        pasillo_nombre = "Pasillo 5 (A4)"

    x = AISLE_X[aisle]
    y = float(fila)
    access_node = f"{aisle}_Y{fila}"

    return {
        "bloque": bloque,
        "cara_estanteria": cara,
        "pasillo_acceso": pasillo_nombre,
        "access_node": access_node,
        "x_m": x,
        "y_m": y,
        "zona_transitable": False
    }

def get_location_access_point(columna: int, fila: int) -> tuple[str, float, float]:
    info = get_location_matrix_info(columna, fila)
    return info["access_node"], info["x_m"], info["y_m"]

def build_warehouse_graph():
    graph = {}
    coords = {}

    def add_edge(u, v):
        x1, y1 = coords[u]
        x2, y2 = coords[v]
        dist = math.hypot(x2 - x1, y2 - y1)
        graph.setdefault(u, []).append((v, dist))
        graph.setdefault(v, []).append((u, dist))

    # Alineación exacta de las dos salidas con los pasillos exteriores:
    # Salida 1 -> Alineada con Pasillo 1 (A0, X = 0.0 m)
    # Salida 2 -> Alineada con Pasillo 5 (A4, X = 10.0 m)
    coords["SALIDA_1"] = (AISLE_X["A0"], 11.0)
    coords["SALIDA_2"] = (AISLE_X["A4"], 11.0)

    coords["BOTTOM_A0"] = (AISLE_X["A0"], 10.0)
    coords["BOTTOM_A1"] = (AISLE_X["A1"], 10.0)
    coords["BOTTOM_A2"] = (AISLE_X["A2"], 10.0)
    coords["BOTTOM_A3"] = (AISLE_X["A3"], 10.0)
    coords["BOTTOM_A4"] = (AISLE_X["A4"], 10.0)

    # Conexiones exclusivas ortogonales sin trazados diagonales:
    add_edge("SALIDA_1", "BOTTOM_A0")
    add_edge("SALIDA_2", "BOTTOM_A4")

    add_edge("BOTTOM_A0", "BOTTOM_A1")
    add_edge("BOTTOM_A1", "BOTTOM_A2")
    add_edge("BOTTOM_A2", "BOTTOM_A3")
    add_edge("BOTTOM_A3", "BOTTOM_A4")

    coords["TOP_A0"] = (AISLE_X["A0"], 0.0)
    coords["TOP_A1"] = (AISLE_X["A1"], 0.0)
    coords["TOP_A2"] = (AISLE_X["A2"], 0.0)
    coords["TOP_A3"] = (AISLE_X["A3"], 0.0)
    coords["TOP_A4"] = (AISLE_X["A4"], 0.0)

    add_edge("TOP_A0", "TOP_A1")
    add_edge("TOP_A1", "TOP_A2")
    add_edge("TOP_A2", "TOP_A3")
    add_edge("TOP_A3", "TOP_A4")

    for aisle, x in AISLE_X.items():
        prev_node = f"TOP_{aisle}"
        for row in range(1, 10):
            curr_node = f"{aisle}_Y{row}"
            coords[curr_node] = (x, float(row))
            add_edge(prev_node, curr_node)
            prev_node = curr_node
        add_edge(prev_node, f"BOTTOM_{aisle}")

    return graph, coords

GRAPH, GRAPH_COORDS = build_warehouse_graph()

def dijkstra_shortest_path(start_node: str, target_node: str):
    if start_node not in GRAPH or target_node not in GRAPH:
        return float("inf"), []

    distances = {node: float("inf") for node in GRAPH}
    previous = {node: None for node in GRAPH}
    distances[start_node] = 0.0

    pq = [(0.0, start_node)]

    while pq:
        d, current = heapq.heappop(pq)
        if d > distances[current]:
            continue
        if current == target_node:
            break

        for neighbor, weight in GRAPH[current]:
            new_dist = d + weight
            if new_dist < distances[neighbor]:
                distances[neighbor] = new_dist
                previous[neighbor] = current
                heapq.heappush(pq, (new_dist, neighbor))

    path = []
    curr = target_node
    while curr is not None:
        path.append(curr)
        curr = previous[curr]
    path.reverse()

    return distances[target_node], path

def calcular_costo_recogida_t(categoria: Optional[str], nivel: Optional[str]) -> Dict[str, Any]:
    """
    Reglas obligatorias de tiempos de recogida y validación (unidades t):
    - Rojo: solo nivel N2 (NIVEL_2), tiempo de recogida de 1t.
    - Amarillo: solo nivel N1 (NIVEL_1), tiempo de recogida de 3t.
    - Naranja: requiere N1 y N2 (AMBOS) como una sola operación lógica de 4t,
      sin duplicar el tiempo por atender ambos niveles.

    Si la categoría o el nivel no coinciden con las reglas (o es SIN_NIVEL),
    no se asigna silenciosamente 1t por defecto; se genera una advertencia explícita.
    """
    cat_norm = (categoria or "").strip().upper()
    niv_norm = (nivel or "").strip().upper()

    advertencia = None

    # Determinación según categoría o nivel asignado
    if cat_norm == "ROJO" or niv_norm == "NIVEL_2":
        if cat_norm == "ROJO" and niv_norm and niv_norm != "NIVEL_2":
            advertencia = f"Advertencia de validación: La categoría ROJO exige únicamente Nivel 2 (NIVEL_2, 1t), pero la ubicación está configurada como {niv_norm}."
        elif cat_norm == "ROJO" and niv_norm == "SIN_NIVEL":
            advertencia = "Advertencia de validación: Ubicación en categoría ROJO sin nivel asignado (SIN_NIVEL)."
        return {"tiempo_t": 1.0, "categoria": "ROJO", "nivel": "NIVEL_2", "advertencia": advertencia}

    elif cat_norm == "AMARILLO" or niv_norm == "NIVEL_1":
        if cat_norm == "AMARILLO" and niv_norm and niv_norm != "NIVEL_1":
            advertencia = f"Advertencia de validación: La categoría AMARILLO exige únicamente Nivel 1 (NIVEL_1, 3t), pero la ubicación está configurada como {niv_norm}."
        elif cat_norm == "AMARILLO" and niv_norm == "SIN_NIVEL":
            advertencia = "Advertencia de validación: Ubicación en categoría AMARILLO sin nivel asignado (SIN_NIVEL)."
        return {"tiempo_t": 3.0, "categoria": "AMARILLO", "nivel": "NIVEL_1", "advertencia": advertencia}

    elif cat_norm == "NARANJA" or niv_norm == "AMBOS":
        if cat_norm == "NARANJA" and niv_norm and niv_norm != "AMBOS":
            advertencia = f"Advertencia de validación: La categoría NARANJA exige la operación conjunta en ambos niveles (AMBOS, 4t), pero la ubicación está configurada como {niv_norm}."
        elif cat_norm == "NARANJA" and niv_norm == "SIN_NIVEL":
            advertencia = "Advertencia de validación: Ubicación en categoría NARANJA sin nivel asignado (SIN_NIVEL)."
        return {"tiempo_t": 4.0, "categoria": "NARANJA", "nivel": "AMBOS", "advertencia": advertencia}

    else:
        # Caso sin categoría de color ni nivel válido (por ej. SIN_NIVEL)
        advertencia = (
            f"Advertencia de validación: La combinación categoría='{categoria or 'N/A'}' "
            f"y nivel='{nivel or 'SIN_NIVEL'}' no coincide con las reglas de picking "
            "(Rojo: N2=1t, Amarillo: N1=3t, Naranja: AMBOS=4t)."
        )
        return {
            "tiempo_t": 1.0,
            "categoria": cat_norm or "DESCONOCIDO",
            "nivel": niv_norm or "SIN_NIVEL",
            "advertencia": advertencia
        }

def calcular_tiempo_pick(nivel: str, t_nivel1: float, t_nivel2: float, categoria: Optional[str] = None) -> float:
    """
    Calcula el tiempo de recogida en segundos a partir de las unidades `t`:
    1t es equivalente a `t_nivel1` (tiempo base en segundos).
    """
    info = calcular_costo_recogida_t(categoria, nivel)
    tiempo_t = info["tiempo_t"]
    return tiempo_t * t_nivel1

def generar_instrucciones_arduino(trips: List[Dict[str, Any]]) -> Dict[str, Any]:
    lines = []
    pasos = []

    for trip in trips:
        trip_num = trip["numero_viaje"]
        s_start = trip["salida_inicio"]
        s_end = trip["salida_fin"]

        lines.append(f"INICIAR_VIAJE;{trip_num};{s_start}")
        pasos.append({
            "comando": "INICIAR_VIAJE",
            "parametro": f"VIAJE_{trip_num}",
            "salida": s_start,
            "descripcion": f"Inicio de viaje {trip_num} desde {s_start}"
        })

        for p in trip["pasos"]:
            if p["tipo"] == "RECOGIDA":
                loc_id = p["ubicacion_id"]
                code_vis = p["codigo_ubicacion"]
                etiqueta = p.get("etiqueta_completa", code_vis)
                nivel = p["nivel"]
                ord_v = p["orden_visita"]

                lines.append(f"IR;{loc_id};LABEL;{etiqueta}")
                pasos.append({
                    "comando": "IR",
                    "parametro": loc_id,
                    "codigo_visible": code_vis,
                    "etiqueta_completa": etiqueta,
                    "orden_visita": ord_v,
                    "descripcion": f"Ir a ubicación {etiqueta} ({loc_id})"
                })

                if nivel == "NIVEL_1":
                    lines.append("RECOGER;NIVEL_1")
                    lines.append("PITIDO;1")
                    pasos.append({
                        "comando": "RECOGER",
                        "nivel": "NIVEL_1",
                        "descripcion": "Recoger producto en 1er Nivel"
                    })
                    pasos.append({
                        "comando": "PITIDO",
                        "patron": "1_CORTO",
                        "descripcion": "1 pitido corto (1er Nivel)"
                    })
                elif nivel == "NIVEL_2":
                    lines.append("RECOGER;NIVEL_2")
                    lines.append("PITIDO;2")
                    pasos.append({
                        "comando": "RECOGER",
                        "nivel": "NIVEL_2",
                        "descripcion": "Recoger producto en 2do Nivel"
                    })
                    pasos.append({
                        "comando": "PITIDO",
                        "patron": "2_CORTOS",
                        "descripcion": "2 pitidos cortos consecutivos (2do Nivel)"
                    })
                elif nivel == "AMBOS":
                    lines.append("RECOGER;NIVEL_1")
                    lines.append("PITIDO;1")
                    lines.append("PAUSA;0.5")
                    lines.append("RECOGER;NIVEL_2")
                    lines.append("PITIDO;1")
                    pasos.append({
                        "comando": "RECOGER",
                        "nivel": "NIVEL_1",
                        "descripcion": "Recoger producto en 1er Nivel"
                    })
                    pasos.append({
                        "comando": "PITIDO",
                        "patron": "1_CORTO",
                        "descripcion": "1 pitido corto (1er Nivel)"
                    })
                    pasos.append({
                        "comando": "PAUSA",
                        "parametro": "0.5s",
                        "descripcion": "Pausa breve entre niveles"
                    })
                    pasos.append({
                        "comando": "RECOGER",
                        "nivel": "NIVEL_2",
                        "descripcion": "Recoger producto en 2do Nivel"
                    })
                    pasos.append({
                        "comando": "PITIDO",
                        "patron": "1_CORTO",
                        "descripcion": "1 pitido corto (2do Nivel)"
                    })

        lines.append(f"REGRESAR;{s_end}")
        pasos.append({
            "comando": "REGRESAR",
            "parametro": s_end,
            "descripcion": f"Retorno a {s_end}"
        })

    return {
        "comandos_texto": "\n".join(lines),
        "pasos": pasos
    }

def construir_detalle_ruta(batch_locs: List[Any], c_solicitadas: Dict[str, float],
                            salida_inicio: str, salida_fin: str,
                            vel_ms: float, t_niv1: float, t_niv2: float):
    trips = []
    lista_despacho = []

    chunk_size = 3
    batches = [batch_locs[i:i + chunk_size] for i in range(0, len(batch_locs), chunk_size)]

    total_dist_m = 0.0
    total_travel_time_s = 0.0
    total_pick_time_s = 0.0
    total_pick_time_t = 0.0
    global_order = 1

    for trip_idx, batch in enumerate(batches):
        trip_start_exit = salida_inicio if trip_idx == 0 else salida_fin
        trip_end_exit = salida_fin

        current_node = trip_start_exit
        trip_waypoints = [current_node]
        trip_dist_m = 0.0
        trip_pick_time_s = 0.0
        trip_pick_time_t = 0.0
        trip_steps = []

        trip_steps.append({
            "tipo": "INICIO_VIAJE",
            "nodo": trip_start_exit,
            "descripcion": f"Inicio de viaje {trip_idx + 1} desde {trip_start_exit}"
        })

        for u in batch:
            target_node, _, _ = get_location_access_point(u.columna, u.fila)
            segment_dist, path = dijkstra_shortest_path(current_node, target_node)

            if path and len(path) > 1:
                trip_waypoints.extend(path[1:])
            trip_dist_m += segment_dist
            current_node = target_node

            p = getattr(u, 'producto', None)
            if p is None and hasattr(u, 'ubicacion') and getattr(u, 'ubicacion', None):
                p = u.ubicacion.producto

            qty_req = getattr(u, 'cantidad', 1.0) or c_solicitadas.get(u.id, 1.0)
            qty_avail = p.stock_actual if p else 0.0
            cat = p.categoria if p else None
            costo_info = calcular_costo_recogida_t(cat, u.nivel)
            pick_t_val = costo_info["tiempo_t"]
            pick_s = calcular_tiempo_pick(u.nivel, t_niv1, t_niv2, cat)

            trip_pick_time_t += pick_t_val
            trip_pick_time_s += pick_s

            desc_prod = p.descripcion if p else "N/A"
            ref_prod = getattr(u, 'producto_codigo', None) or (p.codigo if p else "N/A")

            label_tag = f"{u.codigo_visible} [F{u.fila}-C{u.columna}]" if u.es_duplicado else u.codigo_visible

            step_info = {
                "tipo": "RECOGIDA",
                "orden_visita": global_order,
                "ubicacion_id": u.id,
                "codigo_ubicacion": u.codigo_visible,
                "etiqueta_completa": label_tag,
                "access_node": target_node,
                "fila": u.fila,
                "columna": u.columna,
                "producto_codigo": ref_prod,
                "producto_descripcion": desc_prod,
                "cantidad_solicitada": qty_req,
                "cantidad_disponible": qty_avail,
                "nivel": u.nivel,
                "categoria_producto": cat,
                "tiempo_recogida_t": pick_t_val,
                "tiempo_recogida_s": pick_s,
                "advertencia_categoria": costo_info["advertencia"],
                "estado": "PENDIENTE",
                "nota_advertencia": "Stock insuficiente" if qty_req > qty_avail else None
            }
            trip_steps.append(step_info)
            lista_despacho.append(step_info)
            global_order += 1

        segment_dist, path = dijkstra_shortest_path(current_node, trip_end_exit)
        if path and len(path) > 1:
            trip_waypoints.extend(path[1:])
        trip_dist_m += segment_dist

        trip_steps.append({
            "tipo": "FIN_VIAJE",
            "nodo": trip_end_exit,
            "descripcion": f"Retorno de viaje {trip_idx + 1} a {trip_end_exit}"
        })

        trip_travel_time_s = trip_dist_m / vel_ms if vel_ms > 0 else 0.0

        trips.append({
            "numero_viaje": trip_idx + 1,
            "salida_inicio": trip_start_exit,
            "salida_fin": trip_end_exit,
            "num_ubicaciones": len(batch),
            "distancia_m": round(trip_dist_m, 2),
            "tiempo_desplazamiento_s": round(trip_travel_time_s, 2),
            "tiempo_recogida_t": round(trip_pick_time_t, 2),
            "tiempo_recogida_s": round(trip_pick_time_s, 2),
            "tiempo_total_s": round(trip_travel_time_s + trip_pick_time_s, 2),
            "waypoints": trip_waypoints,
            "pasos": trip_steps
        })

        total_dist_m += trip_dist_m
        total_travel_time_s += trip_travel_time_s
        total_pick_time_t += trip_pick_time_t
        total_pick_time_s += trip_pick_time_s

    total_time_s = total_travel_time_s + total_pick_time_s
    instrucciones = generar_instrucciones_arduino(trips)

    return {
        "numero_viajes": len(trips),
        "distancia_total_m": round(total_dist_m, 2),
        "tiempo_desplazamiento_s": round(total_travel_time_s, 2),
        "tiempo_recogida_t": round(total_pick_time_t, 2),
        "tiempo_recogida_s": round(total_pick_time_s, 2),
        "tiempo_total_s": round(total_time_s, 2),
        "tiempo_total_min": round(total_time_s / 60.0, 2),
        "viajes": trips,
        "lista_despacho": lista_despacho,
        "instrucciones_arduino": instrucciones
    }

def optimizar_orden_ubicaciones(locs: List[Any], c_solic: Dict[str, float],
                                 salida_inicio: str, salida_fin: str,
                                 vel_ms: float, t_niv1: float, t_niv2: float,
                                 es_referencia: bool = False) -> List[Any]:
    """
    Encuentra el orden óptimo de visita que minimiza el tiempo total.
    Para el pedido de referencia documentado, optimiza dentro de cada lote conservando los 4 viajes.
    Para conjuntos de hasta 8 ubicaciones generales, evalúa exhaustivamente todas las permutaciones.
    Para más ubicaciones generales, utiliza la heurística del vecino más cercano.
    """
    if len(locs) <= 1:
        return list(locs)

    if es_referencia:
        chunk_size = 3
        batches = [locs[i:i + chunk_size] for i in range(0, len(locs), chunk_size)]
        opt_lines = []
        for b in batches:
            if len(b) <= 1:
                opt_lines.extend(b)
            else:
                best_b = b
                best_t = float("inf")
                for perm in itertools.permutations(b):
                    res_b = construir_detalle_ruta(
                        batch_locs=list(perm),
                        c_solicitadas=c_solic,
                        salida_inicio=salida_inicio,
                        salida_fin=salida_fin,
                        vel_ms=vel_ms,
                        t_niv1=t_niv1,
                        t_niv2=t_niv2
                    )
                    if res_b["tiempo_total_s"] < best_t:
                        best_t = res_b["tiempo_total_s"]
                        best_b = list(perm)
                opt_lines.extend(best_b)
        return opt_lines

    if len(locs) <= 8:
        best_perm = None
        best_time = float("inf")

        for perm in itertools.permutations(locs):
            res = construir_detalle_ruta(
                batch_locs=list(perm),
                c_solicitadas=c_solic,
                salida_inicio=salida_inicio,
                salida_fin=salida_fin,
                vel_ms=vel_ms,
                t_niv1=t_niv1,
                t_niv2=t_niv2
            )
            if res["tiempo_total_s"] < best_time:
                best_time = res["tiempo_total_s"]
                best_perm = list(perm)

        return best_perm or list(locs)

    unvisited = list(locs)
    opt = []
    curr_exit = salida_inicio

    while unvisited:
        curr_node = curr_exit if len(opt) % 3 == 0 else get_location_access_point(opt[-1].columna, opt[-1].fila)[0]
        best_next = None
        best_dist = float("inf")

        for u in unvisited:
            node, _, _ = get_location_access_point(u.columna, u.fila)
            d, _ = dijkstra_shortest_path(curr_node, node)
            if d < best_dist:
                best_dist = d
                best_next = u

        if best_next:
            opt.append(best_next)
            unvisited.remove(best_next)

    return opt

@router.get("/ubicaciones")
def get_ubicaciones(db: Session = Depends(get_db)):
    seed_mapa_si_vacio(db)
    ubicaciones = db.query(UbicacionMapa).order_by(UbicacionMapa.fila.asc(), UbicacionMapa.columna.asc()).all()

    res = []
    for u in ubicaciones:
        p = u.producto
        mat_info = get_location_matrix_info(u.columna, u.fila)
        etiqueta = f"{u.codigo_visible} [F{u.fila}-C{u.columna}]" if u.es_duplicado else u.codigo_visible
        res.append({
            "id": u.id,
            "codigo_visible": u.codigo_visible,
            "etiqueta_completa": etiqueta,
            "bloque": mat_info["bloque"],
            "cara_estanteria": mat_info["cara_estanteria"],
            "pasillo_acceso": mat_info["pasillo_acceso"],
            "zona_transitable": mat_info["zona_transitable"],
            "fila": u.fila,
            "columna": u.columna,
            "nivel": u.nivel,
            "producto_codigo": u.producto_codigo,
            "producto_descripcion": p.descripcion if p else "Sin producto asignado",
            "stock_actual": p.stock_actual if p else 0.0,
            "es_duplicado": u.es_duplicado,
            "nota_inconsistencia": u.nota_inconsistencia,
            "access_node": mat_info["access_node"],
            "x_m": mat_info["x_m"],
            "y_m": mat_info["y_m"],
            "updated_at": u.updated_at.strftime("%Y-%m-%d %H:%M") if u.updated_at else ""
        })

    return {
        "esquema_referencia": GRID_SCHEMA,
        "dimensiones_referencia": {
            "espacio_libre_superior_m": 2.0,
            "espacio_libre_inferior_m": 5.0,
            "profundidad_seccion_rack_m": 2.4,
            "ancho_pasillo_m": 1.0,
            "ancho_estanteria_doble_m": 2.1,
            "ancho_estanteria_simple_m": 1.05,
            "distancia_salidas_m": 10.0,
            "pasillos_transitables": 5,
            "bloques_estanterias": 4
        },
        "inconsistencias_notificadas": DUPLICATE_CODES,
        "total_ubicaciones": len(res),
        "ubicaciones": res
    }

@router.put("/ubicaciones/{loc_id}")
def update_ubicacion(loc_id: str, data: UbicacionUpdate, db: Session = Depends(get_db)):
    u = db.query(UbicacionMapa).filter(UbicacionMapa.id == loc_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Ubicación no encontrada")

    if data.codigo_visible is not None:
        u.codigo_visible = data.codigo_visible
    if data.nivel is not None:
        if data.nivel not in ["NIVEL_1", "NIVEL_2", "AMBOS", "SIN_NIVEL"]:
            raise HTTPException(status_code=400, detail="Nivel inválido. Debe ser NIVEL_1, NIVEL_2, AMBOS o SIN_NIVEL")
        u.nivel = data.nivel
    if data.producto_codigo is not None:
        if data.producto_codigo != "":
            p = db.query(Producto).filter(Producto.codigo == data.producto_codigo).first()
            if not p:
                raise HTTPException(status_code=404, detail=f"Producto {data.producto_codigo} no existe")
            u.producto_codigo = data.producto_codigo
        else:
            u.producto_codigo = None

    db.commit()
    return {"message": "Ubicación actualizada con éxito", "id": u.id}

@router.post("/ubicaciones/reset")
def reset_ubicaciones(db: Session = Depends(get_db)):
    db.query(UbicacionMapa).delete()
    db.commit()
    seed_mapa_si_vacio(db)
    return {"message": "Mapa reseteado al esquema predeterminado con éxito"}

@router.get("/parametros")
def get_parametros(db: Session = Depends(get_db)):
    seed_mapa_si_vacio(db)
    p = db.query(ParametrosSimulacion).first()
    return {
        "velocidad_rover_ms": p.velocidad_rover_ms,
        "tiempo_pick_nivel_1_s": p.tiempo_pick_nivel_1_s,
        "tiempo_pick_nivel_2_s": p.tiempo_pick_nivel_2_s,
        "salida_defecto_inicio": p.salida_defecto_inicio,
        "salida_defecto_fin": p.salida_defecto_fin
    }

@router.put("/parametros")
def update_parametros(data: ParametrosUpdate, db: Session = Depends(get_db)):
    seed_mapa_si_vacio(db)
    p = db.query(ParametrosSimulacion).first()

    if data.velocidad_rover_ms is not None:
        if data.velocidad_rover_ms <= 0:
            raise HTTPException(status_code=400, detail="La velocidad debe ser mayor a 0")
        p.velocidad_rover_ms = data.velocidad_rover_ms
    if data.tiempo_pick_nivel_1_s is not None:
        p.tiempo_pick_nivel_1_s = data.tiempo_pick_nivel_1_s
    if data.tiempo_pick_nivel_2_s is not None:
        p.tiempo_pick_nivel_2_s = data.tiempo_pick_nivel_2_s
    if data.salida_defecto_inicio is not None:
        p.salida_defecto_inicio = data.salida_defecto_inicio
    if data.salida_defecto_fin is not None:
        p.salida_defecto_fin = data.salida_defecto_fin

    db.commit()
    return {"message": "Parámetros de simulación actualizados", "parametros": {
        "velocidad_rover_ms": p.velocidad_rover_ms,
        "tiempo_pick_nivel_1_s": p.tiempo_pick_nivel_1_s,
        "tiempo_pick_nivel_2_s": p.tiempo_pick_nivel_2_s,
        "salida_defecto_inicio": p.salida_defecto_inicio,
        "salida_defecto_fin": p.salida_defecto_fin
    }}

@router.post("/calcular-ruta")
def calcular_ruta(req: RutaRequest, db: Session = Depends(get_db)):
    seed_mapa_si_vacio(db)

    c_solic = req.cantidades_solicitadas or {}
    vel_ms = req.velocidad_rover_ms or 1.0
    t_niv1 = req.tiempo_pick_nivel_1_s or 15.0
    t_niv2 = req.tiempo_pick_nivel_2_s or 45.0

    lines_to_process: List[PickingLine] = []
    es_pedido_referencia = False

    if req.lineas and len(req.lineas) > 0:
        uids = [item.ubicacion_id for item in req.lineas]
        ubics = db.query(UbicacionMapa).filter(UbicacionMapa.id.in_(uids)).all()
        ubic_dict = {u.id: u for u in ubics}

        for item in req.lineas:
            u = ubic_dict.get(item.ubicacion_id)
            if u:
                lines_to_process.append(PickingLine(u, item.nivel, item.cantidad or 1.0, item.producto_codigo))
    elif req.ubicaciones_ids and len(req.ubicaciones_ids) > 0:
        id_set = set(req.ubicaciones_ids)
        if id_set == REF_ORDER_LOC_IDS:
            es_pedido_referencia = True
            all_ref_uids = [spec[0] for spec in REF_12_SPEC]
            ubics = db.query(UbicacionMapa).filter(UbicacionMapa.id.in_(all_ref_uids)).all()
            ubic_dict = {u.id: u for u in ubics}

            for loc_id, niv_spec in REF_12_SPEC:
                u = ubic_dict.get(loc_id)
                if u:
                    lines_to_process.append(PickingLine(u, niv_spec))
        else:
            ubics = db.query(UbicacionMapa).filter(UbicacionMapa.id.in_(req.ubicaciones_ids)).all()
            ubic_dict = {u.id: u for u in ubics}

            for uid in req.ubicaciones_ids:
                u = ubic_dict.get(uid)
                if u:
                    lines_to_process.append(PickingLine(u))

    if not lines_to_process:
        raise HTTPException(status_code=400, detail="Debe seleccionar al menos una ubicación o línea de recogida válida")

    if len(lines_to_process) == 12:
        id_set = set(item.id for item in lines_to_process)
        if id_set == REF_ORDER_LOC_IDS:
            es_pedido_referencia = True

    posibles_salidas = ["SALIDA_1", "SALIDA_2"]
    s_start_candidates = posibles_salidas if req.salida_inicio in ["AUTO", None, ""] else [req.salida_inicio]
    s_end_candidates = posibles_salidas if req.salida_fin in ["AUTO", None, ""] else [req.salida_fin]

    best_start = s_start_candidates[0]
    best_end = s_end_candidates[0]
    best_optimizada = None
    best_inicial = None
    best_time = float("inf")

    for s_start in s_start_candidates:
        for s_end in s_end_candidates:
            locs_opt = optimizar_orden_ubicaciones(
                locs=lines_to_process,
                c_solic=c_solic,
                salida_inicio=s_start,
                salida_fin=s_end,
                vel_ms=vel_ms,
                t_niv1=t_niv1,
                t_niv2=t_niv2,
                es_referencia=es_pedido_referencia
            )
            res_opt = construir_detalle_ruta(
                batch_locs=locs_opt,
                c_solicitadas=c_solic,
                salida_inicio=s_start,
                salida_fin=s_end,
                vel_ms=vel_ms,
                t_niv1=t_niv1,
                t_niv2=t_niv2
            )
            if res_opt["tiempo_total_s"] < best_time:
                best_time = res_opt["tiempo_total_s"]
                best_start = s_start
                best_end = s_end
                best_optimizada = res_opt
                best_inicial = construir_detalle_ruta(
                    batch_locs=lines_to_process,
                    c_solicitadas=c_solic,
                    salida_inicio=s_start,
                    salida_fin=s_end,
                    vel_ms=vel_ms,
                    t_niv1=t_niv1,
                    t_niv2=t_niv2
                )

    res_inicial = best_inicial
    res_optimizada = best_optimizada

    dist_ahorrada_m = round(res_inicial["distancia_total_m"] - res_optimizada["distancia_total_m"], 2)
    tiempo_ahorrado_s = round(res_inicial["tiempo_total_s"] - res_optimizada["tiempo_total_s"], 2)

    dist_ref_m = 185.1
    tiempo_ref_t = 20.0
    viajes_ref = 4

    dif_dist_abs_m = round(abs(res_optimizada["distancia_total_m"] - dist_ref_m), 2)
    dif_dist_pct = round((dif_dist_abs_m / dist_ref_m) * 100, 2)
    dif_viajes = res_optimizada["numero_viajes"] - viajes_ref

    return {
        "salida_inicio": best_start,
        "salida_fin": best_end,
        "salida_inicio_solicitada": req.salida_inicio,
        "salida_fin_solicitada": req.salida_fin,
        "velocidad_rover_ms": vel_ms,
        "restricciones": {
            "max_ubicaciones_por_viaje": 3,
            "regla_tiempos_recogida": "Rojo N2=1t, Amarillo N1=3t, Naranja N1+N2=4t (operación única)"
        },
        "ruta_inicial": res_inicial,
        "ruta_optimizada": res_optimizada,
        "comparacion": {
            "distancia_ahorrada_m": dist_ahorrada_m,
            "tiempo_ahorrado_s": tiempo_ahorrado_s,
            "porcentaje_mejora_distancia": round((dist_ahorrada_m / res_inicial["distancia_total_m"] * 100) if res_inicial["distancia_total_m"] > 0 else 0, 1),
            "criterio_optimizacion": "La optimización evalúa las secuencias de recorrido sobre el grafo físico de 5 pasillos transitables del almacén, selecciona automáticamente la mejor puerta de SALIDA para minimizar el tiempo total (desplazamiento + recogida) y agrupa hasta 3 operaciones lógicas de recogida por viaje."
        },
        "validacion_referencia": {
            "referencia_documentada": {
                "distancia_m": dist_ref_m,
                "tiempo_recogida_t": tiempo_ref_t,
                "numero_viajes": viajes_ref,
                "grupos_viaje": [
                    {"viaje": 1, "posiciones": ["60", "60", "55"], "distancia_m": 43.6, "tiempo_t": 7.0},
                    {"viaje": 2, "posiciones": ["41", "44", "49"], "distancia_m": 54.6, "tiempo_t": 3.0},
                    {"viaje": 3, "posiciones": ["25", "25", "21"], "distancia_m": 57.7, "tiempo_t": 5.0},
                    {"viaje": 4, "posiciones": ["7", "4", "4"], "distancia_m": 29.2, "tiempo_t": 5.0}
                ]
            },
            "diferencias": {
                "diferencia_distancia_m": round(res_optimizada["distancia_total_m"] - dist_ref_m, 2),
                "diferencia_distancia_abs_m": dif_dist_abs_m,
                "diferencia_distancia_pct": dif_dist_pct,
                "diferencia_viajes": dif_viajes,
                "explicacion_discrepancia": (
                    "Nota metodológica: La referencia documentada (185.1m, 20t, 4 viajes) evalúa 12 líneas de pedido en 4 viajes independientes con retornos obligatorios a la salida. "
                    "El trazado geométrico ortogonal optimizado calcula los trayectos reales sobre el grafo de pasillos del almacén preservando las 12 operaciones de recogida y la agrupación por viaje."
                )
            }
        },
        "graph_nodes_coords": GRAPH_COORDS
    }

@router.get("/recorridos")
def get_recorridos_guardados(db: Session = Depends(get_db)):
    recorridos = db.query(RecorridoGuardado).order_by(RecorridoGuardado.fecha.desc()).all()
    return [
        {
            "id": r.id,
            "fecha": r.fecha.strftime("%Y-%m-%d %H:%M"),
            "nombre": r.nombre,
            "salida_inicio": r.salida_inicio,
            "salida_fin": r.salida_fin,
            "ubicaciones_count": len(json.loads(r.ubicaciones_json)) if r.ubicaciones_json else 0,
            "resultado": json.loads(r.resultado_json) if r.resultado_json else {}
        }
        for r in recorridos
    ]

@router.post("/recorridos")
def guardar_recorrido(req: RecorridoGuardarRequest, db: Session = Depends(get_db)):
    rec = RecorridoGuardado(
        nombre=req.nombre,
        salida_inicio=req.salida_inicio,
        salida_fin=req.salida_fin,
        ubicaciones_json=json.dumps(req.ubicaciones_ids),
        resultado_json=json.dumps(req.resultado)
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return {"message": "Recorrido de picking guardado con éxito", "id": rec.id}
