import React from 'react';

export function MapaAlmacenSVG({
  ubicaciones,
  selectedLocIds,
  onToggleSelect,
  activeRouteWaypoints,
  roverPositionNode,
  roverCoords,
  isSimulating,
  startExit,
  endExit
}) {
  const svgWidth = 840;
  const svgHeight = 640;

  // Mapa de coordenadas X para columnas 1 a 7 (grupos de estanterías y pasillos)
  // Col 1, Col 2 | Pasillo 1 | Col 3, Col 4 | Pasillo 2 | Col 5, Col 6 | Pasillo 3 | Col 7
  const colXMap = {
    1: 80,
    2: 150,
    3: 260,
    4: 330,
    5: 440,
    6: 510,
    7: 620
  };

  const aisleXMap = {
    A0: 40,
    A1: 205,
    A2: 385,
    A3: 565
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
    SALIDA_1: 120,
    SALIDA_2: 475
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

  // Nivel de recogida: Estanterías blancas por defecto (`#ffffff`), con colores para clasificaciones
  const getNivelStyle = (nivel) => {
    switch (nivel) {
      case 'NIVEL_1':
        return { fill: '#fef08a', stroke: '#ca8a04', text: '#854d0e', label: 'Amarillo (1er Nivel)' };
      case 'NIVEL_2':
        return { fill: '#fecaca', stroke: '#dc2626', text: '#991b1b', label: 'Rojo (2do Nivel)' };
      case 'AMBOS':
        return { fill: '#ffedd5', stroke: '#ea580c', text: '#9a3412', label: 'Naranja (Ambos Niveles)' };
      default:
        return { fill: '#ffffff', stroke: '#475569', text: '#0f172a', label: 'Estantería Blanca (Sin clasificar)' };
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
    <div className="mapa-svg-container" style={{ position: 'relative', width: '100%', overflowX: 'auto', background: '#0f172a', borderRadius: '8px', padding: '16px' }}>
      {/* Leyenda y dimensiones de referencia */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px', color: '#f8fafc', fontSize: '0.82rem' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#ffffff', border: '1px solid #94a3b8' }}></span> Blanco (Defecto)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#fef08a', border: '1px solid #ca8a04' }}></span> Nivel 1 (15s)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#fecaca', border: '1px solid #dc2626' }}></span> Nivel 2 (45s)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#ffedd5', border: '1px solid #ea580c' }}></span> Ambos (60s)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid #38bdf8', backgroundColor: '#2563eb' }}></span> Seleccionada para Ruta
          </span>
        </div>

        <div style={{ fontSize: '0.75rem', color: '#94a3b8', background: '#1e293b', padding: '4px 10px', borderRadius: '4px', border: '1px solid #334155' }}>
          Dist. Salidas: 2,4m | Pasillo: 1,0m | Módulo: 2,1m | 5,0m x 2,0m
        </div>
      </div>

      <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Fondo del almacén */}
        <rect x="10" y="10" width={svgWidth - 20} height={svgHeight - 20} fill="#1e293b" rx="8" stroke="#334155" strokeWidth="2" />

        {/* Pasillos Transitables - Grafo de Referencia */}
        <g stroke="#334155" strokeWidth="2" strokeDasharray="4,4">
          <line x1={aisleXMap.A0} y1={topAisleY} x2={aisleXMap.A3} y2={topAisleY} />
          <line x1={aisleXMap.A0} y1={bottomAisleY} x2={aisleXMap.A3} y2={bottomAisleY} />

          {Object.entries(aisleXMap).map(([aisleKey, xVal]) => (
            <line key={aisleKey} x1={xVal} y1={topAisleY} x2={xVal} y2={bottomAisleY} />
          ))}

          <line x1={exitXMap.SALIDA_1} y1={exitY} x2={aisleXMap.A0} y2={bottomAisleY} stroke="#10b981" strokeWidth="2" />
          <line x1={exitXMap.SALIDA_1} y1={exitY} x2={aisleXMap.A1} y2={bottomAisleY} stroke="#10b981" strokeWidth="2" />
          <line x1={exitXMap.SALIDA_2} y1={exitY} x2={aisleXMap.A2} y2={bottomAisleY} stroke="#3b82f6" strokeWidth="2" />
          <line x1={exitXMap.SALIDA_2} y1={exitY} x2={aisleXMap.A3} y2={bottomAisleY} stroke="#3b82f6" strokeWidth="2" />
        </g>

        {/* Grupos de Estanterías (Fondo visual delimitador) */}
        {/* Grupo 1: Col 1 - Col 2 */}
        <rect x="70" y="45" width="90" height="430" fill="#0f172a" rx="4" stroke="#475569" strokeWidth="1" opacity="0.6" />
        {/* Grupo 2: Col 3 - Col 4 */}
        <rect x="250" y="45" width="90" height="430" fill="#0f172a" rx="4" stroke="#475569" strokeWidth="1" opacity="0.6" />
        {/* Grupo 3: Col 5 - Col 6 */}
        <rect x="430" y="45" width="90" height="430" fill="#0f172a" rx="4" stroke="#475569" strokeWidth="1" opacity="0.6" />
        {/* Grupo 4: Col 7 */}
        <rect x="610" y="45" width="45" height="430" fill="#0f172a" rx="4" stroke="#475569" strokeWidth="1" opacity="0.6" />

        {/* Separadores de Pasillos */}
        <text x="205" y="35" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="bold">PASILLO 1 (1,0m)</text>
        <text x="385" y="35" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="bold">PASILLO 2 (1,0m)</text>
        <text x="565" y="35" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="bold">PASILLO 3 (1,0m)</text>

        {/* Polyline de la Ruta Calculada */}
        {routePolylinePoints && (
          <polyline
            points={routePolylinePoints}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.85"
            strokeDasharray={isSimulating ? "8,4" : "none"}
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
              {/* Resplandor o borde de Selección de Ruta (separado del color de nivel) */}
              {isSelected && (
                <rect
                  x="-3"
                  y="-3"
                  width="54"
                  height="42"
                  rx="7"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="3.5"
                  filter="drop-shadow(0px 0px 8px rgba(56, 189, 248, 0.9))"
                />
              )}

              {/* Casilla de Estantería (Blanca por defecto o color de nivel asignado) */}
              <rect
                x="0"
                y="0"
                width="48"
                height="36"
                rx="5"
                fill={style.fill}
                stroke={isSelected ? '#0284c7' : style.stroke}
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
                <circle cx="6" cy="6" r="6" fill="#2563eb" stroke="#ffffff" strokeWidth="1" />
              )}
            </g>
          );
        })}

        {/* Salidas en la Parte Inferior */}
        {/* SALIDA 1 */}
        <g transform={`translate(${exitXMap.SALIDA_1 - 50}, ${exitY - 18})`}>
          <rect
            x="0"
            y="0"
            width="100"
            height="36"
            rx="6"
            fill={startExit === 'SALIDA_1' ? '#059669' : '#064e3b'}
            stroke="#10b981"
            strokeWidth="2"
          />
          <text x="50" y="22" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">
            SALIDA 1
          </text>
        </g>

        {/* Acotación de distancia 2.4 m entre salidas */}
        <g transform={`translate(${exitXMap.SALIDA_1 + 50}, ${exitY - 5})`}>
          <line x1="0" y1="0" x2="255" y2="0" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" />
          <text x="127" y="-4" textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="bold">2.4 m entre salidas</text>
        </g>

        {/* SALIDA 2 */}
        <g transform={`translate(${exitXMap.SALIDA_2 - 50}, ${exitY - 18})`}>
          <rect
            x="0"
            y="0"
            width="100"
            height="36"
            rx="6"
            fill={startExit === 'SALIDA_2' ? '#2563eb' : '#1e3a8a'}
            stroke="#3b82f6"
            strokeWidth="2"
          />
          <text x="50" y="22" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">
            SALIDA 2
          </text>
        </g>

        {/* Simulación: Ícono del Rover Virtual Arduino */}
        {currentRoverCoords && (
          <g
            transform={`translate(${currentRoverCoords.x}, ${currentRoverCoords.y})`}
            style={{ transition: 'all 0.3s ease-out' }}
          >
            <circle cx="0" cy="0" r="18" fill="#38bdf8" opacity="0.3" className="pulse-animation" />
            <circle cx="0" cy="0" r="12" fill="#0284c7" stroke="#ffffff" strokeWidth="2" />
            <path d="M -5 -5 L 5 -5 L 5 5 L -5 5 Z" fill="#ffffff" />
            <text x="0" y="22" textAnchor="middle" fill="#38bdf8" fontSize="10" fontWeight="bold">
              ROVER
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
