import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Search, Download, Edit, X, Save, Boxes } from 'lucide-react';

export function InventarioView() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('TODAS');

  // Edit Modal
  const [editingItem, setEditingItem] = useState(null);
  const [stockInput, setStockInput] = useState('');

  useEffect(() => {
    loadInventario();
  }, [page, selectedCat]);

  const loadInventario = async () => {
    setLoading(true);
    try {
      const res = await api.getInventario({
        page,
        limit: 15,
        q: search,
        categoria: selectedCat,
      });
      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
      setCategories(res.categorias_disponibles || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadInventario();
  };

  const handleEditClick = (item) => {
    setEditingItem(item);
    setStockInput(item.stock_actual);
  };

  const handleUpdateStock = async () => {
    if (!editingItem) return;
    try {
      await api.updateProducto(editingItem.codigo, {
        stock_actual: parseFloat(stockInput),
      });
      setEditingItem(null);
      loadInventario();
    } catch (err) {
      alert('Error al actualizar el stock: ' + err.message);
    }
  };

  return (
    <div>
      <div className="card">
        <div className="filter-bar">
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '280px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por código o descripción..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              <Search size={16} /> Buscar
            </button>
          </form>

          <select
            className="form-control"
            style={{ width: '220px' }}
            value={selectedCat}
            onChange={(e) => {
              setSelectedCat(e.target.value);
              setPage(1);
            }}
          >
            <option value="TODAS">Todas las Categorías</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <a
            href={`/api/inventario/export/csv?q=${search}&categoria=${selectedCat}`}
            className="btn btn-outline"
            target="_blank"
            rel="noreferrer"
          >
            <Download size={16} /> Exportar CSV
          </a>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Código Ref</th>
                <th>Descripción</th>
                <th>Categoría</th>
                <th>Stock Físico Actual</th>
                <th>Ubicación Asignada</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    <div className="spin-animation" style={{ display: 'inline-block', marginBottom: '8px' }}>
                      <Boxes size={22} color="var(--primary)" />
                    </div>
                    <div>Cargando referencias del inventario...</div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    No se encontraron referencias para los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.codigo}>
                    <td><span className="badge badge-primary">{item.codigo}</span></td>
                    <td style={{ fontWeight: '500' }}>{item.descripcion}</td>
                    <td><span className="badge badge-secondary">{item.categoria}</span></td>
                    <td>
                      <strong style={{ color: 'var(--primary)', fontSize: '0.95rem' }}>{item.stock_actual}</strong>{' '}
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{item.unidad_medida}</span>
                    </td>
                    <td><span className="badge badge-secondary">{item.ubicacion}</span></td>
                    <td>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => handleEditClick(item)}
                      >
                        <Edit size={14} /> Editar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '18px', flexWrap: 'wrap', gap: '12px' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Total de registros: <strong>{total}</strong> | Página <strong>{page}</strong> de <strong>{totalPages}</strong>
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

      {editingItem && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Ajustar Stock Físico de Referencia
              </h3>
              <button className="btn btn-outline btn-sm" onClick={() => setEditingItem(null)} style={{ padding: '4px 8px' }}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div>
                <label className="kpi-label" style={{ marginBottom: '6px' }}>Código de Referencia</label>
                <input type="text" className="form-control" value={editingItem.codigo} disabled style={{ opacity: 0.7 }} />
              </div>
              <div>
                <label className="kpi-label" style={{ marginBottom: '6px' }}>Descripción del Producto</label>
                <input type="text" className="form-control" value={editingItem.descripcion} disabled style={{ opacity: 0.7 }} />
              </div>
              <div>
                <label className="kpi-label" style={{ marginBottom: '6px', color: 'var(--primary)' }}>Nuevo Stock Físico Actual</label>
                <input
                  type="number"
                  step="1"
                  className="form-control"
                  value={stockInput}
                  onChange={(e) => setStockInput(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setEditingItem(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleUpdateStock}>
                <Save size={16} /> Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
