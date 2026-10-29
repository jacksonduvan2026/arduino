const API_BASE = import.meta.env.VITE_API_URL || '';

async function fetchAPI(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Error en la solicitud' }));
    throw new Error(errorData.detail || 'Error en la respuesta del servidor');
  }

  return res.json();
}

export const api = {
  getDashboard: () => fetchAPI('/api/dashboard'),
  getInventario: (params) => fetchAPI(`/api/inventario?${new URLSearchParams(params)}`),
  updateProducto: (codigo, data) => fetchAPI(`/api/inventario/${codigo}`, { method: 'PUT', body: JSON.stringify(data) }),
  getProductosIncluir: (params) => fetchAPI(`/api/productos-incluir?${new URLSearchParams(params || {})}`),
  getVentas: (params) => fetchAPI(`/api/ventas?${new URLSearchParams(params)}`),
  getVentaDetalle: (id) => fetchAPI(`/api/ventas/${id}`),
  getCronograma: (params) => {
    const cleanParams = {};
    if (params) {
      Object.keys(params).forEach(k => {
        if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
          cleanParams[k] = params[k];
        }
      });
    }
    return fetchAPI(`/api/cronograma?${new URLSearchParams(cleanParams)}`);
  },
  getCronogramaPreview: (data) => fetchAPI('/api/cronograma/preview', { method: 'POST', body: JSON.stringify(data) }),
  iniciarCicloCronograma: (data) => fetchAPI('/api/cronograma/iniciar', { method: 'POST', body: JSON.stringify(data) }),
  regenerarCronograma: () => fetchAPI('/api/cronograma/regenerar', { method: 'POST' }),
  registrarConteo: (data) => fetchAPI('/api/cronograma/conteo', { method: 'POST', body: JSON.stringify(data) }),
  reprogramarAsignacion: (data) => fetchAPI('/api/cronograma/reprogramar', { method: 'POST', body: JSON.stringify(data) }),
  anularAsignacion: (data) => fetchAPI('/api/cronograma/anular', { method: 'POST', body: JSON.stringify(data) }),
  getReferenciaHistorial: (codigo) => fetchAPI(`/api/cronograma/referencia/${encodeURIComponent(codigo)}`),
  getReportesVentasPeriodo: () => fetchAPI('/api/reportes/ventas-periodo'),
  getReportesCronogramaResumen: () => fetchAPI('/api/reportes/cronograma-resumen'),
  getReportesTopReferencias: () => fetchAPI('/api/reportes/top-referencias'),
  getArduinoStatus: () => fetchAPI('/api/arduino/status'),
  reimportarExcel: () => fetchAPI('/api/admin/reimportar', { method: 'POST' }),

  // Mapa de almacén y picking
  getUbicacionesMapa: () => fetchAPI('/api/mapa/ubicaciones'),
  updateUbicacionMapa: (locId, data) => fetchAPI(`/api/mapa/ubicaciones/${locId}`, { method: 'PUT', body: JSON.stringify(data) }),
  resetUbicacionesMapa: () => fetchAPI('/api/mapa/ubicaciones/reset', { method: 'POST' }),
  getParametrosSimulacion: () => fetchAPI('/api/mapa/parametros'),
  updateParametrosSimulacion: (data) => fetchAPI('/api/mapa/parametros', { method: 'PUT', body: JSON.stringify(data) }),
  calcularRutaPicking: (data) => fetchAPI('/api/mapa/calcular-ruta', { method: 'POST', body: JSON.stringify(data) }),
  getRecorridosGuardados: () => fetchAPI('/api/mapa/recorridos'),
  guardarRecorrido: (data) => fetchAPI('/api/mapa/recorridos', { method: 'POST', body: JSON.stringify(data) }),
};
