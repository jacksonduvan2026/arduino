import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { DashboardView } from './views/DashboardView';
import { InventarioView } from './views/InventarioView';
import { ProductosView } from './views/ProductosView';
import { CronogramaView } from './views/CronogramaView';
import { VentasView } from './views/VentasView';
import { ReportesView } from './views/ReportesView';
import { ImportacionView } from './views/ImportacionView';
import { ArduinoView } from './views/ArduinoView';
import './styles/globals.css';

export function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardView key={refreshKey} />;
      case 'inventario':
        return <InventarioView key={refreshKey} />;
      case 'productos':
        return <ProductosView key={refreshKey} />;
      case 'cronograma':
        return <CronogramaView key={refreshKey} />;
      case 'ventas':
        return <VentasView key={refreshKey} />;
      case 'reportes':
        return <ReportesView key={refreshKey} />;
      case 'importacion':
        return <ImportacionView key={refreshKey} />;
      case 'arduino':
        return <ArduinoView key={refreshKey} />;
      default:
        return <DashboardView key={refreshKey} />;
    }
  };

  return (
    <Layout currentTab={currentTab} onSelectTab={setCurrentTab} onRefresh={handleRefresh}>
      {renderContent()}
    </Layout>
  );
}

export default App;
