import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin, Play, Pause, RotateCcw, XCircle, Sliders, Layers,
  Bot, FastForward, CheckCircle2, AlertTriangle, ArrowRight,
  Package, Info, Save, Trash2, Volume2
} from 'lucide-react';
import { api } from '../services/api';
import { MapaAlmacenSVG } from '../components/MapaAlmacenSVG';
import { ListaDespacho } from '../components/ListaDespacho';
import { ComparacionRutas } from '../components/ComparacionRutas';
import { InstruccionesArduino } from '../components/InstruccionesArduino';

export function MapaView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Datos de almacén
  const [ubicaciones, setUbicaciones] = useState([]);
  const [productos, setProductos] = useState([]);
  const [selectedLocIds, setSelectedLocIds] = useState([]);
  const [inconsistencias, setInconsistencias] = useState({});

  // Parámetros de simulación
  const [velocidadRoverMs, setVelocidadRoverMs] = useState(1.0);
  const [tiempoPickNivel1S, setTiempoPickNivel1S] = useState(15.0);
  const [salidaInicio, setSalidaInicio] = useState('SALIDA_1');
  const [salidaFin, setSalidaFin] = useState('SALIDA_1');
  const [simSpeedMultiplier, setSimSpeedMultiplier] = useState(2); // 1x, 2x, 5x, 10x

  // Resultado de la ruta
  const [rutaCalculada, setRutaCalculada] = useState(null);
  const [modoRuta, setModoRuta] = useState('optimizada'); // 'optimizada' o 'inicial'

  // Estados de Simulación
  const [isSimulating, setIsSimulating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [currentWaypointNode, setCurrentWaypointNode] = useState('SALIDA_1');
  const [roverCoords, setRoverCoords] = useState(null);
  const [activeBeepSignal, setActiveBeepSignal] = useState(null);

  // Tiempos en tiempo real de la simulación
  const [simTimeElapsedS, setSimTimeElapsedS] = useState(0);
  const [simTravelTimeS, setSimTravelTimeS] = useState(0);
  const [simPickTimeS, setSimPickTimeS] = useState(0);

  // Modal para editar ubicación
  const [editingLoc, setEditingLoc] = useState(null);

  // Referencias para animación
  const simTimerRef = useRef(null);

  useEffect(() => {
    cargarDatos();
    return () => {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
    };
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    setError(null);
    try {
      const mapRes = await api.getUbicacionesMapa();
      setUbicaciones(mapRes.ubicaciones || []);
      setInconsistencias(mapRes.inconsistencias_notificadas || {});

      const paramRes = await api.getParametrosSimulacion();
      if (paramRes) {
        setVelocidadRoverMs(paramRes.velocidad_rover_ms || 1.0);
        setTiempoPickNivel1S(paramRes.tiempo_pick_nivel_1_s || 15.0);
        setSalidaInicio(paramRes.salida_defecto_inicio || 'SALIDA_1');
        setSalidaFin(paramRes.salida_defecto_fin || 'SALIDA_1');
      }

      const prodRes = await api.getInventario({ limit: 100 });
      if (prodRes && prodRes.items) {
        setProductos(prodRes.items);
      }
    } catch (err) {
      setError(err.message || 'Error al cargar los datos del mapa');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelectLoc = (locId) => {
    setSelectedLocIds((prev) =>
      prev.includes(locId) ? prev.filter((id) => id !== locId) : [...prev, locId]
    );
  };

  const handleClearSelection = () => {
    setSelectedLocIds([]);
    setRutaCalculada(null);
    cancelarSimulacion();
  };

  const handleQuickAssignLevel = async (locId, nivel) => {
    try {
      await api.updateUbicacionMapa(locId, { nivel });
      cargarDatos();
    } catch (err) {
      alert('Error al asignar el nivel: ' + err.message);
    }
  };

  const handleCalcularRuta = async () => {
    if (selectedLocIds.length === 0) {
      alert('Por favor, selecciona al menos una ubicación de recogida en el mapa.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.calcularRutaPicking({
        ubicaciones_ids: selectedLocIds,
        salida_inicio: salidaInicio,
        salida_fin: salidaFin,
        velocidad_rover_ms: velocidadRoverMs,
        tiempo_pick_nivel_1_s: tiempoPickNivel1S,
        tiempo_pick_nivel_2_s: tiempoPickNivel1S * 3.0
      });
      setRutaCalculada(res);
      cancelarSimulacion();
    } catch (err) {
      alert('Error al calcular la ruta: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Reproducción de pitidos de sonido con Web Audio API
  const triggerAudioBeep = (nivel) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const beep = (delayMs, durationMs) => {
        setTimeout(() => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + durationMs / 1000);
        }, delayMs);
      };

      if (nivel === 'NIVEL_1') {
        beep(0, 150);
        setActiveBeepSignal('1 Pitido Corto');
      } else if (nivel === 'NIVEL_2') {
        beep(0, 150);
        beep(220, 150);
        setActiveBeepSignal('2 Pitidos Cortos');
      } else if (nivel === 'AMBOS') {
        beep(0, 150);
        beep(350, 150);
        setActiveBeepSignal('1 Pitido + Pausa + 1 Pitido');
      }

      setTimeout(() => setActiveBeepSignal(null), 1200);
    } catch (e) {
      console.warn('Audio no soportado:', e);
    }
  };

  // --- CONTROLES DE SIMULACIÓN ---
  const activeRoute = rutaCalculada
    ? modoRuta === 'optimizada'
      ? rutaCalculada.ruta_optimizada
      : rutaCalculada.ruta_inicial
    : null;

  const activeWaypoints = activeRoute
    ? activeRoute.viajes.flatMap((v) => v.waypoints)
    : [];

  const activeListaDespacho = activeRoute ? activeRoute.lista_despacho : [];

  const iniciarSimulacion = () => {
    if (!activeRoute) {
      alert('Primero debes calcular la ruta de recogida.');
      return;
    }
    setIsSimulating(true);
    setIsPaused(false);
    setCurrentStepIndex(0);
    setCurrentTaskIndex(0);
    setSimTimeElapsedS(0);
    setSimTravelTimeS(0);
    setSimPickTimeS(0);

    ejecutarBucleSimulacion();
  };

  const pausarSimulacion = () => {
    setIsPaused(true);
    if (simTimerRef.current) clearInterval(simTimerRef.current);
  };

  const reanudarSimulacion = () => {
    setIsPaused(false);
    ejecutarBucleSimulacion();
  };

  const reiniciarSimulacion = () => {
    cancelarSimulacion();
    iniciarSimulacion();
  };

  const cancelarSimulacion = () => {
    setIsSimulating(false);
    setIsPaused(false);
    setCurrentStepIndex(0);
    setCurrentTaskIndex(0);
    setSimTimeElapsedS(0);
    setSimTravelTimeS(0);
    setSimPickTimeS(0);
    setCurrentWaypointNode(salidaInicio);
    setRoverCoords(null);
    setActiveBeepSignal(null);
    if (simTimerRef.current) clearInterval(simTimerRef.current);
  };

  const ejecutarBucleSimulacion = () => {
    if (simTimerRef.current) clearInterval(simTimerRef.current);

    const intervalMs = 120;
    const stepDurationSec = (intervalMs / 1000) * simSpeedMultiplier;

    simTimerRef.current = setInterval(() => {
      setSimTimeElapsedS((prev) => prev + stepDurationSec);

      setCurrentStepIndex((prevStep) => {
        if (!activeWaypoints || prevStep >= activeWaypoints.length - 1) {
          clearInterval(simTimerRef.current);
          setIsSimulating(false);
          return prevStep;
        }

        const nextStep = prevStep + 1;
        const currentNode = activeWaypoints[nextStep];
        setCurrentWaypointNode(currentNode);

        const currentTask = activeListaDespacho[currentTaskIndex];
        if (currentTask && currentTask.access_node === currentNode) {
          triggerAudioBeep(currentTask.nivel);
          setCurrentTaskIndex((tIdx) => Math.min(tIdx + 1, activeListaDespacho.length - 1));
          setSimPickTimeS((prev) => prev + (currentTask.tiempo_recogida_s || 15));
        } else {
          setSimTravelTimeS((prev) => prev + stepDurationSec);
        }

        return nextStep;
      });
    }, intervalMs);
  };

  const handleOpenEditModal = (u) => {
    setEditingLoc({ ...u });
  };

  const handleSaveEditModal = async () => {
    if (!editingLoc) return;
    try {
      await api.updateUbicacionMapa(editingLoc.id, {
        codigo_visible: editingLoc.codigo_visible,
        nivel: editingLoc.nivel,
        producto_codigo: editingLoc.producto_codigo
      });
      setEditingLoc(null);
      cargarDatos();
    } catch (err) {
      alert('Error al guardar la ubicación: ' + err.message);
    }
  };

  if (loading && ubicaciones.length === 0) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
        <p>Cargando mapa de almacén y parámetros...</p>
      </div>
    );
  }

  return (
    <div className="mapa-view-container">
      {/* Título de la Sección */}
      <div className="card-header" style={{ marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin className="text-primary" size={26} />
            Mapa de Almacén, Picking y Simulación Rover
          </h2>
          <p style={{ fontSize: '0.88rem', color: '#64748b', marginTop: '4px' }}>
            Layout de almacén interactivo con geometría fiel (7 columnas x 9 filas), clasificaciones de niveles y simulador Rover Arduino.
          </p>
        </div>
      </div>

      {error && (
        <div className="card" style={{ backgroundColor: '#fee2e2', borderColor: '#fca5a5', color: '#991b1b', padding: '16px', marginBottom: '20px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Grid Principal: Mapa SVG a la izquierda, Panel de Control a la derecha */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '24px', marginBottom: '24px' }}>
        {/* Panel del Mapa */}
        <div className="card" style={{ padding: '16px' }}>
          <div className="card-header" style={{ marginBottom: '12px' }}>
            <h3 className="card-title" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} className="text-primary" />
              Vista General del Almacén ({ubicaciones.length} posiciones)
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-outline btn-sm" onClick={handleClearSelection} disabled={selectedLocIds.length === 0}>
                Limpiar Selección ({selectedLocIds.length})
              </button>
            </div>
          </div>

          <MapaAlmacenSVG
            ubicaciones={ubicaciones}
            selectedLocIds={selectedLocIds}
            onToggleSelect={handleToggleSelectLoc}
            activeRouteWaypoints={activeWaypoints}
            roverPositionNode={currentWaypointNode}
            roverCoords={roverCoords}
            isSimulating={isSimulating}
            startExit={salidaInicio}
            endExit={salidaFin}
          />
        </div>

        {/* Panel Lateral de Controles y Parámetros */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Tarjeta de Parámetros de Ruta */}
          <div className="card">
            <h3 className="card-title" style={{ fontSize: '1rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sliders size={18} className="text-primary" />
              Parámetros de Recorrido
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.88rem' }}>
              <div>
                <label style={{ fontWeight: '500', color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Salida de Inicio:
                </label>
                <select className="form-control" value={salidaInicio} onChange={(e) => setSalidaInicio(e.target.value)}>
                  <option value="SALIDA_1">SALIDA 1 (Izquierda)</option>
                  <option value="SALIDA_2">SALIDA 2 (Derecha)</option>
                </select>
              </div>

              <div>
                <label style={{ fontWeight: '500', color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Salida de Retorno:
                </label>
                <select className="form-control" value={salidaFin} onChange={(e) => setSalidaFin(e.target.value)}>
                  <option value="SALIDA_1">SALIDA 1 (Izquierda)</option>
                  <option value="SALIDA_2">SALIDA 2 (Derecha)</option>
                </select>
              </div>

              <div>
                <label style={{ fontWeight: '500', color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Velocidad Rover (m/s):
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="5.0"
                  className="form-control"
                  value={velocidadRoverMs}
                  onChange={(e) => setVelocidadRoverMs(parseFloat(e.target.value) || 1.0)}
                />
              </div>

              <div>
                <label style={{ fontWeight: '500', color: '#475569', display: 'block', marginBottom: '4px' }}>
                  T. Recogida 1er Nivel (seg):
                </label>
                <input
                  type="number"
                  min="1"
                  className="form-control"
                  value={tiempoPickNivel1S}
                  onChange={(e) => setTiempoPickNivel1S(parseFloat(e.target.value) || 15.0)}
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px', display: 'block' }}>
                  * Nivel 2 tomará {tiempoPickNivel1S * 3}s (3x primer nivel)
                </span>
              </div>

              <button className="btn btn-primary" style={{ marginTop: '8px', width: '100%' }} onClick={handleCalcularRuta}>
                Generar Recorrido
              </button>
            </div>
          </div>

          {/* Tarjeta Controles de Simulación Virtual */}
          <div className="card" style={{ backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#1e293b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '0.98rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8' }}>
                <Bot size={20} /> Simulador Virtual Rover
              </h3>
              <span className={`badge ${isSimulating ? (isPaused ? 'badge-warning' : 'badge-success') : 'badge-secondary'}`}>
                {isSimulating ? (isPaused ? 'Pausado' : 'Simulando') : 'Inactivo'}
              </span>
            </div>

            {/* Señal acústica visual durante simulación */}
            {activeBeepSignal && (
              <div style={{ backgroundColor: '#ca8a04', color: '#ffffff', padding: '6px 12px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Volume2 size={16} className="pulse-animation" /> {activeBeepSignal}
              </div>
            )}

            {/* Selector de modo de ruta */}
            {rutaCalculada && (
              <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', background: '#1e293b', padding: '4px', borderRadius: '6px' }}>
                <button
                  style={{ flex: 1, padding: '6px', fontSize: '0.78rem', border: 'none', borderRadius: '4px', cursor: 'pointer', background: modoRuta === 'optimizada' ? '#2563eb' : 'transparent', color: '#fff', fontWeight: modoRuta === 'optimizada' ? 'bold' : 'normal' }}
                  onClick={() => setModoRuta('optimizada')}
                >
                  Ruta Optimizada
                </button>
                <button
                  style={{ flex: 1, padding: '6px', fontSize: '0.78rem', border: 'none', borderRadius: '4px', cursor: 'pointer', background: modoRuta === 'inicial' ? '#2563eb' : 'transparent', color: '#fff', fontWeight: modoRuta === 'inicial' ? 'bold' : 'normal' }}
                  onClick={() => setModoRuta('inicial')}
                >
                  Ruta Inicial
                </button>
              </div>
            )}

            {/* Selector de Multiplicador de Velocidad */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                Velocidad Simulación en Pantalla:
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[1, 2, 5, 10].map((mult) => (
                  <button
                    key={mult}
                    onClick={() => setSimSpeedMultiplier(mult)}
                    style={{
                      flex: 1,
                      padding: '4px 8px',
                      fontSize: '0.78rem',
                      border: '1px solid #334155',
                      borderRadius: '4px',
                      background: simSpeedMultiplier === mult ? '#0284c7' : '#1e293b',
                      color: '#ffffff',
                      cursor: 'pointer',
                      fontWeight: simSpeedMultiplier === mult ? 'bold' : 'normal'
                    }}
                  >
                    {mult}x
                  </button>
                ))}
              </div>
            </div>

            {/* Botones Principales de Control */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
              {!isSimulating ? (
                <button className="btn btn-primary" style={{ gridColumn: 'span 2', backgroundColor: '#10b981' }} onClick={iniciarSimulacion} disabled={!rutaCalculada}>
                  <Play size={16} /> Iniciar Simulación
                </button>
              ) : (
                <>
                  {isPaused ? (
                    <button className="btn btn-primary" style={{ backgroundColor: '#10b981' }} onClick={reanudarSimulacion}>
                      <Play size={16} /> Reanudar
                    </button>
                  ) : (
                    <button className="btn btn-warning" style={{ backgroundColor: '#f59e0b', color: '#fff' }} onClick={pausarSimulacion}>
                      <Pause size={16} /> Pausar
                    </button>
                  )}
                  <button className="btn btn-outline" style={{ color: '#fff', borderColor: '#475569' }} onClick={reiniciarSimulacion}>
                    <RotateCcw size={16} /> Reiniciar
                  </button>
                </>
              )}
            </div>

            {isSimulating && (
              <button className="btn btn-danger btn-sm" style={{ width: '100%', marginBottom: '12px' }} onClick={cancelarSimulacion}>
                <XCircle size={14} /> Cancelar Simulación
              </button>
            )}

            {/* Métrica de Tiempos en Pantalla vs Físico */}
            <div style={{ backgroundColor: '#1e293b', padding: '12px', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Tiempo Físico Estimado:</span>
                <strong style={{ color: '#38bdf8' }}>{Math.round(activeRoute ? activeRoute.tiempo_total_s : 0)}s</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>T. Desplazamiento:</span>
                <span>{Math.round(activeRoute ? activeRoute.tiempo_desplazamiento_s : 0)}s</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>T. Recogidas:</span>
                <span>{Math.round(activeRoute ? activeRoute.tiempo_recogida_s : 0)}s</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #334155', paddingTop: '4px', marginTop: '2px' }}>
                <span style={{ color: '#94a3b8' }}>Tiempo Simulación Real:</span>
                <span style={{ color: '#facc15', fontWeight: 'bold' }}>{Math.round(simTimeElapsedS)}s ({simSpeedMultiplier}x)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Comparación de Rutas */}
      {rutaCalculada && <ComparacionRutas rutaCalculada={rutaCalculada} />}

      {/* Tabla de Lista de Despacho */}
      <ListaDespacho
        listaDespacho={activeListaDespacho}
        currentTaskIndex={currentTaskIndex}
        isSimulating={isSimulating}
      />

      {/* Panel de Instrucciones para Arduino */}
      {rutaCalculada && (
        <InstruccionesArduino rutaCalculada={rutaCalculada} modoRuta={modoRuta} />
      )}

      {/* Tabla de Ubicaciones y Edición */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <h3 className="card-title" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={18} className="text-primary" />
            Configuración de Estanterías y Clasificación por Nivel
          </h3>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID Interno</th>
                <th>Código Visible</th>
                <th>Posición (Fila/Col)</th>
                <th>Clasificación de Nivel</th>
                <th>Producto Asignado</th>
                <th>Inconsistencia</th>
                <th>Acción Rápida Nivel</th>
                <th>Editar</th>
              </tr>
            </thead>
            <tbody>
              {ubicaciones.map((u) => (
                <tr key={u.id} style={{ backgroundColor: u.es_duplicado ? '#fff7ed' : 'transparent' }}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#64748b' }}>{u.id}</td>
                  <td>
                    <strong>{u.codigo_visible}</strong>
                    {u.es_duplicado && (
                      <span style={{ fontSize: '0.72rem', color: '#c2410c', display: 'block' }}>
                        [Fila {u.fila}, Col {u.columna}]
                      </span>
                    )}
                  </td>
                  <td>Fila {u.fila}, Col {u.columna}</td>
                  <td>
                    <span className={`badge ${
                      u.nivel === 'NIVEL_1'
                        ? 'badge-warning'
                        : u.nivel === 'NIVEL_2'
                        ? 'badge-danger'
                        : u.nivel === 'AMBOS'
                        ? 'badge'
                        : 'badge-secondary'
                    }`} style={{
                      backgroundColor: u.nivel === 'AMBOS' ? '#ffedd5' : undefined,
                      color: u.nivel === 'AMBOS' ? '#9a3412' : undefined
                    }}>
                      {u.nivel === 'NIVEL_1' ? '1er Nivel (Amarillo)' : u.nivel === 'NIVEL_2' ? '2do Nivel (Rojo)' : u.nivel === 'AMBOS' ? 'Ambos (Naranja)' : 'Sin Nivel (Blanco)'}
                    </span>
                  </td>
                  <td>
                    <div>
                      <strong style={{ fontSize: '0.85rem' }}>{u.producto_codigo || 'Sin asignar'}</strong>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{u.producto_descripcion}</div>
                    </div>
                  </td>
                  <td>
                    {u.es_duplicado ? (
                      <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={12} /> Duplicado ({u.codigo_visible})
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Normal</span>
                    )}
                  </td>
                  <td>
                    {/* Botones de Asignación Rápida de Color / Nivel */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        title="Asignar 1er Nivel (Amarillo)"
                        style={{ border: '1px solid #ca8a04', background: '#fef08a', color: '#854d0e', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 'bold' }}
                        onClick={() => handleQuickAssignLevel(u.id, 'NIVEL_1')}
                      >
                        N1
                      </button>
                      <button
                        title="Asignar 2do Nivel (Rojo)"
                        style={{ border: '1px solid #dc2626', background: '#fecaca', color: '#991b1b', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 'bold' }}
                        onClick={() => handleQuickAssignLevel(u.id, 'NIVEL_2')}
                      >
                        N2
                      </button>
                      <button
                        title="Asignar Ambos Niveles (Naranja)"
                        style={{ border: '1px solid #ea580c', background: '#ffedd5', color: '#9a3412', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 'bold' }}
                        onClick={() => handleQuickAssignLevel(u.id, 'AMBOS')}
                      >
                        Ambos
                      </button>
                    </div>
                  </td>
                  <td>
                    <button className="btn btn-outline btn-sm" onClick={() => handleOpenEditModal(u)}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Edición de Ubicación */}
      {editingLoc && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Editar Ubicación {editingLoc.id}</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setEditingLoc(null)}>X</button>
            </div>
            <div className="modal-body">
              <div>
                <label style={{ fontWeight: '500', color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Código Visible:
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={editingLoc.codigo_visible}
                  onChange={(e) => setEditingLoc({ ...editingLoc, codigo_visible: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontWeight: '500', color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Nivel de Recogida:
                </label>
                <select
                  className="form-control"
                  value={editingLoc.nivel}
                  onChange={(e) => setEditingLoc({ ...editingLoc, nivel: e.target.value })}
                >
                  <option value="NIVEL_1">Nivel 1 (Primer nivel - Amarillo)</option>
                  <option value="NIVEL_2">Nivel 2 (Segundo nivel - Rojo, 3x tiempo)</option>
                  <option value="AMBOS">Ambos Niveles (Nivel 1 y 2 - Naranja)</option>
                </select>
              </div>

              <div>
                <label style={{ fontWeight: '500', color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Producto Asignado:
                </label>
                <select
                  className="form-control"
                  value={editingLoc.producto_codigo || ''}
                  onChange={(e) => setEditingLoc({ ...editingLoc, producto_codigo: e.target.value })}
                >
                  <option value="">-- Sin Producto --</option>
                  {productos.map((p) => (
                    <option key={p.codigo} value={p.codigo}>
                      {p.codigo} - {p.descripcion} (Stock: {p.stock_actual})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setEditingLoc(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveEditModal}>Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}

      {/* Nota de Integración Futura con Hardware Arduino */}
      <div className="card" style={{ backgroundColor: '#f8fafc', borderColor: '#cbd5e1', marginTop: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <Info className="text-primary" size={22} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}>
              Puntos de Integración con Rover Arduino Físico (Fase Posterior)
            </h4>
            <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: '1.5' }}>
              Esta simulación se ejecuta de forma completamente virtual en el navegador. La arquitectura está preparada para enviar la secuencia de comandos por puerto serie USB al Arduino (`/api/arduino/comando`) cuando se confirme la integración física con motores y sensores IR.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
