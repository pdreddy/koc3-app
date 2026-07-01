import React, { useState } from 'react';
import { Alert, Box, Button, Container, Link, Paper, Stack, TextField, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

// Route is named /admin/login for historical reasons (it was built as an admin-only
// screen first) but works for anyone with a Firebase Auth account — captains and players
// sign in here too. A `redirect` query param sends them back to wherever they came from
// (e.g. the public tournament site links here with ?redirect=/t/{slug}); admin flows omit
// it and land on the Tournament Manager.
export default function AdminLogin() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email, password);
      navigate(searchParams.get('redirect') || '/admin');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const signUpHref = searchParams.get('redirect')
    ? `/admin/signup?redirect=${encodeURIComponent(searchParams.get('redirect')!)}`
    : '/admin/signup';

  return (
    <Container maxWidth="xs" sx={{ py: 8 }}>
      <Paper variant="outlined" sx={{ p: 4 }}>
        <Typography variant="h5" sx={{ mb: 3 }}>Sign In</Typography>
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
            <Typography variant="body2">
              New here? <Link component={RouterLink} to={signUpHref}>Create an account</Link>
            </Typography>
          </Stack>
        </Box>
      </Paper>
    </Container>
  );
}
