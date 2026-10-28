import React from 'react';
import { Sidebar, navigationItems } from './Sidebar';
import { RotateCw } from 'lucide-react';

export function Layout({ currentTab, onSelectTab, onRefresh, children }) {
  const currentItem = navigationItems.find((item) => item.id === currentTab);

  return (
    <div className="app-container">
      <Sidebar currentTab={currentTab} onSelectTab={onSelectTab} />

      <div className="main-wrapper">
        <header className="top-bar">
          <h1>{currentItem ? currentItem.label : 'Sistema'}</h1>
          <button className="btn btn-outline btn-sm" onClick={onRefresh}>
            <RotateCw size={16} />
            <span>Actualizar</span>
          </button>
        </header>

        <main className="content-body">
          {children}
        </main>
      </div>
    </div>
  );
}
