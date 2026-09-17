import { useState, useEffect, useRef } from 'react';
import { adminAPI } from '../api';
import LanguageToggle from '../components/LanguageToggle';
import SmsConfigGuide from '../components/SmsConfigGuide';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import toast from 'react-hot-toast';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, Title, Tooltip, Legend, Filler
);

const CHART_DEFAULTS = {
  plugins: {
    legend: { labels: { color: 'hsl(210, 15%, 65%)', font: { family: 'Inter', size: 11 } } },
  },
  scales: {
    x: { ticks: { color: 'hsl(210, 12%, 45%)' }, grid: { color: 'hsla(210, 20%, 40%, 0.12)' } },
    y: { ticks: { color: 'hsl(210, 12%, 45%)' }, grid: { color: 'hsla(210, 20%, 40%, 0.12)' } },
  },
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, value, label, accent = 'var(--color-primary)', change }) {
  return (
    <div className="stat-card" style={{ '--accent': accent }}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className="stat-label">{label}</div>
      {change !== undefined && (
        <div style={{ marginTop: 6, fontSize: '0.75rem', color: change >= 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600 }}>
          {change >= 0 ? '↑' : '↓'} {Math.abs(change)}% vs yesterday
        </div>
      )}
    </div>
  );
}

// ── Queue Overview Table ───────────────────────────────────────────────────────
function QueueOverview({ data }) {
  if (!data || data.length === 0) return (
    <div className="empty-state"><div className="empty-icon">📋</div><p>No queue data available</p></div>
  );

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Department</th>
            <th>Doctor</th>
            <th>Waiting</th>
            <th>Avg Wait</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map(q => (
            <tr key={q.id}>
              <td><div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{q.department?.name || '—'}</div></td>
              <td>{q.doctor?.user?.full_name || `Doctor #${q.doctor_id}`}</td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: q.waiting_count > 10 ? 'var(--color-danger)' :
                      q.waiting_count > 5 ? 'var(--color-warning)' : 'var(--color-success)',
                  }} />
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{q.waiting_count}</span>
                </div>
              </td>
              <td>{Math.round(q.avg_wait_time_predicted)} min</td>
              <td>
                <span className={`badge ${q.is_active ? 'badge-active' : 'badge-completed'}`}>
                  {q.is_active ? '🟢 Active' : '⭕ Idle'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Add Doctor Form ────────────────────────────────────────────────────────────
function AddDoctorForm({ onAdded }) {
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', department_id: '',
    specialization: '', experience_years: '', max_daily_patients: 30, avg_consultation_minutes: 15
  });
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    adminAPI.getDepartments().then(r => setDepartments(r.data));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // First register as doctor user
      const { authAPI } = await import('../api');
      const userRes = await import('../api').then(m => m.authAPI.register({
        email: form.email,
        password: 'Doctor@123',
        full_name: form.full_name,
        phone: form.phone,
        role: 'doctor',
      }));
      const userId = userRes.data.user_id;

      // Then create doctor profile
      await adminAPI.addDoctor({
        user_id: userId,
        department_id: parseInt(form.department_id),
        specialization: form.specialization,
        experience_years: parseInt(form.experience_years) || 0,
        max_daily_patients: parseInt(form.max_daily_patients),
        avg_consultation_minutes: parseFloat(form.avg_consultation_minutes),
      });

      toast.success(`Dr. ${form.full_name} added successfully!`);
      onAdded && onAdded();
      setForm({ full_name: '', email: '', phone: '', department_id: '', specialization: '', experience_years: '', max_daily_patients: 30, avg_consultation_minutes: 15 });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add doctor');
    } finally {
      setLoading(false);
    }
  };

  const update = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <div className="card">
      <h3 className="mb-lg">➕ Add New Doctor</h3>
      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Full Name</label>
          <input className="form-input" placeholder="Dr. Name" value={form.full_name} onChange={update('full_name')} required />
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input type="email" className="form-input" placeholder="doctor@hospital.com" value={form.email} onChange={update('email')} required />
        </div>
        <div className="form-group">
          <label className="form-label">Phone</label>
          <input className="form-input" placeholder="Phone number" value={form.phone} onChange={update('phone')} />
        </div>
        <div className="form-group">
          <label className="form-label">Department</label>
          <select className="form-select" value={form.department_id} onChange={update('department_id')} required>
            <option value="">Select Department</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Specialization</label>
          <input className="form-input" placeholder="e.g. Cardiologist" value={form.specialization} onChange={update('specialization')} />
        </div>
        <div className="form-group">
          <label className="form-label">Experience (years)</label>
          <input type="number" className="form-input" placeholder="Years" value={form.experience_years} onChange={update('experience_years')} />
        </div>
        <div className="form-group">
          <label className="form-label">Max Daily Patients</label>
          <input type="number" className="form-input" value={form.max_daily_patients} onChange={update('max_daily_patients')} />
        </div>
        <div className="form-group">
          <label className="form-label">Avg Consultation (min)</label>
          <input type="number" className="form-input" value={form.avg_consultation_minutes} onChange={update('avg_consultation_minutes')} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <span className="loading-spinner" /> : '➕'} Add Doctor
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Departments Manager ────────────────────────────────────────────────────────
const DEPT_ICONS = { CARD:'❤️', EMRG:'🚨', NEUR:'🧠', ORTH:'🦴', GENM:'🩺', PEDI:'👶', DERM:'🫧', OPHT:'👁️' };

