import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { ShoppingBag, DollarSign, Barcode, CalendarCheck, TrendingUp } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

export function DashboardView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDashboard();
      setData(res);
    } catch (err) {
      setError(err.message || 'Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="card">Cargando indicadores del sistema...</div>;
  if (error) return <div className="card text-danger">Error: {error}</div>;

  const { kpis, ventas_por_ciudad, ventas_por_empresa, ultimas_ventas } = data;

  const ciudadChartData = {
    labels: ventas_por_ciudad.map((x) => x.ciudad),
    datasets: [
      {
        label: 'Monto Total Ventas ($)',
        data: ventas_por_ciudad.map((x) => x.total),
        backgroundColor: '#2563eb',
        borderRadius: 4,
      },
    ],
  };

  const empresaChartData = {
    labels: ventas_por_empresa.map((x) => x.empresa),
    datasets: [
      {
        data: ventas_por_empresa.map((x) => x.total),
        backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#6366f1'],
      },
    ],
  };

  return (
    <div>
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-wrapper blue">
            <ShoppingBag size={24} />
          </div>
          <div>
            <span className="kpi-label">Registros de Ventas</span>
            <div className="kpi-value">{kpis.total_ventas_registros.toLocaleString()}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrapper green">
            <DollarSign size={24} />
          </div>
          <div>
            <span className="kpi-label">Monto Total Recaudado</span>
            <div className="kpi-value">${kpis.total_monto_ventas.toLocaleString()}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrapper warning">
            <Barcode size={24} />
          </div>
          <div>
            <span className="kpi-label">Referencias Distintas</span>
            <div className="kpi-value">{kpis.total_referencias_distintas}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrapper blue">
            <CalendarCheck size={24} />
          </div>
          <div>
            <span className="kpi-label">Progreso Cronograma Cíclico</span>
            <div className="kpi-value">{kpis.cronograma_progreso_porcentaje}%</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Distribución de Ventas por Ciudad</h3>
          </div>
          <div style={{ height: '260px' }}>
            <Bar data={ciudadChartData} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Ventas por Empresa</h3>
          </div>
          <div style={{ height: '260px' }}>
            <Pie data={empresaChartData} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Últimas Operaciones Registradas</h3>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>No. Orden</th>
                <th>Fecha</th>
                <th>Código Ref</th>
                <th>Descripción</th>
                <th>Empresa</th>
                <th>Ciudad</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              {ultimas_ventas.map((v) => (
                <tr key={v.id}>
                  <td><strong>{v.no_orden}</strong></td>
                  <td>{v.fecha}</td>
                  <td><span className="badge badge-secondary">{v.codigo_referencia}</span></td>
                  <td>{v.descripcion}</td>
                  <td>{v.empresa}</td>
                  <td>{v.ciudad}</td>
                  <td><strong>${v.valor_total_ref.toLocaleString()}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
