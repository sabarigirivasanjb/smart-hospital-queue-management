import { useState, useEffect, useRef, useCallback } from 'react';
import { patientAPI, publicAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import SmartWatchConnector from '../components/SmartWatchConnector';
import LanguageToggle from '../components/LanguageToggle';
import { FeedbackForm } from '../components/FeedbackForm';
import { MyBillsList } from '../components/BillViewer';
import { useLanguage } from '../i18n';

const SYMPTOMS = [
  { key: 'chest_pain', label: '💔 Chest Pain', weight: 'high' },
  { key: 'difficulty_breathing', label: '😮‍💨 Difficulty Breathing', weight: 'high' },
  { key: 'high_fever', label: '🌡️ High Fever', weight: 'medium' },
  { key: 'severe_bleeding', label: '🩸 Severe Bleeding', weight: 'high' },
  { key: 'loss_of_consciousness', label: '😵 Loss of Consciousness', weight: 'critical' },
  { key: 'accident_trauma', label: '🚑 Accident / Trauma', weight: 'high' },
  { key: 'stroke_symptoms', label: '🧠 Stroke Symptoms', weight: 'critical' },
  { key: 'severe_abdominal_pain', label: '🤢 Severe Abdominal Pain', weight: 'medium' },
  { key: 'allergic_reaction', label: '🌿 Allergic Reaction', weight: 'medium' },
];

const PRIORITY_COLORS = {
  critical: 'var(--color-critical)',
  high: 'var(--color-high)',
  medium: 'var(--color-medium)',
  normal: 'var(--color-normal)',
};

function PriorityBadge({ level }) {
  return <span className={`badge badge-${level}`}>
    {level === 'critical' ? '🚨' : level === 'high' ? '⚠️' : level === 'medium' ? '🟡' : '✅'} {level.toUpperCase()}
  </span>;
}

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

function formatWait(mins) {
  if (!mins) return '—';
  const m = Math.round(mins);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// ── TRIAGE FORM ───────────────────────────────────────────────────────────────
function TriageForm({ appointmentId, onComplete }) {
  const [symptoms,       setSymptoms]       = useState({});
  const [vitals,         setVitals]         = useState({ heart_rate: '', oxygen_saturation: '', temperature: '', pain_scale: 0 });
  const [result,         setResult]         = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [watchConnected, setWatchConnected] = useState(false);
  const [showWatch,      setShowWatch]      = useState(false);
  const [errors,         setErrors]         = useState({});

  const handleWatchVitals = useCallback((reading) => {
    setWatchConnected(true);
    setVitals(v => ({
      ...v,
      heart_rate:        reading.heart_rate        != null ? String(reading.heart_rate)        : v.heart_rate,
      oxygen_saturation: reading.oxygen_saturation != null ? String(reading.oxygen_saturation) : v.oxygen_saturation,
      temperature:       reading.temperature       != null ? String(reading.temperature)       : v.temperature,
    }));
  }, []);

  const toggleSymptom = (key) => setSymptoms(s => ({ ...s, [key]: !s[key] }));

  const setVital = (key, val) => {
    setVitals(v => ({ ...v, [key]: val }));
    setErrors(e => ({ ...e, [key]: '' }));
  };

  const handleSubmit = async () => {
    // Guard: must have a valid appointment
    if (!appointmentId) {
      toast.error('❌ No appointment found. Please book an appointment first!');
      return;
    }

    const errs = {};
    if (vitals.heart_rate && (Number(vitals.heart_rate) < 20 || Number(vitals.heart_rate) > 300))
      errs.heart_rate = 'Must be 20–300 bpm';
    if (vitals.oxygen_saturation && (Number(vitals.oxygen_saturation) < 50 || Number(vitals.oxygen_saturation) > 100))
      errs.oxygen_saturation = 'Must be 50–100%';
    if (vitals.temperature && (Number(vitals.temperature) < 30 || Number(vitals.temperature) > 45))
      errs.temperature = 'Must be 30–45 °C';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      // Build payload — all symptom booleans explicitly set
      const payload = {
        chest_pain:            !!symptoms.chest_pain,
        difficulty_breathing:  !!symptoms.difficulty_breathing,
        high_fever:            !!symptoms.high_fever,
        severe_bleeding:       !!symptoms.severe_bleeding,
        loss_of_consciousness: !!symptoms.loss_of_consciousness,
        accident_trauma:       !!symptoms.accident_trauma,
        stroke_symptoms:       !!symptoms.stroke_symptoms,
        severe_abdominal_pain: !!symptoms.severe_abdominal_pain,
        allergic_reaction:     !!symptoms.allergic_reaction,
        heart_rate:        vitals.heart_rate        ? parseInt(vitals.heart_rate)        : null,
        oxygen_saturation: vitals.oxygen_saturation ? parseInt(vitals.oxygen_saturation) : null,
        temperature:       vitals.temperature       ? parseFloat(vitals.temperature)     : null,
        pain_scale:        parseInt(vitals.pain_scale) || 0,
      };

      const res = await patientAPI.submitTriage(appointmentId, payload);
      setResult(res.data);

      const lvl = res.data.priority_level;
      const pos  = res.data.queue_position;
      const wait = res.data.predicted_wait_minutes;

      if (lvl === 'critical') {
        toast.error(`🚨 CRITICAL! You are #${pos} in queue. Immediate attention needed!`, { duration: 8000 });
      } else if (lvl === 'high') {
        toast(`⚠️ HIGH Priority — Queue position #${pos}. Est. wait: ~${Math.round(wait || 0)} min`, { duration: 6000 });
      } else if (lvl === 'medium') {
        toast(`🟡 MEDIUM Priority — Queue position #${pos}. Est. wait: ~${Math.round(wait || 0)} min`, { duration: 5000 });
      } else {
        toast.success(`✅ NORMAL Priority — Queue position #${pos}. Est. wait: ~${Math.round(wait || 0)} min`, { duration: 5000 });
      }
      onComplete && onComplete(res.data);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail) {
        toast.error(`❌ ${detail}`);
      } else {
        toast.error('❌ Triage submission failed. Please try again.');
      }
      console.error('Triage error:', err);
    } finally {
      setLoading(false);
    }
  };


  const painLabels = ['No Pain 😐','Very Mild 😕','Mild 😟','Moderate 😣','Significant 😖',
    'Severe 😩','Very Severe 😰','Intense 😱','Very Intense 🤯','Unbearable 😭','Worst 💀'];
  const painColor = vitals.pain_scale <= 3 ? 'var(--color-success)'
    : vitals.pain_scale <= 6 ? 'var(--color-warning)' : 'var(--color-danger)';

  if (result) {
    return (
      <div className="card animate-fade-up" style={{ borderColor: PRIORITY_COLORS[result.priority_level], boxShadow: `0 0 30px ${PRIORITY_COLORS[result.priority_level]}30` }}>
        <div style={{ textAlign:'center', marginBottom:'var(--space-lg)' }}>
          <div style={{ fontSize:'4rem', marginBottom:8 }}>
            {result.priority_level==='critical'?'🚨':result.priority_level==='high'?'⚠️':result.priority_level==='medium'?'🟡':'✅'}
          </div>
          <h3 style={{ marginBottom:8 }}>Triage Assessment Complete</h3>
          <PriorityBadge level={result.priority_level} />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-md)', marginBottom:'var(--space-md)' }}>
          <div className="card" style={{ padding:'var(--space-md)', textAlign:'center' }}>
            <div style={{ fontSize:'2.5rem', fontWeight:900, color: PRIORITY_COLORS[result.priority_level] }}>{Math.round(result.risk_score)}</div>
            <div className="text-xs text-muted">Risk Score / 100</div>
          </div>
          <div className="card" style={{ padding:'var(--space-md)', textAlign:'center' }}>
            <div style={{ fontSize:'2.5rem', fontWeight:900, color:'var(--color-primary)' }}>#{result.queue_position||'—'}</div>
            <div className="text-xs text-muted">Queue Position</div>
          </div>
        </div>
        <p style={{ color:'var(--text-secondary)', fontSize:'0.9rem', lineHeight:1.6, marginBottom:'var(--space-md)' }}>{result.message}</p>
        {result.predicted_wait_minutes && (
          <div style={{ padding:'var(--space-md)', background:'var(--bg-surface)', borderRadius:'var(--radius-md)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span className="text-muted text-sm">⏱️ Estimated Wait:</span>
            <span style={{ fontWeight:700, fontSize:'1.2rem', color:'var(--color-primary)' }}>{formatWait(result.predicted_wait_minutes)}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom:'var(--space-sm)' }}>🩺 Emergency Triage Assessment</h3>
      <p style={{ marginBottom:'var(--space-lg)', fontSize:'0.85rem', color:'var(--text-muted)' }}>
        Select symptoms and enter your vitals. AI will determine your emergency priority.
      </p>

      {/* SYMPTOMS */}
      <div className="section-title">🤒 Symptoms <span style={{ fontWeight:400, fontSize:'0.75rem', color:'var(--text-muted)' }}>— select all that apply</span></div>
      <div className="symptom-grid mb-lg">
        {SYMPTOMS.map(({ key, label }) => (
          <label key={key} className={`symptom-checkbox ${symptoms[key] ? 'checked' : ''}`}>
            <input type="checkbox" checked={!!symptoms[key]} onChange={() => toggleSymptom(key)} />
            <span style={{ fontSize:'0.88rem' }}>{label}</span>
          </label>
        ))}
      </div>

      {/* VITALS */}
      <div className="section-title" style={{ marginBottom:12 }}>
        📊 Vitals Entry
        {watchConnected && <span style={{ marginLeft:10, fontSize:'0.72rem', fontWeight:500, background:'rgba(102,187,106,0.15)', color:'var(--color-success)', border:'1px solid var(--color-success)', borderRadius:20, padding:'2px 10px' }}>✅ Watch Connected</span>}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(190px,1fr))', gap:12, marginBottom:16 }}>
        {[
          { key:'heart_rate',        icon:'❤️', label:'HEART RATE',     unit:'bpm',  color:'#ef5350', placeholder:'e.g. 85',  min:20, max:300, step:1,   note:'Normal: 60–100',
            getColor: v => v<60?'#42a5f5':v<=100?'#66bb6a':'#ef5350' },
          { key:'oxygen_saturation', icon:'🩸', label:'SpO₂ OXYGEN',    unit:'%',    color:'#42a5f5', placeholder:'e.g. 97',  min:50, max:100, step:1,   note:'Normal: 95–100',
            getColor: v => v>=95?'#66bb6a':v>=90?'#ffa726':'#ef5350' },
          { key:'temperature',       icon:'🌡️', label:'TEMPERATURE',    unit:'°C',   color:'#ffa726', placeholder:'e.g. 37.5',min:30, max:45,  step:0.1, note:'Normal: 36.1–37.2',
            getColor: v => v<=37.2?'#66bb6a':v<=38.5?'#ffa726':'#ef5350' },
        ].map(({ key, icon, label, unit, color, placeholder, min, max, step, note, getColor }) => (
          <div key={key} style={{ background:`rgba(255,255,255,0.03)`, border:`1px solid ${errors[key]?'var(--color-danger)':`${color}33`}`, borderRadius:12, padding:'14px 16px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
              <span style={{ fontSize:'1.3rem' }}>{icon}</span>
              <div>
                <div style={{ fontSize:'0.72rem', fontWeight:700, color, letterSpacing:'0.5px' }}>{label}</div>
                <div style={{ fontSize:'0.67rem', color:'var(--text-muted)' }}>{note}</div>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input
                type="number" min={min} max={max} step={step}
                placeholder={placeholder}
                value={vitals[key]}
                onChange={e => setVital(key, e.target.value)}
                style={{ flex:1, background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:8, padding:'9px 12px', color:'var(--text-primary)', fontSize:'1.15rem', fontWeight:700, outline:'none', width:'100%' }}
              />
              <span style={{ color:'var(--text-muted)', fontSize:'0.8rem', fontWeight:600, minWidth:28 }}>{unit}</span>
            </div>
            {errors[key] && <div style={{ color:'var(--color-danger)', fontSize:'0.7rem', marginTop:5 }}>⚠️ {errors[key]}</div>}
            {vitals[key] && !errors[key] && (
              <div style={{ marginTop:8, height:3, borderRadius:2, background: getColor(Number(vitals[key])) }} />
            )}
          </div>
        ))}
      </div>

      {/* PAIN SCALE */}
      <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:'16px', marginBottom:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <span style={{ fontSize:'0.8rem', fontWeight:700, letterSpacing:'0.5px' }}>😣 PAIN SCALE</span>
          <span style={{ fontSize:'1.5rem', fontWeight:900, color: painColor }}>{vitals.pain_scale}<span style={{ fontSize:'0.85rem', color:'var(--text-muted)' }}>/10</span></span>
        </div>
        <input type="range" min="0" max="10" value={vitals.pain_scale}
          onChange={e => setVital('pain_scale', e.target.value)}
          style={{ width:'100%', accentColor: painColor, height:6, cursor:'pointer' }}
        />
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:6 }}>
          <span style={{ fontSize:'0.68rem', color:'var(--text-muted)' }}>0 - None</span>
          <span style={{ fontSize:'0.8rem', color: painColor, fontWeight:600 }}>{painLabels[parseInt(vitals.pain_scale)]}</span>
          <span style={{ fontSize:'0.68rem', color:'var(--text-muted)' }}>10 - Worst</span>
        </div>
      </div>

      {/* SUBMIT */}
      <button className="btn btn-danger btn-full" onClick={handleSubmit} disabled={loading}
        style={{ fontSize:'1rem', fontWeight:700, padding:'14px', marginBottom:'var(--space-lg)', letterSpacing:'0.3px' }}>
        {loading ? <span className="loading-spinner" /> : '🚨'} Submit Triage Assessment
      </button>

      {/* OPTIONAL SMARTWATCH */}
      <button onClick={() => setShowWatch(w => !w)} style={{
        width:'100%', padding:'11px 16px',
        background: showWatch ? 'rgba(66,165,245,0.12)' : 'rgba(66,165,245,0.05)',
        border:'1px dashed rgba(66,165,245,0.4)', borderRadius:'var(--radius-md)',
        color:'var(--color-primary)', cursor:'pointer', fontSize:'0.88rem', fontWeight:600,
        display:'flex', alignItems:'center', justifyContent:'center', gap:8,
      }}>
        ⌚ {showWatch ? 'Hide SmartWatch' : 'Connect SmartWatch'}
        <span style={{ fontWeight:400, opacity:0.7, fontSize:'0.8rem' }}>(Optional — auto-fills vitals)</span>
        <span style={{ marginLeft:'auto', opacity:0.6 }}>{showWatch ? '▲' : '▼'}</span>
      </button>
      {showWatch && <div style={{ marginTop:'var(--space-sm)' }}><SmartWatchConnector onVitalsReceived={handleWatchVitals} /></div>}
    </div>
  );
}


// ── LIVE QUEUE STATUS ──────────────────────────────────────────────────────────
function QueueStatus({ appointment, ws }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await patientAPI.getQueueStatus(appointment.id);
      setStatus(res.data);
    } catch {}
    setLoading(false);
  }, [appointment.id]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  useEffect(() => {
    if (!ws) return;
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'queue_update' || msg.type === 'your_turn') {
        fetchStatus();
        if (msg.type === 'your_turn') {
          toast.success("🩺 It's your turn! Please proceed to the consultation room.", { duration: 8000 });
        }
      }
    };
  }, [ws, fetchStatus]);

  if (loading) return <div className="loading-overlay"><div className="loading-spinner" /><p>Loading queue status…</p></div>;
  if (!status) return null;

  const trackerSteps = Math.min(status.patients_ahead + 1, 8);
  const currentStep = status.patients_ahead;

  return (
    <div className="card card-highlight animate-fade-up">
      <div className="flex justify-between items-center mb-md">
        <h3>Live Queue Status</h3>
        <PriorityBadge level={status.priority_level} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'var(--space-xl)', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
        <div className="queue-position-circle">
          <div className="pos-num">{status.queue_position}</div>
          <div className="pos-label">Your #</div>
        </div>
        <div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {status.patients_ahead === 0 ? "You're Next! 🎉" : `${status.patients_ahead} patients ahead`}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
            Estimated wait: <span style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: '1.1rem' }}>
              {formatWait(status.predicted_wait_minutes)}
            </span>
          </div>
          <div style={{ marginTop: 'var(--space-md)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>Progress</div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${Math.max(5, 100 - (status.patients_ahead * 12.5))}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Queue Visual */}
      <div className="queue-tracker">
        {Array.from({ length: trackerSteps }).map((_, i) => (
          <div key={i} className="queue-step">
            <div className={`queue-dot ${i < currentStep ? 'past' : i === currentStep ? 'current' : 'future'}`}>
              {i < currentStep ? '✓' : i + 1}
            </div>
            {i < trackerSteps - 1 && <div className={`queue-line ${i < currentStep ? 'filled' : ''}`} />}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-sm) var(--space-md)', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        Status: <StatusBadge status={status.status} /> · Updates every 30 seconds
      </div>
    </div>
  );
}

// ── BOOK APPOINTMENT ──────────────────────────────────────────────────────────
function BookAppointment({ onBooked }) {
  const [step, setStep] = useState(1);
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [selectedDept, setSelectedDept] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [symptoms, setSymptoms] = useState('');
  const [time, setTime] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    publicAPI.getDepartments().then(r => setDepartments(r.data));
  }, []);

  const selectDept = async (dept) => {
    setSelectedDept(dept);
    setLoading(true);
    const [docRes, recRes] = await Promise.all([
      publicAPI.getDoctors(dept.id),
      patientAPI.getSlotRecommendations(dept.id).catch(() => ({ data: [] })),
    ]);
    setDoctors(docRes.data);
    setRecommendations(recRes.data || []);
    setLoading(false);
    setStep(2);
  };

  const selectDoctor = (doctor) => {
    setSelectedDoctor(doctor);
    const rec = recommendations.find(r => r.doctor_id === (doctor.id || doctor.doctor_id));
    if (rec) setTime(new Date(rec.recommended_time).toISOString().slice(0, 16));
    setStep(3);
  };

  const handleBook = async () => {
    if (!selectedDoctor || !time) return toast.error('Please select a time');
    setLoading(true);
    try {
      const res = await patientAPI.bookAppointment({
        doctor_id: selectedDoctor.id,
        appointment_time: new Date(time).toISOString(),
        symptoms_description: symptoms,
      });
      toast.success('Appointment booked! ✅');
      onBooked && onBooked(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Booking failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center gap-md mb-lg">
        <h3>📅 Book Appointment</h3>
        <div className="flex gap-sm" style={{ marginLeft: 'auto' }}>
          {[1,2,3].map(s => (
            <div key={s} style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', fontWeight: 700,
              background: step >= s ? 'var(--color-primary)' : 'var(--bg-surface)',
              color: step >= s ? 'white' : 'var(--text-muted)',
              border: step === s ? '2px solid var(--color-primary)' : '2px solid var(--border-subtle)',
            }}>{s}</div>
          ))}
        </div>
      </div>

      {step === 1 && (
        <div className="animate-fade-up">
          <p className="text-muted text-sm mb-md">Choose a department to begin</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-sm)' }}>
            {departments.map(d => (
              <div key={d.id} className="doctor-card" onClick={() => selectDept(d)}>
                <div style={{ fontSize: '1.5rem', marginBottom: 'var(--space-xs)' }}>
                  {d.code === 'CARD' ? '❤️' : d.code === 'EMRG' ? '🚨' : d.code === 'NEUR' ? '🧠' :
                   d.code === 'ORTH' ? '🦴' : d.code === 'GENM' ? '🩺' : d.code === 'PEDI' ? '👶' :
                   d.code === 'DERM' ? '🧴' : '👁️'}
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{d.name}</div>
                <div className="text-xs text-muted mt-sm">{d.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 2 && !loading && (
        <div className="animate-fade-up">
          <button className="btn btn-ghost btn-sm mb-md" onClick={() => setStep(1)}>← Back</button>
          <p className="text-sm text-muted mb-md">
            Department: <strong style={{ color: 'var(--text-primary)' }}>{selectedDept?.name}</strong>
          </p>

          {recommendations.length > 0 && (
            <>
              <div className="section-title">🤖 AI Recommended</div>
              {recommendations.map(rec => {
                const doc = doctors.find(d => d.id === rec.doctor_id);
                return (
                  <div key={rec.doctor_id} className="doctor-card mb-md" onClick={() => selectDoctor({ ...doc, ...rec })}>
                    <div className="flex items-center gap-md">
                      <div className="doctor-avatar">{rec.doctor_name[3]}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{rec.doctor_name}</div>
                        <div className="text-xs text-muted">{rec.specialization}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: 'var(--color-success)', fontWeight: 700 }}>{formatWait(rec.estimated_wait_minutes)}</div>
                        <div className="text-xs text-muted">{rec.current_queue_size} waiting</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 'var(--space-sm)', padding: '4px 10px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      💡 {rec.reason}
                    </div>
                  </div>
                );
              })}
              <div className="section-title">All Available Doctors</div>
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-sm)' }}>
            {doctors.map(d => (
              <div key={d.id} className="doctor-card" onClick={() => selectDoctor(d)}>
                <div className="doctor-avatar" style={{ width: 40, height: 40, fontSize: '1rem' }}>{d.name[3]}</div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{d.name}</div>
                <div className="text-xs text-muted">{d.specialization}</div>
                <div className="text-xs text-muted mt-sm">⏱ avg {d.avg_consultation_minutes}min · {d.experience_years}yr exp</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 2 && loading && (
        <div className="loading-overlay"><div className="loading-spinner" /><p>Loading doctors…</p></div>
      )}

      {step === 3 && (
        <div className="animate-fade-up">
          <button className="btn btn-ghost btn-sm mb-md" onClick={() => setStep(2)}>← Back</button>
          <div className="card" style={{ background: 'var(--bg-surface)', marginBottom: 'var(--space-md)' }}>
            <div className="flex items-center gap-md">
              <div className="doctor-avatar">{selectedDoctor?.name?.[3] || selectedDoctor?.doctor_name?.[3] || 'D'}</div>
              <div>
                <div style={{ fontWeight: 700 }}>{selectedDoctor?.name || selectedDoctor?.doctor_name}</div>
                <div className="text-xs text-muted">{selectedDoctor?.specialization} · {selectedDept?.name}</div>
              </div>
            </div>
          </div>

          <div className="form-group mb-md">
            <label className="form-label">Preferred Date & Time</label>
            <input type="datetime-local" className="form-input" value={time}
              onChange={e => setTime(e.target.value)} min={new Date().toISOString().slice(0, 16)} />
          </div>
          <div className="form-group mb-lg">
            <label className="form-label">Describe Your Symptoms (Optional)</label>
            <textarea className="form-textarea" placeholder="Briefly describe your symptoms or reason for visit…"
              value={symptoms} onChange={e => setSymptoms(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-full" onClick={handleBook} disabled={loading}>
            {loading ? <span className="loading-spinner" /> : '✅'} Confirm Appointment
          </button>
        </div>
      )}
    </div>
  );
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
function Notifications({ onUnreadChange }) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    patientAPI.getNotifications().then(r => {
      setNotifications(r.data);
      onUnreadChange(r.data.filter(n => !n.is_read).length);
    });
  }, []);

  const markRead = async (id) => {
    await patientAPI.markNotificationRead(id);
    setNotifications(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
    onUnreadChange(notifications.filter(n => !n.is_read && n.id !== id).length);
  };

  return (
    <div className="card">
      <h3 className="mb-md">🔔 Notifications</h3>
      {notifications.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🔕</div><p>No notifications yet</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          {notifications.map(n => (
            <div key={n.id} className={`notif-item ${n.is_read ? 'read' : 'unread'} ${n.notification_type}`}
              onClick={() => !n.is_read && markRead(n.id)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{n.title}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 2 }}>{n.message}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </div>
              {!n.is_read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 4 }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── MAIN PATIENT DASHBOARD ────────────────────────────────────────────────────
export default function PatientDashboard({ onUnreadChange }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [appointments, setAppointments] = useState([]);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const wsRef    = useRef(null);
  const [queueAlert, setQueueAlert] = useState(null); // { type: 'your_turn'|'almost_your_turn', message, wait_minutes }

  // Play a soft notification beep
  const playBeep = (type = 'your_turn') => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(type === 'your_turn' ? 880 : 660, ctx.currentTime);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
      osc.start(); osc.stop(ctx.currentTime + 1.2);
    } catch {}
  };

  useEffect(() => {
    patientAPI.getAppointments().then(r => setAppointments(r.data));

    // Always use hardcoded backend address — never rely on window.location
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/patient/${user.id}`);
    wsRef.current = ws;

    ws.onopen = () => console.log('[WS] Patient connected, user_id:', user.id);

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        console.log('[WS] Message received:', msg.type, msg);

        if (msg.type === 'your_turn') {
          // Only show if this appointment belongs to THIS patient
          // (backend already sends to correct user_id via send_to_user)
          setQueueAlert({ type: 'your_turn', message: 'The doctor is ready for you!', wait_minutes: 0 });
          playBeep('your_turn');
          toast.success("🩺 IT'S YOUR TURN! Please go to the consultation room now.", {
            duration: 12000,
            style: { background: '#1b5e20', color: '#fff', fontWeight: 700, fontSize: '1rem' }
          });
          // Refresh appointments to show active status
          patientAPI.getAppointments().then(r => setAppointments(r.data));

        } else if (msg.type === 'almost_your_turn') {
          setQueueAlert({ type: 'almost_your_turn', message: msg.message || "You're almost next!", wait_minutes: msg.wait_minutes });
          playBeep('almost');
          toast(`⏰ You're UP NEXT! Be ready — ~${Math.round(msg.wait_minutes || 5)} min`, {
            duration: 8000,
            style: { background: '#e65100', color: '#fff', fontWeight: 600 }
          });

        } else if (msg.type === 'queue_update') {
          // Silently refresh queue data — no banner
          patientAPI.getAppointments().then(r => setAppointments(r.data));

        } else if (msg.type === 'emergency_alert') {
          // Show emergency alert only if this patient is the one being alerted
          if (msg.patient_id === user.id) {
            toast.error(`🚨 CRITICAL alert confirmed for you!`, { duration: 8000 });
          }
        }
      } catch {}
    };

    ws.onerror = () => console.log('[WS] Connection error');
    ws.onclose = () => console.log('[WS] Disconnected');

    const ping = setInterval(() => ws.readyState === 1 && ws.send('ping'), 25000);
    return () => { clearInterval(ping); ws.close(); };
  }, [user.id]);


  const activeAppointments = appointments.filter(a => ['scheduled', 'active'].includes(a.status));
  // Sort: active first, then by most recent appointment_time
  const sortedActive = [...activeAppointments].sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (b.status === 'active' && a.status !== 'active') return 1;
    return new Date(b.appointment_time) - new Date(a.appointment_time);
  });
  const latestActive = sortedActive[0];
  // For triage: use any scheduled/active — even if none, pick most recent overall
  const triageAppt = latestActive || appointments.find(a => a.status === 'scheduled');

  const sidebar = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'queue', label: 'Live Queue', icon: '📍' },
    { id: 'triage', label: 'Emergency Triage', icon: '🚨' },
    { id: 'book', label: 'Book Appointment', icon: '📅' },
    { id: 'history', label: 'My Appointments', icon: '📋' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
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
      </div>

      {/* ── QUEUE ALERT BANNER ─────────────────────────────────────────────── */}
      {queueAlert && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: queueAlert.type === 'your_turn'
            ? 'linear-gradient(135deg, hsl(142,70%,25%), hsl(142,70%,18%))'
            : 'linear-gradient(135deg, hsl(38,100%,25%), hsl(38,100%,18%))',
          borderBottom: `3px solid ${queueAlert.type === 'your_turn' ? 'hsl(142,70%,46%)' : 'hsl(38,100%,50%)'}`,
          padding: '14px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          animation: 'pulse-critical 1.5s infinite',
          boxShadow: queueAlert.type === 'your_turn'
            ? '0 4px 40px rgba(102,187,106,0.4)'
            : '0 4px 40px rgba(255,167,38,0.4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: '2.5rem', animation: 'pulse-critical 0.8s infinite' }}>
              {queueAlert.type === 'your_turn' ? '🩺' : '⏰'}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#fff', letterSpacing: '0.5px' }}>
                {queueAlert.type === 'your_turn' ? "IT'S YOUR TURN!" : "YOU'RE NEXT!"}
              </div>
              <div style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
                {queueAlert.type === 'your_turn'
                  ? '🏥 Doctor is ready — Please proceed to the consultation room now!'
                  : `⏱️ Get Ready! Estimated wait: ~${Math.round(queueAlert.wait_minutes || 5)} minutes`
                }
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            {queueAlert.type === 'your_turn' && (
              <button style={{
                background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)',
                color: '#fff', padding: '8px 18px', borderRadius: 8, cursor: 'pointer',
                fontWeight: 700, fontSize: '0.85rem',
              }} onClick={() => setActiveTab('queue')}>
                📍 View Queue
              </button>
            )}
            <button style={{
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)',
              color: 'rgba(255,255,255,0.7)', padding: '8px 14px', borderRadius: 8,
              cursor: 'pointer', fontSize: '1rem',
            }} onClick={() => setQueueAlert(null)}>✕</button>
          </div>
        </div>
      )}

      <div className="main-content" style={{ paddingTop: queueAlert ? '80px' : undefined }}>
        {activeTab === 'overview' && (
          <div className="animate-fade-up">
            <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12 }}>
              <div>
                <h1>Welcome, {user.full_name.split(' ')[0]} 👋</h1>
                <p>Manage your health appointments and queue status</p>
              </div>
              <LanguageToggle />
            </div>

            <div className="stats-grid stagger">
              <div className="stat-card" style={{ '--accent': 'var(--color-primary)' }}>
                <div className="stat-icon">📅</div>
                <div className="stat-value">{appointments.length}</div>
                <div className="stat-label">Total Appointments</div>
              </div>
              <div className="stat-card" style={{ '--accent': 'var(--color-success)' }}>
                <div className="stat-icon">✅</div>
                <div className="stat-value">{appointments.filter(a => a.status === 'completed').length}</div>
                <div className="stat-label">Completed</div>
              </div>
              <div className="stat-card" style={{ '--accent': 'var(--color-warning)' }}>
                <div className="stat-icon">⏳</div>
                <div className="stat-value">{activeAppointments.length}</div>
                <div className="stat-label">Active / Pending</div>
              </div>
              <div className="stat-card" style={{ '--accent': 'var(--color-danger)' }}>
                <div className="stat-icon">🚨</div>
                <div className="stat-value">{appointments.filter(a => a.priority_level === 'critical' || a.priority_level === 'high').length}</div>
                <div className="stat-label">High Priority</div>
              </div>
            </div>

            {latestActive && (
              <>
                <div className="section-title">Current Appointment</div>
                <QueueStatus appointment={latestActive} ws={wsRef.current} />
              </>
            )}

            {!latestActive && (
              <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>🏥</div>
                <h3>No Active Appointments</h3>
                <p style={{ marginBottom: 'var(--space-lg)' }}>Book a new appointment to get started</p>
                <button className="btn btn-primary" onClick={() => setActiveTab('book')}>📅 Book Appointment</button>
              </div>
            )}

            {/* My Bills quick view */}
            <MyBillsList patientId={user.id} />
          </div>
        )}

        {activeTab === 'queue' && latestActive && (
          <div className="animate-fade-up">
            <div className="page-header"><h1>📍 Live Queue Status</h1></div>
            <QueueStatus appointment={latestActive} ws={wsRef.current} />
          </div>
        )}

        {activeTab === 'queue' && !latestActive && (
          <div className="empty-state">
            <div className="empty-icon">📍</div>
            <h3>No Active Appointment</h3>
            <p>You're not currently in any queue</p>
            <button className="btn btn-primary mt-md" onClick={() => setActiveTab('book')}>Book Appointment</button>
          </div>
        )}

        {activeTab === 'triage' && (
          <div className="animate-fade-up">
            <div className="page-header">
              <h1>🚨 Emergency Triage</h1>
              <p>Complete this assessment to get your emergency priority assigned</p>
            </div>
            {triageAppt ? (
              <>
                {/* Appointment selector if multiple scheduled */}
                {activeAppointments.length > 1 && (
                  <div className="card mb-md" style={{ padding: '12px 16px', display:'flex', alignItems:'center', gap:12 }}>
                    <span style={{ fontSize:'0.82rem', color:'var(--text-muted)', whiteSpace:'nowrap' }}>📅 Appointment:</span>
                    <select
                      className="form-select"
                      style={{ flex:1, padding:'6px 10px', fontSize:'0.85rem' }}
                      value={triageAppt.id}
                      onChange={e => {
                        const chosen = activeAppointments.find(a => a.id === parseInt(e.target.value));
                        if (chosen) setAppointments(prev => [chosen, ...prev.filter(a => a.id !== chosen.id)]);
                      }}
                    >
                      {activeAppointments.map(a => (
                        <option key={a.id} value={a.id}>
                          #{a.id} — {a.doctor_name || `Doctor #${a.doctor_id}`} — {new Date(a.appointment_time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} ({a.status})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <TriageForm
                  appointmentId={triageAppt.id}
                  onComplete={() => patientAPI.getAppointments().then(r => setAppointments(r.data))}
                />
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">🚑</div>
                <h3>No Appointment Found</h3>
                <p>Please book an appointment first before submitting triage</p>
                <button className="btn btn-primary mt-md" onClick={() => setActiveTab('book')}>📅 Book Appointment</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'book' && (
          <div className="animate-fade-up">
            <div className="page-header"><h1>📅 Book Appointment</h1><p>AI-assisted slot recommendation</p></div>
            <BookAppointment onBooked={(appt) => {
              setAppointments(a => [appt, ...a]);
              setActiveTab('overview');
            }} />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="animate-fade-up">
            <div className="page-header"><h1>📋 My Appointments</h1></div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Doctor</th>
                    <th>Date & Time</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Wait Time</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.length === 0 ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No appointments yet</td></tr>
                  ) : appointments.map(a => (
                    <>
                      <tr key={a.id}>
                        <td><div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{a.doctor?.user?.full_name || `Doctor #${a.doctor_id}`}</div>
                          <div className="text-xs text-muted">{a.doctor?.department?.name}</div></td>
                        <td>{new Date(a.appointment_time).toLocaleString()}</td>
                        <td><StatusBadge status={a.status} /></td>
                        <td><PriorityBadge level={a.priority_level} /></td>
                        <td>{formatWait(a.predicted_wait_minutes)}</td>
                        <td>
                          {['scheduled', 'active'].includes(a.status) && (
                            <button className="btn btn-ghost btn-sm" onClick={() => {
                              setSelectedAppt(a);
                              setActiveTab('queue');
                            }}>View Queue</button>
                          )}
                        </td>
                      </tr>
                      {/* Feedback row for completed appointments */}
                      {a.status === 'completed' && (
                        <tr key={`fb-${a.id}`}>
                          <td colSpan="6" style={{ padding: '0 12px 16px', background: 'rgba(255,255,255,0.02)' }}>
                            <FeedbackForm
                              appointment={a}
                              doctorId={a.doctor_id}
                            />
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="animate-fade-up">
            <div className="page-header"><h1>🔔 Notifications</h1></div>
            <Notifications onUnreadChange={onUnreadChange} />
          </div>
        )}
      </div>
    </div>
  );
}
