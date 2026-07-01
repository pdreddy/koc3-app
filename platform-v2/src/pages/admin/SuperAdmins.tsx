import { useEffect, useState } from 'react';
import { Alert, Button, Chip, Container, IconButton, Stack, TextField, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useAuth } from '@/contexts/AuthContext';
import { useSuperAdmin } from '@/contexts/SuperAdminContext';
import { SuperAdminService } from '@/services/superAdminService';
import type { SuperAdminInvite, SuperAdminRecord } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';

// Platform-wide (not per-tournament) management of who holds SUPER_ADMIN — the mirror
// image of admin/TeamRoles.tsx's invite/revoke flow, but for the one platform-wide
// capability instead of per-tournament roles. Gated client-side on useSuperAdmin() below;
// the real enforcement is firestore.rules (superAdmins/superAdminInvites both require
// isSuperAdmin() for every write except the bootstrap/invite self-claim paths).
export default function SuperAdmins() {
  const { user } = useAuth();
  const { isSuperAdmin, loading: superAdminLoading } = useSuperAdmin();
  const [admins, setAdmins] = useState<SuperAdminRecord[]>([]);
  const [invites, setInvites] = useState<SuperAdminInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    const [a, i] = await Promise.all([SuperAdminService.list(), SuperAdminService.listInvites()]);
    setAdmins(a);
    setInvites(i.filter((inv) => !inv.claimedBy));
    setLoading(false);
  };

  useEffect(() => {
    if (isSuperAdmin) reload();
    else setLoading(false);
  }, [isSuperAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  if (superAdminLoading || loading) return <Typography color="text.secondary">Loading…</Typography>;
  if (!isSuperAdmin) return <Alert severity="error">You are not a platform super admin.</Alert>;

  const handleInvite = async () => {
    if (!email.trim() || !user) return;
    setInviting(true);
    setError(null);
    try {
      const invite = await SuperAdminService.invite(email, user.uid);
      setInvites((prev) => [...prev, invite]);
      setEmail('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setInviting(false);
    }
  };

  const handleRevoke = async (record: SuperAdminRecord) => {
    await SuperAdminService.revoke(record);
    setAdmins((prev) => prev.filter((a) => a.uid !== record.uid));
  };

  const handleCancelInvite = async (invite: SuperAdminInvite) => {
    await SuperAdminService.cancelInvite(invite.email);
    setInvites((prev) => prev.filter((i) => i.id !== invite.id));
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <PageHeader title="Platform Super Admins" subtitle="Grant or revoke admin access across every tournament on this platform." />
      <Alert severity="info" sx={{ mb: 3 }}>
        A super admin has admin access to every tournament on this platform, not just ones
        they created. Grant this sparingly.
      </Alert>

      <Stack spacing={4}>
        <Stack spacing={1}>
          <Typography variant="h6">Current super admins</Typography>
          {admins.length === 0 && <Typography color="text.secondary">None yet.</Typography>}
          {admins.map((a) => (
            <Stack key={a.uid} direction="row" spacing={1} alignItems="center">
              <Typography sx={{ minWidth: 220 }}>{a.email ?? a.uid}</Typography>
              <IconButton size="small" onClick={() => handleRevoke(a)} title="Revoke super admin">
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
        </Stack>

        <Stack spacing={1}>
          <Typography variant="h6">Pending invites</Typography>
          {invites.length === 0 && <Typography color="text.secondary">None pending.</Typography>}
          {invites.map((inv) => (
            <Stack key={inv.id} direction="row" spacing={1} alignItems="center">
              <Typography sx={{ minWidth: 220 }}>{inv.email}</Typography>
              <Chip size="small" label="Pending" />
              <IconButton size="small" onClick={() => handleCancelInvite(inv)} title="Cancel invite">
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField size="small" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} sx={{ minWidth: 220 }} />
            <Button size="small" variant="outlined" disabled={inviting || !email.trim()} onClick={handleInvite}>
              {inviting ? 'Inviting…' : 'Invite'}
            </Button>
          </Stack>
          {error && <Typography variant="caption" color="error">{error}</Typography>}
        </Stack>
      </Stack>
    </Container>
  );
}
