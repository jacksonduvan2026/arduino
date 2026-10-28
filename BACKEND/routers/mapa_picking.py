from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import json
import math
import heapq
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
    nivel: Optional[str] = None # NIVEL_1, NIVEL_2, AMBOS
    producto_codigo: Optional[str] = None

class ParametrosUpdate(BaseModel):
    velocidad_rover_ms: Optional[float] = None
    tiempo_pick_nivel_1_s: Optional[float] = None
    tiempo_pick_nivel_2_s: Optional[float] = None
    salida_defecto_inicio: Optional[str] = None
    salida_defecto_fin: Optional[str] = None

class RutaRequest(BaseModel):
    ubicaciones_ids: List[str]
    cantidades_solicitadas: Optional[Dict[str, float]] = None # {ubicacion_id: cantidad}
    salida_inicio: str = "SALIDA_1" # SALIDA_1 o SALIDA_2
    salida_fin: str = "SALIDA_1"
    velocidad_rover_ms: Optional[float] = 1.0
    tiempo_pick_nivel_1_s: Optional[float] = 15.0
    tiempo_pick_nivel_2_s: Optional[float] = 45.0

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

                # Nivel por defecto distribuido para demostración
                if (fila + columna) % 3 == 0:
                    nivel = "AMBOS"
                elif (fila + columna) % 2 == 0:
                    nivel = "NIVEL_2"
                else:
                    nivel = "NIVEL_1"

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

# --- MODELO GEOMÉTRICO Y GRAFO DE PASILLOS TRANSITABLES ---
# Coordenadas físicas en metros:
# Ancho de pasillos y racks:
# Pasillos verticales:
# Aisle 0 (Izquierda de Col 1): x = 0.0 m
# Aisle 1 (Entre Col 2 y Col 3): x = 2.4 m
# Aisle 2 (Entre Col 4 y Col 5): x = 5.0 m
# Aisle 3 (Derecha de Col 6 / Col 7): x = 7.4 m
# Filas y Pasillos Horizontales:
# Pasillo Superior (Cross Aisle Top): y = 0.0 m
# Filas 1 a 9: y = 1.0 m a 9.0 m (1.0m por fila)
# Pasillo Inferior (Cross Aisle Bottom): y = 10.0 m
# Salidas: SALIDA_1 a (1.2, 11.0), SALIDA_2 a (6.2, 11.0)

AISLE_X = {
    "A0": 0.0,
    "A1": 2.4,
    "A2": 5.0,
    "A3": 7.4
}

def get_location_access_point(columna: int, fila: int) -> tuple[str, float, float]:
    """Retorna el nodo del pasillo transitable más cercano y sus coordenadas (node_id, x, y)."""
    y = float(fila)
    if columna in [1, 2]:
        aisle = "A1" if columna == 2 else "A0"
    elif columna in [3, 4]:
        aisle = "A1" if columna == 3 else "A2"
    elif columna in [5, 6]:
        aisle = "A2" if columna == 5 else "A3"
    else: # columna 7
        aisle = "A3"
    x = AISLE_X[aisle]
    return f"{aisle}_Y{fila}", x, y

def build_warehouse_graph():
    """Construye el grafo transitatorio con nodos y distancias euclídeas reales."""
    graph = {}
    coords = {}

    def add_edge(u, v):
        x1, y1 = coords[u]
        x2, y2 = coords[v]
        dist = math.hypot(x2 - x1, y2 - y1)
        graph.setdefault(u, []).append((v, dist))
        graph.setdefault(v, []).append((u, dist))

    # Nodos de las salidas
    coords["SALIDA_1"] = (1.2, 11.0)
    coords["SALIDA_2"] = (6.2, 11.0)

    # Nodos del pasillo inferior
    coords["BOTTOM_A0"] = (AISLE_X["A0"], 10.0)
    coords["BOTTOM_A1"] = (AISLE_X["A1"], 10.0)
    coords["BOTTOM_A2"] = (AISLE_X["A2"], 10.0)
    coords["BOTTOM_A3"] = (AISLE_X["A3"], 10.0)

    # Conectar salidas al pasillo inferior
    add_edge("SALIDA_1", "BOTTOM_A0")
    add_edge("SALIDA_1", "BOTTOM_A1")
    add_edge("SALIDA_2", "BOTTOM_A2")
    add_edge("SALIDA_2", "BOTTOM_A3")
    add_edge("BOTTOM_A0", "BOTTOM_A1")
    add_edge("BOTTOM_A1", "BOTTOM_A2")
    add_edge("BOTTOM_A2", "BOTTOM_A3")

    # Nodos del pasillo superior
    coords["TOP_A0"] = (AISLE_X["A0"], 0.0)
    coords["TOP_A1"] = (AISLE_X["A1"], 0.0)
    coords["TOP_A2"] = (AISLE_X["A2"], 0.0)
    coords["TOP_A3"] = (AISLE_X["A3"], 0.0)

    add_edge("TOP_A0", "TOP_A1")
    add_edge("TOP_A1", "TOP_A2")
    add_edge("TOP_A2", "TOP_A3")

    # Nodos a lo largo de los pasillos verticales (filas 1 a 9)
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
    """Calcula el camino más corto en el grafo de pasillos transitables."""
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

