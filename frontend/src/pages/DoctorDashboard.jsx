import { useState, useEffect, useRef } from 'react';
import { doctorAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { GenerateBillModal } from '../components/BillViewer';
import LanguageToggle from '../components/LanguageToggle';

function PriorityBadge({ level }) {
  return <span className={`badge badge-${level}`}>
    {level === 'critical' ? '🚨' : level === 'high' ? '⚠️' : level === 'medium' ? '🟡' : '✅'} {level}
  </span>;
}

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

function formatWait(mins) {
  if (!mins) return '—';
  const m = Math.round(mins);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

// ── Emergency Alert Banner ─────────────────────────────────────────────────────
function EmergencyAlert({ alert, onDismiss }) {
  return (
    <div className="emergency-banner">
      <div style={{ fontSize: '2rem', animation: 'pulse-critical 1s infinite' }}>🚨</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800, color: 'hsl(0, 90%, 75%)', fontSize: '1rem' }}>
          CRITICAL PATIENT ALERT
        </div>
        <div style={{ color: 'hsl(0, 60%, 80%)', fontSize: '0.9rem', marginTop: 2 }}>
          {alert.message || `${alert.patient_name} — Risk Score: ${Math.round(alert.risk_score)}/100`}
        </div>
      </div>
      <button className="btn btn-ghost btn-sm" onClick={onDismiss} style={{ color: 'white', borderColor: 'hsla(0,80%,70%,0.4)' }}>
        ✕
      </button>
    </div>
  );
}