function DepartmentsManager() {
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const r = await adminAPI.getDepartments();
      setDepts(r.data);
    } catch (e) {
      toast.error('Failed to load departments');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name || !form.code) { toast.error('Name and Code are required'); return; }
    setSaving(true);
    try {
      await adminAPI.createDepartment({ ...form, is_active: true });
      toast.success(`Department "${form.name}" added! ✅`);
      setForm({ name: '', code: '', description: '' });
      setShowAdd(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add department');
    }
    setSaving(false);
  };

  const handleToggle = async (dept) => {
    try {
      await adminAPI.toggleDepartment(dept.id);
      toast.success(`${dept.name} ${dept.is_active ? 'deactivated' : 'activated'}`);
      load();
    } catch {
      toast.error('Toggle failed');
    }
  };

  if (loading) return <div className="loading-overlay"><div className="loading-spinner" /><p>Loading departments…</p></div>;

  return (
    <div className="animate-fade-up">
      <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
        <div>
          <h1>🏢 Departments</h1>
          <p>{depts.length} departments · {depts.filter(d=>d.is_active).length} active</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(s => !s)}>
          {showAdd ? '✕ Cancel' : '➕ Add Department'}
        </button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="card mb-lg" style={{ borderColor: 'var(--color-primary)', borderLeft: '4px solid var(--color-primary)' }}>
          <h4 className="mb-md">➕ New Department</h4>
          <form onSubmit={handleAdd} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
            <div className="form-group">
              <label className="form-label">DEPARTMENT NAME *</label>
              <input className="form-input" placeholder="e.g. Radiology" value={form.name}
                onChange={e => setForm(f=>({...f, name: e.target.value}))} required />
            </div>
            <div className="form-group">
              <label className="form-label">CODE * (4 letters)</label>
              <input className="form-input" placeholder="e.g. RADI" maxLength={6} value={form.code}
                onChange={e => setForm(f=>({...f, code: e.target.value.toUpperCase()}))} required />
            </div>
            <div className="form-group">
              <label className="form-label">DESCRIPTION</label>
              <input className="form-input" placeholder="Brief description" value={form.description}
                onChange={e => setForm(f=>({...f, description: e.target.value}))} />
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <span className="loading-spinner" /> : '💾'} Save Department
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Department Cards Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px,1fr))', gap:16 }}>
        {depts.map(dept => (
          <div key={dept.id} className="card" style={{
            borderLeft: `4px solid ${dept.is_active ? 'var(--color-success)' : 'var(--color-danger)'}`,
            opacity: dept.is_active ? 1 : 0.65,
            transition: 'all 0.2s',
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div style={{ fontSize:'2rem' }}>{DEPT_ICONS[dept.code] || '🏥'}</div>
              <span className={`badge ${dept.is_active ? 'badge-active' : 'badge-completed'}`}>
                {dept.is_active ? '🟢 Active' : '🔴 Inactive'}
              </span>
            </div>
            <div style={{ marginTop:10 }}>
              <div style={{ fontWeight:700, fontSize:'1.05rem', color:'var(--text-primary)' }}>{dept.name}</div>
              <div style={{ marginTop:4 }}>
                <span className="chip" style={{ fontSize:'0.72rem', padding:'2px 8px' }}>{dept.code}</span>
              </div>
              {dept.description && (
                <div style={{ marginTop:8, fontSize:'0.82rem', color:'var(--text-muted)', lineHeight:1.4 }}>
                  {dept.description}
                </div>
              )}
            </div>
            <div style={{ marginTop:14, display:'flex', gap:8 }}>
              <button
                onClick={() => handleToggle(dept)}
                className={`btn btn-sm ${dept.is_active ? 'btn-ghost' : 'btn-primary'}`}
                style={{ flex:1, fontSize:'0.78rem' }}
              >
                {dept.is_active ? '⏸ Deactivate' : '▶ Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Table */}
      <div className="card mt-lg">
        <h4 className="mb-md">📋 Department Summary</h4>
        <div className="table-container">
          <table>
            <thead>
              <tr><th>#</th><th>Name</th><th>Code</th><th>Description</th><th>Status</th></tr>
            </thead>
            <tbody>
              {depts.map((d, i) => (
                <tr key={d.id}>
                  <td style={{ color:'var(--text-muted)' }}>{i+1}</td>
                  <td><div style={{ fontWeight:600, color:'var(--text-primary)' }}>{DEPT_ICONS[d.code]||'🏥'} {d.name}</div></td>
                  <td><span className="chip">{d.code}</span></td>
                  <td className="text-muted text-sm">{d.description || '—'}</td>
                  <td><span className={`badge ${d.is_active ? 'badge-active' : 'badge-completed'}`}>{d.is_active ? '🟢 Active' : '🔴 Inactive'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── MAIN ADMIN DASHBOARD ───────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('analytics');
  const [analytics, setAnalytics] = useState(null);
  const [queueData, setQueueData] = useState([]);
  const [emergencyAlerts, setEmergencyAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    try {
      const [analyticsRes, queueRes, emergencyRes] = await Promise.all([
        adminAPI.getDashboard(),
        adminAPI.getQueueOverview(),
        adminAPI.getEmergencyAlerts(),
      ]);
      setAnalytics(analyticsRes.data);
      setQueueData(queueRes.data);
      setEmergencyAlerts(emergencyRes.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, []);

  const sidebar = [
    { id: 'analytics', label: 'Analytics', icon: '📊' },
    { id: 'queue', label: 'Queue Monitor', icon: '📍' },
    { id: 'emergency', label: 'Emergency Alerts', icon: '🚨' },
    { id: 'doctors', label: 'Manage Doctors', icon: '🩺' },
    { id: 'departments', label: 'Departments', icon: '🏢' },
  ];

  // Chart data builders
  const deptNames = analytics?.department_stats?.map(d => d.department_name) || [];
  const waitTimeData = {
    labels: deptNames,
    datasets: [{
      label: 'Avg Wait Time (min)',
      data: analytics?.department_stats?.map(d => Math.round(d.avg_wait_time)) || [],
      backgroundColor: 'hsla(210, 100%, 56%, 0.7)',
      borderColor: 'hsl(210, 100%, 56%)',
      borderWidth: 2,
      borderRadius: 6,
    }],
  };

  const patientLoadData = {
    labels: deptNames,
    datasets: [{
      label: 'Patients Today',
      data: analytics?.department_stats?.map(d => d.total_patients) || [],
      backgroundColor: [
        'hsla(210, 100%, 56%, 0.8)',
        'hsla(142, 70%, 46%, 0.8)',
        'hsla(38, 100%, 58%, 0.8)',
        'hsla(270, 60%, 60%, 0.8)',
        'hsla(0, 80%, 60%, 0.8)',
        'hsla(180, 60%, 50%, 0.8)',
        'hsla(300, 50%, 60%, 0.8)',
        'hsla(60, 80%, 50%, 0.8)',
      ],
      borderColor: 'transparent',
    }],
  };

  const peakHoursData = {
    labels: ['8AM', '9AM', '10AM', '11AM', '12PM', '1PM', '2PM', '3PM', '4PM', '5PM', '6PM'],
    datasets: [{
      label: 'Patient Arrivals',
      data: [8, 22, 38, 45, 35, 18, 28, 42, 31, 15, 6],
      borderColor: 'hsl(210, 100%, 56%)',
      backgroundColor: 'hsla(210, 100%, 56%, 0.1)',
      tension: 0.4,
      fill: true,
      pointBackgroundColor: 'hsl(210, 100%, 56%)',
      pointRadius: 4,
    }],
  };

  const emergencyTrendData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Critical',
        data: [3, 5, 2, 7, 4, 6, 3],
        borderColor: 'hsl(0, 90%, 60%)',
        backgroundColor: 'hsla(0, 90%, 60%, 0.1)',
        tension: 0.4, fill: true,
      },
      {
        label: 'High',
        data: [8, 12, 7, 15, 10, 14, 9],
        borderColor: 'hsl(25, 90%, 55%)',
        backgroundColor: 'hsla(25, 90%, 55%, 0.1)',
        tension: 0.4, fill: true,
      },
    ],
  };

  return (
    <div className="portal-layout">
      <div className="sidebar">
        {sidebar.map(item => (
          <button key={item.id} className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}>
            {item.icon} {item.label}
          </button>
        ))}
      </div>

      <div className="main-content">
        {loading && (
          <div className="loading-overlay"><div className="loading-spinner" /><p>Loading hospital data…</p></div>
        )}

        {!loading && activeTab === 'analytics' && (
          <div className="animate-fade-up">
            <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12 }}>
              <div>
                <h1>📊 Hospital Analytics</h1>
                <p>Real-time overview of all departments and queues · Updates every 30s</p>
              </div>
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <button className="btn btn-ghost" onClick={fetchAll} style={{ padding:'8px 14px', fontSize:'0.82rem' }}>🔄 Refresh</button>
                <LanguageToggle />
              </div>
            </div>

            {analytics && (
              <>
                <div className="stats-grid stagger">
                  <StatCard icon="👥" value={analytics.total_patients_today} label="Patients Today" accent="var(--color-primary)" />
                  <StatCard icon="✅" value={analytics.completed_consultations_today} label="Completed" accent="var(--color-success)" />
                  <StatCard icon="⏱" value={`${Math.round(analytics.avg_wait_time_overall)} min`} label="Avg Wait Time" accent="var(--color-warning)" />
                  <StatCard icon="🚨" value={analytics.emergency_cases_today} label="Emergency Cases" accent="var(--color-danger)" />
                  <StatCard icon="🩺" value={analytics.active_doctors} label="Active Doctors" accent="hsl(270, 60%, 60%)" />
                </div>

                <div className="dashboard-grid">
                  <div className="col-8">
                    <div className="card mb-lg">
                      <h4 className="mb-md">⏱ Avg Wait Time by Department</h4>
                      <div className="chart-container">
                        <Bar data={waitTimeData} options={{ ...CHART_DEFAULTS, maintainAspectRatio: false }} />
                      </div>
                    </div>
                  </div>

                  <div className="col-4">
                    <div className="card mb-lg">
                      <h4 className="mb-md">🏥 Patient Distribution</h4>
                      <div className="chart-container">
                        <Doughnut data={patientLoadData} options={{
                          maintainAspectRatio: false,
                          plugins: { legend: { position: 'bottom', labels: { color: 'hsl(210, 15%, 65%)', font: { size: 10 } } } }
                        }} />
                      </div>
                    </div>
                  </div>

                  <div className="col-6">
                    <div className="card mb-lg">
                      <h4 className="mb-md">📈 Peak Hours (Simulated)</h4>
                      <div className="chart-container">
                        <Line data={peakHoursData} options={{ ...CHART_DEFAULTS, maintainAspectRatio: false }} />
                      </div>
                    </div>
                  </div>

                  <div className="col-6">
                    <div className="card mb-lg">
                      <h4 className="mb-md">🚨 Emergency Trend (7 Days)</h4>
                      <div className="chart-container">
                        <Line data={emergencyTrendData} options={{ ...CHART_DEFAULTS, maintainAspectRatio: false }} />
                      </div>
                    </div>
                  </div>

                  <div className="col-12">
                    <div className="card">
                      <h4 className="mb-md">🏢 Department Performance</h4>
                      <div className="table-container">
                        <table>
                          <thead>
                            <tr><th>Department</th><th>Patients</th><th>Completed</th><th>Avg Wait</th><th>Emergencies</th><th>Efficiency</th></tr>
                          </thead>
                          <tbody>
                            {analytics.department_stats.map(dept => {
                              const efficiency = dept.total_patients ? Math.round((dept.completed_count / dept.total_patients) * 100) : 0;
                              return (
                                <tr key={dept.department_name}>
                                  <td><div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{dept.department_name}</div></td>
                                  <td>{dept.total_patients}</td>
                                  <td style={{ color: 'var(--color-success)', fontWeight: 600 }}>{dept.completed_count}</td>
                                  <td>{Math.round(dept.avg_wait_time)} min</td>
                                  <td>
                                    {dept.emergency_count > 0 ? (
                                      <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>🚨 {dept.emergency_count}</span>
                                    ) : <span style={{ color: 'var(--text-muted)' }}>0</span>}
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                      <div className="progress-bar" style={{ width: 80, display: 'inline-block' }}>
                                        <div className="progress-fill" style={{ width: `${efficiency}%` }} />
                                      </div>
                                      <span className="text-sm">{efficiency}%</span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {!loading && activeTab === 'queue' && (
          <div className="animate-fade-up">
            <div className="page-header">
              <h1>📍 Live Queue Monitor</h1>
              <p>Real-time queue status across all departments</p>
            </div>
            <QueueOverview data={queueData} />
          </div>
        )}

        {!loading && activeTab === 'emergency' && (
          <div className="animate-fade-up">
            <div className="page-header">
              <h1>🚨 Emergency Alerts</h1>
              <p>Critical and high-priority cases today</p>
            </div>
            {emergencyAlerts.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                <div style={{ fontSize: '3rem' }}>✅</div>
                <h3 style={{ marginTop: 'var(--space-md)' }}>No Emergencies Today</h3>
                <p>All patients are in normal/medium priority</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                {emergencyAlerts.map(alert => (
                  <div key={alert.id} className="card" style={{
                    borderColor: alert.priority_level === 'critical' ? 'var(--color-danger)' : 'var(--color-warning)',
                    borderLeft: `4px solid ${alert.priority_level === 'critical' ? 'var(--color-danger)' : 'var(--color-warning)'}`,
                  }}>
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-sm">
                          <span style={{ fontSize: '1.3rem' }}>{alert.priority_level === 'critical' ? '🚨' : '⚠️'}</span>
                          <h4 style={{ color: 'var(--text-primary)' }}>{alert.patient_name}</h4>
                          <span className={`badge badge-${alert.priority_level}`}>{alert.priority_level}</span>
                        </div>
                        <div className="text-xs text-muted mt-sm">
                          Risk Score: <strong style={{ color: 'var(--color-danger)' }}>{Math.round(alert.risk_score)}/100</strong>
                          · Assessed: {new Date(alert.assessed_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && activeTab === 'doctors' && (
          <div className="animate-fade-up">
            <div className="page-header"><h1>🩺 Manage Doctors</h1></div>
            <AddDoctorForm onAdded={fetchAll} />
          </div>
        )}

        {!loading && activeTab === 'departments' && (
          <DepartmentsManager />
        )}
      </div>
    </div>
  );
}
