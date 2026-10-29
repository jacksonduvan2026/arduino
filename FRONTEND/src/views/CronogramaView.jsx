import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import {
  Search,
  Download,
  PlusCircle,
  ClipboardCheck,
  X,
  Save,
  CalendarRange,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCcw,
  Eye,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  MapPin,
  FileSpreadsheet,
  Ban
} from 'lucide-react';

export function CronogramaView() {
  const [data, setData] = useState(null);
  const [semana, setSemana] = useState('');
  const [searchRef, setSearchRef] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [ubicacionFilter, setUbicacionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Modal para Inicio de Nuevo Ciclo / Vista Previa
  const [showInicioModal, setShowInicioModal] = useState(false);
  const [fechaInicioInput, setFechaInicioInput] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [nombreCiclo, setNombreCiclo] = useState('Cronograma Cíclico Anual');
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  // Modal Registrar Conteo Físico Real
  const [selectedItem, setSelectedItem] = useState(null);
  const [cantFisica, setCantFisica] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [usuarioOperador, setUsuarioOperador] = useState('Operador Bodega');
  const [submittingConteo, setSubmittingConteo] = useState(false);

  // Modal Detalle e Historial de Referencia
  const [refHistorial, setRefHistorial] = useState(null);
  const [loadingRefHistorial, setLoadingRefHistorial] = useState(false);

  // Modal Reprogramar Asignación
  const [reprogramarItem, setReprogramarItem] = useState(null);
  const [nuevaSemanaInput, setNuevaSemanaInput] = useState('');
  const [motivoReprogramacion, setMotivoReprogramacion] = useState('');

  // Modal Anular Asignación
  const [anularItem, setAnularItem] = useState(null);
  const [justificacionAnulacion, setJustificacionAnulacion] = useState('');

  useEffect(() => {
    loadCronograma();
  }, [semana, estadoFilter, page]);

  const loadCronograma = async () => {
    setLoading(true);
    try {
      const res = await api.getCronograma({
        semana: semana || undefined,
        q: searchRef || undefined,
        estado: estadoFilter || undefined,
        ubicacion: ubicacionFilter || undefined,
        page,
        limit: 25
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
    setPage(1);
    loadCronograma();
  };

  const handleGenerarPreview = async () => {
    if (!fechaInicioInput) return;
    setPreviewLoading(true);
    setPreviewError('');
    try {
      const res = await api.getCronogramaPreview({ fecha_inicio: fechaInicioInput });
      setPreviewData(res);
    } catch (err) {
      setPreviewError(err.message || 'Error generando vista previa');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmarInicioCiclo = async () => {
    if (!fechaInicioInput) return;
    try {
      await api.iniciarCicloCronograma({
        fecha_inicio: fechaInicioInput,
        nombre: nombreCiclo,
        confirmar_sobrescribir: true
      });
      alert('Nuevo ciclo de inventario cíclico iniciado y guardado con éxito.');
      setShowInicioModal(false);
      setPreviewData(null);
      loadCronograma();
    } catch (err) {
      alert('Error iniciando ciclo: ' + err.message);
    }
  };

  const handleSaveConteo = async () => {
    if (!selectedItem || cantFisica === '') return;
    setSubmittingConteo(true);
    try {
      await api.registrarConteo({
        cronograma_item_id: selectedItem.id,
        cantidad_fisica: parseFloat(cantFisica),
        observaciones,
        usuario: usuarioOperador
      });
      setSelectedItem(null);
      setCantFisica('');
      setObservaciones('');
      loadCronograma();
    } catch (err) {
      alert('Error al registrar conteo: ' + err.message);
    } finally {
      setSubmittingConteo(false);
    }
  };

  const handleReprogramar = async () => {
    if (!reprogramarItem || !nuevaSemanaInput) return;
    try {
      await api.reprogramarAsignacion({
        cronograma_item_id: reprogramarItem.id,
        nueva_semana: parseInt(nuevaSemanaInput, 10),
        motivo: motivoReprogramacion
      });
      alert(`Asignación reprogramada con éxito a la semana ${nuevaSemanaInput}.`);
      setReprogramarItem(null);
      setNuevaSemanaInput('');
      setMotivoReprogramacion('');
      loadCronograma();
    } catch (err) {
      alert('Error reprogramando asignación: ' + err.message);
    }
  };

  const handleAnular = async () => {
    if (!anularItem || !justificacionAnulacion.trim()) {
      alert('Se requiere ingresar una justificación obligatoria para anular.');
      return;
    }
    try {
      await api.anularAsignacion({
        cronograma_item_id: anularItem.id,
        justificacion: justificacionAnulacion
      });
      alert('Asignación anulada.');
      setAnularItem(null);
      setJustificacionAnulacion('');
      loadCronograma();
    } catch (err) {
      alert('Error anulando asignación: ' + err.message);
    }
  };

  const handleViewHistorialRef = async (codigo) => {
    setLoadingRefHistorial(true);
    try {
      const res = await api.getReferenciaHistorial(codigo);
      setRefHistorial(res);
    } catch (err) {
      alert('Error consultando historial: ' + err.message);
    } finally {
      setLoadingRefHistorial(false);
    }
  };

  const totalSemanasCiclo = data?.semanas_resumen?.length || 49;
  const semanasOptions = Array.from({ length: totalSemanasCiclo }, (_, i) => i + 1);

  return (
    <div>
      {/* Botón Superior de Acción e Indicadores */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <CalendarRange size={22} color="var(--primary)" />
            <span>Módulo de Inventario Cíclico</span>
            {data?.nombre && <span className="badge badge-primary">{data.nombre}</span>}
            {data?.fecha_inicio && (
              <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={12} /> Inicio: {data.fecha_inicio}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-primary" onClick={() => setShowInicioModal(true)}>
              <PlusCircle size={16} /> Iniciar Nuevo Ciclo
            </button>
            <a href="/api/cronograma/export/csv" className="btn btn-outline" target="_blank" rel="noreferrer">
              <Download size={16} /> Exportar CSV
            </a>
          </div>
        </div>

        {/* Panel General de Indicadores (KPIs reales) */}
        {data?.kpis && (
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-icon-wrapper red">
                <Layers size={22} />
              </div>
              <div>
                <span className="kpi-label">Referencias Elegibles</span>
                <div className="kpi-value">{data.kpis.referencias_elegibles.toLocaleString()}</div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {data.kpis.referencias_completadas_5} con 5/5 conteos
                </span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon-wrapper green">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <span className="kpi-label">Conteos Confirmados</span>
                <div className="kpi-value" style={{ color: 'var(--success)' }}>
                  {data.kpis.conteos_confirmados.toLocaleString()}
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  de {data.kpis.conteos_programados.toLocaleString()} programados ({data.kpis.progreso_general}%)
                </span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon-wrapper warning">
                <Clock size={22} />
              </div>
              <div>
                <span className="kpi-label">Pendientes / Atrasados</span>
                <div className="kpi-value" style={{ color: 'var(--warning)' }}>
                  {data.kpis.conteos_pendientes.toLocaleString()}
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--danger)' }}>
                  {data.kpis.conteos_atrasados} atrasados de semanas pasadas
                </span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon-wrapper info">
                <CalendarRange size={22} />
              </div>
              <div>
                <span className="kpi-label">Semana Actual</span>
                <div className="kpi-value" style={{ color: 'var(--info)' }}>
                  Semana {data.semana_actual}
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Cumplimiento sem: {data.kpis.cumplimiento_semanal}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Barra de Filtros */}
        <div className="filter-bar">
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '300px', flexWrap: 'wrap' }}>
            <select
              className="form-control"
              style={{ width: '160px' }}
              value={semana}
              onChange={(e) => {
                setSemana(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas las Semanas</option>
              {semanasOptions.map((s) => (
                <option key={s} value={s}>
                  Semana {s} {s === data?.semana_actual ? '(Actual)' : ''}
                </option>
              ))}
            </select>

            <select
              className="form-control"
              style={{ width: '160px' }}
              value={estadoFilter}
              onChange={(e) => {
                setEstadoFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos los Estados</option>
              <option value="PENDIENTE">PENDIENTE</option>
              <option value="ATRASADO">ATRASADO</option>
              <option value="COMPLETADO">COMPLETADO</option>
              <option value="ANULADO">ANULADO</option>
            </select>

            <input
              type="text"
              className="form-control"
              style={{ width: '220px' }}
              placeholder="Buscar Referencia / Código..."
              value={searchRef}
              onChange={(e) => setSearchRef(e.target.value)}
            />

            <input
              type="text"
              className="form-control"
              style={{ width: '180px' }}
              placeholder="Ubicación..."
              value={ubicacionFilter}
              onChange={(e) => setUbicacionFilter(e.target.value)}
            />

            <button type="submit" className="btn btn-primary">
              <Search size={16} /> Buscar
            </button>
          </form>
        </div>

        {/* Tabla de Programación Semanal */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Semana</th>
                <th>Fecha Prog.</th>
                <th>Código Referencia</th>
                <th>Descripción</th>
                <th>Ubicación</th>
                <th>Avance Ref</th>
                <th>No. Conteo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    <div className="spin-animation" style={{ display: 'inline-block', marginBottom: '8px' }}>
                      <CalendarRange size={24} color="var(--primary)" />
                    </div>
                    <div>Cargando cronograma y asignaciones semanales...</div>
                  </td>
                </tr>
              ) : !data || data.items.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No se encontraron asignaciones programadas para los filtros aplicados.
                  </td>
                </tr>
              ) : (
                data.items.map((item) => {
                  const isAtrasado = item.estado === 'ATRASADO';
                  const isCompletado = item.estado === 'COMPLETADO';
                  const isAnulado = item.estado === 'ANULADO';

                  return (
                    <tr key={item.id}>
                      <td>
                        <strong style={{ color: item.semana === data.semana_actual ? 'var(--primary)' : 'var(--text-main)' }}>
                          Semana {item.semana}
                        </strong>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          {item.fecha_programada}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ padding: '2px 8px', fontSize: '0.78rem' }}
                          onClick={() => handleViewHistorialRef(item.codigo_referencia)}
                          title="Ver historial completo de la referencia"
                        >
                          <Eye size={12} /> {item.codigo_referencia}
                        </button>
                      </td>
                      <td>{item.descripcion}</td>
                      <td>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-subtle)' }}>
                          <MapPin size={12} inline style={{ marginRight: '4px' }} />
                          {item.ubicacion}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${item.conteos_confirmados_ref >= 5 ? 'badge-success' : 'badge-secondary'}`}>
                          {item.conteos_confirmados_ref} / 5
                        </span>
                      </td>
                      <td>Conteo #{item.numero_conteo}</td>
                      <td>
                        {isCompletado && <span className="badge badge-success"><CheckCircle2 size={12} /> COMPLETADO</span>}
                        {isAtrasado && <span className="badge badge-danger"><AlertTriangle size={12} /> ATRASADO</span>}
                        {!isCompletado && !isAtrasado && !isAnulado && <span className="badge badge-warning"><Clock size={12} /> PENDIENTE</span>}
                        {isAnulado && <span className="badge badge-secondary"><Ban size={12} /> ANULADO</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {!isCompletado && !isAnulado && (
                            <>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => {
                                  setSelectedItem(item);
                                  setCantFisica(item.stock_sistema || 0);
                                  setObservaciones('');
                                }}
                                title="Registrar conteo físico real"
                              >
                                <ClipboardCheck size={14} /> Registrar
                              </button>
                              <button
                                className="btn btn-outline btn-sm"
                                onClick={() => {
                                  setReprogramarItem(item);
                                  setNuevaSemanaInput(item.semana);
                                }}
                                title="Reprogramar asignación a otra semana"
                              >
                                <RotateCcw size={14} />
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => {
                                  setAnularItem(item);
                                  setJustificacionAnulacion('');
                                }}
                                title="Anular conteo con justificación"
                              >
                                <Ban size={14} />
                              </button>
                            </>
                          )}
                          {isCompletado && (
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => handleViewHistorialRef(item.codigo_referencia)}
                            >
                              <Eye size={14} /> Historial
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {data?.pagination && data.pagination.total_pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', padding: '0 8px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Mostrando {data.items.length} de {data.pagination.total} asignaciones (Página {data.pagination.page} de {data.pagination.total_pages})
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-outline btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={16} /> Anterior
              </button>
              <button
                className="btn btn-outline btn-sm"
                disabled={page >= data.pagination.total_pages}
                onClick={() => setPage((p) => Math.min(data.pagination.total_pages, p + 1))}
              >
                Siguiente <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: Iniciar Nuevo Ciclo y Generar Vista Previa */}
      {showInicioModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CalendarRange size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Programación e Inicio de Inventario Cíclico</h3>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setShowInicioModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div>
                <label className="kpi-label" style={{ marginBottom: '6px' }}>Nombre del Ciclo</label>
                <input
                  type="text"
                  className="form-control"
                  value={nombreCiclo}
                  onChange={(e) => setNombreCiclo(e.target.value)}
                />
              </div>

              <div>
                <label className="kpi-label" style={{ marginBottom: '6px' }}>Fecha Inicial del Ciclo</label>
                <input
                  type="date"
                  className="form-control"
                  value={fechaInicioInput}
                  onChange={(e) => {
                    setFechaInicioInput(e.target.value);
                    setPreviewData(null);
                  }}
                />
              </div>

              <div style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleGenerarPreview}
                  disabled={previewLoading || !fechaInicioInput}
                >
                  {previewLoading ? <div className="spin-animation"><RotateCcw size={16} /></div> : <Eye size={16} />}
                  Generar Vista Previa & Validar Algoritmo
                </button>
              </div>

              {previewError && (
                <div style={{ padding: '12px', background: 'var(--danger-light)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius)', color: 'var(--danger)', fontSize: '0.85rem' }}>
                  <AlertTriangle size={16} inline style={{ marginRight: '6px' }} />
                  {previewError}
                </div>
              )}

              {previewData && (
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {previewData.tiene_ciclo_activo && (
                    <div style={{ padding: '10px', background: 'var(--warning-light)', border: '1px solid var(--warning-border)', borderRadius: 'var(--radius-sm)', color: 'var(--warning)', fontSize: '0.82rem' }}>
                      <AlertTriangle size={16} inline style={{ marginRight: '6px' }} />
                      <strong>Advertencia:</strong> Ya existe un ciclo activo (ID: {previewData.ciclo_activo_id}). Iniciar este nuevo ciclo archivará el ciclo anterior manteniendo todo el historial.
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.85rem' }}>
                    <div>
                      <span className="kpi-label">Referencias Elegibles</span>
                      <strong style={{ color: 'var(--text-main)', display: 'block', fontSize: '1.1rem' }}>{previewData.referencias_elegibles} referencias</strong>
                    </div>
                    <div>
                      <span className="kpi-label">Conteos Objetivo (x5)</span>
                      <strong style={{ color: 'var(--primary)', display: 'block', fontSize: '1.1rem' }}>{previewData.total_conteos_objetivo.toLocaleString()} conteos</strong>
                    </div>
                    <div>
                      <span className="kpi-label">Duración Estimada</span>
                      <strong style={{ color: 'var(--text-main)', display: 'block' }}>{previewData.total_semanas_estimadas} semanas (~{(previewData.total_semanas_estimadas / 4.33).toFixed(1)} meses)</strong>
                    </div>
                    <div>
                      <span className="kpi-label">Fecha Fin Estimada</span>
                      <strong style={{ color: 'var(--text-main)', display: 'block' }}>{previewData.fecha_fin_estimada}</strong>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.82rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                    <CheckCircle2 size={16} />
                    {previewData.mensaje_validacion}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowInicioModal(false)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={!previewData || !previewData.es_valido}
                onClick={handleConfirmarInicioCiclo}
              >
                <Save size={16} /> Confirmar e Iniciar Ciclo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Registrar Conteo Físico Real */}
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
              <div style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: '0.9rem', marginBottom: '4px' }}>
                  <strong style={{ color: 'var(--text-main)' }}>Referencia:</strong> <span className="badge badge-primary">{selectedItem.codigo_referencia}</span> {selectedItem.descripcion}
                </p>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  <strong>Ubicación:</strong> {selectedItem.ubicacion} | <strong>Semana:</strong> {selectedItem.semana} | <strong>Conteo:</strong> #{selectedItem.numero_conteo} de 5
                </p>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  <strong>Stock en Sistema:</strong> <span style={{ color: 'var(--info)', fontWeight: 700 }}>{selectedItem.stock_sistema}</span>
                </p>
              </div>

              <div>
                <label className="kpi-label" style={{ marginBottom: '6px' }}>Cantidad Física Encontrada</label>
                <input
                  type="number"
                  step="any"
                  className="form-control"
                  style={{ fontSize: '1.2rem', fontWeight: 700 }}
                  value={cantFisica}
                  onChange={(e) => setCantFisica(e.target.value)}
                  autoFocus
                />
              </div>

              {cantFisica !== '' && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  background: (parseFloat(cantFisica) - selectedItem.stock_sistema) === 0 ? 'var(--success-light)' : 'var(--warning-light)',
                  border: '1px solid',
                  borderColor: (parseFloat(cantFisica) - selectedItem.stock_sistema) === 0 ? 'var(--success-border)' : 'var(--warning-border)',
                  color: (parseFloat(cantFisica) - selectedItem.stock_sistema) === 0 ? 'var(--success)' : 'var(--warning)'
                }}>
                  Diferencia de Inventario: {(parseFloat(cantFisica) - selectedItem.stock_sistema) > 0 ? `+${(parseFloat(cantFisica) - selectedItem.stock_sistema)}` : (parseFloat(cantFisica) - selectedItem.stock_sistema)}
                </div>
              )}

              <div>
                <label className="kpi-label" style={{ marginBottom: '6px' }}>Operador Responsable</label>
                <input
                  type="text"
                  className="form-control"
                  value={usuarioOperador}
                  onChange={(e) => setUsuarioOperador(e.target.value)}
                />
              </div>

              <div>
                <label className="kpi-label" style={{ marginBottom: '6px' }}>Observaciones e Incidencias</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Detalle si hubo empaque dañado, faltante, error de ubicación..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setSelectedItem(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveConteo}
                disabled={submittingConteo || cantFisica === ''}
              >
                {submittingConteo ? <div className="spin-animation"><RotateCcw size={16} /></div> : <Save size={16} />} Confirmar Conteo Físico
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Detalle e Historial Completo de Referencia */}
      {refHistorial && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '720px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Eye size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                  Historial de Referencia: {refHistorial.codigo_referencia}
                </h3>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setRefHistorial(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-surface)', padding: '14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div>
                  <span className="kpi-label">Descripción</span>
                  <strong style={{ color: 'var(--text-main)', display: 'block', fontSize: '0.95rem' }}>{refHistorial.descripcion}</strong>
                </div>
                <div>
                  <span className="kpi-label">Categoría & Ubicación</span>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.85rem' }}>{refHistorial.categoria} | {refHistorial.ubicacion}</span>
                </div>
                <div>
                  <span className="kpi-label">Stock Actual</span>
                  <strong style={{ color: 'var(--info)', display: 'block', fontSize: '1.1rem' }}>{refHistorial.stock_actual} unidades</strong>
                </div>
                <div>
                  <span className="kpi-label">Progreso del Ciclo</span>
                  <span className={`badge ${refHistorial.metricas_ciclo.objetivo_alcanzado ? 'badge-success' : 'badge-warning'}`}>
                    {refHistorial.metricas_ciclo.conteos_confirmados} de 5 Conteos Confirmados {refHistorial.metricas_ciclo.objetivo_alcanzado ? '(Completado 5/5)' : ''}
                  </span>
                </div>
              </div>

              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginTop: '8px' }}>Asignaciones y Conteos en el Ciclo:</h4>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Semana</th>
                      <th>Fecha Prog.</th>
                      <th>Estado</th>
                      <th>Cant. Sistema</th>
                      <th>Cant. Física</th>
                      <th>Diferencia</th>
                      <th>Fecha Confirmación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {refHistorial.historial_asignaciones.map((asig) => (
                      <tr key={asig.cronograma_item_id}>
                        <td><strong>Semana {asig.semana}</strong></td>
                        <td>{asig.fecha_programada}</td>
                        <td>
                          <span className={`badge ${asig.estado === 'COMPLETADO' ? 'badge-success' : asig.estado === 'ANULADO' ? 'badge-secondary' : 'badge-warning'}`}>
                            {asig.estado}
                          </span>
                        </td>
                        <td>{asig.cantidad_sistema}</td>
                        <td>{asig.cantidad_fisica !== null ? asig.cantidad_fisica : '-'}</td>
                        <td>
                          {asig.diferencia !== null ? (
                            <span style={{ color: asig.diferencia === 0 ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
                              {asig.diferencia > 0 ? `+${asig.diferencia}` : asig.diferencia}
                            </span>
                          ) : '-'}
                        </td>
                        <td>{asig.fecha_confirmacion || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setRefHistorial(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Reprogramar Asignación */}
      {reprogramarItem && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Reprogramar Asignación Futura</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setReprogramarItem(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.88rem' }}>
                Reasignar el conteo de la referencia <strong style={{ color: 'var(--primary)' }}>{reprogramarItem.codigo_referencia}</strong> (Semana {reprogramarItem.semana}) a otra semana del cronograma.
              </p>

              <div>
                <label className="kpi-label" style={{ marginBottom: '6px' }}>Nueva Semana de Asignación</label>
                <select
                  className="form-control"
                  value={nuevaSemanaInput}
                  onChange={(e) => setNuevaSemanaInput(e.target.value)}
                >
                  {semanasOptions.map((s) => (
                    <option key={s} value={s}>
                      Semana {s} {s === data?.semana_actual ? '(Semana Actual)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="kpi-label" style={{ marginBottom: '6px' }}>Motivo de la Reprogramación</label>
                <input
                  type="text"
                  className="form-control"
                  value={motivoReprogramacion}
                  onChange={(e) => setMotivoReprogramacion(e.target.value)}
                  placeholder="Ej: Reagendamiento operativo por ajuste de personal..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setReprogramarItem(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleReprogramar}>
                <RotateCcw size={16} /> Confirmar Reprogramación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Anular Asignación */}
      {anularItem && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Anular Asignación de Conteo</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setAnularItem(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.88rem' }}>
                Anular la asignación de <strong style={{ color: 'var(--primary)' }}>{anularItem.codigo_referencia}</strong> en la Semana {anularItem.semana}.
              </p>
              <p style={{ fontSize: '0.82rem', color: 'var(--warning)' }}>
                * Un conteo anulado no incrementará el contador de conteos confirmados.
              </p>

              <div>
                <label className="kpi-label" style={{ marginBottom: '6px' }}>Justificación Obligatoria</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={justificacionAnulacion}
                  onChange={(e) => setJustificacionAnulacion(e.target.value)}
                  placeholder="Escriba la razón justificada para anular este conteo..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setAnularItem(null)}>
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={handleAnular}>
                <Ban size={16} /> Confirmar Anulación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
