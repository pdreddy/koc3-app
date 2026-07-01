import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert, Button, Card, CardContent, Container, IconButton, MenuItem, Select, Stack, Tab,
  Tabs, TextField, Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { TournamentProvider, useTournament } from '@/contexts/TournamentContext';
import { useAuth } from '@/contexts/AuthContext';
import type { Announcement, GalleryImage, Sponsor } from '@/types';
import { notify } from '@/services/notificationService';

function AnnouncementsTab() {
  const { tournament, repo } = useTournament();
  const { user } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => { repo<Announcement>('announcements').list().then((a) => setItems(a.sort((x, y) => y.publishedAt - x.publishedAt))); }, [repo]);

  const handleAdd = async () => {
    if (!title.trim()) return;
    const created = await repo<Announcement>('announcements').create({ title, body, publishedAt: Date.now(), createdBy: user?.uid ?? 'unknown' });
    setItems((prev) => [created, ...prev]);
    if (user && tournament) {
      await notify(repo, 'ALL', 'ANNOUNCEMENT', title, body.slice(0, 140), `/t/${tournament.slug}/announcements`, user.uid);
    }
    setTitle(''); setBody('');
  };

  const handleDelete = async (id: string) => {
    await repo<Announcement>('announcements').remove(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <Stack spacing={2}>
      <Stack spacing={1}>
        <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextField label="Body" multiline minRows={2} value={body} onChange={(e) => setBody(e.target.value)} />
        <Button variant="outlined" onClick={handleAdd} disabled={!title.trim()} sx={{ alignSelf: 'flex-start' }}>Post Announcement</Button>
      </Stack>
      {items.map((a) => (
        <Card key={a.id} variant="outlined">
          <CardContent>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="subtitle1">{a.title}</Typography>
              <IconButton size="small" onClick={() => handleDelete(a.id)}><DeleteIcon fontSize="small" /></IconButton>
            </Stack>
            <Typography variant="body2" color="text.secondary">{new Date(a.publishedAt).toLocaleDateString()}</Typography>
            <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>{a.body}</Typography>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

function SponsorsTab() {
  const { repo } = useTournament();
  const [items, setItems] = useState<Sponsor[]>([]);
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [website, setWebsite] = useState('');
  const [tier, setTier] = useState<Sponsor['tier']>('PARTNER');

  useEffect(() => { repo<Sponsor>('sponsors').list().then(setItems); }, [repo]);

  const handleAdd = async () => {
    if (!name.trim() || !logoUrl.trim()) return;
    const created = await repo<Sponsor>('sponsors').create({ name, logoUrl, website: website || null, tier, createdAt: Date.now() });
    setItems((prev) => [...prev, created]);
    setName(''); setLogoUrl(''); setWebsite('');
  };

  const handleDelete = async (id: string) => {
    await repo<Sponsor>('sponsors').remove(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Logo URL" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} sx={{ minWidth: 220 }} />
        <TextField label="Website" value={website} onChange={(e) => setWebsite(e.target.value)} />
        <Select value={tier} onChange={(e) => setTier(e.target.value as Sponsor['tier'])}>
          {(['TITLE', 'GOLD', 'SILVER', 'BRONZE', 'PARTNER'] as const).map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </Select>
        <Button variant="outlined" onClick={handleAdd} disabled={!name.trim() || !logoUrl.trim()}>Add Sponsor</Button>
      </Stack>
      {items.map((s) => (
        <Stack key={s.id} direction="row" spacing={2} alignItems="center">
          <Typography sx={{ minWidth: 160 }}>{s.name} ({s.tier})</Typography>
          <IconButton size="small" onClick={() => handleDelete(s.id)}><DeleteIcon fontSize="small" /></IconButton>
        </Stack>
      ))}
    </Stack>
  );
}

function GalleryTab() {
  const { repo } = useTournament();
  const { user } = useAuth();
  const [items, setItems] = useState<GalleryImage[]>([]);
  const [url, setUrl] = useState('');
  const [caption, setCaption] = useState('');

  useEffect(() => { repo<GalleryImage>('gallery').list().then((g) => setItems(g.sort((a, b) => b.uploadedAt - a.uploadedAt))); }, [repo]);

  const handleAdd = async () => {
    if (!url.trim()) return;
    const created = await repo<GalleryImage>('gallery').create({ url, caption: caption || null, uploadedAt: Date.now(), uploadedBy: user?.uid ?? 'unknown' });
    setItems((prev) => [created, ...prev]);
    setUrl(''); setCaption('');
  };

  const handleDelete = async (id: string) => {
    await repo<GalleryImage>('gallery').remove(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <Stack spacing={2}>
      <Alert severity="info">No file upload yet — paste a URL to an already-hosted image (Firebase Storage isn't wired up in this project).</Alert>
      <Stack direction="row" spacing={1}>
        <TextField label="Image URL" value={url} onChange={(e) => setUrl(e.target.value)} sx={{ minWidth: 260 }} />
        <TextField label="Caption" value={caption} onChange={(e) => setCaption(e.target.value)} />
        <Button variant="outlined" onClick={handleAdd} disabled={!url.trim()}>Add Photo</Button>
      </Stack>
      {items.map((g) => (
        <Stack key={g.id} direction="row" spacing={2} alignItems="center">
          <Typography sx={{ minWidth: 260, wordBreak: 'break-all' }}>{g.url}</Typography>
          <Typography color="text.secondary">{g.caption}</Typography>
          <IconButton size="small" onClick={() => handleDelete(g.id)}><DeleteIcon fontSize="small" /></IconButton>
        </Stack>
      ))}
    </Stack>
  );
}

function ContentManagerContent() {
  const [tab, setTab] = useState(0);
  return (
    <Stack spacing={3}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label="Announcements" />
        <Tab label="Sponsors" />
        <Tab label="Gallery" />
      </Tabs>
      {tab === 0 && <AnnouncementsTab />}
      {tab === 1 && <SponsorsTab />}
      {tab === 2 && <GalleryTab />}
    </Stack>
  );
}

export default function ContentManager() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  if (!tournamentId) return <Alert severity="error">Missing tournament id</Alert>;
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>Content</Typography>
      <TournamentProvider tournamentId={tournamentId}>
        <ContentManagerContent />
      </TournamentProvider>
    </Container>
  );
}
