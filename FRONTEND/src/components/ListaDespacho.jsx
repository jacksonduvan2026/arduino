import React from 'react';
import { PackageCheck, Clock, Layers, AlertCircle, CheckCircle2, PlayCircle } from 'lucide-react';

export function ListaDespacho({ listaDespacho, currentTaskIndex, isSimulating }) {
  if (!listaDespacho || listaDespacho.length === 0) {
    return (
      <div className="card" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
        <PackageCheck size={36} style={{ marginBottom: '8px', color: '#94a3b8' }} />
        <p style={{ fontWeight: 500 }}>No hay ninguna lista de despacho generada.</p>

      </div>
    );
  }

  const getNivelBadge = (nivel) => {
    switch (nivel) {
      case 'NIVEL_1':
        return <span className="badge badge-warning" style={{ backgroundColor: '#fef08a', color: '#854d0e' }}>1er Nivel</span>;
      case 'NIVEL_2':
        return <span className="badge badge-danger" style={{ backgroundColor: '#fecaca', color: '#991b1b' }}>2do Nivel (3x T)</span>;
      case 'AMBOS':
        return <span className="badge" style={{ backgroundColor: '#ffedd5', color: '#9a3412' }}>Ambos Niveles</span>;
      default:
        return <span className="badge badge-secondary">{nivel}</span>;
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PackageCheck className="text-primary" size={20} />
          Lista de Despacho ({listaDespacho.length} tareas)
        </h3>
        <span className="badge badge-secondary">
          Máx. 3 ubicaciones por viaje
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
                <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} /> Pendiente
                </span>
              );

              if (isCurrent) {
                statusBadge = (
                  <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#fef3c7', color: '#b45309' }}>
                    <PlayCircle size={12} className="spin-animation" /> Recogiendo...
                  </span>
                );
              } else if (isCompleted) {
                statusBadge = (
                  <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={12} /> Completada
                  </span>
                );
              }

              return (
                <tr
                  key={`${task.ubicacion_id}-${idx}`}
                  style={{
                    backgroundColor: isCurrent ? '#f0f9ff' : 'transparent',
                    fontWeight: isCurrent ? '600' : 'normal'
                  }}
                >
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>#{task.orden_visita}</td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 'bold', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                      {task.codigo_ubicacion}
                    </span>
                  </td>
                  <td>
                    <div>
                      <strong style={{ fontSize: '0.85rem' }}>{task.producto_codigo}</strong>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{task.producto_descripcion}</div>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{task.cantidad_solicitada}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ color: task.cantidad_disponible < task.cantidad_solicitada ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>
                      {task.cantidad_disponible}
                    </span>
                    {task.nota_advertencia && (
                      <span title={task.nota_advertencia} style={{ marginLeft: '4px', color: '#ef4444', cursor: 'pointer' }}>
                        <AlertCircle size={14} style={{ display: 'inline' }} />
                      </span>
                    )}
                  </td>
                  <td>{getNivelBadge(task.nivel)}</td>
                  <td style={{ fontWeight: '500' }}>{task.tiempo_recogida_s}s</td>
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
