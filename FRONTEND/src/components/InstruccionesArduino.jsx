import React, { useState } from 'react';
import { Terminal, Copy, Check, Cpu, Code, Info } from 'lucide-react';

export function InstruccionesArduino({ rutaCalculada, modoRuta }) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('comandos'); // 'comandos' o 'cpp'

  if (!rutaCalculada) return null;

  const activeRoute = modoRuta === 'optimizada'
    ? rutaCalculada.ruta_optimizada
    : rutaCalculada.ruta_inicial;

  const instrucciones = activeRoute?.instrucciones_arduino;

  if (!instrucciones) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(instrucciones.comandos_texto);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cppSnippet = `// Sketch Firmware de Control para Arduino Rover
// Protocolo Serie USB - 115200 baudios
#include <Arduino.h>

const int BUZZER_PIN = 8;

void setup() {
  Serial.begin(115200);
  pinMode(BUZZER_PIN, OUTPUT);
  Serial.println("ROVER_READY;SYSTEM_OK");
}

void sonarPitido(int cantidad) {
  for (int i = 0; i < cantidad; i++) {
    tone(BUZZER_PIN, 1000, 150); // 1000 Hz por 150 ms
    delay(250);
  }
}

void loop() {
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\\n');
    cmd.trim();
    if (cmd.startsWith("PITIDO;1")) {
      sonarPitido(1);
    } else if (cmd.startsWith("PITIDO;2")) {
      sonarPitido(2);
    } else if (cmd.startsWith("IR;")) {
      Serial.println("ACK;DESPLAZANDO");
    } else if (cmd.startsWith("RECOGER;")) {
      Serial.println("ACK;RECOGIDA_COMPLETADA");
    }
  }
}
`;

  return (
    <div className="card" style={{ marginTop: '24px', borderLeft: '4px solid var(--primary)' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h3 className="card-title">
          <Terminal size={20} style={{ color: 'var(--primary)' }} />
          Instrucciones para Arduino / Código de Recorrido
        </h3>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`btn btn-sm ${activeTab === 'comandos' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('comandos')}
          >
            <Code size={14} /> Plan de Comandos
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'cpp' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('cpp')}
          >
            <Cpu size={14} /> Firmware C++
          </button>
          <button className="btn btn-outline btn-sm" onClick={handleCopy} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            {copied ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
            {copied ? '¡Copiado!' : 'Copiar Instrucciones'}
          </button>
        </div>
      </div>

      <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
        Secuencia de comandos generada para la ruta <strong>{modoRuta}</strong> (Salida {rutaCalculada.salida_inicio} a {rutaCalculada.salida_fin}, {activeRoute.numero_viajes} viaje(s)).
      </p>

      {activeTab === 'comandos' ? (
        <div>
          {/* Bloque de Comandos de Texto */}
          <div className="terminal-box" style={{ maxHeight: '220px', overflowY: 'auto', marginBottom: '16px', whiteSpace: 'pre-wrap' }}>
            {instrucciones.comandos_texto}
          </div>

          {/* Desglose de Pasos de Instrucción */}
          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '10px' }}>
            Desglose de Pasos y Patrones de Pitido Acústico
          </h4>
          <div className="table-responsive" style={{ maxHeight: '250px', overflowY: 'auto' }}>
            <table className="data-table" style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th>Comando</th>
                  <th>Parámetro / ID Ubicación</th>
                  <th>Rótulo Visible</th>
                  <th>Nivel Recogida</th>
                  <th>Señal Acústica Arduino</th>
                  <th>Descripción</th>
                </tr>
              </thead>
              <tbody>
                {instrucciones.pasos.map((paso, idx) => (
                  <tr key={idx}>
                    <td>
                      <span className="badge badge-secondary" style={{ fontFamily: 'monospace' }}>
                        {paso.comando}
                      </span>
                    </td>
                    <td><strong style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>{paso.parametro || paso.salida || '-'}</strong></td>
                    <td>{paso.etiqueta_completa || paso.codigo_visible || '-'}</td>
                    <td>{paso.nivel || '-'}</td>
                    <td>
                      {paso.patron ? (
                        <span className="badge badge-warning">
                          🔊 {paso.patron}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>{paso.descripcion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div>
          <div className="terminal-box" style={{ maxHeight: '280px', overflowY: 'auto', color: '#10b981', whiteSpace: 'pre-wrap' }}>
            {cppSnippet}
          </div>
          <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Info size={14} style={{ color: 'var(--primary)' }} /> Sketch de referencia compatible con Arduino UNO / Mega para procesar comandos por puerto serie USB.
          </div>
        </div>
      )}
    </div>
  );
}
