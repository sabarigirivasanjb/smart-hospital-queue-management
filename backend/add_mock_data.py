"""
Mock Data Seeder — adds realistic demo data for presentation
Run: python add_mock_data.py
"""
import sqlite3
import hashlib
import random
from datetime import datetime, timedelta
import json

try:
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    def make_hash(pw): return pwd_context.hash(pw)
except:
    def make_hash(pw): return hashlib.sha256(pw.encode()).hexdigest()

conn = sqlite3.connect('hospital.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

print("=" * 60)
print("  ADDING MOCK DATA FOR DEMO PRESENTATION")
print("=" * 60)

# ── 1. MORE PATIENTS ──────────────────────────────────────────────
patients = [
    ("Arjun Krishnamurthy",  "arjun.k@email.com",    "9876543210", 28, "O+"),
    ("Meenakshi Sundaram",   "meena.s@email.com",    "9876543211", 45, "B+"),
    ("Karthikeyan Raja",     "karthi.r@email.com",   "9876543212", 35, "A+"),
    ("Preethi Venkatesh",    "preethi.v@email.com",  "9876543213", 52, "AB+"),
    ("Suresh Babu",          "suresh.b@email.com",   "9876543214", 62, "O-"),
    ("Lakshmi Priya",        "lakshmi.p@email.com",  "9876543215", 30, "B-"),
    ("Rajesh Kumar",         "rajesh.k@email.com",   "9876543216", 40, "A-"),
    ("Anitha Devi",          "anitha.d@email.com",   "9876543217", 55, "AB-"),
    ("Murugan Selvam",       "murugan.s@email.com",  "9876543218", 48, "O+"),
    ("Kavitha Rajan",        "kavitha.r@email.com",  "9876543219", 33, "A+"),
    ("Senthilkumar M",       "senthil.m@email.com",  "9876543220", 29, "B+"),
    ("Padmavathi N",         "padma.n@email.com",    "9876543221", 67, "O+"),
]

new_patient_ids = []
for name, email, phone, age, blood in patients:
    existing = cur.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()
    if existing:
        new_patient_ids.append(existing['id'])
        continue
    cur.execute("""
        INSERT INTO users (email, password_hash, full_name, phone, role, age, blood_group, is_active)
        VALUES (?, ?, ?, ?, 'patient', ?, ?, 1)
    """, (email, make_hash("Patient@123"), name, phone, age, blood))
    new_patient_ids.append(cur.lastrowid)

conn.commit()
print(f"\n✅ Added {len(patients)} demo patients")

# ── 2. GET DOCTORS & DEPARTMENTS ─────────────────────────────────
doctors = cur.execute("""
    SELECT d.id, d.department_id, u.full_name, dep.name as dept_name
    FROM doctors d
    JOIN users u ON d.user_id = u.id
    JOIN departments dep ON d.department_id = dep.id
""").fetchall()

print(f"   Found {len(doctors)} doctors")

# ── 3. ADD APPOINTMENTS (mix of completed/active/scheduled) ───────
statuses = ['completed', 'completed', 'completed', 'active', 'scheduled']
priority_levels = ['normal', 'normal', 'medium', 'high', 'critical']
priority_scores  = [10.0, 15.0, 40.0, 65.0, 90.0]

appt_count = 0
appt_ids_completed = []

# Get all patient ids (existing + new)
all_patients = cur.execute(
    "SELECT id, full_name FROM users WHERE role='patient'"
).fetchall()

for i, patient in enumerate(all_patients):
    doc = doctors[i % len(doctors)]
    status = statuses[i % len(statuses)]
    prio  = priority_levels[i % len(priority_levels)]
    score = priority_scores[i % len(priority_scores)]

    # appointment time — past for completed, near-future for active/scheduled
    if status == 'completed':
        appt_time = datetime.now() - timedelta(hours=random.randint(1, 72))
    elif status == 'active':
        appt_time = datetime.now() - timedelta(minutes=random.randint(10, 40))
    else:
        appt_time = datetime.now() + timedelta(hours=random.randint(1, 24))

    existing = cur.execute(
        "SELECT id FROM appointments WHERE patient_id=? AND doctor_id=?",
        (patient['id'], doc['id'])
    ).fetchone()
    if existing:
        if status == 'completed':
            appt_ids_completed.append(existing['id'])
        continue

    cur.execute("""
        INSERT INTO appointments
        (patient_id, doctor_id, appointment_time, status,
         priority_score, priority_level, queue_position,
         predicted_wait_minutes, actual_wait_minutes,
         consultation_duration_minutes, symptoms_description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        patient['id'], doc['id'],
        appt_time.isoformat(),
        status, score, prio,
        random.randint(1, 15) if status != 'completed' else None,
        random.uniform(5, 45),
        random.uniform(5, 30) if status == 'completed' else None,
        random.uniform(8, 25) if status == 'completed' else None,
        random.choice([
            "Fever and headache for 3 days",
            "Chest pain and shortness of breath",
            "Back pain and joint stiffness",
            "Skin rash and itching",
            "Eye irritation and blurred vision",
            "Stomach pain and nausea",
            "Cough and cold for a week",
            "Dizziness and weakness",
        ])
    ))
    aid = cur.lastrowid
    appt_count += 1
    if status == 'completed':
        appt_ids_completed.append(aid)

conn.commit()
print(f"✅ Added {appt_count} appointments")

# ── 4. ADD BILLS for completed appointments ───────────────────────
bill_count = 0
year = datetime.now().year
existing_bill_count = cur.execute("SELECT COUNT(*) FROM bills").fetchone()[0]
bill_num = existing_bill_count

diagnosis_list = [
    "Hypertension Stage 1",
    "Acute Bronchitis",
    "Lumbar Spondylosis",
    "Type 2 Diabetes Mellitus",
    "Migraine with Aura",
    "Allergic Rhinitis",
    "Gastritis",
    "Conjunctivitis",
    "Viral Fever",
    "Osteoarthritis",
]
prescription_list = [
    "Tab Amlodipine 5mg OD x 30 days\nTab Telmisartan 40mg OD x 30 days",
    "Syrup Benadryl 10ml TDS x 5 days\nTab Azithromycin 500mg OD x 3 days",
    "Tab Etoricoxib 90mg OD x 5 days\nOintment Volini apply BD",
    "Tab Metformin 500mg BD x 30 days\nTab Glimepiride 1mg OD x 30 days",
    "Tab Sumatriptan 50mg SOS\nTab Flunarizine 10mg HS x 30 days",
    "Nasal spray Budesonide BD x 15 days\nTab Cetirizine 10mg HS x 10 days",
    "Tab Pantoprazole 40mg BD x 14 days\nSyrup Mucaine Gel 15ml TDS",
    "Eye drops Moxifloxacin 4x/day x 5 days\nEye drops Lubricant PRN",
    "Tab Paracetamol 650mg TDS x 5 days\nORS sachets x 5",
    "Tab Calcium + Vit D3 OD x 30 days\nTab Glucosamine 500mg BD x 30 days",
]

for i, appt_id in enumerate(appt_ids_completed[:15]):  # max 15 bills
    existing = cur.execute("SELECT id FROM bills WHERE appointment_id=?", (appt_id,)).fetchone()
    if existing:
        continue

    appt = cur.execute(
        "SELECT patient_id, doctor_id FROM appointments WHERE id=?", (appt_id,)
    ).fetchone()
    if not appt:
        continue

    bill_num += 1
    bill_number = f"BILL-{year}-{str(bill_num).zfill(4)}"

    consult = random.choice([300, 400, 500, 600, 800])
    medicine = random.choice([0, 0, 150, 250, 350, 500])
    lab      = random.choice([0, 0, 0, 200, 400, 750, 1200])
    other    = random.choice([0, 0, 50, 100])
    discount = random.choice([0, 0, 0, 50, 100])
    total    = consult + medicine + lab + other - discount

    cur.execute("""
        INSERT INTO bills
        (bill_number, appointment_id, patient_id, doctor_id,
         consultation_fee, medicine_charges, lab_charges, other_charges,
         discount, total_amount, payment_status, payment_method,
         diagnosis, prescription, generated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    """, (
        bill_number, appt_id, appt['patient_id'], appt['doctor_id'],
        consult, medicine, lab, other, discount, total,
        random.choice(['paid', 'paid', 'paid', 'pending']),
        random.choice(['cash', 'card', 'upi', 'insurance']),
        diagnosis_list[i % len(diagnosis_list)],
        prescription_list[i % len(prescription_list)],
    ))
    bill_count += 1

conn.commit()
print(f"✅ Added {bill_count} patient bills")

# ── 5. ADD FEEDBACK for completed appointments ────────────────────
fb_count = 0
comments = [
    "Doctor was very attentive and explained everything clearly. Very satisfied!",
    "Quick consultation but thorough. Waiting time was minimal.",
    "Very professional and knowledgeable doctor. Highly recommended!",
    "Good experience overall. The AI queue system is very innovative.",
    "Doctor took time to listen to my problems. Treatment was effective.",
    "Excellent service! The smart queue system saved a lot of time.",
    "Very helpful staff and great doctor. Will definitely visit again.",
    "Good diagnosis and proper medication prescribed. Feeling better now.",
    "The hospital system is very modern and efficient. Impressed!",
    "Doctor was kind and patient. Explained the medication clearly.",
]

for i, appt_id in enumerate(appt_ids_completed[:10]):
    appt = cur.execute(
        "SELECT patient_id, doctor_id FROM appointments WHERE id=?", (appt_id,)
    ).fetchone()
    if not appt:
        continue

    existing = cur.execute(
        "SELECT id FROM feedback WHERE appointment_id=?", (appt_id,)
    ).fetchone()
    if existing:
        continue

    rating = random.choice([3, 4, 4, 5, 5, 5])
    cur.execute("""
        INSERT INTO feedback (patient_id, doctor_id, appointment_id, rating, comment)
        VALUES (?, ?, ?, ?, ?)
    """, (
        appt['patient_id'], appt['doctor_id'], appt_id,
        rating,
        comments[i % len(comments)] if rating >= 4 else "Average experience. Expected better wait times.",
    ))
    fb_count += 1

conn.commit()
print(f"✅ Added {fb_count} patient feedback ratings")

# ── 6. UPDATE QUEUE STATES ────────────────────────────────────────
cur.execute("""
    UPDATE queue_states SET
        waiting_count = abs(random() % 12),
        avg_wait_time_predicted = (abs(random() % 35) + 5)
""")
conn.commit()
print(f"✅ Updated queue states with realistic waiting counts")

# ── 7. ADD NOTIFICATIONS ──────────────────────────────────────────
notif_templates = [
    ("Appointment Confirmed", "Your appointment with {doc} has been confirmed for today.", "success"),
    ("Queue Update", "You are now position #3 in the queue. Estimated wait: 12 minutes.", "info"),
    ("Your Turn!", "Please proceed to Dr. {doc}'s consultation room immediately.", "warning"),
    ("Bill Generated", "Your bill BILL-2026-0001 of ₹850 has been generated.", "info"),
    ("Triage Complete", "Your emergency triage is complete. Priority: HIGH.", "warning"),
]

all_patients_for_notif = cur.execute(
    "SELECT id FROM users WHERE role='patient' LIMIT 10"
).fetchall()

notif_count = 0
for pat in all_patients_for_notif:
    doc = random.choice(doctors)
    for title, msg, ntype in random.sample(notif_templates, k=2):
        msg = msg.replace('{doc}', doc['full_name'])
        existing = cur.execute(
            "SELECT id FROM notifications WHERE user_id=? AND title=?",
            (pat['id'], title)
        ).fetchone()
        if existing:
            continue
        cur.execute("""
            INSERT INTO notifications (user_id, title, message, notification_type, is_read)
            VALUES (?, ?, ?, ?, ?)
        """, (pat['id'], title, msg, ntype, random.choice([0, 0, 1])))
        notif_count += 1

conn.commit()
print(f"✅ Added {notif_count} notifications")

# ── 8. EMERGENCY TRIAGE RECORDS ───────────────────────────────────
triage_data = [
    (4, 'critical', 92.5, {"chest_pain": True, "difficulty_breathing": True, "loss_of_consciousness": True,
                            "heart_rate": 135, "oxygen_saturation": 88, "temperature": 39.2, "pain_scale": 9}),
    (3, 'high',     72.0, {"chest_pain": True, "high_fever": True,
                            "heart_rate": 110, "oxygen_saturation": 93, "temperature": 38.8, "pain_scale": 7}),
    (5, 'medium',   45.0, {"severe_abdominal_pain": True, "allergic_reaction": True,
                            "heart_rate": 95, "oxygen_saturation": 96, "temperature": 38.1, "pain_scale": 5}),
    (6, 'normal',   18.0, {"high_fever": True,
                            "heart_rate": 82, "oxygen_saturation": 98, "temperature": 37.8, "pain_scale": 3}),
]

triage_count_added = 0
for pat_idx, prio, score, responses in triage_data:
    if pat_idx >= len(all_patients):
        continue
    patient_id = all_patients[pat_idx]['id']
    existing = cur.execute(
        "SELECT id FROM emergency_triage WHERE patient_id=?", (patient_id,)
    ).fetchone()
    if existing:
        continue
    cur.execute("""
        INSERT INTO emergency_triage (patient_id, responses_json, risk_score, priority_level)
        VALUES (?, ?, ?, ?)
    """, (patient_id, json.dumps(responses), score, prio))
    triage_count_added += 1

conn.commit()
print(f"✅ Added {triage_count_added} emergency triage records")

conn.close()

print("\n" + "=" * 60)
print("  MOCK DATA ADDED SUCCESSFULLY!")
print("=" * 60)
print(f"""
Summary:
  Patients     : {len(patients)} new Tamil name patients added
  Appointments : {appt_count} new (completed/active/scheduled mix)
  Bills        : {bill_count} generated with diagnosis & prescription
  Feedback     : {fb_count} star ratings with comments
  Notifications: {notif_count} added
  Triage       : {triage_count_added} emergency records
  Queue States : Updated with realistic wait counts

New Patient Password: Patient@123 (all new patients)

RESTART the backend server to see all changes!
""")
