import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Search, Download, Eye, X } from 'lucide-react';

export function VentasView() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [empresas, setEmpresas] = useState([]);
  const [ciudades, setCiudades] = useState([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState('TODAS');
  const [selectedCiudad, setSelectedCiudad] = useState('TODAS');

  // Detail Modal
  const [selectedVenta, setSelectedVenta] = useState(null);

  useEffect(() => {
    loadVentas();
  }, [page, selectedEmpresa, selectedCiudad]);

  const loadVentas = async () => {
    setLoading(true);
    try {
      const res = await api.getVentas({
        page,
        limit: 15,
        q: search,
        empresa: selectedEmpresa,
        ciudad: selectedCiudad,
      });
      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
      setEmpresas(res.filtros_disponibles?.empresas || []);
      setCiudades(res.filtros_disponibles?.ciudades || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadVentas();
  };

  const handleViewDetail = async (id) => {
    try {
      const res = await api.getVentaDetalle(id);
      setSelectedVenta(res);
    } catch (err) {
      alert('Error al cargar detalle: ' + err.message);
    }
  };

  return (
    <div>
      <div className="card">
        <div className="filter-bar">
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', flex: 1 }}>
            <input
              type="text"
              className="form-control"
              placeholder="No. Orden, Código Referencia..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              <Search size={16} /> Buscar
            </button>
          </form>

          <select
            className="form-control"
            style={{ width: '180px' }}
            value={selectedEmpresa}
            onChange={(e) => {
              setSelectedEmpresa(e.target.value);
              setPage(1);
            }}
          >
            <option value="TODAS">Empresa (Todas)</option>
            {empresas.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>

          <select
            className="form-control"
            style={{ width: '180px' }}
            value={selectedCiudad}
            onChange={(e) => {
              setSelectedCiudad(e.target.value);
              setPage(1);
            }}
          >
            <option value="TODAS">Ciudad (Todas)</option>
            {ciudades.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <a
            href={`/api/ventas/export/csv?q=${search}&empresa=${selectedEmpresa}&ciudad=${selectedCiudad}`}
            className="btn btn-outline"
            target="_blank"
            rel="noreferrer"
          >
            <Download size={16} /> Exportar
          </a>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>No. Orden</th>
                <th>Fecha</th>
                <th>Código Ref</th>
                <th>Descripción</th>
                <th>Cantidad</th>
                <th>Monto Total</th>
                <th>Empresa</th>
                <th>Ciudad</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '24px' }}>
                    Cargando ventas...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '24px' }}>
                    No se encontraron registros de ventas.
                  </td>
                </tr>
              ) : (
                items.map((v) => (
                  <tr key={v.id}>
                    <td><strong>{v.no_orden}</strong></td>
                    <td>{v.fecha}</td>
                    <td><span className="badge badge-secondary">{v.codigo_referencia}</span></td>
                    <td>{v.descripcion_referencia}</td>
                    <td>{v.cantidad}</td>
                    <td><strong>${v.valor_total_ref.toLocaleString()}</strong></td>
                    <td>{v.empresa}</td>
                    <td>{v.ciudad}</td>
                    <td>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => handleViewDetail(v.id)}
                      >
                        <Eye size={14} /> Detalle
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Total registros: {total} | Página {page} de {totalPages}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-outline btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            <button
              className="btn btn-outline btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {selectedVenta && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Detalle de Orden de Venta</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setSelectedVenta(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p><strong>Orden No:</strong> {selectedVenta.no_orden}</p>
              <p><strong>Fecha:</strong> {selectedVenta.fecha}</p>
              <p><strong>Empresa:</strong> {selectedVenta.empresa} | <strong>Ciudad:</strong> {selectedVenta.ciudad}</p>
              <p><strong>Valor Total Orden:</strong> ${selectedVenta.valor_total_orden.toLocaleString()} {selectedVenta.moneda}</p>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '12px 0' }} />
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '8px' }}>Referencias en esta misma orden:</h4>
              <ul style={{ paddingLeft: '20px', fontSize: '0.88rem' }}>
                {selectedVenta.items_de_orden.map((item) => (
                  <li key={item.id} style={{ marginBottom: '4px' }}>
                    {item.codigo_referencia} - {item.descripcion} ({item.cantidad} un. - ${item.valor_total_ref.toLocaleString()})
                  </li>
                ))}
              </ul>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setSelectedVenta(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
