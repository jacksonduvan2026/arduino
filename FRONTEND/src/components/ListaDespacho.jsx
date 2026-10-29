import React from 'react';
import { PackageCheck, Clock, AlertCircle, CheckCircle2, PlayCircle } from 'lucide-react';

export function ListaDespacho({ listaDespacho, currentTaskIndex, isSimulating }) {
  if (!listaDespacho || listaDespacho.length === 0) {
    return (
      <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <PackageCheck size={36} style={{ marginBottom: '8px', color: 'var(--text-subtle)' }} />
        <p style={{ fontWeight: 500 }}>No hay ninguna lista de despacho generada para esta ruta.</p>
      </div>
    );
  }

  const getNivelBadge = (nivel) => {
    switch (nivel) {
      case 'NIVEL_1':
        return <span className="badge badge-warning">1er Nivel (15s)</span>;
      case 'NIVEL_2':
        return <span className="badge badge-danger">2do Nivel (45s - 3x)</span>;
      case 'AMBOS':
        return <span className="badge" style={{ backgroundColor: 'rgba(234, 88, 12, 0.2)', color: '#ea580c', border: '1px solid #ea580c' }}>Ambos Niveles (60s)</span>;
      default:
        return <span className="badge badge-secondary">{nivel}</span>;
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">
          <PackageCheck size={20} style={{ color: 'var(--primary)' }} />
          Lista de Despacho y Tareas de Recogida ({listaDespacho.length} tareas)
        </h3>
        <span className="badge badge-secondary">
          Restricción: Máx. 3 ubicaciones por viaje
        </span>
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Orden</th>
              <th>Ubicación</th>
              <th>Referencia & Producto</th>
              <th>Cant. Solicitada</th>
              <th>Stock Dispon.</th>
              <th>Nivel</th>
              <th>Tiempo Est.</th>
              <th>Estado Tarea</th>
            </tr>
          </thead>
          <tbody>
            {listaDespacho.map((task, idx) => {
              const isCurrent = isSimulating && idx === currentTaskIndex;
              const isCompleted = isSimulating && idx < currentTaskIndex;

              let statusBadge = (
                <span className="badge badge-secondary">
                  <Clock size={12} /> Pendiente
                </span>
              );

              if (isCurrent) {
                statusBadge = (
                  <span className="badge badge-warning" style={{ fontWeight: 'bold' }}>
                    <PlayCircle size={12} className="spin-animation" /> Recogiendo...
                  </span>
                );
              } else if (isCompleted) {
                statusBadge = (
                  <span className="badge badge-success">
                    <CheckCircle2 size={12} /> Completada
                  </span>
                );
              }

              return (
                <tr
                  key={`${task.ubicacion_id}-${idx}`}
                  style={{
                    backgroundColor: isCurrent ? 'rgba(255, 23, 68, 0.08)' : 'transparent',
                    fontWeight: isCurrent ? '600' : 'normal'
                  }}
                >
                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--primary)' }}>#{task.orden_visita}</td>
                  <td>
                    <span className="badge badge-primary" style={{ fontFamily: 'monospace' }}>
                      {task.codigo_ubicacion}
                    </span>
                  </td>
                  <td>
                    <div>
                      <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{task.producto_codigo}</strong>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{task.producto_descripcion}</div>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{task.cantidad_solicitada}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ color: task.cantidad_disponible < task.cantidad_solicitada ? 'var(--danger)' : 'var(--success)', fontWeight: 'bold' }}>
                      {task.cantidad_disponible}
                    </span>
                    {task.nota_advertencia && (
                      <span title={task.nota_advertencia} style={{ marginLeft: '4px', color: 'var(--danger)', cursor: 'pointer' }}>
                        <AlertCircle size={14} style={{ display: 'inline' }} />
                      </span>
                    )}
                  </td>
                  <td>{getNivelBadge(task.nivel)}</td>
                  <td style={{ fontWeight: '600', color: 'var(--text-main)' }}>{task.tiempo_recogida_s}s</td>
                  <td>{statusBadge}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
