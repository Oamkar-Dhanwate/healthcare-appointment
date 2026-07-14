import api from './axiosInstance';

export const doctorApi = {
  getAppointments: (params) => api.get('/doctor/appointments', { params }),
  getAppointmentDetail: (id) => api.get(`/doctor/appointments/${id}`),
  submitNotes: (id, data) => api.post(`/doctor/appointments/${id}/notes`, data),
  getAvailability: (date) => api.get('/doctor/availability', { params: { date } }),
  addCustomSlot: (data) => api.post('/doctor/slots/custom', data),
  removeSlot: (data) => api.post('/doctor/slots/remove', data),
  triggerAiPatternGeneration: (data) => api.post('/doctor/slots/generate-ai', data),
};

export default doctorApi;