@router.get("/ubicaciones")
def get_ubicaciones(db: Session = Depends(get_db)):
    seed_mapa_si_vacio(db)
    ubicaciones = db.query(UbicacionMapa).order_by(UbicacionMapa.fila.asc(), UbicacionMapa.columna.asc()).all()

    # Obtener maestro de productos para información ampliada
    res = []
    for u in ubicaciones:
        p = u.producto
        access_node, x, y = get_location_access_point(u.columna, u.fila)
        res.append({
            "id": u.id,
            "codigo_visible": u.codigo_visible,
            "fila": u.fila,
            "columna": u.columna,
            "nivel": u.nivel,
            "producto_codigo": u.producto_codigo,
            "producto_descripcion": p.descripcion if p else "Sin producto asignado",
            "stock_actual": p.stock_actual if p else 0.0,
            "es_duplicado": u.es_duplicado,
            "nota_inconsistencia": u.nota_inconsistencia,
            "access_node": access_node,
            "x_m": x,
            "y_m": y,
            "updated_at": u.updated_at.strftime("%Y-%m-%d %H:%M") if u.updated_at else ""
        })

    return {
        "esquema_referencia": GRID_SCHEMA,
        "dimensiones_referencia": {
            "ancho_pasillo_m": 2.4,
            "ancho_rack_m": 1.0,
            "largo_modulo_m": 2.1,
            "alto_m": 5.0,
            "fondo_m": 2.0
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
        if data.nivel not in ["NIVEL_1", "NIVEL_2", "AMBOS"]:
            raise HTTPException(status_code=400, detail="Nivel inválido. Debe ser NIVEL_1, NIVEL_2 o AMBOS")
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

def calcular_tiempo_pick(nivel: str, t_nivel1: float, t_nivel2: float) -> float:
    if nivel == "NIVEL_1":
        return t_nivel1
    elif nivel == "NIVEL_2":
        return t_nivel2 # 3x nivel 1 por especificación
    elif nivel == "AMBOS":
        return t_nivel1 + t_nivel2 # Recogida en ambos niveles
    return t_nivel1

def construir_detalle_ruta(batch_locs: List[UbicacionMapa], c_solicitadas: Dict[str, float],
                            salida_inicio: str, salida_fin: str,
                            vel_ms: float, t_niv1: float, t_niv2: float):
    """Construye viajes agrupando máximo 3 ubicaciones por viaje."""
    trips = []
    lista_despacho = []

    # Dividir las ubicaciones en viajes de máximo 3 ubicaciones
    chunk_size = 3
    batches = [batch_locs[i:i + chunk_size] for i in range(0, len(batch_locs), chunk_size)]

    total_dist_m = 0.0
    total_travel_time_s = 0.0
    total_pick_time_s = 0.0
    global_order = 1

    for trip_idx, batch in enumerate(batches):
        trip_start_exit = salida_inicio if trip_idx == 0 else salida_fin
        trip_end_exit = salida_fin

        current_node = trip_start_exit
        trip_waypoints = [current_node]
        trip_dist_m = 0.0
        trip_pick_time_s = 0.0
        trip_steps = []

        # Paso inicial desde salida
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

            p = u.producto
            qty_req = c_solicitadas.get(u.id, 1.0)
            qty_avail = p.stock_actual if p else 0.0
            pick_t = calcular_tiempo_pick(u.nivel, t_niv1, t_niv2)
            trip_pick_time_s += pick_t

            desc_prod = p.descripcion if p else "N/A"
            ref_prod = p.codigo if p else "N/A"

            step_info = {
                "tipo": "RECOGIDA",
                "orden_visita": global_order,
                "ubicacion_id": u.id,
                "codigo_ubicacion": u.codigo_visible,
                "access_node": target_node,
                "producto_codigo": ref_prod,
                "producto_descripcion": desc_prod,
                "cantidad_solicitada": qty_req,
                "cantidad_disponible": qty_avail,
                "nivel": u.nivel,
                "tiempo_recogida_s": pick_t,
                "estado": "PENDIENTE",
                "nota_advertencia": "Stock insuficiente" if qty_req > qty_avail else None
            }
            trip_steps.append(step_info)
            lista_despacho.append(step_info)
            global_order += 1

        # Retorno a la salida
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
            "tiempo_recogida_s": round(trip_pick_time_s, 2),
            "tiempo_total_s": round(trip_travel_time_s + trip_pick_time_s, 2),
            "waypoints": trip_waypoints,
            "pasos": trip_steps
        })

        total_dist_m += trip_dist_m
        total_travel_time_s += trip_travel_time_s
        total_pick_time_s += trip_pick_time_s

    total_time_s = total_travel_time_s + total_pick_time_s

    return {
        "numero_viajes": len(trips),
        "distancia_total_m": round(total_dist_m, 2),
        "tiempo_desplazamiento_s": round(total_travel_time_s, 2),
        "tiempo_recogida_s": round(total_pick_time_s, 2),
        "tiempo_total_s": round(total_time_s, 2),
        "tiempo_total_min": round(total_time_s / 60.0, 2),
        "viajes": trips,
        "lista_despacho": lista_despacho
    }

