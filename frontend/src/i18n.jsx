// i18n.js — Tamil / English translation system for SmartQueue
// Usage: import { useLanguage, t } from './i18n';

import { createContext, useContext, useState } from 'react';

// ── Translations ────────────────────────────────────────────────
export const translations = {
  en: {
    // Nav / Common
    appName:            'SmartQueue Hospital',
    logout:             'Logout',
    loading:            'Loading...',
    save:               'Save',
    cancel:             'Cancel',
    submit:             'Submit',
    close:              'Close',
    back:               'Back',
    refresh:            'Refresh',
    search:             'Search',
    noData:             'No data found',
    success:            'Success!',
    error:              'Error!',

    // Auth
    login:              'Login',
    loginTitle:         'Welcome Back',
    loginSubtitle:      'Sign in to SmartQueue Hospital',
    email:              'Email Address',
    password:           'Password',
    role:               'Login as',
    patient:            'Patient',
    doctor:             'Doctor',
    admin:              'Administrator',
    noAccount:          "Don't have an account?",
    register:           'Register',
    registerTitle:      'Create Account',
    fullName:           'Full Name',
    phone:              'Phone Number',
    age:                'Age',
    bloodGroup:         'Blood Group',
    alreadyAccount:     'Already have an account?',

    // Patient Dashboard
    myAppointments:     'My Appointments',
    bookAppointment:    'Book Appointment',
    queueStatus:        'Live Queue Status',
    triageAssessment:   'Triage Assessment',
    myBills:            'My Bills',
    notifications:      'Notifications',
    selectDoctor:       'Select Doctor',
    selectDept:         'Select Department',
    selectSlot:         'Select Time Slot',
    aiRecommended:      'AI Recommended',
    bookNow:            'Book Appointment',
    queuePosition:      'Queue Position',
    estimatedWait:      'Estimated Wait',
    yourTurn:           "It's your turn!",
    waitingPatients:    'Waiting Patients',

    // Triage
    triageTitle:        'Emergency Triage Assessment',
    triageSubtitle:     'Select all symptoms that apply. Our AI will assess your priority level.',
    symptoms:           'Symptoms',
    vitalsEntry:        'Vitals Entry',
    heartRate:          'Heart Rate (bpm)',
    spo2:               'SpO2 (%)',
    temperature:        'Temperature (°C)',
    painScale:          'Pain Scale (0–10)',
    submitTriage:       'Submit Triage Assessment',
    connectWatch:       'Connect SmartWatch',
    watchOptional:      'Optional — auto-fills vitals above',
    triageComplete:     'Triage Assessment Complete',
    riskScore:          'Risk Score / 100',

    // Priority
    critical:           'CRITICAL',
    high:               'HIGH',
    medium:             'MEDIUM',
    normal:             'NORMAL',

    // Doctor Dashboard
    patientQueue:       'Patient Queue',
    callNext:           'Call Next',
    complete:           'Complete',
    reject:             'Reject',
    available:          'Available',
    unavailable:        'Unavailable',
    emergencyAlert:     '🚨 EMERGENCY ALERT!',
    noQueue:            'No patients in queue',

    // Admin
    dashboard:          'Dashboard',
    totalPatients:      'Total Patients',
    activeDoctors:      'Active Doctors',
    emergencies:        'Emergencies Today',
    completed:          'Completed Today',
    addDoctor:          'Add Doctor',
    departments:        'Departments',
    avgWaitTime:        'Avg Wait Time',
    efficiency:         'Efficiency',

    // Feedback
    rateyourexp:        'Rate Your Experience',
    feedbackSubtitle:   'How was your consultation?',
    submitFeedback:     'Submit Feedback',
    feedbackDone:       'Thank you for your feedback!',
    poor:               'Poor',
    fair:               'Fair',
    good:               'Good',
    veryGood:           'Very Good',
    excellent:          'Excellent!',
    shareExp:           'Share your experience (optional)...',

    // Bills
    billNumber:         'Bill Number',
    consultationFee:    'Consultation Fee',
    medicineCharges:    'Medicine Charges',
    labCharges:         'Lab / Test Charges',
    totalAmount:        'Total Amount',
    paymentStatus:      'Payment Status',
    paid:               'PAID',
    pending:            'PENDING',
    printBill:          'Print / Download PDF',
    generateBill:       'Generate Bill',

    // SMS
    smsSetup:           'SMS Notifications Setup',

    // Symptoms
    chestPain:          'Chest Pain',
    breathingDiff:      'Difficulty Breathing',
    highFever:          'High Fever',
    severeBleeding:     'Severe Bleeding',
    lossConsciousness:  'Loss of Consciousness',
    accidentTrauma:     'Accident / Trauma',
    strokeSymptoms:     'Stroke Symptoms',
    abdominalPain:      'Severe Abdominal Pain',
    allergicReaction:   'Allergic Reaction',
  },

  ta: {
    // Nav / Common
    appName:            'ஸ்மார்ட்கியூ மருத்துவமனை',
    logout:             'வெளியேறு',
    loading:            'ஏற்றுகிறது...',
    save:               'சேமி',
    cancel:             'ரத்து செய்',
    submit:             'சமர்ப்பி',
    close:              'மூடு',
    back:               'திரும்பு',
    refresh:            'புதுப்பி',
    search:             'தேடு',
    noData:             'தகவல் இல்லை',
    success:            'வெற்றி!',
    error:              'பிழை!',

    // Auth
    login:              'உள்நுழை',
    loginTitle:         'மீண்டும் வருக',
    loginSubtitle:      'ஸ்மார்ட்கியூ மருத்துவமனையில் உள்நுழையுங்கள்',
    email:              'மின்னஞ்சல் முகவரி',
    password:           'கடவுச்சொல்',
    role:               'பதிவின் வகை',
    patient:            'நோயாளி',
    doctor:             'மருத்துவர்',
    admin:              'நிர்வாகி',
    noAccount:          'கணக்கு இல்லையா?',
    register:           'பதிவு செய்',
    registerTitle:      'கணக்கு உருவாக்கு',
    fullName:           'முழு பெயர்',
    phone:              'தொலைபேசி எண்',
    age:                'வயது',
    bloodGroup:         'இரத்த வகை',
    alreadyAccount:     'ஏற்கனவே கணக்கு இருக்கா?',

    // Patient Dashboard
    myAppointments:     'என் சந்திப்புகள்',
    bookAppointment:    'சந்திப்பு பதிவு செய்',
    queueStatus:        'நேரடி வரிசை நிலை',
    triageAssessment:   'அவசர மதிப்பீடு',
    myBills:            'என் பில்கள்',
    notifications:      'அறிவிப்புகள்',
    selectDoctor:       'மருத்துவர் தேர்ந்தெடு',
    selectDept:         'பிரிவு தேர்ந்தெடு',
    selectSlot:         'நேர இடம் தேர்ந்தெடு',
    aiRecommended:      'AI பரிந்துரை',
    bookNow:            'சந்திப்பு பதிவு செய்',
    queuePosition:      'வரிசை எண்',
    estimatedWait:      'மதிப்பிடப்பட்ட காத்திருப்பு',
    yourTurn:           'உங்கள் முறை வந்தது!',
    waitingPatients:    'காத்திருக்கும் நோயாளிகள்',

    // Triage
    triageTitle:        'அவசர நிலை மதிப்பீடு',
    triageSubtitle:     'பொருந்தும் அறிகுறிகளை தேர்வு செய்யுங்கள். AI உங்கள் முன்னுரிமை நிலையை மதிப்பிடும்.',
    symptoms:           'அறிகுறிகள்',
    vitalsEntry:        'உடல் அளவுகள்',
    heartRate:          'இதய துடிப்பு (bpm)',
    spo2:               'ரத்த ஆக்சிஜன் SpO2 (%)',
    temperature:        'உடல் வெப்பநிலை (°C)',
    painScale:          'வலி அளவு (0–10)',
    submitTriage:       'மதிப்பீட்டை சமர்ப்பி',
    connectWatch:       'ஸ்மார்ட் வாட்ச் இணை',
    watchOptional:      'விருப்பத்தேர்வு — அளவுகள் தானாக நிரப்பும்',
    triageComplete:     'மதிப்பீடு முடிந்தது',
    riskScore:          'ஆபத்து மதிப்பெண் / 100',

    // Priority
    critical:           'மிகவும் அவசரம்',
    high:               'அவசரம்',
    medium:             'நடுத்தர அவசரம்',
    normal:             'சாதாரணம்',

    // Doctor Dashboard
    patientQueue:       'நோயாளி வரிசை',
    callNext:           'அடுத்தவரை அழை',
    complete:           'முடிந்தது',
    reject:             'நிராகரி',
    available:          'கிடைக்கிறார்',
    unavailable:        'கிடைக்கவில்லை',
    emergencyAlert:     '🚨 அவசர எச்சரிக்கை!',
    noQueue:            'வரிசையில் நோயாளிகள் இல்லை',

    // Admin
    dashboard:          'டாஷ்போர்டு',
    totalPatients:      'மொத்த நோயாளிகள்',
    activeDoctors:      'செயலில் மருத்துவர்கள்',
    emergencies:        'இன்றைய அவசர நிலைகள்',
    completed:          'இன்று முடிந்தவை',
    addDoctor:          'மருத்துவர் சேர்',
    departments:        'பிரிவுகள்',
    avgWaitTime:        'சராசரி காத்திருப்பு',
    efficiency:         'செயல்திறன்',

    // Feedback
    rateyourexp:        'உங்கள் அனுபவத்தை மதிப்பிடுங்கள்',
    feedbackSubtitle:   'ஆலோசனை எப்படி இருந்தது?',
    submitFeedback:     'கருத்தை சமர்ப்பி',
    feedbackDone:       'உங்கள் கருத்திற்கு நன்றி!',
    poor:               'மோசம்',
    fair:               'சாதாரணம்',
    good:               'நல்லது',
    veryGood:           'மிகவும் நல்லது',
    excellent:          'சிறப்பானது! ⭐',
    shareExp:           'உங்கள் அனுபவத்தை பகிருங்கள் (விருப்பத்தேர்வு)...',

    // Bills
    billNumber:         'பில் எண்',
    consultationFee:    'ஆலோசனை கட்டணம்',
    medicineCharges:    'மருந்து கட்டணம்',
    labCharges:         'ஆய்வக / சோதனை கட்டணம்',
    totalAmount:        'மொத்த தொகை',
    paymentStatus:      'கட்டண நிலை',
    paid:               'செலுத்தப்பட்டது',
    pending:            'நிலுவையில் உள்ளது',
    printBill:          'அச்சிடு / PDF பதிவிறக்கு',
    generateBill:       'பில் உருவாக்கு',

    // SMS
    smsSetup:           'SMS அறிவிப்பு அமைப்பு',

    // Symptoms
    chestPain:          '💔 மார்பு வலி',
    breathingDiff:      '😮‍💨 சுவாசிக்க சிரமம்',
    highFever:          '🌡️ கடுமையான காய்ச்சல்',
    severeBleeding:     '🩸 கடுமையான இரத்தப்போக்கு',
    lossConsciousness:  '😵 நினைவிழப்பு',
    accidentTrauma:     '🚑 விபத்து / காயம்',
    strokeSymptoms:     '🧠 பக்கவாத அறிகுறிகள்',
    abdominalPain:      '🤢 கடுமையான வயிற்று வலி',
    allergicReaction:   '🌿 ஒவ்வாமை எதிர்வினை',
  },
};

// ── Language Context ────────────────────────────────────────────
const LanguageContext = createContext({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(
    localStorage.getItem('smartqueue_lang') || 'en'
  );

  const changeLang = (l) => {
    setLang(l);
    localStorage.setItem('smartqueue_lang', l);
  };

  const t = (key) => translations[lang]?.[key] ?? translations['en']?.[key] ?? key;

  return (
    <LanguageContext.Provider value={{ lang, setLang: changeLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

// Convenience hook — just returns the t() function
export function useT() {
  return useContext(LanguageContext).t;
}
