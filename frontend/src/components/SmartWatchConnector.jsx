// SmartWatchConnector.jsx
// Web Bluetooth API – connects to a standard BLE Heart-Rate / Health sensor
// and streams HR, SpO2 and (where available) Temperature into the Triage form.
//
// Supported devices (BLE standard services):
//   ✅ Heart Rate Service       (0x180D) – any BLE HR monitor / most smart watches
//   ✅ Pulse Oximeter Service   (0x1822) – Polar Verity, Garmin, Masimo halo ring…
//   ⚠️  Health Thermometer      (0x1809) – chest-patch thermometers
//   ℹ️  Apple Watch / Samsung   – use companion app bridges (simulated fallback used)

import { useState, useRef, useCallback } from 'react';

/* ── BLE UUIDs ────────────────────────────────────────────────── */
const SERVICES = {
  HEART_RATE:          '0000180d-0000-1000-8000-00805f9b34fb',
  PULSE_OX:            '00001822-0000-1000-8000-00805f9b34fb',
  HEALTH_THERMO:       '00001809-0000-1000-8000-00805f9b34fb',
  BATTERY:             '0000180f-0000-1000-8000-00805f9b34fb',
};
const CHARS = {
  HR_MEASUREMENT:      '00002a37-0000-1000-8000-00805f9b34fb',
  PLX_CONTINUOUS:      '00002a5f-0000-1000-8000-00805f9b34fb',
  TEMPERATURE_MEAS:    '00002a1c-0000-1000-8000-00805f9b34fb',
  BATTERY_LEVEL:       '00002a19-0000-1000-8000-00805f9b34fb',
};

/* ── Parsers ──────────────────────────────────────────────────── */
function parseHR(dataView) {
  const flags = dataView.getUint8(0);
  return flags & 0x01
    ? dataView.getUint16(1, true)   // 16-bit format
    : dataView.getUint8(1);          // 8-bit format
}

function parsePLX(dataView) {
  // IEEE-11073 SFLOAT pairs: SpO2 (2 bytes) + PR (2 bytes)
  const flags  = dataView.getUint8(0);
  const spo2   = dataView.getUint16(1, true) / 100;
  const pr     = dataView.getUint16(3, true) / 100;
  return { spo2: Math.round(spo2), pulse: Math.round(pr) };
}

function parseTemp(dataView) {
  // IEEE-11073 FLOAT (4 bytes) in units of °C or °F (flag bit 0)
  const flags  = dataView.getUint8(0);
  const mantissa = dataView.getInt32(1, true) & 0x00FFFFFF;
  const exponent = dataView.getInt8(4);
  let temp = mantissa * Math.pow(10, exponent);
  if (flags & 0x01) temp = ((temp - 32) * 5) / 9; // °F → °C
  return Math.round(temp * 10) / 10;
}

/* ── Simulation fallback (when no device / for demo) ─────────── */
function simulateReading() {
  return {
    heart_rate:         68 + Math.floor(Math.random() * 40),  // 68-108 bpm
    oxygen_saturation:  94 + Math.floor(Math.random() * 6),   // 94-99 %
    temperature:        Math.round((36.2 + Math.random() * 1.8) * 10) / 10, // 36.2-38°C
  };
}

