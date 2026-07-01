import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Box, Button, Container, Stack, Tab, Tabs, Typography } from '@mui/material';
import { TournamentProvider, useTournament } from '@/contexts/TournamentContext';
import { useAuth } from '@/contexts/AuthContext';
import { useConfigDraft } from '@/hooks/useConfigDraft';
import { TournamentService } from '@/services/TournamentService';
import Step1Info from './wizard/Step1Info';
import Step2Type from './wizard/Step2Type';
import Step3Structure from './wizard/Step3Structure';
import { PlayerConfigEditor, VisibilityEditor } from './settings/PlayerConfigVisibilityEditor';
import MatchTypesEditor from './settings/MatchTypesEditor';
import ScoringEditor from './settings/ScoringEditor';
import StandingsEditor from './settings/StandingsEditor';
import { PlayoffsEditor, RegistrationEditor } from './settings/PlayoffsRegistrationEditor';
import BrandingEditor from './settings/BrandingEditor';

const TABS = ['Info', 'Type', 'Structure', 'Players', 'Match Types', 'Scoring', 'Standings', 'Playoffs', 'Registration', 'Visibility', 'Branding'];

function TournamentSettingsContent() {
  const { tournament, loading } = useTournament();
  const { user } = useAuth();
  const { draft, patch, setField, reset } = useConfigDraft(tournament?.config);
  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Re-sync the draft once the tournament finishes loading (useConfigDraft's initial value
  // is captured before that happens on first render).
  useEffect(() => {
    if (tournament) reset(tournament.config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament?.id]);

  if (loading) return <Typography color="text.secondary">Loading…</Typography>;
  if (!tournament) return <Alert severity="error">Tournament not found</Alert>;

  const handleSave = async () => {
    setSaving(true);
    await TournamentService.updateConfig(tournament.id, draft, user?.uid || 'unknown');
    setSaving(false);
    setSaved(true);
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Tournament Settings</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
        {TABS.map((label) => <Tab key={label} label={label} />)}
      </Tabs>

      <Box>
        {tab === 0 && <Step1Info value={draft.info} onChange={(p) => patch('info', p)} />}
        {tab === 1 && <Step2Type value={draft.type} onChange={(t) => setField('type', t)} />}
        {tab === 2 && <Step3Structure value={draft.structure} onChange={(p) => patch('structure', p)} />}
        {tab === 3 && <PlayerConfigEditor value={draft.playerConfig} onChange={(p) => patch('playerConfig', p)} />}
        {tab === 4 && (
          <MatchTypesEditor
            matchTypes={draft.matchTypes}
            lineup={draft.lineup}
            onMatchTypesChange={(next) => setField('matchTypes', next)}
            onLineupChange={(next) => setField('lineup', next)}
          />
        )}
        {tab === 5 && <ScoringEditor value={draft.scoring} onChange={(p) => patch('scoring', p)} />}
        {tab === 6 && <StandingsEditor value={draft.standings} onChange={(p) => patch('standings', p)} />}
        {tab === 7 && <PlayoffsEditor value={draft.playoffs} onChange={(p) => patch('playoffs', p)} />}
        {tab === 8 && <RegistrationEditor value={draft.registration} onChange={(p) => patch('registration', p)} />}
        {tab === 9 && <VisibilityEditor value={draft.visibility} onChange={(next) => setField('visibility', next)} />}
        {tab === 10 && <BrandingEditor value={draft.branding} onChange={(p) => patch('branding', p)} tournamentId={tournament.id} />}
      </Box>

      {saved && <Alert severity="success" onClose={() => setSaved(false)}>Saved.</Alert>}
      <Box>
        <Button variant="contained" disabled={saving} onClick={handleSave}>
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </Box>
    </Stack>
  );
}

export default function TournamentSettings() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  if (!tournamentId) return <Alert severity="error">Missing tournament id</Alert>;
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <TournamentProvider tournamentId={tournamentId}>
        <TournamentSettingsContent />
      </TournamentProvider>
    </Container>
  );
}
