import { useState, useEffect, useRef, useCallback } from 'react';
import { receptionAPI } from '../api';
import toast from 'react-hot-toast';

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDate = (iso) => iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

function PriorityBadge({ level }) {
  const map = { critical: ['#ef5350', '🚨'], high: ['#ffa726', '⚠️'], medium: ['#ffee58', '🟡'], normal: ['#66bb6a', '✅'] };
  const [color, icon] = map[level] || map.normal;
  return <span style={{ background: `${color}22`, color, border: `1px solid ${color}55`, borderRadius: 20, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 }}>{icon} {(level || 'normal').toUpperCase()}</span>;
}

function StatusBadge({ status }) {
  const map = { scheduled: ['#42a5f5', '🕐'], active: ['#66bb6a', '▶️'], completed: ['#78909c', '✅'], cancelled: ['#ef5350', '✕'], checked_in: ['#29b6f6', '✓'], checked_out: ['#78909c', '🚪'] };
  const [color, icon] = map[status] || ['#78909c', '•'];
  return <span style={{ background: `${color}22`, color, border: `1px solid ${color}55`, borderRadius: 20, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 }}>{icon} {status?.replace('_', ' ').toUpperCase()}</span>;
}

function PayBadge({ status }) {
  return status === 'paid'
    ? <span style={{ background: '#1b5e2044', color: '#66bb6a', border: '1px solid #66bb6a55', borderRadius: 20, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 }}>💳 PAID</span>
    : <span style={{ background: '#b71c1c44', color: '#ef5350', border: '1px solid #ef535055', borderRadius: 20, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 }}>⏳ PENDING</span>;
}

// ── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color = 'var(--color-primary)', sub }) {
  return (
    <div className="stat-card" style={{ '--accent': color }}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── PAYMENT RECEIPT MODAL ─────────────────────────────────────────────────────
function ReceiptModal({ receipt, onClose }) {
  const printRef = useRef();

  const handlePrint = () => {
    const w = window.open('', '_blank');
    w.document.write(`
      <html><head><title>Receipt - ${receipt.bill_number}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; color: #222; max-width: 400px; margin: auto; }
        h2 { text-align: center; color: #1565c0; }
        .hospital { text-align: center; font-size: 1.2rem; font-weight: bold; margin-bottom: 4px; }
        .sub { text-align: center; font-size: 0.8rem; color: #555; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        td { padding: 6px 4px; font-size: 0.9rem; }
        td:first-child { color: #555; width: 50%; }
        td:last-child { font-weight: 600; text-align: right; }
        .total-row td { border-top: 2px solid #222; font-size: 1.05rem; padding-top: 10px; }
        .footer { text-align: center; margin-top: 24px; font-size: 0.8rem; color: #888; }
        .paid-stamp { text-align: center; font-size: 2rem; color: green; font-weight: bold; margin: 16px 0; letter-spacing: 4px; border: 3px solid green; display: inline-block; padding: 4px 24px; transform: rotate(-10deg); }
        .stamp-wrap { text-align: center; }
      </style></head><body>
      <div class="hospital">🏥 SmartQueue Hospital</div>
      <div class="sub">AI-Powered Smart Queue Management System</div>
      <h2>PAYMENT RECEIPT</h2>
      <div class="stamp-wrap"><span class="paid-stamp">${receipt.payment_status === 'paid' ? 'PAID' : 'PENDING'}</span></div>
      <table>
        <tr><td>Bill Number</td><td>${receipt.bill_number}</td></tr>
        <tr><td>Patient Name</td><td>${receipt.patient_name}</td></tr>
        <tr><td>Patient ID</td><td>#${receipt.patient_id}</td></tr>
        <tr><td>Department</td><td>${receipt.department}</td></tr>
        <tr><td>Doctor</td><td>${receipt.doctor_name}</td></tr>
        <tr><td>Date &amp; Time</td><td>${fmtDate(receipt.appointment_time || receipt.paid_at || receipt.created_at)}</td></tr>
        <tr><td colspan="2" style="border-top:1px dashed #ccc;padding-top:8px;"></td></tr>
        <tr><td>Consultation Fee</td><td>₹${(receipt.consultation_fee || 0).toFixed(2)}</td></tr>
        <tr><td>Medicine Charges</td><td>₹${(receipt.medicine_charges || 0).toFixed(2)}</td></tr>
        <tr><td>Lab Charges</td><td>₹${(receipt.lab_charges || 0).toFixed(2)}</td></tr>
        <tr><td>Other Charges</td><td>₹${(receipt.other_charges || 0).toFixed(2)}</td></tr>
        <tr><td>Discount</td><td>- ₹${(receipt.discount || 0).toFixed(2)}</td></tr>
        <tr class="total-row"><td>TOTAL AMOUNT</td><td>₹${(receipt.total_amount || 0).toFixed(2)}</td></tr>
        <tr><td>Payment Method</td><td>${(receipt.payment_method || '—').toUpperCase()}</td></tr>
        ${receipt.transaction_ref ? `<tr><td>Transaction Ref</td><td>${receipt.transaction_ref}</td></tr>` : ''}
        <tr><td>Payment Status</td><td>${(receipt.payment_status || '').toUpperCase()}</td></tr>
      </table>
      <div class="footer">Thank you for visiting SmartQueue Hospital!<br/>Please retain this receipt for your records.</div>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  if (!receipt) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0 }}>🧾 Payment Receipt</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.4rem', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-primary)' }}>🏥 SmartQueue Hospital</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>AI-Powered Smart Queue Management</div>
          <div style={{ marginTop: 12 }}>
            <PayBadge status={receipt.payment_status} />
          </div>
        </div>

        <div style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          {[
            ['Bill Number', receipt.bill_number],
            ['Patient Name', receipt.patient_name],
            ['Patient ID', `#${receipt.patient_id}`],
            ['Department', receipt.department],
            ['Doctor', receipt.doctor_name],
            ['Date & Time', fmtDate(receipt.appointment_time || receipt.paid_at || receipt.created_at)],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{k}</span>
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          {[
            ['Consultation Fee', fmt(receipt.consultation_fee)],
            ['Medicine Charges', fmt(receipt.medicine_charges)],
            ['Lab Charges', fmt(receipt.lab_charges)],
            ['Other Charges', fmt(receipt.other_charges)],
            ['Discount', `- ${fmt(receipt.discount)}`],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{k}</span>
              <span style={{ fontSize: '0.85rem' }}>{v}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', borderTop: '2px solid var(--border-subtle)', marginTop: 8 }}>
            <span style={{ fontWeight: 700, fontSize: '1rem' }}>TOTAL</span>
            <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--color-primary)' }}>{fmt(receipt.total_amount)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Payment Method</span>
            <span style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase' }}>{receipt.payment_method || '—'}</span>
          </div>
          {receipt.transaction_ref && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Transaction Ref</span>
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{receipt.transaction_ref}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handlePrint}>🖨️ Print / Download PDF</button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── PAYMENT COLLECTION MODAL ──────────────────────────────────────────────────
function PaymentModal({ bill, onClose, onSuccess }) {
  const [method, setMethod] = useState('cash');
  const [txnRef, setTxnRef] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    setLoading(true);
    try {
      const res = await receptionAPI.collectPayment(bill.id, { payment_method: method, transaction_ref: txnRef || null });
      toast.success(`✅ Payment of ${fmt(bill.total_amount)} collected via ${method.toUpperCase()}!`);
      onSuccess(res.data.receipt);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Payment failed');
    }
    setLoading(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420, border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0 }}>💳 Collect Payment</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.4rem', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: 14, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{bill.patient_name}</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Bill: {bill.bill_number} · {bill.department}</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: 10 }}>{fmt(bill.total_amount)}</div>
        </div>

        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">PAYMENT METHOD</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {['cash', 'upi', 'card'].map(m => (
              <button key={m} onClick={() => setMethod(m)}
                style={{ padding: '10px', borderRadius: 10, border: `2px solid ${method === m ? 'var(--color-primary)' : 'var(--border-subtle)'}`, background: method === m ? 'var(--color-primary)22' : 'var(--bg-surface)', color: method === m ? 'var(--color-primary)' : 'var(--text-muted)', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                {m === 'cash' ? '💵' : m === 'upi' ? '📱' : '💳'} {m}
              </button>
            ))}
          </div>
        </div>

        {(method === 'upi' || method === 'card') && (
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">{method === 'upi' ? 'UPI Transaction ID' : 'Card Last 4 Digits / Ref'}</label>
            <input className="form-input" placeholder={method === 'upi' ? 'e.g. TXN123456789' : 'e.g. XXXX-1234'} value={txnRef} onChange={e => setTxnRef(e.target.value)} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={handlePay} disabled={loading}>
            {loading ? <span className="loading-spinner" /> : '✅'} Confirm Payment
          </button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── SECTION: DASHBOARD ────────────────────────────────────────────────────────
function DashboardSection() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    receptionAPI.getDashboard().then(r => { setData(r.data); setLoading(false); }).catch(() => setLoading(false));
    const t = setInterval(() => receptionAPI.getDashboard().then(r => setData(r.data)), 30000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <div className="loading-overlay"><div className="loading-spinner" /><p>Loading dashboard…</p></div>;
  if (!data) return <div className="empty-state"><p>Failed to load dashboard</p></div>;

  return (
    <div className="animate-fade-up">
      <div className="page-header"><h1>🏥 Reception Dashboard</h1><p>Today's Overview — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div>

      {/* Stats Grid */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <StatCard icon="📋" label="Total Appointments" value={data.total_appointments} color="var(--color-primary)" />
        <StatCard icon="✅" label="Checked In" value={data.checked_in} color="var(--color-success)" />
        <StatCard icon="⏳" label="Waiting" value={data.waiting} color="var(--color-warning)" />
        <StatCard icon="▶️" label="In Consultation" value={data.active} color="#42a5f5" />
        <StatCard icon="🏁" label="Completed" value={data.completed} color="var(--text-muted)" />
        <StatCard icon="💰" label="Today's Collection" value={fmt(data.today_collection)} color="var(--color-success)" sub={`${data.paid_bills} bills paid`} />
        <StatCard icon="⏳" label="Pending Amount" value={fmt(data.pending_amount)} color="var(--color-danger)" sub={`${data.pending_payments} bills pending`} />
        <StatCard icon="🧾" label="Total Bills" value={data.total_bills} color="var(--color-primary)" />
      </div>

      {/* Department-wise Collection */}
      <div className="card">
        <h4 className="mb-md">🏢 Department-wise Collection (Today)</h4>
        {Object.keys(data.dept_collection || {}).length === 0 ? (
          <div className="empty-state"><div className="empty-icon">💸</div><p>No payments collected yet today</p></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {Object.entries(data.dept_collection).map(([dept, amount]) => (
              <div key={dept} style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: 14, borderLeft: '4px solid var(--color-success)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>{dept}</div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--color-success)' }}>{fmt(amount)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── SECTION: APPOINTMENTS / CHECK-IN ─────────────────────────────────────────
function AppointmentsSection() {
  const [apts, setApts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  const load = useCallback(async (q) => {
    setLoading(true);
    try { const r = await receptionAPI.getAppointments(q); setApts(r.data); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(''); }, [load]);

  const handleSearch = (e) => { e.preventDefault(); load(search); };

  const handleCheckin = async (id, name) => {
    setActing(id);
    try {
      await receptionAPI.checkin(id);
      toast.success(`✅ ${name} checked in!`);
      load(search);
    } catch (err) { toast.error(err.response?.data?.detail || 'Check-in failed'); }
    setActing(null);
  };

  const handleCheckout = async (id, name) => {
    setActing(id);
    try {
      await receptionAPI.checkout(id);
      toast.success(`🚪 ${name} checked out`);
      load(search);
    } catch (err) { toast.error(err.response?.data?.detail || 'Check-out failed'); }
    setActing(null);
  };

  return (
    <div className="animate-fade-up">
      <div className="page-header"><h1>📋 Appointments & Check-in</h1><p>Verify and manage patient arrivals</p></div>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input className="form-input" placeholder="🔍 Search by name, patient ID, appointment ID…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
        <button type="submit" className="btn btn-primary">Search</button>
        <button type="button" className="btn btn-ghost" onClick={() => { setSearch(''); load(''); }}>Clear</button>
      </form>

      {loading ? (
        <div className="loading-overlay"><div className="loading-spinner" /></div>
      ) : apts.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">📋</div><p>No appointments found</p></div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr><th>#</th><th>Patient</th><th>Doctor / Dept</th><th>Time</th><th>Priority</th><th>Queue</th><th>Status</th><th>Check-in</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {apts.map((a) => (
                <tr key={a.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{a.id}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{a.patient_name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ID #{a.patient_id} · {a.patient_phone || '—'}</div>
                    {a.patient_age && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Age {a.patient_age} · {a.patient_blood_group || ''}</div>}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{a.doctor_name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{a.department}</div>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{fmtTime(a.appointment_time)}</td>
                  <td><PriorityBadge level={a.priority_level} /></td>
                  <td style={{ textAlign: 'center' }}>
                    {a.queue_position ? <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>#{a.queue_position}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td><StatusBadge status={a.status} /></td>
                  <td>
                    {a.checked_in
                      ? <><div style={{ color: 'var(--color-success)', fontSize: '0.78rem', fontWeight: 600 }}>✓ IN</div><div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{fmtTime(a.checked_in_at)}</div></>
                      : <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {!a.checked_in && a.status !== 'completed' && a.status !== 'cancelled' && (
                        <button className="btn btn-primary btn-sm" style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                          onClick={() => handleCheckin(a.id, a.patient_name)} disabled={acting === a.id}>
                          {acting === a.id ? <span className="loading-spinner" style={{ width: 12, height: 12 }} /> : '✓ Check In'}
                        </button>
                      )}
                      {a.checked_in && a.checkin_status === 'checked_in' && (
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                          onClick={() => handleCheckout(a.id, a.patient_name)} disabled={acting === a.id}>
                          {acting === a.id ? <span className="loading-spinner" style={{ width: 12, height: 12 }} /> : '🚪 Check Out'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── SECTION: LIVE QUEUE ───────────────────────────────────────────────────────
function QueueSection() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => receptionAPI.getQueue().then(r => { setQueue(r.data); setLoading(false); }).catch(() => setLoading(false));

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  const priorityOrder = { critical: 0, high: 1, medium: 2, normal: 3 };
  const sorted = [...queue].sort((a, b) => (priorityOrder[a.priority_level] || 3) - (priorityOrder[b.priority_level] || 3));

  return (
    <div className="animate-fade-up">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><h1>📍 Live Queue Monitor</h1><p>Real-time queue status — auto-refreshes every 15s</p></div>
        <button className="btn btn-ghost btn-sm" onClick={load}>🔄 Refresh</button>
      </div>

      {loading ? <div className="loading-overlay"><div className="loading-spinner" /></div>
        : sorted.length === 0 ? <div className="empty-state"><div className="empty-icon">📍</div><p>Queue is empty</p></div>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sorted.map((a, i) => (
              <div key={a.id} style={{
                background: 'var(--bg-card)', border: `1px solid var(--border-subtle)`, borderLeft: `4px solid ${a.priority_level === 'critical' ? '#ef5350' : a.priority_level === 'high' ? '#ffa726' : a.priority_level === 'medium' ? '#ffee58' : '#66bb6a'}`,
                borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap'
              }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: a.status === 'active' ? 'var(--color-success)22' : 'var(--bg-surface)', border: '2px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: a.status === 'active' ? 'var(--color-success)' : 'var(--color-primary)', fontSize: '1.1rem', flexShrink: 0 }}>
                  {a.queue_position || i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontWeight: 700 }}>{a.patient_name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{a.doctor_name} · {a.department}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <PriorityBadge level={a.priority_level} />
                  <StatusBadge status={a.status} />
                  {a.checked_in && <span style={{ fontSize: '0.72rem', color: 'var(--color-success)', fontWeight: 600 }}>✓ Checked In</span>}
                </div>
                <div style={{ textAlign: 'right', minWidth: 80 }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{fmtTime(a.appointment_time)}</div>
                  {a.predicted_wait_minutes && <div style={{ fontSize: '0.72rem', color: 'var(--color-warning)' }}>~{Math.round(a.predicted_wait_minutes)} min wait</div>}
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

// ── SECTION: PAYMENTS ─────────────────────────────────────────────────────────
function PaymentsSection() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', date: '', payment_method: '' });
  const [payModal, setPayModal] = useState(null);
  const [receipt, setReceipt] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.date) params.date = filters.date;
      if (filters.payment_method) params.payment_method = filters.payment_method;
      const r = await receptionAPI.getBills(params);
      setBills(r.data);
    } catch {}
    setLoading(false);
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const handleViewReceipt = async (billId) => {
    try {
      const r = await receptionAPI.getReceipt(billId);
      setReceipt(r.data);
    } catch { toast.error('Could not fetch receipt'); }
  };

  const totals = bills.reduce((acc, b) => {
    if (b.payment_status === 'paid') acc.collected += b.total_amount;
    else acc.pending += b.total_amount;
    return acc;
  }, { collected: 0, pending: 0 });

  return (
    <div className="animate-fade-up">
      <div className="page-header"><h1>💳 Payment Collection</h1><p>Manage bills and collect payments</p></div>

      {/* Summary */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <StatCard icon="💰" label="Collected" value={fmt(totals.collected)} color="var(--color-success)" />
        <StatCard icon="⏳" label="Pending" value={fmt(totals.pending)} color="var(--color-danger)" />
        <StatCard icon="🧾" label="Total Bills" value={bills.length} color="var(--color-primary)" />
      </div>

      {/* Filters */}
      <div className="card mb-md" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">STATUS</label>
            <select className="form-select" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
              <option value="">All</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">DATE</label>
            <input type="date" className="form-input" value={filters.date} onChange={e => setFilters(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">PAYMENT METHOD</label>
            <select className="form-select" value={filters.payment_method} onChange={e => setFilters(f => ({ ...f, payment_method: e.target.value }))}>
              <option value="">All</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setFilters({ status: '', date: '', payment_method: '' })}>Clear Filters</button>
          </div>
        </div>
      </div>

      {/* Bills Table */}
      {loading ? <div className="loading-overlay"><div className="loading-spinner" /></div>
        : bills.length === 0 ? <div className="empty-state"><div className="empty-icon">🧾</div><p>No bills found</p></div>
        : (
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Bill #</th><th>Patient</th><th>Department</th><th>Amount</th><th>Status</th><th>Method</th><th>Date</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {bills.map(b => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{b.bill_number}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{b.patient_name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ID #{b.patient_id}</div>
                    </td>
                    <td>
                      <div>{b.department}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{b.doctor_name}</div>
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{fmt(b.total_amount)}</td>
                    <td><PayBadge status={b.payment_status} /></td>
                    <td style={{ textTransform: 'uppercase', fontSize: '0.82rem' }}>{b.payment_method || '—'}</td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{fmtDate(b.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {b.payment_status === 'pending' && (
                          <button className="btn btn-primary btn-sm" style={{ fontSize: '0.72rem', padding: '4px 10px' }} onClick={() => setPayModal(b)}>
                            💳 Pay
                          </button>
                        )}
                        {b.payment_status === 'paid' && (
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.72rem', padding: '4px 10px' }} onClick={() => handleViewReceipt(b.id)}>
                            🧾 Receipt
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {payModal && (
        <PaymentModal
          bill={payModal}
          onClose={() => setPayModal(null)}
          onSuccess={(rec) => { setPayModal(null); setReceipt(rec); load(); }}
        />
      )}
      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}

// ── SECTION: REPORTS ──────────────────────────────────────────────────────────
function ReportsSection() {
  const [data, setData] = useState(null);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async (d) => {
    setLoading(true);
    try { const r = await receptionAPI.getReports(d || null); setData(r.data); } catch {}
    setLoading(false);
  };

  useEffect(() => { load(''); }, []);

  return (
    <div className="animate-fade-up">
      <div className="page-header"><h1>📊 Revenue Reports</h1><p>Department-wise collection and payment analytics</p></div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'flex-end' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">SELECT DATE</label>
          <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={() => load(date)}>View</button>
        <button className="btn btn-ghost" onClick={() => { setDate(''); load(''); }}>Today</button>
      </div>

      {loading ? <div className="loading-overlay"><div className="loading-spinner" /></div>
        : !data ? <div className="empty-state"><p>No data</p></div>
        : (
          <>
            {/* Summary Cards */}
            <div className="stats-grid" style={{ marginBottom: 24 }}>
              <StatCard icon="💰" label="Total Collection" value={fmt(data.total_collection)} color="var(--color-success)" />
              <StatCard icon="⏳" label="Pending Amount" value={fmt(data.pending_amount)} color="var(--color-danger)" />
              <StatCard icon="💵" label="Cash" value={fmt(data.by_method?.cash)} color="#66bb6a" />
              <StatCard icon="📱" label="UPI" value={fmt(data.by_method?.upi)} color="#42a5f5" />
              <StatCard icon="💳" label="Card" value={fmt(data.by_method?.card)} color="#ab47bc" />
              <StatCard icon="🧾" label="Bills Paid" value={data.paid_bills} color="var(--color-success)" sub={`of ${data.total_bills} total`} />
            </div>

            {/* Department Table */}
            <div className="card">
              <h4 className="mb-md">🏢 Department-wise Breakdown</h4>
              <div className="table-container">
                <table>
                  <thead>
                    <tr><th>Department</th><th>Total Bills</th><th>Paid</th><th>Pending</th><th>Collection</th><th>Pending Amt</th></tr>
                  </thead>
                  <tbody>
                    {(data.departments || []).filter(d => d.total_bills > 0).map(d => (
                      <tr key={d.department}>
                        <td style={{ fontWeight: 600 }}>{d.department}</td>
                        <td style={{ textAlign: 'center' }}>{d.total_bills}</td>
                        <td style={{ textAlign: 'center', color: 'var(--color-success)', fontWeight: 600 }}>{d.paid_bills}</td>
                        <td style={{ textAlign: 'center', color: 'var(--color-danger)' }}>{d.pending_bills}</td>
                        <td style={{ fontWeight: 700, color: 'var(--color-success)' }}>{fmt(d.collection)}</td>
                        <td style={{ color: 'var(--color-danger)' }}>{fmt(d.pending_amount)}</td>
                      </tr>
                    ))}
                    {(data.departments || []).filter(d => d.total_bills > 0).length === 0 && (
                      <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>No billing data for this date</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
    </div>
  );
}

// ── MAIN RECEPTION DASHBOARD ──────────────────────────────────────────────────
export default function ReceptionDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const sidebar = [
    { id: 'dashboard',    label: 'Dashboard',     icon: '🏥' },
    { id: 'appointments', label: 'Check-in',       icon: '✅' },
    { id: 'queue',        label: 'Live Queue',     icon: '📍' },
    { id: 'payments',     label: 'Payments',       icon: '💳' },
    { id: 'reports',      label: 'Reports',        icon: '📊' },
  ];

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span style={{ fontSize: '1.5rem' }}>🏥</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Reception</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Staff Portal</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {sidebar.map(item => (
            <button key={item.id} className={`nav-item ${activeTab === item.id ? 'active' : ''}`} onClick={() => setActiveTab(item.id)}>
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {activeTab === 'dashboard'    && <DashboardSection />}
        {activeTab === 'appointments' && <AppointmentsSection />}
        {activeTab === 'queue'        && <QueueSection />}
        {activeTab === 'payments'     && <PaymentsSection />}
        {activeTab === 'reports'      && <ReportsSection />}
      </main>
    </div>
  );
}
