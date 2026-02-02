import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ExamCreator from './components/ExamCreator';
import LiveBattle from './components/LiveBattle';
import Marketplace from './components/Marketplace';
import ClassManager from './components/ClassManager';
import StudentView from './components/StudentView';
import TeacherLogin from './components/TeacherLogin';
import TeacherProfile from './components/TeacherProfile';
import TeacherManager from './components/TeacherManager';
import QuestionBank from './components/QuestionBank'; 
import ExamHistory from './components/ExamHistory'; // Import new component
import { Teacher } from './types';

// Wrapper to conditionally apply Layout
interface LayoutWrapperProps {
  children: React.ReactNode;
  onLogout: () => void;
}

const LayoutWrapper: React.FC<LayoutWrapperProps> = ({ children, onLogout }) => {
  const location = useLocation();
  // Don't use Layout for student view or login
  if (location.pathname === '/student' || location.pathname === '/login') {
    return <>{children}</>;
  }
  return <Layout onLogout={onLogout}>{children}</Layout>;
};

const App: React.FC = () => {
  const [currentTeacher, setCurrentTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);

  // Load teacher session on startup
  useEffect(() => {
    const stored = localStorage.getItem('bamboo_current_teacher');
    if (stored) {
      setCurrentTeacher(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  const handleTeacherLogin = (teacher: Teacher) => {
    setCurrentTeacher(teacher);
    localStorage.setItem('bamboo_current_teacher', JSON.stringify(teacher));
  };

  const handleTeacherUpdate = (updated: Teacher) => {
    setCurrentTeacher(updated);
    localStorage.setItem('bamboo_current_teacher', JSON.stringify(updated));
    
    // Also update in the main list
    const allTeachers: Teacher[] = JSON.parse(localStorage.getItem('bamboo_teachers') || '[]');
    const newAll = allTeachers.map(t => t.id === updated.id ? updated : t);
    localStorage.setItem('bamboo_teachers', JSON.stringify(newAll));
  };

  const handleLogout = () => {
    localStorage.removeItem('bamboo_current_teacher');
    setCurrentTeacher(null);
  };

  if (loading) return null;

  return (
    <Router>
      <LayoutWrapper onLogout={handleLogout}>
        <Routes>
          {/* Public / Student Route */}
          <Route path="/student" element={<StudentView />} />

          {/* Login Route (if not logged in) */}
          <Route path="/login" element={
            currentTeacher ? <Navigate to="/" replace /> : <TeacherLogin onLogin={handleTeacherLogin} />
          } />

          {/* Protected Routes */}
          {currentTeacher ? (
            <>
              <Route path="/" element={<Dashboard />} />
              <Route path="/question-bank" element={<QuestionBank />} /> 
              <Route path="/exams" element={<ExamCreator />} />
              <Route path="/battle" element={<LiveBattle />} />
              <Route path="/history" element={<ExamHistory />} /> {/* New Route */}
              <Route path="/classes" element={<ClassManager />} />
              <Route path="/teachers" element={<TeacherManager />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/profile" element={<TeacherProfile currentTeacher={currentTeacher} onUpdate={handleTeacherUpdate} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <Route path="*" element={<Navigate to="/login" replace />} />
          )}
        </Routes>
      </LayoutWrapper>
    </Router>
  );
};

export default App;