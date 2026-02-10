import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Phone, History, Megaphone, LogOut, User, Shield } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';
import Signup from './components/Signup';
import CallInterface from './components/CallInterface';
import CallHistory from './components/CallHistory';
import Campaigns from './components/Campaigns';

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

function AppContent() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen gradient-bg">
      {isAuthenticated && <Navigation />}
      <main className={isAuthenticated ? "container mx-auto px-4 py-8" : ""}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <CallInterface />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <CallHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/campaigns"
            element={
              <ProtectedRoute>
                <Campaigns />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function Navigation() {
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  
  const isActive = (path) => location.pathname === path;
  
  return (
    <nav className="glass-effect shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-2">
            <Phone className="w-8 h-8 text-primary-600" />
            <span className="text-2xl font-bold text-gray-800">VoiceAI</span>
          </div>
          
          <div className="flex items-center space-x-4">
            <Link
              to="/"
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                isActive('/')
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-700 hover:bg-primary-100'
              }`}
            >
              <Phone className="w-5 h-5" />
              <span>Make Call</span>
            </Link>
            
            <Link
              to="/campaigns"
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                isActive('/campaigns')
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-700 hover:bg-primary-100'
              }`}
            >
              <Megaphone className="w-5 h-5" />
              <span>Campaigns</span>
            </Link>
            
            <Link
              to="/history"
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                isActive('/history')
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-700 hover:bg-primary-100'
              }`}
            >
              <History className="w-5 h-5" />
              <span>Call History</span>
            </Link>

            <div className="flex items-center space-x-3 pl-4 border-l border-gray-300">
              <div className="flex items-center space-x-2 text-gray-700">
                {isAdmin() ? (
                  <Shield className="w-5 h-5 text-yellow-600" />
                ) : (
                  <User className="w-5 h-5" />
                )}
                <span className="font-medium">{user?.name || user?.email}</span>
                {isAdmin() && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-semibold">
                    Admin
                  </span>
                )}
              </div>
              
              <button
                onClick={logout}
                className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default App;
