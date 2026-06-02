import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import RegisterOrgPage from './pages/auth/RegisterOrgPage';
import InvitationPage from './pages/auth/InvitationPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import ProjectsPage from './pages/projects/ProjectsPage';
import ProjectDetailPage from './pages/projects/ProjectDetailPage';
import ProjectRawItemsPage from './pages/projects/ProjectRawItemsPage';
import ProjectProcessedItemsPage from './pages/projects/ProjectProcessedItemsPage';
import CollectionPlanDetailPage from './pages/projects/CollectionPlanDetailPage';
import ProjectEnrichedItemsPage from './pages/projects/ProjectEnrichedItemsPage';
import ProjectInsightDashboardPage from './pages/projects/ProjectInsightDashboardPage';
import OrganisationPage from './pages/organisation/OrganisationPage';
import AnalysePage from './pages/analyse/AnalysePage';
import AdminPage from './pages/admin/AdminPage';
import CreateProjectWizard from './pages/wizard/CreateProjectWizard';
import ProfilePage from './pages/profile/ProfilePage';
import AlertesPage from './pages/alertes/AlertesPage';
import GraphPage from './pages/graph/GraphPage';

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
        {/* Auth */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/register/organisation" element={<PublicRoute><RegisterOrgPage /></PublicRoute>} />
        <Route path="/invitation/:token" element={<InvitationPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        <Route path="/admin" element={<AdminPage />} />

        {/* App */}
        <Route path="/home" element={<PrivateRoute><HomeRedirect /></PrivateRoute>} />
        <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />

        {/* Projets */}
        <Route path="/projects" element={<PrivateRoute><ProjectsPage /></PrivateRoute>} />
        <Route path="/projects/new" element={<PrivateRoute><CreateProjectWizard /></PrivateRoute>} />
        <Route path="/projects/:id" element={<PrivateRoute><ProjectDetailPage /></PrivateRoute>} />

        {/* Sprint 3 */}
        <Route path="/projects/:id/raw-items" element={<PrivateRoute><ProjectRawItemsPage /></PrivateRoute>} />
        <Route path="/projects/:projectId/plans/:planId" element={<PrivateRoute><CollectionPlanDetailPage /></PrivateRoute>} />

        {/* Sprint 4 */}
        <Route path="/projects/:id/processed" element={<PrivateRoute><ProjectProcessedItemsPage /></PrivateRoute>} />

        {/* Sprint 5 & 6 */}
        <Route path="/projects/:id/enriched" element={<PrivateRoute><ProjectEnrichedItemsPage /></PrivateRoute>} />
        <Route path="/projects/:id/insights" element={<PrivateRoute><ProjectInsightDashboardPage /></PrivateRoute>} />

        {/* Autres */}
        <Route path="/graph" element={<PrivateRoute><GraphPage /></PrivateRoute>} />
        <Route path="/organisation" element={<PrivateRoute><OrganisationPage /></PrivateRoute>} />
        <Route path="/analyse/:projectId" element={<PrivateRoute><AnalysePage /></PrivateRoute>} />
        <Route path="/alertes" element={<PrivateRoute><AlertesPage /></PrivateRoute>} />

        <Route path="/" element={<Navigate to="/home" />} />
        <Route path="*" element={<Navigate to="/home" />} />
      </Routes>
    </BrowserRouter>
  );
}