@router.post("/calcular-ruta")
def calcular_ruta(req: RutaRequest, db: Session = Depends(get_db)):
    seed_mapa_si_vacio(db)

    if not req.ubicaciones_ids:
        raise HTTPException(status_code=400, detail="Debe seleccionar al menos una ubicación de recogida")

    # Cargar ubicaciones seleccionadas
    ubics = db.query(UbicacionMapa).filter(UbicacionMapa.id.in_(req.ubicaciones_ids)).all()
    ubic_dict = {u.id: u for u in ubics}

    # Mantener el orden inicial recibido
    locs_iniciales = [ubic_dict[uid] for uid in req.ubicaciones_ids if uid in ubic_dict]

    if not locs_iniciales:
        raise HTTPException(status_code=404, detail="Ninguna de las ubicaciones especificadas existe")

    c_solic = req.cantidades_solicitadas or {}
    vel_ms = req.velocidad_rover_ms or 1.0
    t_niv1 = req.tiempo_pick_nivel_1_s or 15.0
    t_niv2 = req.tiempo_pick_nivel_2_s or 45.0

    # 1. Ruta Inicial (secuencial)
    res_inicial = construir_detalle_ruta(
        batch_locs=locs_iniciales,
        c_solicitadas=c_solic,
        salida_inicio=req.salida_inicio,
        salida_fin=req.salida_fin,
        vel_ms=vel_ms,
        t_niv1=t_niv1,
        t_niv2=t_niv2
    )

    # 2. Ruta Optimizada
    # Ordenamiento optimizado mediante heurística del vecino más cercano a lo largo de pasillos
    unvisited = list(locs_iniciales)
    locs_optimizadas = []
    curr_exit = req.salida_inicio

    while unvisited:
        # Si empezamos un nuevo viaje (múltiplo de 3)
        curr_node = curr_exit if len(locs_optimizadas) % 3 == 0 else get_location_access_point(locs_optimizadas[-1].columna, locs_optimizadas[-1].fila)[0]

        best_next = None
        best_dist = float("inf")

        for u in unvisited:
            node, _, _ = get_location_access_point(u.columna, u.fila)
            d, _ = dijkstra_shortest_path(curr_node, node)
            if d < best_dist:
                best_dist = d
                best_next = u

        if best_next:
            locs_optimizadas.append(best_next)
            unvisited.remove(best_next)

    res_optimizada = construir_detalle_ruta(
        batch_locs=locs_optimizadas,
        c_solicitadas=c_solic,
        salida_inicio=req.salida_inicio,
        salida_fin=req.salida_fin,
        vel_ms=vel_ms,
        t_niv1=t_niv1,
        t_niv2=t_niv2
    )

    dist_ahorrada_m = round(res_inicial["distancia_total_m"] - res_optimizada["distancia_total_m"], 2)
    tiempo_ahorrado_s = round(res_inicial["tiempo_total_s"] - res_optimizada["tiempo_total_s"], 2)

    return {
        "salida_inicio": req.salida_inicio,
        "salida_fin": req.salida_fin,
        "velocidad_rover_ms": vel_ms,
        "restricciones": {
            "max_ubicaciones_por_viaje": 3,
            "factor_nivel_2": "3x respecto al primer nivel"
        },
        "ruta_inicial": res_inicial,
        "ruta_optimizada": res_optimizada,
        "comparacion": {
            "distancia_ahorrada_m": dist_ahorrada_m,
            "tiempo_ahorrado_s": tiempo_ahorrado_s,
            "porcentaje_mejora_distancia": round((dist_ahorrada_m / res_inicial["distancia_total_m"] * 100) if res_inicial["distancia_total_m"] > 0 else 0, 1),
            "criterio_optimizacion": "La optimización utiliza la heurística de Vecino Más Cercano (Nearest Neighbor) calculada sobre las conexiones reales del grafo de pasillos transitables y agrupa estrictamente hasta 3 ubicaciones por viaje para minimizar la distancia total recorrida."
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
