import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert, Button, Chip, Container, IconButton, MenuItem, Select, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { TournamentProvider, useTournament } from '@/contexts/TournamentContext';
import { useAuth } from '@/contexts/AuthContext';
import type { Invite, Player, Role, Team, TournamentPermission } from '@/types';
import { normalizeEmail } from '@/types';
import { writeAuditLog } from '@/services/auditService';

const ASSIGNABLE_ROLES: Exclude<Role, 'SUPER_ADMIN' | 'GUEST' | 'PUBLIC' | 'TOURNAMENT_ADMIN'>[] = [
  'ORGANIZER', 'CAPTAIN', 'VICE_CAPTAIN', 'PLAYER',
];

function InviteRow({
  defaultEmail, teamId, tournamentId, onInvited,
}: { defaultEmail: string; teamId: string | null; tournamentId: string; onInvited: (invite: Invite) => void }) {
  const { repo } = useTournament();
  const { user } = useAuth();
  const [email, setEmail] = useState(defaultEmail);
  const [role, setRole] = useState<typeof ASSIGNABLE_ROLES[number]>(teamId ? 'CAPTAIN' : 'ORGANIZER');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInvite = async () => {
    const normalized = normalizeEmail(email);
    if (!normalized) return;
    setSending(true);
    setError(null);
    try {
      const now = Date.now();
      const invite = await repo<Invite>('invites').setWithId(normalized, {
        email: normalized,
        tournamentId,
        role,
        teamId: role === 'ORGANIZER' ? null : teamId,
        invitedBy: user?.uid ?? 'unknown',
        invitedAt: now,
        claimedBy: null,
        claimedAt: null,
      });
      onInvited(invite);
      await writeAuditLog(tournamentId, 'ROLE_INVITED', { uid: user?.uid ?? 'unknown', email: user?.email ?? null }, 'invite', normalized, { role, teamId });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <TextField size="small" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} sx={{ minWidth: 220 }} />
      <Select size="small" value={role} onChange={(e) => setRole(e.target.value as typeof role)} sx={{ minWidth: 160 }}>
        {ASSIGNABLE_ROLES.map((r) => <MenuItem key={r} value={r}>{r.replaceAll('_', ' ')}</MenuItem>)}
      </Select>
      <Button size="small" variant="outlined" disabled={sending || !email.trim()} onClick={handleInvite}>
        {sending ? 'Inviting…' : 'Invite'}
      </Button>
      {error && <Typography variant="caption" color="error">{error}</Typography>}
    </Stack>
  );
}

function InviteStatusRow({ invite, tournamentId, onRemoved }: { invite: Invite; tournamentId: string; onRemoved: (id: string) => void }) {
  const { repo } = useTournament();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  const handleRemove = async () => {
    setBusy(true);
    // Revoking a claimed role deletes both the permission doc (the actual access grant)
    // and the invite record; cancelling an unclaimed invite just deletes the invite.
    if (invite.claimedBy) {
      await repo<TournamentPermission>('permissions').remove(invite.claimedBy);
    }
    await repo<Invite>('invites').remove(invite.id);
    await writeAuditLog(
      tournamentId,
      invite.claimedBy ? 'ROLE_REVOKED' : 'INVITE_CANCELLED',
      { uid: user?.uid ?? 'unknown', email: user?.email ?? null },
      'invite',
      invite.id,
      { role: invite.role, teamId: invite.teamId }
    );
    onRemoved(invite.id);
  };

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography sx={{ minWidth: 220 }}>{invite.email}</Typography>
      <Chip size="small" label={invite.role.replaceAll('_', ' ')} />
      <Chip size="small" color={invite.claimedBy ? 'success' : 'default'} label={invite.claimedBy ? 'Claimed' : 'Pending'} />
      <IconButton size="small" disabled={busy} onClick={handleRemove} title={invite.claimedBy ? 'Revoke role' : 'Cancel invite'}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

function TeamRolesContent() {
  const { tournament, repo } = useTournament();
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tournament) return;
    Promise.all([repo<Team>('teams').list(), repo<Player>('players').list(), repo<Invite>('invites').list()]).then(
      ([t, p, inv]) => {
        setTeams(t);
        setPlayers(Object.fromEntries(p.map((pl) => [pl.id, pl])));
        setInvites(inv);
        setLoading(false);
      }
    );
  }, [tournament, repo]);

  const invitesByTeam = useMemo(() => {
    const map: Record<string, Invite[]> = {};
    invites.forEach((inv) => {
      const key = inv.teamId ?? 'organizers';
      (map[key] ||= []).push(inv);
    });
    return map;
  }, [invites]);

  if (!tournament) return null;

  const upsertInvite = (invite: Invite) => setInvites((prev) => [...prev.filter((i) => i.id !== invite.id), invite]);
  const removeInvite = (id: string) => setInvites((prev) => prev.filter((i) => i.id !== id));

  return (
    <Stack spacing={4}>
      <Typography variant="h4">Team Roles</Typography>
      <Alert severity="info">
        Inviting someone sends them no email yet — just registers the role for when they sign
        in (or sign up) with that exact email address, at <code>{window.location.origin}/admin/signup</code>.
        Share that link and the tournament's public URL with them directly.
      </Alert>

      <Stack spacing={1}>
        <Typography variant="h6">Organizers / Co-Admins</Typography>
        {(invitesByTeam.organizers ?? []).map((inv) => (
          <InviteStatusRow key={inv.id} invite={inv} tournamentId={tournament.id} onRemoved={removeInvite} />
        ))}
        <InviteRow defaultEmail="" teamId={null} tournamentId={tournament.id} onInvited={upsertInvite} />
      </Stack>

      {loading ? (
        <Typography color="text.secondary">Loading teams…</Typography>
      ) : (
        teams.map((team) => (
          <Stack key={team.id} spacing={1}>
            <Typography variant="h6">{team.name} (Group {team.group})</Typography>
            <Table size="small">
              <TableHead>
                <TableRow><TableCell>Player</TableCell><TableCell>Email</TableCell></TableRow>
              </TableHead>
              <TableBody>
                {team.playerIds.map((pid) => (
                  <TableRow key={pid}>
                    <TableCell>{players[pid]?.displayName ?? pid}</TableCell>
                    <TableCell>{players[pid]?.email ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {(invitesByTeam[team.id] ?? []).map((inv) => (
              <InviteStatusRow key={inv.id} invite={inv} tournamentId={tournament.id} onRemoved={removeInvite} />
            ))}
            <InviteRow
              defaultEmail={players[team.playerIds[0]]?.email ?? ''}
              teamId={team.id}
              tournamentId={tournament.id}
              onInvited={upsertInvite}
            />
          </Stack>
        ))
      )}
    </Stack>
  );
}

export default function TeamRoles() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  if (!tournamentId) return <Alert severity="error">Missing tournament id</Alert>;
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <TournamentProvider tournamentId={tournamentId}>
        <TeamRolesContent />
      </TournamentProvider>
    </Container>
  );
}
