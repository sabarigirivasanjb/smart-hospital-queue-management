import { useState } from 'react';
import { billingAPI } from '../api';

/* ── printable bill ───────────────────────────────────────────── */
function printBill(bill) {
  const win = window.open('', '_blank');
  if (!win) { alert('Please allow popups to print bills'); return; }
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Bill ${bill.bill_number}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;background:#fff;color:#222;padding:30px;max-width:700px;margin:0 auto}
    .header{text-align:center;border-bottom:3px solid #1565c0;padding-bottom:18px;margin-bottom:24px}
    .header h1{color:#1565c0;font-size:24px;letter-spacing:1px}
    .header p{color:#555;font-size:12px;margin-top:4px}
    .bill-num{font-size:13px;font-weight:700;color:#1565c0;margin-top:6px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
    .box{background:#f5f9ff;border:1px solid #c5d8f5;border-radius:8px;padding:12px}
    .box h3{font-size:11px;text-transform:uppercase;color:#1565c0;letter-spacing:1px;margin-bottom:6px}
    .box p{font-size:12px;line-height:1.8;color:#333}
    table{width:100%;border-collapse:collapse;margin-bottom:16px}
    thead tr{background:#1565c0;color:#fff}
    th,td{padding:9px 12px;text-align:left;font-size:12px;border-bottom:1px solid #e0e0e0}
    tr:nth-child(even){background:#f0f6ff}
    .total-row{background:#1565c0!important;color:#fff;font-weight:700;font-size:14px}
    .note{background:#fffde7;border:1px solid #fff176;border-radius:6px;padding:12px;margin-bottom:14px;font-size:12px}
    .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}
    .paid{background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7}
    .pending{background:#fff3e0;color:#e65100;border:1px solid #ffcc80}
    .footer{text-align:center;border-top:1px solid #ccc;padding-top:14px;color:#888;font-size:11px;margin-top:14px}
    @media print{body{padding:10px}}
  </style>
</head>
<body>
  <div class="header">
    <h1>🏥 SmartQueue Hospital</h1>
    <p>AI-Powered Smart Hospital Queue Management System</p>
    <div class="bill-num">Bill No: ${bill.bill_number}</div>
    <div style="margin-top:4px;font-size:11px;color:#888">Date: ${new Date(bill.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}</div>
  </div>
  <div class="grid">
    <div class="box">
      <h3>Patient Details</h3>
      <p><strong>${bill.patient_name}</strong><br/>
      ${bill.patient_age ? `Age: ${bill.patient_age} yrs` : ''} ${bill.patient_blood_group ? `| Blood: ${bill.patient_blood_group}` : ''}<br/>
      Email: ${bill.patient_email || '—'}<br/>
      Phone: ${bill.patient_phone || '—'}</p>
    </div>
    <div class="box">
      <h3>Doctor Details</h3>
      <p><strong>${bill.doctor_name}</strong><br/>
      ${bill.doctor_specialization || ''}<br/>
      Dept: ${bill.department || '—'}<br/>
      Appt: ${bill.appointment_time ? new Date(bill.appointment_time).toLocaleString('en-IN') : '—'}</p>
    </div>
  </div>
  ${bill.diagnosis ? `<div class="note"><strong>Diagnosis:</strong> ${bill.diagnosis}</div>` : ''}
  ${bill.prescription ? `<div class="note"><strong>Prescription:</strong><br/>${bill.prescription.replace(/\n/g,'<br/>')}</div>` : ''}
  <table>
    <thead><tr><th>Description</th><th style="text-align:right">Amount (₹)</th></tr></thead>
    <tbody>
      <tr><td>Consultation Fee</td><td style="text-align:right">₹ ${Number(bill.consultation_fee).toFixed(2)}</td></tr>
      ${bill.medicine_charges > 0 ? `<tr><td>Medicine Charges</td><td style="text-align:right">₹ ${Number(bill.medicine_charges).toFixed(2)}</td></tr>` : ''}
      ${bill.lab_charges > 0 ? `<tr><td>Lab / Test Charges</td><td style="text-align:right">₹ ${Number(bill.lab_charges).toFixed(2)}</td></tr>` : ''}
      ${bill.other_charges > 0 ? `<tr><td>Other Charges</td><td style="text-align:right">₹ ${Number(bill.other_charges).toFixed(2)}</td></tr>` : ''}
      ${bill.discount > 0 ? `<tr><td>Discount</td><td style="text-align:right;color:#2e7d32">- ₹ ${Number(bill.discount).toFixed(2)}</td></tr>` : ''}
      <tr class="total-row"><td>TOTAL AMOUNT</td><td style="text-align:right">₹ ${Number(bill.total_amount).toFixed(2)}</td></tr>
    </tbody>
  </table>
  <div style="margin-bottom:14px">
    <strong>Payment Status:</strong>
    <span class="badge ${bill.payment_status}" style="margin-left:8px">${bill.payment_status.toUpperCase()}</span>
    ${bill.payment_method ? `<span style="margin-left:12px"><strong>Method:</strong> ${bill.payment_method.toUpperCase()}</span>` : ''}
  </div>
  ${bill.notes ? `<div class="note"><strong>Notes:</strong> ${bill.notes}</div>` : ''}
  <div class="footer">
    <p>Thank you for visiting SmartQueue Hospital. Get well soon! 🙏</p>
    <p style="margin-top:4px">Computer-generated bill. No signature required.</p>
  </div>
</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 600);
}

/* ══ Generate Bill Modal (for Doctor) ══════════════════════════ */
export function GenerateBillModal({ appointment, onClose, onGenerated }) {
  const [form, setForm] = useState({
    consultation_fee: 500, medicine_charges: 0,
    lab_charges: 0, other_charges: 0, discount: 0,
    diagnosis: '', prescription: '', notes: '', payment_method: 'cash',
  });
  const [loading, setLoading] = useState(false);
  const [bill, setBill] = useState(null);

  const total = Math.max(0,
    Number(form.consultation_fee) + Number(form.medicine_charges) +
    Number(form.lab_charges) + Number(form.other_charges) - Number(form.discount)
  );

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await billingAPI.generate({
        appointment_id: appointment.id,
        consultation_fee: Number(form.consultation_fee) || 0,
        medicine_charges: Number(form.medicine_charges) || 0,
        lab_charges:      Number(form.lab_charges) || 0,
        other_charges:    Number(form.other_charges) || 0,
        discount:         Number(form.discount) || 0,
        diagnosis:        form.diagnosis,
        prescription:     form.prescription,
        notes:            form.notes,
        payment_method:   form.payment_method,
      });
      setBill(res.data);
      onGenerated && onGenerated(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to generate bill');
    } finally {
      setLoading(false);
    }
  };

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:1000,
      background:'rgba(0,0,0,0.8)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:20,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background:'var(--bg-card)', borderRadius:'var(--radius-xl)',
        border:'1px solid var(--border-color)',
        width:'100%', maxWidth:580,
        maxHeight:'90vh', overflowY:'auto',
        padding:'var(--space-xl)',
      }}>
        {bill ? (
          <>
            <div style={{textAlign:'center', marginBottom:16}}>
              <div style={{fontSize:'3rem'}}>✅</div>
              <h3 style={{color:'var(--color-success)'}}>Bill Generated!</h3>
              <p style={{fontSize:'0.85rem', color:'var(--text-muted)', margin:'8px 0'}}>
                <strong>{bill.bill_number}</strong> — Total: <strong>₹{Number(bill.total_amount).toFixed(2)}</strong>
              </p>
            </div>
            <div style={{display:'flex', gap:10}}>
              <button className="btn btn-primary" onClick={() => printBill(bill)} style={{flex:1}}>🖨️ Print / PDF</button>
              <button className="btn" onClick={onClose} style={{flex:1}}>Close</button>
            </div>
          </>
        ) : (
          <>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20}}>
              <h3 style={{margin:0}}>🧾 Generate Patient Bill</h3>
              <button onClick={onClose} style={{background:'none',border:'none',color:'var(--text-muted)',fontSize:22,cursor:'pointer'}}>✕</button>
            </div>
            <div className="form-grid" style={{marginBottom:14}}>
              {[
                ['consultation_fee','💊 Consultation Fee (₹)'],
                ['medicine_charges','💉 Medicine Charges (₹)'],
                ['lab_charges','🧪 Lab / Test Charges (₹)'],
                ['other_charges','📋 Other Charges (₹)'],
                ['discount','🏷️ Discount (₹)'],
              ].map(([key,label]) => (
                <div key={key} className="form-group">
                  <label className="form-label">{label}</label>
                  <input type="number" min="0" className="form-input"
                    value={form[key]} onChange={e => upd(key, e.target.value)} />
                </div>
              ))}
              <div className="form-group">
                <label className="form-label">💳 Payment Method</label>
                <select className="form-input" value={form.payment_method} onChange={e => upd('payment_method', e.target.value)}>
                  <option value="cash">💵 Cash</option>
                  <option value="card">💳 Card</option>
                  <option value="upi">📱 UPI</option>
                  <option value="insurance">🏥 Insurance</option>
                </select>
              </div>
            </div>
            <div className="form-group" style={{marginBottom:10}}>
              <label className="form-label">🩺 Diagnosis</label>
              <input type="text" className="form-input" placeholder="e.g. Hypertension, Fever..."
                value={form.diagnosis} onChange={e => upd('diagnosis', e.target.value)} />
            </div>
            <div className="form-group" style={{marginBottom:10}}>
              <label className="form-label">💊 Prescription</label>
              <textarea className="form-input" rows={3} placeholder="Medicine names, dosage, frequency..."
                value={form.prescription} onChange={e => upd('prescription', e.target.value)}
                style={{resize:'vertical'}} />
            </div>
            <div className="form-group" style={{marginBottom:18}}>
              <label className="form-label">📝 Notes</label>
              <input type="text" className="form-input" placeholder="Follow-up in 7 days..."
                value={form.notes} onChange={e => upd('notes', e.target.value)} />
            </div>
            <div style={{
              background:'rgba(66,165,245,0.1)', border:'1px solid rgba(66,165,245,0.3)',
              borderRadius:'var(--radius-md)', padding:'12px 16px',
              display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18,
            }}>
              <span style={{fontWeight:600}}>Total Amount:</span>
              <span style={{fontSize:'1.6rem', fontWeight:800, color:'var(--color-primary)'}}>₹ {total.toFixed(2)}</span>
            </div>
            <div style={{display:'flex', gap:10}}>
              <button className="btn btn-primary" onClick={handleGenerate} disabled={loading} style={{flex:1}}>
                {loading ? <span className="loading-spinner" /> : '🧾'} Generate Bill
              </button>
              <button className="btn" onClick={onClose} style={{flex:1}}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ══ My Bills List (for Patient) ═══════════════════════════════ */
export function MyBillsList() {
  const [bills, setBills] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchBills = async () => {
    if (bills !== null) { setOpen(o => !o); return; }
    setLoading(true);
    try {
      const res = await billingAPI.myBills();
      setBills(res.data);
      setOpen(true);
    } catch { setBills([]); setOpen(true); }
    finally { setLoading(false); }
  };

  return (
    <div className="card" style={{marginBottom:'var(--space-lg)'}}>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <div>
          <h3 style={{margin:0}}>🧾 My Bills</h3>
          <p style={{margin:'4px 0 0', fontSize:'0.8rem', color:'var(--text-muted)'}}>View and print your hospital bills</p>
        </div>
        <button className="btn btn-primary" onClick={fetchBills} disabled={loading} style={{padding:'8px 18px'}}>
          {loading ? <span className="loading-spinner" /> : open ? '▲ Hide' : '📄 View Bills'}
        </button>
      </div>
      {open && (
        <div style={{marginTop:16}}>
          {!bills || bills.length === 0 ? (
            <div style={{textAlign:'center', padding:'20px', color:'var(--text-muted)', fontSize:'0.88rem'}}>
              <div style={{fontSize:'2rem', marginBottom:8}}>🧾</div>
              No bills generated yet.
            </div>
          ) : bills.map(bill => (
            <div key={bill.id} style={{
              background:'var(--bg-surface)',
              border:'1px solid var(--border-color)',
              borderRadius:'var(--radius-md)',
              padding:'14px 16px',
              marginBottom:10,
              display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10,
            }}>
              <div>
                <div style={{fontWeight:700, color:'var(--color-primary)', fontSize:'0.95rem'}}>{bill.bill_number}</div>
                <div style={{fontSize:'0.8rem', color:'var(--text-muted)', marginTop:2}}>Dr. {bill.doctor_name} • {bill.department}</div>
                <div style={{fontSize:'0.78rem', color:'var(--text-muted)'}}>
                  {new Date(bill.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}
                </div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:'1.3rem', fontWeight:800, color:'var(--color-primary)'}}>₹ {Number(bill.total_amount).toFixed(2)}</div>
                <span style={{
                  display:'inline-block', fontSize:'0.72rem', padding:'2px 10px',
                  borderRadius:20, fontWeight:600, margin:'4px 0',
                  background: bill.payment_status === 'paid' ? 'rgba(102,187,106,0.15)' : 'rgba(255,167,38,0.15)',
                  color: bill.payment_status === 'paid' ? 'var(--color-success)' : 'var(--color-warning)',
                  border: `1px solid ${bill.payment_status === 'paid' ? 'var(--color-success)' : 'var(--color-warning)'}`,
                }}>{bill.payment_status === 'paid' ? '✅ PAID' : '⏳ PENDING'}</span>
                <br/>
                <button onClick={() => printBill(bill)} style={{
                  padding:'4px 12px', background:'rgba(66,165,245,0.15)',
                  border:'1px solid rgba(66,165,245,0.4)', borderRadius:8,
                  color:'var(--color-primary)', cursor:'pointer', fontSize:'0.78rem', fontWeight:600,
                }}>🖨️ Print / PDF</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
