import React from 'react';

export function MapaAlmacenSVG({
  ubicaciones,
  selectedLocIds,
  onToggleSelect,
  activeRouteWaypoints,
  roverPositionNode,
  roverCoords,
  roverStatus,
  roverCurrentTask,
  isSimulating,
  startExit,
  endExit
}) {
  const svgWidth = 840;
  const svgHeight = 640;

  // Distribución de 5 pasillos transitables (A0..A4) y 4 bloques de estanterías (1 simple, 3 dobles)
  const colXMap = {
    1: 120,  // Bloque 1 (Simple)
    2: 265,  // Bloque 2 (Cara Izquierda)
    3: 315,  // Bloque 2 (Cara Derecha)
    4: 465,  // Bloque 3 (Cara Izquierda)
    5: 515,  // Bloque 3 (Cara Derecha)
    6: 665,  // Bloque 4 (Cara Izquierda)
    7: 715   // Bloque 4 (Cara Derecha)
  };

  const aisleXMap = {
    A0: 50,   // Pasillo 1 (Exterior izquierdo - Alineado con Salida 1)
    A1: 190,  // Pasillo 2 (Entre Bloque 1 y Bloque 2)
    A2: 390,  // Pasillo 3 (Entre Bloque 2 y Bloque 3)
    A3: 590,  // Pasillo 4 (Entre Bloque 3 y Bloque 4)
    A4: 790   // Pasillo 5 (Exterior derecho - Alineado con Salida 2)
  };

  const rowYMap = {
    1: 60,
    2: 110,
    3: 160,
    4: 210,
    5: 260,
    6: 310,
    7: 360,
    8: 410,
    9: 460
  };

  const topAisleY = 20;
  const bottomAisleY = 510;
  const exitY = 570;

  const exitXMap = {
    SALIDA_1: 50,  // Alineada con Pasillo 1 (A0)
    SALIDA_2: 790  // Alineada con Pasillo 5 (A4)
  };

  const getWayPointSvgCoords = (nodeId) => {
    if (!nodeId) return { x: 40, y: topAisleY };
    if (nodeId.startsWith('SALIDA_')) {
      return { x: exitXMap[nodeId] || 120, y: exitY };
    }
    if (nodeId.startsWith('BOTTOM_')) {
      const aisle = nodeId.replace('BOTTOM_', '');
      return { x: aisleXMap[aisle] || 40, y: bottomAisleY };
    }
    if (nodeId.startsWith('TOP_')) {
      const aisle = nodeId.replace('TOP_', '');
      return { x: aisleXMap[aisle] || 40, y: topAisleY };
    }
    if (nodeId.includes('_Y')) {
      const [aisle, rStr] = nodeId.split('_Y');
      const row = parseInt(rStr, 10);
      return { x: aisleXMap[aisle] || 40, y: rowYMap[row] || 60 };
    }
    return { x: 40, y: topAisleY };
  };

  // Nivel de recogida: Estanterías blancas por defecto (`#ffffff`), con colores semánticos para clasificaciones
  const getNivelStyle = (nivel) => {
    switch (nivel) {
      case 'NIVEL_1':
        return { fill: '#fef08a', stroke: '#ca8a04', text: '#854d0e', label: 'Amarillo (1er Nivel)' };
      case 'NIVEL_2':
        return { fill: '#fecaca', stroke: '#dc2626', text: '#991b1b', label: 'Rojo (2do Nivel)' };
      case 'AMBOS':
        return { fill: '#ffedd5', stroke: '#ea580c', text: '#9a3412', label: 'Naranja (Ambos Niveles)' };
      case 'SIN_NIVEL':
      default:
        return { fill: '#ffffff', stroke: '#94a3b8', text: '#0f172a', label: 'Blanca (Sin nivel asignado)' };
    }
  };

  const routePolylinePoints = activeRouteWaypoints
    ? activeRouteWaypoints.map((node) => {
        const c = getWayPointSvgCoords(node);
        return `${c.x},${c.y}`;
      }).join(' ')
    : '';

  const currentRoverCoords = roverCoords || getWayPointSvgCoords(roverPositionNode || startExit);

  return (
    <div className="mapa-svg-container" style={{ position: 'relative', width: '100%', overflowX: 'auto', background: '#0a0c0f', borderRadius: '8px', padding: '16px', border: '1px solid var(--border)' }}>
      {/* Leyenda y dimensiones de referencia */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px', color: '#f5f5f7', fontSize: '0.82rem' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#ffffff', border: '1px solid #94a3b8' }}></span> Blanca (Defecto)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#fef08a', border: '1px solid #ca8a04' }}></span> Amarillo (N1, 3t)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#fecaca', border: '1px solid #dc2626' }}></span> Rojo (N2, 1t)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#ffedd5', border: '1px solid #ea580c' }}></span> Naranja (N1+N2, 4t)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid #ff1744', backgroundColor: '#ff1744' }}></span> Seleccionada para Ruta
          </span>
        </div>

        <div style={{ fontSize: '0.75rem', color: '#a5a9b2', background: '#14161a', padding: '4px 10px', borderRadius: '4px', border: '1px solid #30343b' }}>
          Ref. Física: 5 Pasillos Transitables | 4 Bloques (1 Simple, 3 Dobles) | Libres: Sup. 2m / Inf. 5m
        </div>
      </div>

      <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Fondo del almacén */}
        <rect x="10" y="10" width={svgWidth - 20} height={svgHeight - 20} fill="#14161a" rx="8" stroke="#30343b" strokeWidth="2" />

        {/* Referencia Espacio Libre Superior (2m) */}
        <text x="380" y="18" textAnchor="middle" fill="#6e737d" fontSize="9" fontWeight="bold">
          ESPACIO LIBRE SUPERIOR (REFERENCIA 2 METROS)
        </text>

        {/* Pasillos Transitables - Grafo de Referencia */}
        <g stroke="#30343b" strokeWidth="2" strokeDasharray="4,4">
          <line x1={aisleXMap.A0} y1={topAisleY} x2={aisleXMap.A4} y2={topAisleY} />
          <line x1={aisleXMap.A0} y1={bottomAisleY} x2={aisleXMap.A4} y2={bottomAisleY} />

          {Object.entries(aisleXMap).map(([aisleKey, xVal]) => (
            <line key={aisleKey} x1={xVal} y1={topAisleY} x2={xVal} y2={bottomAisleY} />
          ))}

          <line x1={exitXMap.SALIDA_1} y1={exitY} x2={aisleXMap.A0} y2={bottomAisleY} stroke="#10b981" strokeWidth="2" />
          <line x1={exitXMap.SALIDA_2} y1={exitY} x2={aisleXMap.A4} y2={bottomAisleY} stroke="#ff1744" strokeWidth="2" />
        </g>

        {/* 4 Bloques de Estanterías (Estructura física) */}
        {/* Bloque 1: Estantería Simple Izquierda (Col 1) */}
        <rect x="98" y="45" width="44" height="430" fill="#08090b" rx="4" stroke="#383e49" strokeWidth="1.5" opacity="0.9" />
        {/* Bloque 2: Estantería Doble (Col 2 & Col 3) */}
        <rect x="238" y="45" width="104" height="430" fill="#08090b" rx="4" stroke="#383e49" strokeWidth="1.5" opacity="0.9" />
        {/* Bloque 3: Estantería Doble (Col 4 & Col 5) */}
        <rect x="438" y="45" width="104" height="430" fill="#08090b" rx="4" stroke="#383e49" strokeWidth="1.5" opacity="0.9" />
        {/* Bloque 4: Estantería Doble Derecha (Col 6 & Col 7) */}
        <rect x="638" y="45" width="104" height="430" fill="#08090b" rx="4" stroke="#383e49" strokeWidth="1.5" opacity="0.9" />

        {/* Etiquetas de Pasillos Transitables */}
        <text x={aisleXMap.A0} y="34" textAnchor="middle" fill="#ff4569" fontSize="9" fontWeight="bold">PASILLO 1</text>
        <text x={aisleXMap.A1} y="34" textAnchor="middle" fill="#ff4569" fontSize="9" fontWeight="bold">PASILLO 2</text>
        <text x={aisleXMap.A2} y="34" textAnchor="middle" fill="#ff4569" fontSize="9" fontWeight="bold">PASILLO 3</text>
        <text x={aisleXMap.A3} y="34" textAnchor="middle" fill="#ff4569" fontSize="9" fontWeight="bold">PASILLO 4</text>
        <text x={aisleXMap.A4} y="34" textAnchor="middle" fill="#ff4569" fontSize="9" fontWeight="bold">PASILLO 5</text>

        {/* Polyline de la Ruta Calculada */}
        {routePolylinePoints && (
          <polyline
            points={routePolylinePoints}
            fill="none"
            stroke="#ff1744"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
            strokeDasharray={isSimulating ? "8,4" : "none"}
            filter="drop-shadow(0px 0px 6px rgba(255, 23, 68, 0.8))"
          />
        )}

        {/* Renderizado de Ubicaciones */}
        {ubicaciones && ubicaciones.map((u) => {
          const x = colXMap[u.columna] || 0;
          const y = rowYMap[u.fila] || 0;
          const isSelected = selectedLocIds.includes(u.id);
          const style = getNivelStyle(u.nivel);
          const isDup = u.es_duplicado;

          return (
            <g
              key={u.id}
              transform={`translate(${x - 24}, ${y - 18})`}
              onClick={() => onToggleSelect(u.id)}
              style={{ cursor: 'pointer' }}
            >
              {/* Resplandor o borde de Selección de Ruta */}
              {isSelected && (
                <rect
                  x="-3"
                  y="-3"
                  width="54"
                  height="42"
                  rx="7"
                  fill="none"
                  stroke="#ff1744"
                  strokeWidth="3.5"
                  filter="drop-shadow(0px 0px 8px rgba(255, 23, 68, 0.9))"
                />
              )}

              {/* Casilla de Estantería (Blanca por defecto o color semántico de nivel) */}
              <rect
                x="0"
                y="0"
                width="48"
                height="36"
                rx="5"
                fill={style.fill}
                stroke={isSelected ? '#ff1744' : style.stroke}
                strokeWidth={isSelected ? '2.5' : '1.5'}
              />

              {/* Código Visible */}
              <text
                x="24"
                y="22"
                textAnchor="middle"
                fill={style.text}
                fontSize="12"
                fontWeight="bold"
                fontFamily="sans-serif"
              >
                {u.codigo_visible}
              </text>

              {/* Tag si es duplicado (22 o 35) */}
              {isDup && (
                <g transform="translate(32, -4)">
                  <circle cx="6" cy="6" r="7" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
                  <text x="6" y="9" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="bold">!</text>
                  <title>{u.nota_inconsistencia || `Fila ${u.fila}, Col ${u.columna}`}</title>
                </g>
              )}

              {/* Badge de Selección para Picking */}
              {isSelected && (
                <circle cx="6" cy="6" r="6" fill="#ff1744" stroke="#ffffff" strokeWidth="1" />
              )}
            </g>
          );
        })}

        {/* Referencia Espacio Libre Inferior (5m) */}
        <text x="380" y="495" textAnchor="middle" fill="#6e737d" fontSize="9" fontWeight="bold">
          ESPACIO LIBRE INFERIOR (REFERENCIA 5 METROS)
        </text>

        {/* Puertas de Salida en la pared inferior (ambas etiquetadas SALIDA) */}
        {/* Puerta SALIDA 1 (Alineada con Pasillo 1) */}
        <g transform={`translate(${exitXMap.SALIDA_1 - 35}, ${exitY - 18})`}>
          <rect
            x="0"
            y="0"
            width="70"
            height="36"
            rx="6"
            fill={startExit === 'SALIDA_1' ? '#059669' : '#064e3b'}
            stroke="#10b981"
            strokeWidth="2"
          />
          <text x="35" y="22" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">
            SALIDA 1
          </text>
        </g>

        {/* Acotación entre salidas */}
        <g transform={`translate(${exitXMap.SALIDA_1 + 35}, ${exitY - 5})`}>
          <line x1="0" y1="0" x2={exitXMap.SALIDA_2 - exitXMap.SALIDA_1 - 70} y2="0" stroke="#a5a9b2" strokeWidth="1" strokeDasharray="3,3" />
          <text x={(exitXMap.SALIDA_2 - exitXMap.SALIDA_1 - 70) / 2} y="-4" textAnchor="middle" fill="#a5a9b2" fontSize="10" fontWeight="bold">10.0 m entre salidas</text>
        </g>

        {/* Puerta SALIDA 2 (Alineada con Pasillo 5) */}
        <g transform={`translate(${exitXMap.SALIDA_2 - 35}, ${exitY - 18})`}>
          <rect
            x="0"
            y="0"
            width="70"
            height="36"
            rx="6"
            fill={startExit === 'SALIDA_2' ? '#a80f2d' : '#450a15'}
            stroke="#ff1744"
            strokeWidth="2"
          />
          <text x="35" y="22" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">
            SALIDA 2
          </text>
        </g>

        {/* Simulación: Ícono del Rover Virtual Arduino */}
        {currentRoverCoords && (
          <g
            transform={`translate(${currentRoverCoords.x}, ${currentRoverCoords.y})`}
            style={{ transition: 'all 0.3s ease-out' }}
          >
            {/* Anillo y resplandor según estado (Detenido/Recogiendo vs Moviéndose) */}
            {roverStatus === 'RECOGIENDO' ? (
              <>
                <circle cx="0" cy="0" r="24" fill="#f59e0b" opacity="0.4" className="pulse-animation" />
                <circle cx="0" cy="0" r="15" fill="#ef4444" stroke="#ffffff" strokeWidth="2.5" />
                <text x="0" y="4" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">⏹</text>
                <rect x="-45" y="-38" width="90" height="18" rx="4" fill="#08090b" stroke="#f59e0b" strokeWidth="1" />
                <text x="0" y="-25" textAnchor="middle" fill="#f59e0b" fontSize="9" fontWeight="bold">
                  PARADA - PICKING
                </text>
              </>
            ) : (
              <>
                <circle cx="0" cy="0" r="18" fill="#ff1744" opacity="0.35" className="pulse-animation" />
                <circle cx="0" cy="0" r="12" fill="#ff1744" stroke="#ffffff" strokeWidth="2" />
                <path d="M -4 -4 L 4 -4 L 4 4 L -4 4 Z" fill="#ffffff" />
              </>
            )}
            <text x="0" y="22" textAnchor="middle" fill={roverStatus === 'RECOGIENDO' ? '#f59e0b' : '#ff4569'} fontSize="10" fontWeight="bold">
              {roverStatus === 'RECOGIENDO' ? 'DETENIDO' : 'ROVER'}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
