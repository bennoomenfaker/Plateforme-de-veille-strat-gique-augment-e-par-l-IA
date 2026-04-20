import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import RegisterOrgPage from './pages/auth/RegisterOrgPage';
import InvitationPage from './pages/auth/InvitationPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import ProjectsPage from './pages/projects/ProjectsPage';
import ProjectDetailPage from './pages/projects/ProjectDetailPage';
import OrganisationPage from './pages/organisation/OrganisationPage';
import AnalysePage from './pages/analyse/AnalysePage';
import AdminPage from './pages/admin/AdminPage';
import CreateProjectWizard from './pages/wizard/CreateProjectWizard';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return !isAuthenticated ? <>{children}</> : <Navigate to="/home" />;
}

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (user.type_utilisateur === 'ORGANISATION') return <Navigate to="/organisation" />;
  return <Navigate to="/dashboard" />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/register/organisation" element={<PublicRoute><RegisterOrgPage /></PublicRoute>} />
        <Route path="/invitation/:token" element={<InvitationPage />} />
        <Route path="/home" element={<PrivateRoute><HomeRedirect /></PrivateRoute>} />
        <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        <Route path="/projects" element={<PrivateRoute><ProjectsPage /></PrivateRoute>} />
        <Route path="/projects/new" element={<PrivateRoute><CreateProjectWizard /></PrivateRoute>} />
        <Route path="/projects/:id" element={<PrivateRoute><ProjectDetailPage /></PrivateRoute>} />
        <Route path="/organisation" element={<PrivateRoute><OrganisationPage /></PrivateRoute>} />
        <Route path="/analyse/:projectId" element={<PrivateRoute><AnalysePage /></PrivateRoute>} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/" element={<Navigate to="/home" />} />
        <Route path="*" element={<Navigate to="/home" />} />
      </Routes>
    </BrowserRouter>
  );
}
