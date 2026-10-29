import React from 'react';
import { Route, TrendingDown, Zap, Info } from 'lucide-react';

export function ComparacionRutas({ rutaCalculada }) {
  if (!rutaCalculada) return null;

  const { ruta_inicial, ruta_optimizada, comparacion } = rutaCalculada;

  return (
    <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
      <div className="card-header">
        <h3 className="card-title">
          <Route size={20} style={{ color: 'var(--primary)' }} />
          Comparación y Optimización del Recorrido
        </h3>
        <span className="badge badge-success" style={{ fontSize: '0.82rem', padding: '6px 12px' }}>
          <TrendingDown size={14} />
          {comparacion.porcentaje_mejora_distancia}% Ahorro en Distancia
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        {/* Ruta Inicial */}
        <div style={{ backgroundColor: 'var(--bg-surface)', padding: '18px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-muted)' }}>Ruta Inicial (Secuencial)</h4>
            <span className="badge badge-secondary">Sin optimizar</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Distancia Total:</span>
              <strong>{ruta_inicial.distancia_total_m} m</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Número de Viajes:</span>
              <strong>{ruta_inicial.numero_viajes} viaje(s)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>T. Desplazamiento:</span>
              <span>{ruta_inicial.tiempo_desplazamiento_s} s</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>T. Recogida:</span>
              <span>{ruta_inicial.tiempo_recogida_s} s</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
              <span style={{ fontWeight: 600 }}>Tiempo Total Estimado:</span>
              <strong style={{ color: 'var(--text-main)' }}>{ruta_inicial.tiempo_total_s} s ({ruta_inicial.tiempo_total_min} min)</strong>
            </div>
          </div>
        </div>

        {/* Ruta Optimizada */}
        <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', padding: '18px', borderRadius: 'var(--radius)', border: '1px solid var(--success-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={16} fill="var(--success)" color="var(--success)" /> Ruta Optimizada
            </h4>
            <span className="badge badge-success">Óptimo Calculado</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Distancia Total:</span>
              <strong style={{ color: 'var(--success)', fontSize: '1.05rem' }}>{ruta_optimizada.distancia_total_m} m</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Número de Viajes:</span>
              <strong>{ruta_optimizada.numero_viajes} viaje(s)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>T. Desplazamiento:</span>
              <span>{ruta_optimizada.tiempo_desplazamiento_s} s</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>T. Recogida:</span>
              <span>{ruta_optimizada.tiempo_recogida_s} s</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--success-border)', paddingTop: '8px', marginTop: '4px' }}>
              <span style={{ fontWeight: 600, color: 'var(--success)' }}>Tiempo Total Estimado:</span>
              <strong style={{ color: 'var(--success)', fontSize: '1.05rem' }}>{ruta_optimizada.tiempo_total_s} s ({ruta_optimizada.tiempo_total_min} min)</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Explicación del Algoritmo */}
      <div style={{ backgroundColor: 'var(--bg-surface)', padding: '14px 18px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: '0.84rem', color: 'var(--text-muted)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <Info size={18} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--primary)' }} />
        <div>
          <strong style={{ color: 'var(--text-main)' }}>Criterio de Optimización:</strong> {comparacion.criterio_optimizacion}
        </div>
      </div>
    </div>
  );
}
