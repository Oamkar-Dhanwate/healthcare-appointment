import api from './axiosInstance';

export const adminApi = {
  getDashboard: () => api.get('/admin/dashboard'),
  listDoctors: () => api.get('/admin/doctors'),
  createDoctor: (data) => api.post('/admin/doctors', data),
  updateDoctor: (id, data) => api.put(`/admin/doctors/${id}`, data),
  markLeave: (doctorId, data) => api.post(`/admin/doctors/${doctorId}/leaves`, data),
  listAppointments: (params) => api.get('/admin/appointments', { params }),
  getFailedNotifications: () => api.get('/admin/notifications/failed'),
};

export default adminApi;
