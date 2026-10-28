import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Download } from 'lucide-react';

export function ProductosView() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProductos();
  }, []);

  const loadProductos = async () => {
    setLoading(true);
    try {
      const res = await api.getProductosIncluir();
      setItems(res.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Productos Propuestos para Incorporar al Inventario</h3>
        <a
          href="/api/productos-incluir/export/csv"
          className="btn btn-outline btn-sm"
          target="_blank"
          rel="noreferrer"
        >
          <Download size={16} /> Exportar CSV
        </a>
      </div>

      <div className="table-responsive">
        <table className="data-table" style={{ fontSize: '0.82rem' }}>
          <thead>
            <tr>
              <th>Código</th>
              <th>Descripción</th>
              <th>Categoría</th>
              <th>Ene</th>
              <th>Feb</th>
              <th>Mar</th>
              <th>Abr</th>
              <th>May</th>
              <th>Jun</th>
              <th>Jul</th>
              <th>Ago</th>
              <th>Sep</th>
              <th>Oct</th>
              <th>Nov</th>
              <th>Dic</th>
              <th>Total Anual</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="16" style={{ textAlign: 'center', padding: '24px' }}>
                  Cargando productos a incluir...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan="16" style={{ textAlign: 'center', padding: '24px' }}>
                  No hay productos registrados.
                </td>
              </tr>
            ) : (
              items.map((p) => (
                <tr key={p.codigo}>
                  <td><strong>{p.codigo}</strong></td>
                  <td>{p.descripcion}</td>
                  <td><span className="badge badge-secondary">{p.categoria}</span></td>
                  <td>{p.meses.enero ?? '-'}</td>
                  <td>{p.meses.febrero ?? '-'}</td>
                  <td>{p.meses.marzo ?? '-'}</td>
                  <td>{p.meses.abril ?? '-'}</td>
                  <td>{p.meses.mayo ?? '-'}</td>
                  <td>{p.meses.junio ?? '-'}</td>
                  <td>{p.meses.julio ?? '-'}</td>
                  <td>{p.meses.agosto ?? '-'}</td>
                  <td>{p.meses.septiembre ?? '-'}</td>
                  <td>{p.meses.octubre ?? '-'}</td>
                  <td>{p.meses.noviembre ?? '-'}</td>
                  <td>{p.meses.diciembre ?? '-'}</td>
                  <td><strong>{p.total_anual}</strong></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
