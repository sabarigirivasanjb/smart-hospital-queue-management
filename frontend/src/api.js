import axios from 'axios';

// Direct backend URL — no proxy, always works
const BASE_URL = 'http://127.0.0.1:8000/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
};

export const patientAPI = {
  getAppointments: () => api.get('/patients/appointments'),
  bookAppointment: (data) => api.post('/patients/appointments', data),
  getQueueStatus: (id) => api.get(`/patients/appointments/${id}/queue-status`),
  submitTriage: (id, data) => api.post(`/patients/triage/${id}`, data),
  getSlotRecommendations: (deptId) =>
    api.get('/patients/scheduler/recommend', { params: { department_id: deptId } }),
  getNotifications: () => api.get('/patients/notifications'),
  markNotificationRead: (id) => api.patch(`/patients/notifications/${id}/read`),
};

export const doctorAPI = {
  getSchedule: () => api.get('/doctors/my-schedule'),
  callNext: (id) => api.post(`/doctors/appointments/${id}/call-next`),
  complete: (id) => api.patch(`/doctors/appointments/${id}/complete`),
  reject: (id, reason) => api.patch(`/doctors/appointments/${id}/reject`, null, { params: { reason } }),
  setAvailability: (available) => api.patch('/doctors/availability', null, { params: { is_available: available } }),
  getQueueState: () => api.get('/doctors/queue-state'),
};

export const adminAPI = {
  getDashboard:       ()        => api.get('/admin/dashboard'),
  getQueueOverview:   ()        => api.get('/admin/queue-overview'),
  getDepartments:     ()        => api.get('/admin/departments'),
  createDepartment:   (data)    => api.post('/admin/departments', data),
  toggleDepartment:   (id)      => api.patch(`/admin/departments/${id}/toggle`),
  updateDepartment:   (id, data)=> api.patch(`/admin/departments/${id}`, data),
  getDoctors:         ()        => api.get('/admin/doctors'),
  addDoctor:          (data)    => api.post('/admin/doctors', data),
  createDoctor:       (data)    => api.post('/admin/doctors/create', data),
  getReceptionists:   ()        => api.get('/admin/receptionists'),
  createReceptionist: (data)    => api.post('/admin/receptionists', data),
  getPatients:        ()        => api.get('/admin/patients'),
  getEmergencyAlerts: ()        => api.get('/admin/emergency-alerts'),
};

export const publicAPI = {
  getDepartments: () => api.get('/departments'),
  getDoctors: (deptId) =>
    api.get('/doctors/public', deptId ? { params: { department_id: deptId } } : {}),
};

export const billingAPI = {
  generate: (data) => api.post('/billing/generate', data),
  myBills:  ()     => api.get('/billing/my-bills'),
  getBill:  (id)   => api.get(`/billing/${id}`),
  markPaid: (id, method) => api.put(`/billing/${id}/pay`, { payment_status: 'paid', payment_method: method }),
};

export const feedbackAPI = {
  submit:         (data) => api.post('/feedback/submit', data),
  doctorFeedback: (id)   => api.get(`/feedback/doctor/${id}`),
  myFeedback:     ()     => api.get('/feedback/my-feedback'),
};

export const receptionAPI = {
  getDashboard:    ()         => api.get('/reception/dashboard'),
  getAppointments: (search)   => api.get('/reception/appointments', search ? { params: { search } } : {}),
  checkin:         (id)       => api.post(`/reception/checkin/${id}`),
  checkout:        (id)       => api.post(`/reception/checkout/${id}`),
  getQueue:        ()         => api.get('/reception/queue'),
  getBills:        (params)   => api.get('/reception/bills', { params }),
  collectPayment:  (id, data) => api.put(`/reception/bills/${id}/collect`, data),
  getReceipt:      (id)       => api.get(`/reception/bills/${id}/receipt`),
  getReports:      (date)     => api.get('/reception/reports', date ? { params: { date } } : {}),
};

export default api;
