import { useState } from 'react';
import {
  Alert, Box, Button, Container, Step, StepLabel, Stepper, Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useWizardDraft } from './useWizardDraft';
import Step1Info from './Step1Info';
import Step2Type from './Step2Type';
import Step3Structure from './Step3Structure';
import { TournamentService } from '@/services/TournamentService';
import { useAuth } from '@/contexts/AuthContext';

// Steps 4-10 from the spec (player config, match types, scoring, standings, playoffs,
// registration, visibility) are intentionally not in this first slice — buildDefaultTournamentConfig()
// seeds sane values for all of them, and they're editable after creation from tournament
// settings once that screen exists (Task list #9/#10 follow-ons). This keeps each shipped
// increment small and verifiable rather than gating "create a tournament at all" behind
// every single wizard step existing.
const STEPS = ['Tournament Information', 'Tournament Type', 'Structure'];

export default function CreateTournamentWizard() {
  const [activeStep, setActiveStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { draft, patch, setField } = useWizardDraft();
  const { user } = useAuth();
  const navigate = useNavigate();

  const canProceed = activeStep === 0 ? draft.info.name.trim().length > 0 : true;

  const handleNext = () => setActiveStep((s) => Math.min(s + 1, STEPS.length - 1));
  const handleBack = () => setActiveStep((s) => Math.max(s - 1, 0));

  const handleCreate = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const created = await TournamentService.create({
        name: draft.info.name,
        createdBy: user?.uid || 'unknown',
        config: draft,
      });
      navigate(`/admin/tournaments/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>Create Tournament</Typography>
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}><StepLabel>{label}</StepLabel></Step>
        ))}
      </Stepper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {activeStep === 0 && <Step1Info value={draft.info} onChange={(p) => patch('info', p)} />}
      {activeStep === 1 && <Step2Type value={draft.type} onChange={(t) => setField('type', t)} />}
      {activeStep === 2 && <Step3Structure value={draft.structure} onChange={(p) => patch('structure', p)} />}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
        <Button disabled={activeStep === 0 || submitting} onClick={handleBack}>Back</Button>
        {activeStep < STEPS.length - 1 ? (
          <Button variant="contained" disabled={!canProceed} onClick={handleNext}>Next</Button>
        ) : (
          <Button variant="contained" disabled={!canProceed || submitting} onClick={handleCreate}>
            {submitting ? 'Creating…' : 'Create Tournament'}
          </Button>
        )}
      </Box>
    </Container>
  );
}
