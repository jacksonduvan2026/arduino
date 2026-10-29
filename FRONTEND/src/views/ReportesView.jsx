import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { BarChart3, TrendingUp, Layers, Award } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

export function ReportesView() {
  const [ventasPeriodo, setVentasPeriodo] = useState([]);
  const [cronoResumen, setCronoResumen] = useState([]);
  const [topRefs, setTopRefs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReportes();
  }, []);

  const loadReportes = async () => {
    setLoading(true);
    try {
      const [resVentas, resCrono, resTop] = await Promise.all([
        api.getReportesVentasPeriodo(),
        api.getReportesCronogramaResumen(),
        api.getReportesTopReferencias(),
      ]);

      setVentasPeriodo(resVentas.datos || []);
      setCronoResumen(resCrono.semanas || []);
      setTopRefs(resTop.top_referencias || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div className="spin-animation" style={{ display: 'inline-block', marginBottom: '12px' }}>
          <BarChart3 size={28} color="var(--primary)" />
        </div>
        <p style={{ fontWeight: 500 }}>Procesando y generando reportes estadísticos...</p>
      </div>
    );
  }

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

  const lineChartData = {
    labels: ventasPeriodo.map((x) => x.mes),
    datasets: [
      {
        label: 'Monto Total Ventas ($)',
        data: ventasPeriodo.map((x) => x.total_monto),
        borderColor: '#ff1744',
        backgroundColor: 'rgba(255, 23, 68, 0.15)',
        borderWidth: 2,
        pointBackgroundColor: '#ff1744',
        pointBorderColor: '#ffffff',
        pointRadius: 4,
        tension: 0.35,
        fill: true,
      },
    ],
  };

  const cronoBarData = {
    labels: cronoResumen.map((x) => `Sem ${x.semana}`),
    datasets: [
      {
        label: 'Programados',
        data: cronoResumen.map((x) => x.total),
        backgroundColor: '#30343b',
        borderColor: '#383e49',
        borderWidth: 1,
      },
      {
        label: 'Completados',
        data: cronoResumen.map((x) => x.completados),
        backgroundColor: '#10b981',
        borderColor: '#065f46',
        borderWidth: 1,
      },
    ],
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <TrendingUp size={18} style={{ color: 'var(--primary)' }} />
              Evolución Mensual de Ventas
            </h3>
          </div>
          <div style={{ height: '280px' }}>
            <Line data={lineChartData} options={chartDarkOptions} />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Layers size={18} style={{ color: 'var(--primary)' }} />
              Progreso Semanal de Conteos Cíclicos
            </h3>
          </div>
          <div style={{ height: '280px' }}>
            <Bar data={cronoBarData} options={chartDarkOptions} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <Award size={18} style={{ color: 'var(--primary)' }} />
            Top Referencias Más Vendidas
          </h3>
          <span className="badge badge-primary">{topRefs.length} referencias top</span>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Código Referencia</th>
                <th>Descripción</th>
                <th>Cantidad Vendida</th>
                <th>Monto Total Recaudado</th>
              </tr>
            </thead>
            <tbody>
              {topRefs.map((r) => (
                <tr key={r.codigo}>
                  <td><span className="badge badge-primary">{r.codigo}</span></td>
                  <td>{r.descripcion}</td>
                  <td><strong>{r.cantidad_vendida.toLocaleString()}</strong> unidades</td>
                  <td><strong style={{ color: 'var(--primary)' }}>${r.monto_total.toLocaleString()}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
