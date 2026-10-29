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

  const cppSnippet = `// Sketch de Prueba de Comandos para Arduino Rover
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
    <div className="card" style={{ marginTop: '24px', borderLeft: '4px solid #0284c7' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem' }}>
          <Terminal className="text-primary" size={20} />
          Instrucciones para Arduino / Código de Recorrido
        </h3>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`btn btn-sm ${activeTab === 'comandos' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('comandos')}
          >
            <Code size={14} style={{ marginRight: '4px' }} /> Plan de Comandos
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'cpp' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('cpp')}
          >
            <Cpu size={14} style={{ marginRight: '4px' }} /> Firmware C++
          </button>
          <button className="btn btn-outline btn-sm" onClick={handleCopy} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
            {copied ? '¡Copiado!' : 'Copiar Instrucciones'}
          </button>
        </div>
      </div>

      <p style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: '14px' }}>
        Secuencia de comandos generada para la ruta {modoRuta} (Salida {rutaCalculada.salida_inicio} a {rutaCalculada.salida_fin}, {activeRoute.numero_viajes} viaje(s)).
      </p>

      {activeTab === 'comandos' ? (
        <div>
          {/* Bloque de Comandos de Texto */}
          <div style={{
            background: '#0f172a',
            color: '#38bdf8',
            fontFamily: 'monospace',
            fontSize: '0.88rem',
            padding: '16px',
            borderRadius: '6px',
            maxHeight: '220px',
            overflowY: 'auto',
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap',
            marginBottom: '16px',
            border: '1px solid #1e293b'
          }}>
            {instrucciones.comandos_texto}
          </div>

          {/* Desglose de Pasos de Instrucción */}
          <h4 style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#334155', marginBottom: '8px' }}>
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
                    <td><strong style={{ fontFamily: 'monospace' }}>{paso.parametro || paso.salida || '-'}</strong></td>
                    <td>{paso.etiqueta_completa || paso.codigo_visible || '-'}</td>
                    <td>{paso.nivel || '-'}</td>
                    <td>
                      {paso.patron ? (
                        <span className="badge badge-warning" style={{ backgroundColor: '#fef08a', color: '#854d0e' }}>
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
          <div style={{
            background: '#0f172a',
            color: '#a7f3d0',
            fontFamily: 'monospace',
            fontSize: '0.84rem',
            padding: '16px',
            borderRadius: '6px',
            maxHeight: '280px',
            overflowY: 'auto',
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap',
            border: '1px solid #1e293b'
          }}>
            {cppSnippet}
          </div>
          <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Info size={14} /> Sketch de referencia compatible con Arduino UNO / Mega para procesar comandos por puerto serie USB.
          </div>
        </div>
      )}
    </div>
  );
}
