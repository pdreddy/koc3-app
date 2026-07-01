import React, { useState } from 'react';
import { Alert, Box, Button, Container, Link, Paper, Stack, TextField, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

// Self-service account creation — this is what lets a team captain (or any player) create
// their own login instead of needing one hand-created in the Firebase console. Creating an
// account here grants no role by itself; it just becomes a Firebase Auth user. Role
// resolution (captain of which team, tournament admin, etc.) happens separately via
// tournaments/{id}/permissions/{uid} docs — see hooks/useClaimPendingInvite.ts, which runs
// automatically after login and claims any invite an admin sent to this email address.
export default function SignUp() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await signUp(email, password);
      navigate(searchParams.get('redirect') || '/admin');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const signInHref = searchParams.get('redirect')
    ? `/admin/login?redirect=${encodeURIComponent(searchParams.get('redirect')!)}`
    : '/admin/login';

  return (
    <Container maxWidth="xs" sx={{ py: 8 }}>
      <Paper variant="outlined" sx={{ p: 4 }}>
        <Typography variant="h5" sx={{ mb: 3 }}>Create Account</Typography>
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} helperText="At least 6 characters" />
            <TextField label="Confirm Password" type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create Account'}
            </Button>
            <Typography variant="body2">
              Already have an account? <Link component={RouterLink} to={signInHref}>Sign in</Link>
            </Typography>
          </Stack>
        </Box>
      </Paper>
    </Container>
  );
}
