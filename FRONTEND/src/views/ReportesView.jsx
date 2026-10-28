import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
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

  if (loading) return <div className="card">Generando reportes y gráficos...</div>;

  const lineChartData = {
    labels: ventasPeriodo.map((x) => x.mes),
    datasets: [
      {
        label: 'Monto Total Ventas ($)',
        data: ventasPeriodo.map((x) => x.total_monto),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        tension: 0.3,
        fill: true,
      },
    ],
  };

  const cronoBarData = {
    labels: cronoResumen.map((x) => `Sem ${x.semana}`),
    datasets: [
      {
        label: 'Conteos Programados',
        data: cronoResumen.map((x) => x.total),
        backgroundColor: '#94a3b8',
      },
      {
        label: 'Conteos Completados',
        data: cronoResumen.map((x) => x.completados),
        backgroundColor: '#10b981',
      },
    ],
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Evolución Mensual de Ventas</h3>
          </div>
          <div style={{ height: '280px' }}>
            <Line data={lineChartData} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Progreso Semanal de Conteos Cíclicos</h3>
          </div>
          <div style={{ height: '280px' }}>
            <Bar data={cronoBarData} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Top Referencias Más Vendidas</h3>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descripción</th>
                <th>Cantidad Vendida</th>
                <th>Monto Total Recaudado</th>
              </tr>
            </thead>
            <tbody>
              {topRefs.map((r) => (
                <tr key={r.codigo}>
                  <td><strong>{r.codigo}</strong></td>
                  <td>{r.descripcion}</td>
                  <td>{r.cantidad_vendida.toLocaleString()} unidades</td>
                  <td><strong>${r.monto_total.toLocaleString()}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
