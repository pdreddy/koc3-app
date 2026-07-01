import React, { useState } from 'react';
import { Alert, Box, Button, Link, Stack, TextField, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AuthCard } from '@/components/layout/AuthCard';

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
    <AuthCard title="Sign In" subtitle="Tournament platform admin & captain portal">
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" variant="contained" size="large" disabled={submitting} sx={{ borderRadius: 999 }}>
            {submitting ? 'Signing in…' : 'Sign In →'}
          </Button>
          <Typography variant="body2" textAlign="center">
            New here? <Link component={RouterLink} to={signUpHref}>Create an account</Link>
          </Typography>
        </Stack>
      </Box>
    </AuthCard>
  );
}
