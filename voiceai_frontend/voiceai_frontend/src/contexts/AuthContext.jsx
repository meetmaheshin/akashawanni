import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);


export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('voiceai_token'));

  // Configure axios to include token in all requests
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Load user data on mount if token exists
  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        try {
          const response = await axios.get(`/api/auth/me`);
          setUser(response.data);
        } catch (error) {
          console.error('Failed to load user:', error);
          // Token is invalid, clear it
          localStorage.removeItem('voiceai_token');
          setToken(null);
        }
      }
      setLoading(false);
    };

    loadUser();
  }, [token]);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`/api/auth/login`, {
        email,
        password
      });

      if (response.data.status === 'verification_required') {
        return { success: false, verificationRequired: true, email: response.data.email, error: response.data.message };
      }

      const { access_token, user: userData } = response.data;

      localStorage.setItem('voiceai_token', access_token);
      setToken(access_token);
      setUser(userData);

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Login failed'
      };
    }
  };

  const signup = async (name, email, password) => {
    try {
      const response = await axios.post(`/api/auth/signup`, {
        name,
        email,
        password
      });

      if (response.data.status === 'verification_required') {
        return { success: false, verificationRequired: true, email: response.data.email };
      }

      const { access_token, user: userData } = response.data;

      localStorage.setItem('voiceai_token', access_token);
      setToken(access_token);
      setUser(userData);

      return { success: true };
    } catch (error) {
      console.error('Signup error:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Signup failed'
      };
    }
  };

  const verifyEmail = async (email, code) => {
    try {
      const response = await axios.post(`/api/auth/verify-email`, { email, code });

      const { access_token, user: userData } = response.data;

      localStorage.setItem('voiceai_token', access_token);
      setToken(access_token);
      setUser(userData);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Verification failed' };
    }
  };

  const resendVerification = async (email) => {
    try {
      await axios.post(`/api/auth/resend-verification`, { email });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Failed to resend code' };
    }
  };

  const logout = () => {
    localStorage.removeItem('voiceai_token');
    setToken(null);
    setUser(null);
  };

  const isAdmin = () => {
    return user?.role === 'admin';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        signup,
        verifyEmail,
        resendVerification,
        logout,
        isAdmin,
        isAuthenticated: !!user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
