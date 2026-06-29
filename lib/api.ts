import axios from 'axios';

const api = axios.create({
  // Set NEXT_PUBLIC_API_URL at build/dev time to point at a tunnel
  // (e.g. https://xxx.trycloudflare.com) when sharing the app off-laptop.
  // Without it, falls back to localhost for normal local dev.
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('access_token');
      const onAdmin = window.location.pathname.startsWith('/admin');
      window.location.href = onAdmin ? '/admin/login' : '/login';
    }
    return Promise.reject(err);
  },
);

export default api;
