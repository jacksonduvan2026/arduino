import React, { useState } from 'react';
import { Sidebar, navigationItems } from './Sidebar';
import { RotateCw, Menu, Radio, Layers } from 'lucide-react';

export function Layout({ currentTab, onSelectTab, onRefresh, children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const currentItem = navigationItems.find((item) => item.id === currentTab);

  return (
    <div className="app-container">
      <Sidebar
        currentTab={currentTab}
        onSelectTab={onSelectTab}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      <div className={`main-wrapper ${isCollapsed ? 'expanded' : ''}`}>
        <header className="top-bar">
          <div className="top-bar-left">
            <button
              className="mobile-menu-btn"
              onClick={() => setIsMobileOpen(true)}
              title="Abrir menú"
            >
              <Menu size={22} />
            </button>
            <h1>
              {currentItem ? (
                <>
                  <currentItem.icon size={22} style={{ color: 'var(--primary)' }} />
                  <span>{currentItem.label}</span>
                </>
              ) : (
                'Sistema'
              )}
            </h1>
            <span className="top-bar-badge">v2.0 Neón</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="btn btn-outline btn-sm" onClick={onRefresh} title="Actualizar datos">
              <RotateCw size={15} />
              <span>Actualizar</span>
            </button>
          </div>
        </header>

        <main className="content-body">
          {children}
        </main>
      </div>
    </div>
  );
}
