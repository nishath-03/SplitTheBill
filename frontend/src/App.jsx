import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import CreateSessionPage from './pages/CreateSessionPage';
import WaitingRoomPage from './pages/WaitingRoomPage';
import JoinPage from './pages/JoinPage';
import ActiveSessionPage from './pages/ActiveSessionPage';
import CollectPage from './pages/CollectPage';
import GuestSharePage from './pages/GuestSharePage';
import SummaryPage from './pages/SummaryPage';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user } = useAuth();
  return !user ? children : <Navigate to="/dashboard" replace />;
}

function AppRoutes() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/create-session" element={<ProtectedRoute><CreateSessionPage /></ProtectedRoute>} />
        <Route path="/session/:roomCode/waiting" element={<ProtectedRoute><WaitingRoomPage /></ProtectedRoute>} />
        <Route path="/session/:roomCode/active" element={<ProtectedRoute><ActiveSessionPage /></ProtectedRoute>} />
        <Route path="/session/:roomCode/collect" element={<ProtectedRoute><CollectPage /></ProtectedRoute>} />
        <Route path="/session/:roomCode/summary" element={<ProtectedRoute><SummaryPage /></ProtectedRoute>} />
        {/* Guest public routes */}
        <Route path="/join/:roomCode" element={<JoinPage />} />
        <Route path="/guest/:roomCode/:memberId" element={<GuestSharePage />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <ToastContainer
          position="bottom-right"
          autoClose={4000}
          theme="dark"
          toastStyle={{
            background: '#1A1929',
            border: '1px solid rgba(108,99,255,0.2)',
            color: '#E8E6FF',
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
