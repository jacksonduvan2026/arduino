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
  getCronograma: (params) => fetchAPI(`/api/cronograma?${new URLSearchParams(params)}`),
  regenerarCronograma: () => fetchAPI('/api/cronograma/regenerar', { method: 'POST' }),
  registrarConteo: (data) => fetchAPI('/api/cronograma/conteo', { method: 'POST', body: JSON.stringify(data) }),
  getReportesVentasPeriodo: () => fetchAPI('/api/reportes/ventas-periodo'),
  getReportesCronogramaResumen: () => fetchAPI('/api/reportes/cronograma-resumen'),
  getReportesTopReferencias: () => fetchAPI('/api/reportes/top-referencias'),
  getArduinoStatus: () => fetchAPI('/api/arduino/status'),
  reimportarExcel: () => fetchAPI('/api/admin/reimportar', { method: 'POST' }),
};
