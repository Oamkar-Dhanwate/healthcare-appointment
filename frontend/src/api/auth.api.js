import api from './axiosInstance';

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  getGoogleAuthUrl: () => api.get('/auth/google'),
};

export default authApi;
