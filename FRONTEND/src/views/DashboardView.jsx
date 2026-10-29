import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { ShoppingBag, DollarSign, Barcode, CalendarCheck, TrendingUp, Layers } from 'lucide-react';
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

  if (loading) {
    return (
      <div className="card" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div className="spin-animation" style={{ display: 'inline-block', marginBottom: '12px' }}>
          <Layers size={28} color="var(--primary)" />
        </div>
        <p style={{ fontWeight: 500 }}>Cargando indicadores clave y métricas del sistema...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ borderColor: 'var(--danger-border)', backgroundColor: 'var(--danger-light)', color: 'var(--danger)' }}>
        <strong>Error en el Dashboard:</strong> {error}
      </div>
    );
  }

  const { kpis, ventas_por_ciudad, ventas_por_empresa, ultimas_ventas } = data;

  const chartDarkOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#a5a9b2',
          font: { family: 'Inter', size: 12 }
        }
      },
      tooltip: {
        backgroundColor: '#1c1f24',
        titleColor: '#f5f5f7',
        bodyColor: '#a5a9b2',
        borderColor: '#30343b',
        borderWidth: 1,
        padding: 10,
        boxPadding: 6
      }
    },
    scales: {
      x: {
        ticks: { color: '#a5a9b2', font: { family: 'Inter', size: 11 } },
        grid: { color: '#262930' }
      },
      y: {
        ticks: { color: '#a5a9b2', font: { family: 'Inter', size: 11 } },
        grid: { color: '#262930' }
      }
    }
  };

  const pieDarkOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#a5a9b2',
          font: { family: 'Inter', size: 12 },
          padding: 16
        }
      },
      tooltip: chartDarkOptions.plugins.tooltip
    }
  };

  const ciudadChartData = {
    labels: ventas_por_ciudad.map((x) => x.ciudad),
    datasets: [
      {
        label: 'Monto Total Ventas ($)',
        data: ventas_por_ciudad.map((x) => x.total),
        backgroundColor: '#ff1744',
        borderColor: '#ff4569',
        borderWidth: 1,
        borderRadius: 4,
        hoverBackgroundColor: '#ff4569',
      },
    ],
  };

  const empresaChartData = {
    labels: ventas_por_empresa.map((x) => x.empresa),
    datasets: [
      {
        data: ventas_por_empresa.map((x) => x.total),
        backgroundColor: ['#ff1744', '#10b981', '#f59e0b', '#38bdf8'],
        borderColor: '#14161a',
        borderWidth: 2,
      },
    ],
  };

  return (
    <div>
      {/* Grid KPI Superior */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-wrapper red">
            <ShoppingBag size={22} />
          </div>
          <div>
            <span className="kpi-label">Registros de Ventas</span>
            <div className="kpi-value">{kpis.total_ventas_registros.toLocaleString()}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrapper green">
            <DollarSign size={22} />
          </div>
          <div>
            <span className="kpi-label">Monto Recaudado</span>
            <div className="kpi-value">${kpis.total_monto_ventas.toLocaleString()}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrapper warning">
            <Barcode size={22} />
          </div>
          <div>
            <span className="kpi-label">Referencias Activas</span>
            <div className="kpi-value">{kpis.total_referencias_distintas}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrapper info">
            <CalendarCheck size={22} />
          </div>
          <div>
            <span className="kpi-label">Progreso Cíclico</span>
            <div className="kpi-value">{kpis.cronograma_progreso_porcentaje}%</div>
          </div>
        </div>
      </div>

      {/* Gráficos de Análisis */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <TrendingUp size={18} style={{ color: 'var(--primary)' }} />
              Distribución de Ventas por Ciudad
            </h3>
          </div>
          <div style={{ height: '270px' }}>
            <Bar data={ciudadChartData} options={chartDarkOptions} />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Layers size={18} style={{ color: 'var(--primary)' }} />
              Ventas por Empresa
            </h3>
          </div>
          <div style={{ height: '270px' }}>
            <Pie data={empresaChartData} options={pieDarkOptions} />
          </div>
        </div>
      </div>

      {/* Tabla de Operaciones Recientes */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Últimas Operaciones Registradas</h3>
          <span className="badge badge-secondary">{ultimas_ventas.length} registros recientes</span>
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
                <th>Monto Total</th>
              </tr>
            </thead>
            <tbody>
              {ultimas_ventas.map((v) => (
                <tr key={v.id}>
                  <td><strong style={{ color: 'var(--text-main)' }}>{v.no_orden}</strong></td>
                  <td style={{ color: 'var(--text-muted)' }}>{v.fecha}</td>
                  <td><span className="badge badge-primary">{v.codigo_referencia}</span></td>
                  <td>{v.descripcion}</td>
                  <td>{v.empresa}</td>
                  <td><span className="badge badge-secondary">{v.ciudad}</span></td>
                  <td><strong style={{ color: 'var(--primary)' }}>${v.valor_total_ref.toLocaleString()}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
