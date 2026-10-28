import React from 'react';
import {
  LayoutDashboard,
  Boxes,
  PackageCheck,
  CalendarRange,
  Receipt,
  BarChart3,
  Database,
  Bot
} from 'lucide-react';

export const navigationItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'inventario', label: 'Inventario', icon: Boxes },
  { id: 'productos', label: 'Productos a Incluir', icon: PackageCheck },
  { id: 'cronograma', label: 'Inventario Cíclico & Cronograma', icon: CalendarRange },
  { id: 'ventas', label: 'Ventas & Movimientos', icon: Receipt },
  { id: 'reportes', label: 'Reportes', icon: BarChart3 },
  { id: 'importacion', label: 'Importación de Datos', icon: Database },
  { id: 'arduino', label: 'Robot Arduino', icon: Bot },
];

export function Sidebar({ currentTab, onSelectTab }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Boxes className="sidebar-brand-icon" />
        <div>
          <h2>INVENTARIO CÍCLICO</h2>
          <span>Sistema Integrado & Rover</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(item.id)}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <span className="status-dot"></span>
        <span>Servidor FastAPI Conectado</span>
      </div>
    </aside>
  );
}
