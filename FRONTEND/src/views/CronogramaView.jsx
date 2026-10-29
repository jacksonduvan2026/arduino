import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Search, Download, RefreshCw, ClipboardCheck, X, Save, CalendarRange } from 'lucide-react';

export function CronogramaView() {
  const [data, setData] = useState(null);
  const [semana, setSemana] = useState('');
  const [searchRef, setSearchRef] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal registrar conteo
  const [selectedItem, setSelectedItem] = useState(null);
  const [cantFisica, setCantFisica] = useState('');
  const [observaciones, setObservaciones] = useState('');

  useEffect(() => {
    loadCronograma();
  }, [semana]);

  const loadCronograma = async () => {
    setLoading(true);
    try {
      const res = await api.getCronograma({
        semana: semana || undefined,
        q: searchRef || undefined,
      });
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadCronograma();
  };

  const handleRegenerar = async () => {
    if (confirm('¿Está seguro de regenerar el cronograma cíclico? Se recalculará la distribución de las 600 referencias para las 49 semanas.')) {
      try {
        await api.regenerarCronograma();
        alert('Cronograma regenerado exitosamente.');
        loadCronograma();
      } catch (err) {
        alert('Error al regenerar: ' + err.message);
      }
    }
  };

  const handleSaveConteo = async () => {
    if (!selectedItem || cantFisica === '') return;
    try {
      await api.registrarConteo({
        cronograma_item_id: selectedItem.id,
        cantidad_fisica: parseFloat(cantFisica),
        observaciones,
      });
      setSelectedItem(null);
      setCantFisica('');
      setObservaciones('');
      loadCronograma();
    } catch (err) {
      alert('Error al registrar conteo: ' + err.message);
    }
  };

  const semanasOptions = Array.from({ length: 49 }, (_, i) => i + 1);

  return (
    <div>
      <div className="card">
        <div className="filter-bar">
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '300px' }}>
            <select
              className="form-control"
              style={{ width: '180px' }}
              value={semana}
              onChange={(e) => setSemana(e.target.value)}
            >
              <option value="">Todas las Semanas</option>
              {semanasOptions.map((s) => (
                <option key={s} value={s}>
                  Semana {s}
                </option>
              ))}
            </select>

            <input
              type="text"
              className="form-control"
              placeholder="Buscar Referencia (Ej: REF-001)..."
              value={searchRef}
              onChange={(e) => setSearchRef(e.target.value)}
            />

            <button type="submit" className="btn btn-primary">
              <Search size={16} /> Consultar
            </button>
          </form>

          <button className="btn btn-danger" onClick={handleRegenerar}>
            <RefreshCw size={16} /> Regenerar Cronograma
          </button>

          <a href="/api/cronograma/export/csv" className="btn btn-outline" target="_blank" rel="noreferrer">
            <Download size={16} /> Exportar CSV
          </a>
        </div>

        {data?.kpis && (
          <div className="kpi-grid" style={{ marginBottom: '20px' }}>
            <div className="kpi-card">
              <div>
                <span className="kpi-label">Total Programados</span>
                <div className="kpi-value">{data.kpis.total_programados.toLocaleString()}</div>
              </div>
            </div>
            <div className="kpi-card">
              <div>
                <span className="kpi-label">Conteos Completados</span>
                <div className="kpi-value" style={{ color: 'var(--success)' }}>{data.kpis.total_completados.toLocaleString()}</div>
              </div>
            </div>
            <div className="kpi-card">
              <div>
                <span className="kpi-label">Conteos Pendientes</span>
                <div className="kpi-value" style={{ color: 'var(--primary)' }}>{data.kpis.total_pendientes.toLocaleString()}</div>
              </div>
            </div>
          </div>
        )}

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Semana</th>
                <th>Código Referencia</th>
                <th>Descripción</th>
                <th>Categoría</th>
                <th>No. Conteo</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    <div className="spin-animation" style={{ display: 'inline-block', marginBottom: '8px' }}>
                      <CalendarRange size={22} color="var(--primary)" />
                    </div>
                    <div>Cargando ítems del cronograma cíclico...</div>
                  </td>
                </tr>
              ) : !data || data.items.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    No se encontraron registros programados.
                  </td>
                </tr>
              ) : (
                data.items.map((item) => (
                  <tr key={item.id}>
                    <td><strong style={{ color: 'var(--text-main)' }}>Semana {item.semana}</strong></td>
                    <td><span className="badge badge-primary">{item.codigo_referencia}</span></td>
                    <td>{item.descripcion}</td>
                    <td><span className="badge badge-secondary">{item.categoria}</span></td>
                    <td>Conteo #{item.numero_conteo}</td>
                    <td>
                      <span className={`badge ${item.estado === 'COMPLETADO' ? 'badge-success' : 'badge-warning'}`}>
                        {item.estado}
                      </span>
                    </td>
                    <td>
                      {item.estado !== 'COMPLETADO' ? (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setSelectedItem(item);
                            setCantFisica(item.stock_sistema || 0);
                          }}
                        >
                          <ClipboardCheck size={14} /> Registrar
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Registrado</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedItem && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Registrar Conteo Físico Real</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setSelectedItem(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.9rem' }}><strong style={{ color: 'var(--text-main)' }}>Referencia:</strong> {selectedItem.codigo_referencia} - {selectedItem.descripcion}</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}><strong>Semana:</strong> {selectedItem.semana} | <strong>Conteo No:</strong> #{selectedItem.numero_conteo}</p>

              <div>
                <label className="kpi-label" style={{ marginBottom: '6px' }}>Cantidad Física Contada</label>
                <input
                  type="number"
                  className="form-control"
                  value={cantFisica}
                  onChange={(e) => setCantFisica(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="kpi-label" style={{ marginBottom: '6px' }}>Observaciones / Incidencias</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Escriba novedades en caso de diferencia con el sistema..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setSelectedItem(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSaveConteo}>
                <Save size={16} /> Confirmar Conteo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
