// frontend/src/services/authService.js
import axios from 'axios';

const API_URL = 'http://localhost:8000/api/auth';

const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Helper function for logout cleanup
const logoutAndRedirect = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  localStorage.removeItem('profile');
  
  // Only redirect if not already on login page to prevent infinite redirects
  if (!window.location.pathname.includes('/login')) {
    window.location.href = '/login';
  }
};

// Handle token refresh
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Prevent infinite loops if already on login page
      if (window.location.pathname.includes('/login')) {
        return Promise.reject(error);
      }
      
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        
        // If no refresh token, logout immediately
        if (!refreshToken) {
          console.log('No refresh token available, logging out');
          logoutAndRedirect();
          return Promise.reject(error);
        }
        
        console.log('Attempting token refresh...');
        const response = await axios.post(`${API_URL}/token/refresh/`, {
          refresh: refreshToken,
        });
        
        console.log('Token refresh successful');
        localStorage.setItem('access_token', response.data.access);
        axiosInstance.defaults.headers['Authorization'] = `Bearer ${response.data.access}`;
        
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        // Use the logout helper for consistent cleanup
        logoutAndRedirect();
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

const authService = {
  login: async (email, password) => {
    const response = await axiosInstance.post('/login/', { email, password });
    if (response.data.tokens) {
      localStorage.setItem('access_token', response.data.tokens.access);
      localStorage.setItem('refresh_token', response.data.tokens.refresh);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      if (response.data.profile) {
        localStorage.setItem('profile', JSON.stringify(response.data.profile));
      }
    }
    return response.data;
  },

  signup: async (userData) => {
    const response = await axiosInstance.post('/signup/', userData);
    if (response.data.tokens) {
      localStorage.setItem('access_token', response.data.tokens.access);
      localStorage.setItem('refresh_token', response.data.tokens.refresh);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    try {
      if (refreshToken) {
        await axiosInstance.post('/logout/', { refresh: refreshToken });
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    // Always clear storage regardless of API call success
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('profile');
    
    // Only redirect if not already on login page to prevent infinite redirects
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  },

  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  getUserProfile: async () => {
    const response = await axiosInstance.get('/profile/');
    return response.data;
  },

  refreshToken: async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }
      
      const response = await axiosInstance.post('/token/refresh/', {
        refresh: refreshToken,
      });
      
      localStorage.setItem('access_token', response.data.access);
      return response.data;
    } catch (error) {
      console.error('Manual token refresh failed:', error);
      await this.logout();
      throw error;
    }
  },

  isAuthenticated: () => {
    const accessToken = localStorage.getItem('access_token');
    const refreshToken = localStorage.getItem('refresh_token');
    
    // Must have both tokens to be considered authenticated
    if (!accessToken || !refreshToken) {
      return false;
    }
    
    try {
      // Basic token format validation (JWT tokens have 3 parts separated by dots)
      const tokenParts = accessToken.split('.');
      if (tokenParts.length !== 3) {
        return false;
      }
      
      // Decode the payload to check expiration (without verification)
      const payload = JSON.parse(atob(tokenParts[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      
      // If access token is not expired, we're good
      if (payload.exp && payload.exp > currentTime) {
        return true;
      }
      
      // If access token is expired but we have refresh token, we're still authenticated
      // (the interceptor will handle the refresh)
      return !!refreshToken;
    } catch (error) {
      console.error('Error validating token:', error);
      return false;
    }
  },

  getUserType: () => {
    const user = authService.getCurrentUser();
    return user ? user.user_type : null;
  },

  getUserUUID: () => {
    const user = authService.getCurrentUser();
    return user ? user.uuid : null;
  },

  getToken: () => {
    return localStorage.getItem('access_token');
  },

  // Helper method for making authenticated API calls
  apiCall: async (url, method = 'GET', data = null) => {
    try {
      const config = {
        method,
        url,
        headers: {
          'Content-Type': 'application/json',
        }
      };

      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error('API call error:', error);
      throw error;
    }
  }
};

export default authService;