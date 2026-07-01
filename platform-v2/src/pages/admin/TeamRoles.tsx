import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert, Button, Chip, Container, MenuItem, Select, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { TournamentProvider, useTournament } from '@/contexts/TournamentContext';
import { useAuth } from '@/contexts/AuthContext';
import type { Invite, Player, Role, Team } from '@/types';
import { normalizeEmail } from '@/types';

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
          <Stack key={inv.id} direction="row" spacing={1} alignItems="center">
            <Typography sx={{ minWidth: 220 }}>{inv.email}</Typography>
            <Chip size="small" label={inv.role.replaceAll('_', ' ')} />
            <Chip size="small" color={inv.claimedBy ? 'success' : 'default'} label={inv.claimedBy ? 'Claimed' : 'Pending'} />
          </Stack>
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
              <Stack key={inv.id} direction="row" spacing={1} alignItems="center">
                <Typography sx={{ minWidth: 220 }}>{inv.email}</Typography>
                <Chip size="small" label={inv.role.replaceAll('_', ' ')} />
                <Chip size="small" color={inv.claimedBy ? 'success' : 'default'} label={inv.claimedBy ? 'Claimed' : 'Pending'} />
              </Stack>
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