/* ══════════════════════════════════════════════════════════════ */
export default function SmartWatchConnector({ onVitalsReceived }) {
  const [status,   setStatus]   = useState('idle');   // idle|scanning|connected|streaming|error|simulated
  const [device,   setDevice]   = useState(null);
  const [vitals,   setVitals]   = useState(null);
  const [battery,  setBattery]  = useState(null);
  const [log,      setLog]      = useState([]);

  const serverRef   = useRef(null);
  const charRefs    = useRef({});
  const intervalRef = useRef(null);

  const addLog = (msg) => setLog(l => [`${new Date().toLocaleTimeString()} — ${msg}`, ...l.slice(0, 8)]);

  /* ── disconnect helper ──────────────────────────────────────── */
  const disconnect = useCallback(async () => {
    clearInterval(intervalRef.current);
    for (const char of Object.values(charRefs.current)) {
      try { await char.stopNotifications(); } catch {}
    }
    try { serverRef.current?.disconnect(); } catch {}
    charRefs.current = {};
    serverRef.current = null;
    setStatus('idle');
    setDevice(null);
    setBattery(null);
    addLog('Disconnected from device');
  }, []);

  /* ── subscribe to a characteristic ─────────────────────────── */
  const subscribe = async (service, charUUID, handler) => {
    try {
      const svc  = await serverRef.current.getPrimaryService(service);
      const char = await svc.getCharacteristic(charUUID);
      char.addEventListener('characteristicvaluechanged', e => handler(e.target.value));
      await char.startNotifications();
      charRefs.current[charUUID] = char;
      return true;
    } catch { return false; }
  };

  /* ── main connect flow ──────────────────────────────────────── */
  const connect = async () => {
    if (!navigator.bluetooth) {
      addLog('Web Bluetooth not supported — using simulation');
      runSimulation();
      return;
    }

    setStatus('scanning');
    addLog('Scanning for BLE health devices…');

    try {
      const dev = await navigator.bluetooth.requestDevice({
        acceptAllDevices: false,
        filters: [
          { services: [SERVICES.HEART_RATE] },
          { services: [SERVICES.PULSE_OX] },
          { services: [SERVICES.HEALTH_THERMO] },
        ],
        optionalServices: [
          SERVICES.HEART_RATE,
          SERVICES.PULSE_OX,
          SERVICES.HEALTH_THERMO,
          SERVICES.BATTERY,
        ],
      });

      setDevice(dev);
      addLog(`Found: ${dev.name || 'Unknown device'}`);
      setStatus('connected');

      dev.addEventListener('gattserverdisconnected', () => {
        addLog('Device disconnected');
        setStatus('idle');
      });

      const server = await dev.gatt.connect();
      serverRef.current = server;
      setStatus('streaming');
      addLog('Connected — streaming vitals…');

      // Local state object updated by multiple char handlers
      const live = { heart_rate: null, oxygen_saturation: null, temperature: null };

      const push = () => {
        if (live.heart_rate || live.oxygen_saturation) {
          const snapshot = { ...live };
          setVitals(snapshot);
          onVitalsReceived(snapshot);
        }
      };

      // Heart Rate
      const hrOk = await subscribe(SERVICES.HEART_RATE, CHARS.HR_MEASUREMENT, dv => {
        live.heart_rate = parseHR(dv);
        addLog(`❤️ HR: ${live.heart_rate} bpm`);
        push();
      });
      if (hrOk) addLog('Heart Rate service active');

      // Pulse Oximeter
      const plxOk = await subscribe(SERVICES.PULSE_OX, CHARS.PLX_CONTINUOUS, dv => {
        const { spo2, pulse } = parsePLX(dv);
        live.oxygen_saturation = spo2;
        if (pulse > 0) live.heart_rate = pulse;
        addLog(`🩸 SpO2: ${spo2}%  PR: ${pulse}`);
        push();
      });
      if (plxOk) addLog('Pulse-ox service active');

      // Temperature
      const tmpOk = await subscribe(SERVICES.HEALTH_THERMO, CHARS.TEMPERATURE_MEAS, dv => {
        live.temperature = parseTemp(dv);
        addLog(`🌡️ Temp: ${live.temperature}°C`);
        push();
      });
      if (tmpOk) addLog('Temperature service active');

      // Battery (read-only, poll every 30 s)
      try {
        const batSvc  = await server.getPrimaryService(SERVICES.BATTERY);
        const batChar = await batSvc.getCharacteristic(CHARS.BATTERY_LEVEL);
        const readBat = async () => {
          const val = await batChar.readValue();
          setBattery(val.getUint8(0));
        };
        readBat();
        intervalRef.current = setInterval(readBat, 30000);
      } catch {}

      if (!hrOk && !plxOk) {
        addLog('No standard vitals service found — using simulation');
        await disconnect();
        runSimulation();
      }

    } catch (err) {
      if (err.name === 'NotFoundError') {
        addLog('No device selected');
        setStatus('idle');
      } else {
        addLog(`Error: ${err.message} — falling back to simulation`);
        runSimulation();
      }
    }
  };

  /* ── simulation mode ────────────────────────────────────────── */
  const runSimulation = () => {
    setStatus('simulated');
    addLog('Starting simulated smartwatch stream…');
    let tick = 0;
    intervalRef.current = setInterval(() => {
      const reading = simulateReading();
      // slight drift each tick to look live
      reading.heart_rate        += tick % 3 === 0 ?  1 : tick % 5 === 0 ? -1 : 0;
      reading.oxygen_saturation += tick % 7 === 0 ? -1 : 0;
      setVitals(reading);
      onVitalsReceived(reading);
      addLog(`📡 [SIM] HR:${reading.heart_rate} SpO2:${reading.oxygen_saturation}% Temp:${reading.temperature}°C`);
      tick++;
    }, 2000);
  };

  const stopSimulation = () => {
    clearInterval(intervalRef.current);
    setStatus('idle');
    setVitals(null);
    addLog('Simulation stopped');
  };

  /* ── UI helpers ─────────────────────────────────────────────── */
  const statusInfo = {
    idle:      { label: 'Not Connected',       color: 'var(--text-muted)',    dot: '⚪' },
    scanning:  { label: 'Scanning…',           color: 'var(--color-warning)', dot: '🔵' },
    connected: { label: 'Connecting…',         color: 'var(--color-warning)', dot: '🟡' },
    streaming: { label: 'Streaming Live',      color: 'var(--color-success)', dot: '🟢' },
    simulated: { label: 'Simulated Mode',      color: 'var(--color-primary)', dot: '🔵' },
    error:     { label: 'Error',               color: 'var(--color-danger)',  dot: '🔴' },
  };
  const si = statusInfo[status];

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(0,150,255,0.08), rgba(0,80,180,0.12))',
      border: '1.5px solid rgba(66,165,245,0.35)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-lg)',
      marginBottom: 'var(--space-lg)',
    }}>
      {/* Header */}
      <div className="flex items-center gap-md mb-md" style={{ flexWrap: 'wrap' }}>
        <span style={{ fontSize: '2rem' }}>⌚</span>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: 0, color: 'var(--color-primary)' }}>SmartWatch Vitals Connect</h4>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Auto-fill Heart Rate, SpO2 & Temperature from your wearable device
          </p>
        </div>

        {/* Battery */}
        {battery !== null && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            🔋 {battery}%
          </span>
        )}

        {/* Status badge */}
        <span style={{
          fontSize: '0.78rem', padding: '3px 10px',
          borderRadius: 20,
          background: 'rgba(255,255,255,0.07)',
          border: `1px solid ${si.color}`,
          color: si.color,
        }}>
          {si.dot} {si.label}
        </span>
      </div>

      {/* Live vitals display */}
      {vitals && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3,1fr)',
          gap: 'var(--space-sm)',
          marginBottom: 'var(--space-md)',
        }}>
          {[
            { icon: '❤️', label: 'Heart Rate', value: vitals.heart_rate, unit: 'bpm', warn: vitals.heart_rate > 100 || vitals.heart_rate < 50 },
            { icon: '🩸', label: 'SpO2',       value: vitals.oxygen_saturation, unit: '%',   warn: vitals.oxygen_saturation < 95 },
            { icon: '🌡️', label: 'Temperature', value: vitals.temperature,       unit: '°C',  warn: vitals.temperature > 38 },
          ].map(({ icon, label, value, unit, warn }) => (
            <div key={label} style={{
              textAlign: 'center',
              background: warn ? 'rgba(239,83,80,0.12)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${warn ? 'var(--color-danger)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-sm)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}>
              <div style={{ fontSize: '1.4rem' }}>{icon}</div>
              <div style={{
                fontSize: '1.5rem', fontWeight: 800,
                color: warn ? 'var(--color-danger)' : 'var(--color-primary)',
                lineHeight: 1.1,
              }}>
                {value ?? '—'}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{unit}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
              {warn && <div style={{ fontSize: '0.65rem', color: 'var(--color-danger)', fontWeight: 600 }}>⚠ Abnormal</div>}
            </div>
          ))}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
        {status === 'idle' && (
          <>
            <button className="btn btn-primary" onClick={connect} style={{ flex: 1 }}>
              📡 Connect Real Device (Bluetooth)
            </button>
            <button
              onClick={runSimulation}
              style={{
                flex: 1, padding: '10px 16px', borderRadius: 'var(--radius-md)',
                background: 'rgba(66,165,245,0.15)', border: '1px solid rgba(66,165,245,0.4)',
                color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600,
              }}>
              🎮 Demo / Simulate Watch
            </button>
          </>
        )}

        {status === 'scanning' && (
          <button className="btn" onClick={() => setStatus('idle')} style={{ flex: 1 }}>
            ✖ Cancel Scan
          </button>
        )}

        {status === 'streaming' && (
          <button className="btn btn-danger" onClick={disconnect} style={{ flex: 1 }}>
            🔌 Disconnect
          </button>
        )}

        {status === 'simulated' && (
          <button className="btn btn-danger" onClick={stopSimulation} style={{ flex: 1 }}>
            ⏹ Stop Simulation
          </button>
        )}
      </div>

      {/* Info tip */}
      <div style={{
        marginTop: 'var(--space-sm)',
        padding: '8px 12px',
        background: 'rgba(66,165,245,0.07)',
        borderRadius: 8,
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
      }}>
        💡 <strong>Real Device:</strong> Works with standard BLE heart rate monitors &amp; pulse oximeters.
        Apple Watch / Samsung Watch → use <em>Demo Mode</em> for presentation.
        Vitals auto-fill the triage form below.
      </div>

      {/* Activity log */}
      {log.length > 0 && (
        <div style={{
          marginTop: 'var(--space-sm)',
          maxHeight: 100,
          overflowY: 'auto',
          background: 'rgba(0,0,0,0.25)',
          borderRadius: 8,
          padding: '8px 12px',
          fontFamily: 'monospace',
          fontSize: '0.7rem',
          color: 'var(--color-primary)',
        }}>
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  );
}
