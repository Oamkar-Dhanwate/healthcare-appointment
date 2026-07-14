import api from './axiosInstance';

export const patientApi = {
  searchDoctors: (params) => api.get('/doctors', { params }),
  getDoctorSlots: (doctorId, date) => api.get(`/doctors/${doctorId}/slots`, { params: { date } }),
  holdSlot: (data) => api.post('/appointments/hold', data),
  confirmAppointment: (id, data) => api.post(`/appointments/${id}/confirm`, data),
  cancelAppointment: (id) => api.post(`/appointments/${id}/cancel`),
  getMyAppointments: () => api.get('/appointments/me'),
  getPostVisitSummary: (id) => api.get(`/appointments/${id}/summary`),
};

export default patientApi;
