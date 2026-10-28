import React from 'react';
import { Route, TrendingDown, Zap, Info, CheckCircle2 } from 'lucide-react';

export function ComparacionRutas({ rutaCalculada }) {
  if (!rutaCalculada) return null;

  const { ruta_inicial, ruta_optimizada, comparacion } = rutaCalculada;

  return (
    <div className="card" style={{ borderLeft: '4px solid #2563eb' }}>
      <div className="card-header">
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Route className="text-primary" size={20} />
          Comparación y Optimización de Recorrido
        </h3>
        <span className="badge badge-success" style={{ fontSize: '0.82rem', padding: '6px 12px' }}>
          <TrendingDown size={14} style={{ marginRight: '4px' }} />
          {comparacion.porcentaje_mejora_distancia}% Ahorro en Distancia
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        {/* Ruta Inicial */}
        <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#475569' }}>Ruta Inicial (Secuencial)</h4>
            <span className="badge badge-secondary">Sin optimizar</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Distancia Total:</span>
              <strong>{ruta_inicial.distancia_total_m} m</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Número de Viajes:</span>
              <strong>{ruta_inicial.numero_viajes} viaje(s)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>T. Desplazamiento:</span>
              <span>{ruta_inicial.tiempo_desplazamiento_s} s</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>T. Recogida:</span>
              <span>{ruta_inicial.tiempo_recogida_s} s</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: '6px', marginTop: '4px' }}>
              <span style={{ fontWeight: 'bold' }}>Tiempo Total Estimado:</span>
              <strong style={{ color: '#0f172a' }}>{ruta_inicial.tiempo_total_s} s ({ruta_inicial.tiempo_total_min} min)</strong>
            </div>
          </div>
        </div>

        {/* Ruta Optimizada */}
        <div style={{ backgroundColor: '#f0fdf4', padding: '16px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={16} fill="#16a34a" color="#16a34a" /> Ruta Optimizada
            </h4>
            <span className="badge badge-success">Óptimo Calculado</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#15803d' }}>Distancia Total:</span>
              <strong style={{ color: '#166534', fontSize: '1rem' }}>{ruta_optimizada.distancia_total_m} m</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#15803d' }}>Número de Viajes:</span>
              <strong>{ruta_optimizada.numero_viajes} viaje(s)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#15803d' }}>T. Desplazamiento:</span>
              <span>{ruta_optimizada.tiempo_desplazamiento_s} s</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#15803d' }}>T. Recogida:</span>
              <span>{ruta_optimizada.tiempo_recogida_s} s</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #86efac', paddingTop: '6px', marginTop: '4px' }}>
              <span style={{ fontWeight: 'bold', color: '#166534' }}>Tiempo Total Estimado:</span>
              <strong style={{ color: '#15803d', fontSize: '1rem' }}>{ruta_optimizada.tiempo_total_s} s ({ruta_optimizada.tiempo_total_min} min)</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Explicación del Algoritmo */}
      <div style={{ backgroundColor: '#eff6ff', padding: '14px 18px', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '0.84rem', color: '#1e40af', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <Info size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong>Criterio de Optimización:</strong> {comparacion.criterio_optimizacion}
        </div>
      </div>
    </div>
  );
}
