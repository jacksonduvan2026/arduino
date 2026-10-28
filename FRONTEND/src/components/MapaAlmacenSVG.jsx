import React from 'react';
import { AlertTriangle, Bot, MapPin, Flag } from 'lucide-react';

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
  // Dimensiones del canvas SVG
  const svgWidth = 840;
  const svgHeight = 640;

  // Mapa de coordenadas para nodos del grafo a SVG (px)
  // Col 1..7
  const colXMap = {
    1: 80,
    2: 150,
    3: 260,
    4: 330,
    5: 440,
    6: 510,
    7: 620
  };

  // Aisles X en SVG
  const aisleXMap = {
    A0: 40,
    A1: 205,
    A2: 385,
    A3: 565
  };

  // Filas 1..9 en SVG
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

  // Convertir id de nodo de grafo (ej: "A1_Y3", "SALIDA_1", "BOTTOM_A2", "TOP_A0") a coordenadas SVG
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

  // Color según el nivel de recogida
  const getNivelColor = (nivel) => {
    switch (nivel) {
      case 'NIVEL_1':
        return { fill: '#fef08a', stroke: '#eab308', text: '#854d0e', label: 'Nivel 1 (Amarillo)' };
      case 'NIVEL_2':
        return { fill: '#fecaca', stroke: '#ef4444', text: '#991b1b', label: 'Nivel 2 (Rojo)' };
      case 'AMBOS':
        return { fill: '#ffedd5', stroke: '#f97316', text: '#9a3412', label: 'Ambos Niveles (Naranja)' };
      default:
        return { fill: '#e2e8f0', stroke: '#94a3b8', text: '#334155', label: 'Sin Nivel' };
    }
  };

  // Generar polyline string para los waypoints activos
  const routePolylinePoints = activeRouteWaypoints
    ? activeRouteWaypoints.map((node) => {
        const c = getWayPointSvgCoords(node);
        return `${c.x},${c.y}`;
      }).join(' ')
    : '';

  // Posición del rover en SVG
  const currentRoverCoords = roverCoords || getWayPointSvgCoords(roverPositionNode || startExit);

  return (
    <div className="mapa-svg-container" style={{ position: 'relative', width: '100%', overflowX: 'auto', background: '#0f172a', borderRadius: '8px', padding: '16px' }}>
      {/* Leyenda superior y dimensiones */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px', color: '#f8fafc', fontSize: '0.82rem' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#eab308' }}></span> Nivel 1
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#ef4444' }}></span> Nivel 2 (3x T)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#f97316' }}></span> Ambos Niveles
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid #3b82f6', backgroundColor: '#2563eb' }}></span> Seleccionada
          </span>
        </div>

        <div style={{ fontSize: '0.75rem', color: '#94a3b8', background: '#1e293b', padding: '4px 10px', borderRadius: '4px' }}>
          Dimensiones ref: 2,4m | 1,0m | 2,1m | 5,0m | 2,0m
        </div>
      </div>

      <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Fondo del Almacén */}
        <rect x="10" y="10" width={svgWidth - 20} height={svgHeight - 20} fill="#1e293b" rx="8" stroke="#334155" strokeWidth="2" />

        {/* Pasillos Transitables - Líneas Guía del Grafo */}
        <g stroke="#334155" strokeWidth="2" strokeDasharray="4,4">
          {/* Pasillo superior */}
          <line x1={aisleXMap.A0} y1={topAisleY} x2={aisleXMap.A3} y2={topAisleY} />
          {/* Pasillo inferior */}
          <line x1={aisleXMap.A0} y1={bottomAisleY} x2={aisleXMap.A3} y2={bottomAisleY} />

          {/* Pasillos verticales */}
          {Object.entries(aisleXMap).map(([aisleKey, xVal]) => (
            <line key={aisleKey} x1={xVal} y1={topAisleY} x2={xVal} y2={bottomAisleY} />
          ))}

          {/* Conexiones a salidas */}
          <line x1={exitXMap.SALIDA_1} y1={exitY} x2={aisleXMap.A0} y2={bottomAisleY} stroke="#10b981" strokeWidth="2" />
          <line x1={exitXMap.SALIDA_1} y1={exitY} x2={aisleXMap.A1} y2={bottomAisleY} stroke="#10b981" strokeWidth="2" />
          <line x1={exitXMap.SALIDA_2} y1={exitY} x2={aisleXMap.A2} y2={bottomAisleY} stroke="#3b82f6" strokeWidth="2" />
          <line x1={exitXMap.SALIDA_2} y1={exitY} x2={aisleXMap.A3} y2={bottomAisleY} stroke="#3b82f6" strokeWidth="2" />
        </g>

        {/* Bloques de Racks (Fondo visual) */}
        {/* Bloque 1 (Col 1-2) */}
        <rect x="70" y="45" width="90" height="430" fill="#0f172a" rx="4" stroke="#475569" strokeWidth="1" opacity="0.6" />
        {/* Bloque 2 (Col 3-4) */}
        <rect x="250" y="45" width="90" height="430" fill="#0f172a" rx="4" stroke="#475569" strokeWidth="1" opacity="0.6" />
        {/* Bloque 3 (Col 5-6) */}
        <rect x="430" y="45" width="90" height="430" fill="#0f172a" rx="4" stroke="#475569" strokeWidth="1" opacity="0.6" />
        {/* Bloque 4 (Col 7) */}
        <rect x="610" y="45" width="45" height="430" fill="#0f172a" rx="4" stroke="#475569" strokeWidth="1" opacity="0.6" />

        {/* Separadores de Pasillos */}
        <text x="205" y="35" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="bold">PASILLO 1</text>
        <text x="385" y="35" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="bold">PASILLO 2</text>
        <text x="565" y="35" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="bold">PASILLO 3</text>

        {/* Ruta Planificada (Polyline trazada por waypoints del pasillo) */}
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

        {/* Renderizado de Ubicaciones en la Cuadrícula */}
        {ubicaciones && ubicaciones.map((u) => {
          const x = colXMap[u.columna] || 0;
          const y = rowYMap[u.fila] || 0;
          const isSelected = selectedLocIds.includes(u.id);
          const color = getNivelColor(u.nivel);
          const isDup = u.es_duplicado;

          return (
            <g
              key={u.id}
              transform={`translate(${x - 24}, ${y - 18})`}
              onClick={() => onToggleSelect(u.id)}
              style={{ cursor: 'pointer' }}
            >
              {/* Recuadro de la Ubicación */}
              <rect
                x="0"
                y="0"
                width="48"
                height="36"
                rx="5"
                fill={isSelected ? '#3b82f6' : color.fill}
                stroke={isSelected ? '#2563eb' : color.stroke}
                strokeWidth={isSelected ? '3' : '1.5'}
                filter={isSelected ? 'drop-shadow(0px 0px 6px rgba(59, 130, 246, 0.8))' : 'none'}
              />

              {/* Código Visible */}
              <text
                x="24"
                y="20"
                textAnchor="middle"
                fill={isSelected ? '#ffffff' : color.text}
                fontSize="12"
                fontWeight="bold"
                fontFamily="sans-serif"
              >
                {u.codigo_visible}
              </text>

              {/* Indicador de Inconsistencia (Insignia si es código duplicado 22 o 35) */}
              {isDup && (
                <g transform="translate(32, -4)">
                  <circle cx="6" cy="6" r="7" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
                  <text x="6" y="9" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="bold">!</text>
                </g>
              )}

              {/* Indicador de Selección Badge (Orden de visita) */}
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
            {/* Halo / Resplandor Rover */}
            <circle cx="0" cy="0" r="18" fill="#38bdf8" opacity="0.3" className="pulse-animation" />
            <circle cx="0" cy="0" r="12" fill="#0284c7" stroke="#ffffff" strokeWidth="2" />
            {/* Ícono Rover */}
            <path
              d="M -5 -5 L 5 -5 L 5 5 L -5 5 Z"
              fill="#ffffff"
            />
            <text x="0" y="22" textAnchor="middle" fill="#38bdf8" fontSize="10" fontWeight="bold">
              ROVER
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
