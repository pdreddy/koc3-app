import { useEffect, useState } from 'react';
import {
  Box, Button, Card, CardActions, CardContent, Chip, Container, Grid, IconButton,
  Stack, Typography, Menu, MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useNavigate } from 'react-router-dom';
import { TournamentService } from '@/services/TournamentService';
import type { Tournament } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

const STATUS_COLOR: Record<Tournament['status'], 'default' | 'success' | 'warning'> = {
  DRAFT: 'default',
  PUBLISHED: 'success',
  ARCHIVED: 'warning',
};

function TournamentCard({ tournament, onChanged }: { tournament: Tournament; onChanged: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const actorId = user?.uid || 'unknown';

  const closeMenu = () => setAnchorEl(null);

  const handlePublish = async () => { await TournamentService.publish(tournament.id, actorId); closeMenu(); onChanged(); };
  const handleArchive = async () => { await TournamentService.archive(tournament.id, actorId); closeMenu(); onChanged(); };
  const handleDuplicate = async () => { await TournamentService.duplicate(tournament.id, actorId); closeMenu(); onChanged(); };
  const handleDelete = async () => {
    closeMenu();
    if (!window.confirm(`Delete "${tournament.config.info.name}"? This only removes the tournament record — team/player/match data must be cleaned up separately.`)) return;
    await TournamentService.deleteTournamentDocOnly(tournament.id);
    onChanged();
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h6">{tournament.config.info.name || '(untitled)'}</Typography>
            <Typography variant="body2" color="text.secondary">/t/{tournament.slug}</Typography>
          </Box>
          <Chip size="small" label={tournament.status} color={STATUS_COLOR[tournament.status]} />
        </Stack>
        <Typography variant="body2" sx={{ mt: 1 }}>
          {tournament.config.structure.teamCount} teams · {tournament.config.structure.groupCount} groups · {tournament.config.type.replaceAll('_', ' ')}
        </Typography>
      </CardContent>
      <CardActions sx={{ justifyContent: 'space-between' }}>
        <Button size="small" onClick={() => navigate(`/admin/tournaments/${tournament.id}`)}>Open</Button>
        <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)} aria-label="more actions">
          <MoreVertIcon fontSize="small" />
        </IconButton>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={closeMenu}>
          <MenuItem onClick={() => { closeMenu(); navigate(`/admin/tournaments/${tournament.id}/edit`); }}>Edit</MenuItem>
          <MenuItem onClick={handleDuplicate}>Duplicate</MenuItem>
          {tournament.status !== 'PUBLISHED' && <MenuItem onClick={handlePublish}>Publish</MenuItem>}
          {tournament.status !== 'ARCHIVED' && <MenuItem onClick={handleArchive}>Archive</MenuItem>}
          <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>Delete</MenuItem>
        </Menu>
      </CardActions>
    </Card>
  );
}

export default function TournamentManager() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const reload = async () => {
    setLoading(true);
    setTournaments(await TournamentService.list());
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, []);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4">Tournament Manager</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/admin/tournaments/new')}>
          Create Tournament
        </Button>
      </Stack>

      {loading && <Typography color="text.secondary">Loading tournaments…</Typography>}
      {!loading && tournaments.length === 0 && (
        <Typography color="text.secondary">No tournaments yet — create your first one.</Typography>
      )}

      <Grid container spacing={2}>
        {tournaments.map((t) => (
          <Grid item xs={12} sm={6} md={4} key={t.id}>
            <TournamentCard tournament={t} onChanged={reload} />
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
