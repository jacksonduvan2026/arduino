import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Bot, Radio, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Pause, AlertTriangle } from 'lucide-react';

export function ArduinoView() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const res = await api.getArduinoStatus();
      setStatus(res);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div style={{
        padding: '16px 20px',
        backgroundColor: 'var(--warning-light)',
        border: '1px solid var(--warning-border)',
        borderRadius: 'var(--radius)',
        color: 'var(--warning)',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px'
      }}>
        <AlertTriangle size={26} style={{ flexShrink: 0 }} />
        <div>
          <strong style={{ display: 'block', fontSize: '0.98rem', letterSpacing: '0.02em' }}>
            MÓDULO ROBOT ARDUINO ROVER - CONEXIÓN PENDIENTE
          </strong>
          <span style={{ fontSize: '0.86rem', opacity: 0.9 }}>
            Los componentes de hardware (placa Arduino, sensores infrarrojos seguidor de línea y controlador de motores) están en fase de instalación física. Los mandos manuales están deshabilitados.
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Bot size={20} style={{ color: 'var(--primary)' }} />
              Estado del Robot & Telemetría de Sensores IR
            </h3>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '16px',
            backgroundColor: 'var(--danger-light)',
            border: '1px solid var(--danger-border)',
            borderRadius: 'var(--radius)',
            color: 'var(--danger)',
            marginBottom: '20px'
          }}>
            <Radio size={24} />
            <div>
              <strong>Estado de Conexión Serial / USB:</strong> {status?.estado_conexion || 'DESCONECTADO'}
              <div style={{ fontSize: '0.82rem', marginTop: '2px', opacity: 0.8 }}>Puerto COM: No Detectado</div>
            </div>
          </div>

          <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '12px' }}>
            Sensado Infrarrojo (Seguidor de Línea Negra)
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '16px' }}>
            {['Sensor Izquierdo', 'Sensor Centro', 'Sensor Derecho'].map((sensorName) => (
              <div key={sensorName} style={{
                padding: '16px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                textAlign: 'center',
                backgroundColor: 'var(--bg-surface)'
              }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>{sensorName}</span>
                <div style={{ height: '8px', backgroundColor: 'var(--border)', borderRadius: '4px', margin: '12px 0', overflow: 'hidden' }}>
                  <div style={{ width: '0%', height: '100%', backgroundColor: 'var(--primary)' }}></div>
                </div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>RAW: 0 (Sin Lectura)</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Panel de Control Manual (Bloqueado)</h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.5' }}>
            Los comandos de movimiento permanecerán bloqueados hasta que la conexión física con el Arduino sea establecida y validada.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', opacity: 0.4 }}>
            <button className="btn btn-outline" disabled><ArrowUp size={20} /></button>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-outline" disabled><ArrowLeft size={20} /></button>
              <button className="btn btn-outline" disabled><Pause size={20} /></button>
              <button className="btn btn-outline" disabled><ArrowRight size={20} /></button>
            </div>
            <button className="btn btn-outline" disabled><ArrowDown size={20} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
