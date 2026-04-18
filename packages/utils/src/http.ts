import axios from 'axios';
import toast from 'react-hot-toast';

const TOKEN_KEY = 'crm-auth-token';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token from localStorage on every request
api.interceptors.request.use((config) => {
  // Try both the direct token key and the Zustand persist key
  let token = localStorage.getItem(TOKEN_KEY);
  
  // If not found, try the Zustand persist storage
  if (!token) {
    try {
      const authData = localStorage.getItem('crm-auth');
      if (authData) {
        const parsed = JSON.parse(authData);
        token = parsed.state?.token;
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
  }
  
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global error handler — shows toast for all API failures
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'Something went wrong';

    // Don't toast on 401 (handled by auth redirect) or cancelled requests
    if (error.response?.status !== 401 && !axios.isCancel(error)) {
      toast.error(message);
    }

    return Promise.reject(error);
  }
);

export default api;
