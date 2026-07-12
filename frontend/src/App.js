import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DashboardClassic from './pages/DashboardClassic';
import TrackByCounties from './pages/TrackByCounties';
import Reminders from './pages/Reminders';
import CountyDetail from './pages/CountyDetail';
import Notifications from './pages/Notifications';
import CreateTask from './pages/CreateTask';
import Contacts from './pages/Contacts';
import Users from './pages/Users';
import FormPilot from './pages/FormPilot';
import RlgfFormPage from './pages/RlgfFormPage';
import DcaShell from './dca/DcaShell';
import DcaDashboard from './dca/pages/DcaDashboard';
import DcaEntities from './dca/pages/DcaEntities';
import DcaEntityDetail from './dca/pages/DcaEntityDetail';
import DcaSubmissions from './dca/pages/DcaSubmissions';
import DcaSubmissionDetail from './dca/pages/DcaSubmissionDetail';
import DcaReminders from './dca/pages/DcaReminders';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/track-by-counties"
            element={
              <PrivateRoute adminOnly={true}>
                <Layout>
                  <TrackByCounties />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/dashboard/classic"
            element={
              <PrivateRoute>
                <Layout>
                  <DashboardClassic />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/county/:id"
            element={
              <PrivateRoute>
                <Layout>
                  <CountyDetail />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/county/:id/contacts"
            element={
              <PrivateRoute>
                <Layout>
                  <Contacts />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/county/:id/formpilot"
            element={
              <PrivateRoute>
                <Layout>
                  <FormPilot />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/county/:id/rlgf/:taskId"
            element={
              <PrivateRoute>
                <Layout>
                  <RlgfFormPage />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/create-task"
            element={
              <PrivateRoute adminOnly={true}>
                <Layout>
                  <CreateTask />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/reminders"
            element={
              <PrivateRoute adminOnly={true}>
                <Layout>
                  <Reminders />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <PrivateRoute adminOnly={true}>
                <Layout>
                  <Notifications />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/users"
            element={
              <PrivateRoute adminOnly={true}>
                <Layout>
                  <Users />
                </Layout>
              </PrivateRoute>
            }
          />
          {/* DCA (state agency) section — hard-gated to the 'dca' role only.
              Dashboard + Add Report are wired to the real /api/tasks endpoints;
              Entities/Submissions/Reminders remain UI-only mock previews. */}
          <Route
            path="/dca"
            element={
              <PrivateRoute dcaOnly={true}>
                <DcaShell />
              </PrivateRoute>
            }
          >
            <Route index element={<DcaDashboard />} />
            <Route path="entities" element={<DcaEntities />} />
            <Route path="entities/:entityId" element={<DcaEntityDetail />} />
            <Route path="submissions" element={<DcaSubmissions />} />
            <Route path="submissions/:submissionId" element={<DcaSubmissionDetail />} />
            <Route path="reminders" element={<DcaReminders />} />
            {/* Add Report reuses the existing ACCG Add Task flow (real create endpoint). */}
            <Route path="add-report" element={<CreateTask />} />
          </Route>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

