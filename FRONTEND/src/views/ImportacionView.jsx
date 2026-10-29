import React, { useState } from 'react';
import { api } from '../services/api';
import { Database, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

export function ImportacionView() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleReimportar = async () => {
    if (!confirm('¿Desea reimportar los datos desde DATA FINAL ENTREGAR2026.xlsx? Esto refrescará las tablas de ventas y productos a incluir.')) {
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await api.reimportarExcel();
      setResult(res);
    } catch (err) {
      setError(err.message || 'Error durante la reimportación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">
          <Database size={20} style={{ color: 'var(--primary)' }} />
          Módulo de Importación y Sincronización de Datos
        </h3>
      </div>

      <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.92rem', lineHeight: '1.6' }}>
        El sistema procesa e importa los datos desde la fuente principal original en formato Excel (<code>DATA FINAL ENTREGAR2026.xlsx</code>).
      </p>

      <div style={{ marginBottom: '24px' }}>
        <button
          className="btn btn-primary"
          onClick={handleReimportar}
          disabled={loading}
        >
          {loading ? (
            <>
              <RefreshCw size={18} className="spin-animation" /> Sincronizando datos...
            </>
          ) : (
            <>
              <Database size={18} /> Reimportar Excel Original
            </>
          )}
        </button>
      </div>

      {result && (
        <div style={{ padding: '18px', backgroundColor: 'var(--success-light)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius)', color: 'var(--success)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, marginBottom: '10px' }}>
            <CheckCircle size={18} /> Importación completada con éxito
          </div>
          <pre className="terminal-box" style={{ color: 'var(--success)', maxHeight: '200px' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      {error && (
        <div style={{ padding: '18px', backgroundColor: 'var(--danger-light)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius)', color: 'var(--danger)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
            <AlertCircle size={18} /> Error: {error}
          </div>
        </div>
      )}
    </div>
  );
}
