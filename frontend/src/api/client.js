import axios from 'axios';

const contextRoot = import.meta.env.BASE_URL.replace(/\/$/, '');

const api = axios.create({
  baseURL: `${contextRoot}/api`,
  timeout: 120000,
});

// Attach token from localStorage
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = `${contextRoot}/login`;
    }
    return Promise.reject(err);
  }
);

export default api;
