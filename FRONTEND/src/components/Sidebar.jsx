import React from 'react';
import {
  LayoutDashboard,
  Boxes,
  PackageCheck,
  CalendarRange,
  Receipt,
  BarChart3,
  Database,
  Bot,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Radio,
  X
} from 'lucide-react';

export const navigationItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'mapa', label: 'Mapa y Recorrido', icon: MapPin },
  { id: 'inventario', label: 'Inventario', icon: Boxes },
  { id: 'productos', label: 'Productos a Incluir', icon: PackageCheck },
  { id: 'cronograma', label: 'Inventario Cíclico & Cronograma', icon: CalendarRange },
  { id: 'ventas', label: 'Ventas & Movimientos', icon: Receipt },
  { id: 'reportes', label: 'Reportes', icon: BarChart3 },
  { id: 'importacion', label: 'Importación de Datos', icon: Database },
  { id: 'arduino', label: 'Robot Arduino', icon: Bot },
];

export function Sidebar({ currentTab, onSelectTab, isCollapsed, onToggleCollapse, isMobileOpen, onCloseMobile }) {
  return (
    <>
      {/* Backdrop overlay for mobile screen */}
      {isMobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseMobile}
        />
      )}

      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
        {/* Brand / Logo */}
        <div className="sidebar-brand">
          <div className="sidebar-logo-wrapper">
            <Boxes className="sidebar-brand-icon" />
          </div>
          {!isCollapsed && (
            <div className="sidebar-brand-text">
              <h2>GESTIÓN BODEGA</h2>
              <span>Sistema & Rover virtual</span>
            </div>
          )}
          {/* Mobile close button */}
          <button className="mobile-close-btn" onClick={onCloseMobile}>
            <X size={20} />
          </button>
        </div>

        {/* Toggle Collapse Desktop */}
        <button
          className="sidebar-collapse-toggle"
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        {/* Navigation Items */}
        <nav className="sidebar-nav">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  onSelectTab(item.id);
                  if (isMobileOpen) onCloseMobile();
                }}
                title={isCollapsed ? item.label : undefined}
              >
                <div className="nav-item-icon-wrapper">
                  <Icon size={20} />
                </div>
                {!isCollapsed && <span className="nav-item-label">{item.label}</span>}
                {isActive && <div className="active-indicator" />}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <div className="status-indicator">
            <span className="status-dot pulse-animation" />
            {!isCollapsed && (
              <div className="status-text">
                <span className="status-title">Servidor FastAPI</span>
                <span className="status-sub">En línea & Conectado</span>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