// ── Appointment Row ────────────────────────────────────────────────────────────
function AppointmentRow({ appt, onCallNext, onComplete, onReject }) {
  const isCritical = appt.priority_level === 'critical';
  const isActive = appt.status === 'active';

  return (
    <tr style={isCritical ? { background: 'hsla(0, 80%, 30%, 0.1)' } : {}}>
      <td>
        <div className="flex items-center gap-sm">
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: isCritical ? 'var(--color-critical)' : isActive ? 'var(--color-success)' : 'var(--border-subtle)',
            boxShadow: isCritical ? '0 0 8px var(--color-danger)' : 'none',
          }} />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {appt.patient?.full_name || `Patient #${appt.patient_id}`}
            </div>
            <div className="text-xs text-muted">
              {appt.patient?.age ? `${appt.patient.age} yrs` : ''} {appt.patient?.blood_group || ''}
            </div>
          </div>
        </div>
      </td>
      <td>
        <div style={{ fontSize: '0.85rem' }}>{new Date(appt.appointment_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      </td>
      <td>
        <StatusBadge status={appt.status} />
      </td>
      <td>
        <PriorityBadge level={appt.priority_level} />
        {appt.priority_score > 0 && (
          <span className="text-xs text-muted" style={{ marginLeft: 4 }}>{Math.round(appt.priority_score)}/100</span>
        )}
      </td>
      <td>{formatWait(appt.predicted_wait_minutes)}</td>
      <td>
        <div className="flex gap-sm">
          {appt.status === 'scheduled' && (
            <button className="btn btn-primary btn-sm" onClick={() => onCallNext(appt.id)}>
              📢 Call
            </button>
          )}
          {appt.status === 'active' && (
            <button className="btn btn-success btn-sm" onClick={() => onComplete(appt.id)}>
              ✅ Done
            </button>
          )}
          {['scheduled', 'active'].includes(appt.status) && (
            <button className="btn btn-danger btn-sm" onClick={() => onReject(appt.id)}>
              ✕
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function DoctorDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('queue');
  const [appointments, setAppointments] = useState([]);
  const [queueState, setQueueState] = useState(null);
  const [emergencyAlerts, setEmergencyAlerts] = useState([]);
  const [isAvailable, setIsAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [billModal, setBillModal] = useState(null);
  const wsRef = useRef(null);

  const fetchData = async () => {
    try {
      const [schedRes, queueRes] = await Promise.all([
        doctorAPI.getSchedule(),
        doctorAPI.getQueueState().catch(() => ({ data: null })),
      ]);
      setAppointments(schedRes.data);
      setQueueState(queueRes.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    // Subscribe to department WebSocket for emergency alerts
    const connectWS = () => {
      const wsHost = window.location.hostname + ':8000';
      const ws = new WebSocket(`ws://${wsHost}/ws/department/1`);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'emergency_alert') {
          setEmergencyAlerts(prev => [msg, ...prev.slice(0, 4)]);
          toast.error(`🚨 Emergency: ${msg.patient_name}`, { duration: 8000 });
        }
        if (msg.type === 'queue_update' || msg.type === 'consultation_complete') {
          fetchData();
        }
      };

      ws.onclose = () => setTimeout(connectWS, 3000);
      const ping = setInterval(() => ws.readyState === 1 && ws.send('ping'), 25000);
      return () => { clearInterval(ping); ws.close(); };
    };

    const cleanup = connectWS();
    return cleanup;
  }, []);

  const callNext = async (id) => {
    try {
      await doctorAPI.callNext(id);
      toast.success('Patient called!');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const complete = async (id) => {
    try {
      await doctorAPI.complete(id);
      toast.success('Consultation completed!');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const reject = async (id) => {
    try {
      await doctorAPI.reject(id, 'Doctor unavailable');
      toast.success('Appointment rejected');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const toggleAvailability = async () => {
    const next = !isAvailable;
    await doctorAPI.setAvailability(next);
    setIsAvailable(next);
    toast.success(next ? '✅ You are now available' : '⛔ You are now unavailable');
  };

  const activeAppt = appointments.find(a => a.status === 'active');
  const scheduledAppts = appointments.filter(a => a.status === 'scheduled').sort((a, b) => {
    // Sort by priority (critical first), then queue position
    const priorityOrder = { critical: 0, high: 1, medium: 2, normal: 3 };
    return (priorityOrder[a.priority_level] - priorityOrder[b.priority_level]) ||
      (a.queue_position - b.queue_position);
  });
  const completedAppts = appointments.filter(a => a.status === 'completed');

  const sidebar = [
    { id: 'queue', label: 'My Queue', icon: '📋' },
    { id: 'schedule', label: 'Full Schedule', icon: '📅' },
    { id: 'stats', label: 'My Stats', icon: '📊' },
  ];

  return (
    <div className="portal-layout">
      <div className="sidebar">
        {sidebar.map(item => (
          <button key={item.id} className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}>
            {item.icon} {item.label}
          </button>
        ))}

        <div className="sidebar-divider" />

        <div style={{ padding: 'var(--space-md)', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)' }}>
          <div className="text-xs text-muted mb-md">Availability</div>
          <button
            className={`btn btn-full btn-sm ${isAvailable ? 'btn-success' : 'btn-danger'}`}
            onClick={toggleAvailability}
          >
            {isAvailable ? '🟢 Available' : '🔴 Unavailable'}
          </button>
        </div>

        {queueState && (
          <div style={{ padding: 'var(--space-md)' }}>
            <div className="text-xs text-muted">Queue</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-primary)' }}>
              {queueState.waiting_count}
            </div>
            <div className="text-xs text-muted">waiting</div>
          </div>
        )}
      </div>

      <div className="main-content">
        {billModal && <GenerateBillModal appointment={billModal} onClose={() => setBillModal(null)} onGenerated={() => setBillModal(null)} />}
        
        {/* Emergency alerts */}
        {emergencyAlerts.map((alert, i) => (
          <EmergencyAlert key={i} alert={alert}
            onDismiss={() => setEmergencyAlerts(a => a.filter((_, j) => j !== i))} />
        ))}

        {activeTab === 'queue' && (
          <div className="animate-fade-up">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1>My Patient Queue</h1>
                <p>Today: {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              </div>
              <LanguageToggle />
            </div>

            {/* Current patient */}
            {activeAppt ? (
              <div className="card card-highlight mb-lg" style={{ borderColor: 'var(--color-success)' }}>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-xs text-muted mb-md" style={{ color: 'var(--color-success)', fontWeight: 700 }}>
                      🩺 CURRENTLY CONSULTING
                    </div>
                    <h3>{activeAppt.patient?.full_name}</h3>
                    <PriorityBadge level={activeAppt.priority_level} />
                  </div>
                  <div className="flex gap-sm" style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-primary" onClick={() => setBillModal(activeAppt)}>
                      🧾 Generate Bill
                    </button>
                    <button className="btn btn-success" onClick={() => complete(activeAppt.id)}>
                      ✅ Complete Consultation
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card mb-lg" style={{ textAlign: 'center', padding: 'var(--space-lg)', borderStyle: 'dashed' }}>
                <p className="text-muted">No patient currently being consulted</p>
              </div>
            )}

            {/* Waiting queue */}
            {loading ? (
              <div className="loading-overlay"><div className="loading-spinner" /></div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Time</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Est. Wait</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduledAppts.length === 0 && (
                      <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No more patients in queue
                      </td></tr>
                    )}
                    {scheduledAppts.map(a => (
                      <AppointmentRow key={a.id} appt={a}
                        onCallNext={callNext} onComplete={complete} onReject={reject} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="animate-fade-up">
            <div className="page-header"><h1>📅 Full Schedule</h1></div>
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Patient</th><th>Time</th><th>Status</th><th>Priority</th><th>Wait</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {appointments.map(a => (
                    <AppointmentRow key={a.id} appt={a}
                      onCallNext={callNext} onComplete={complete} onReject={reject} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="animate-fade-up">
            <div className="page-header"><h1>📊 My Stats — Today</h1></div>
            <div className="stats-grid stagger">
              <div className="stat-card" style={{ '--accent': 'var(--color-primary)' }}>
                <div className="stat-icon">👥</div>
                <div className="stat-value">{appointments.length}</div>
                <div className="stat-label">Total Patients</div>
              </div>
              <div className="stat-card" style={{ '--accent': 'var(--color-success)' }}>
                <div className="stat-icon">✅</div>
                <div className="stat-value">{completedAppts.length}</div>
                <div className="stat-label">Completed</div>
              </div>
              <div className="stat-card" style={{ '--accent': 'var(--color-warning)' }}>
                <div className="stat-icon">⏳</div>
                <div className="stat-value">{scheduledAppts.length}</div>
                <div className="stat-label">In Queue</div>
              </div>
              <div className="stat-card" style={{ '--accent': 'var(--color-danger)' }}>
                <div className="stat-icon">🚨</div>
                <div className="stat-value">{appointments.filter(a => a.priority_level === 'critical').length}</div>
                <div className="stat-label">Critical Cases</div>
              </div>
            </div>

            <div className="card mt-lg">
              <h3 className="mb-md">Priority Distribution</h3>
              {['critical', 'high', 'medium', 'normal'].map(level => {
                const count = appointments.filter(a => a.priority_level === level).length;
                const pct = appointments.length ? (count / appointments.length * 100) : 0;
                return (
                  <div key={level} style={{ marginBottom: 'var(--space-md)' }}>
                    <div className="flex justify-between text-sm mb-md">
                      <span style={{ textTransform: 'capitalize' }}>
                        {level === 'critical' ? '🚨' : level === 'high' ? '⚠️' : level === 'medium' ? '🟡' : '✅'} {level}
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{count}</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{
                        width: `${pct}%`,
                        background: level === 'critical' ? 'var(--color-critical)' :
                          level === 'high' ? 'var(--color-high)' :
                          level === 'medium' ? 'var(--color-medium)' : 'var(--color-normal)',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
