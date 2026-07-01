import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import TournamentManager from '@/pages/admin/TournamentManager';
import CreateTournamentWizard from '@/pages/admin/wizard/CreateTournamentWizard';
import TournamentDetail from '@/pages/admin/TournamentDetail';
import AdminLogin from '@/pages/admin/AdminLogin';
import RosterImport from '@/pages/admin/RosterImport';
import GenerateTeams from '@/pages/admin/GenerateTeams';
import GenerateSchedule from '@/pages/admin/GenerateSchedule';
import TournamentSettings from '@/pages/admin/TournamentSettings';
import PublicTournamentLayout from '@/pages/public/PublicTournamentLayout';
import PublicHome from '@/pages/public/PublicHome';
import PublicSchedule from '@/pages/public/PublicSchedule';
import PublicStandings from '@/pages/public/PublicStandings';
import PublicTeams from '@/pages/public/PublicTeams';
import PublicRules from '@/pages/public/PublicRules';
import ScoreEntry from '@/pages/public/ScoreEntry';

// Requires a signed-in Firebase Auth user. This is NOT yet a real per-tournament role
// check (that needs Firestore security rules + TournamentPermission docs — Task #11) —
// it's the platform-wide "are you signed in at all" gate matching what AuthContext
// currently provides. Do not treat this as sufficient authorization on its own once
// multiple tournament admins with different scopes exist.
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<RequireAuth><TournamentManager /></RequireAuth>} />
      <Route path="/admin/tournaments/new" element={<RequireAuth><CreateTournamentWizard /></RequireAuth>} />
      <Route path="/admin/tournaments/:tournamentId" element={<RequireAuth><TournamentDetail /></RequireAuth>} />
      <Route path="/admin/tournaments/:tournamentId/import-players" element={<RequireAuth><RosterImport /></RequireAuth>} />
      <Route path="/admin/tournaments/:tournamentId/generate-teams" element={<RequireAuth><GenerateTeams /></RequireAuth>} />
      <Route path="/admin/tournaments/:tournamentId/generate-schedule" element={<RequireAuth><GenerateSchedule /></RequireAuth>} />
      <Route path="/admin/tournaments/:tournamentId/edit" element={<RequireAuth><TournamentSettings /></RequireAuth>} />

      <Route path="/t/:slug" element={<PublicTournamentLayout />}>
        <Route index element={<PublicHome />} />
        <Route path="schedule" element={<PublicSchedule />} />
        <Route path="standings" element={<PublicStandings />} />
        <Route path="teams" element={<PublicTeams />} />
        <Route path="rules" element={<PublicRules />} />
        <Route path="score" element={<ScoreEntry />} />
      </Route>

      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
