import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MentionsPage } from './pages/MentionsPage';
import { AlertsPage } from './pages/AlertsPage';
import { IndividualsPage } from './pages/IndividualsPage';
import { AssetsPage } from './pages/AssetsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ClientsPage } from './pages/ClientsPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/mentions" element={<MentionsPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/individuals" element={<IndividualsPage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
