import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Container, MenuItem, Select, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, Typography,
} from '@mui/material';
import { TournamentProvider, useTournament } from '@/contexts/TournamentContext';
import type { Player, PlayerImportRow } from '@/types';
import {
  detectDuplicates, guessColumnMapping, mapRowToPlayer, parseCsv, parseJson,
} from '@/services/rosterImport';
import { PageHeader } from '@/components/layout/PageHeader';

const PLAYER_FIELD_OPTIONS: { value: keyof Player | ''; label: string }[] = [
  { value: '', label: '(ignore this column)' },
  { value: 'firstName', label: 'First Name' },
  { value: 'lastName', label: 'Last Name' },
  { value: 'displayName', label: 'Display Name' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'gender', label: 'Gender' },
  { value: 'age', label: 'Age' },
  { value: 'utrRating', label: 'UTR' },
  { value: 'ntrpRating', label: 'NTRP' },
  { value: 'usta', label: 'USTA' },
  { value: 'city', label: 'City' },
  { value: 'availability', label: 'Availability' },
  { value: 'preferredPosition', label: 'Preferred Position' },
  { value: 'handedness', label: 'Handedness' },
  { value: 'captainEligible', label: 'Captain Eligible' },
  { value: 'notes', label: 'Notes' },
];

function RosterImportContent() {
  const { repo } = useTournament();
  const navigate = useNavigate();
  const { tournamentId } = useParams<{ tournamentId: string }>();

  const [rawRows, setRawRows] = useState<PlayerImportRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, keyof Player | null>>({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);

  const handleFile = async (file: File) => {
    const text = await file.text();
    const parsed = file.name.toLowerCase().endsWith('.json') ? parseJson(text) : parseCsv(text);
    setRawRows(parsed.rows);
    setParseErrors(parsed.errors);
    setImportResult(null);
    if (parsed.rows.length > 0) setMapping(guessColumnMapping(Object.keys(parsed.rows[0])));
  };

  const mappedPlayers = useMemo(
    () => rawRows.map((row) => mapRowToPlayer(row, mapping, Date.now())),
    [rawRows, mapping]
  );
  const { unique, duplicateGroups } = useMemo(() => detectDuplicates(mappedPlayers), [mappedPlayers]);

  const headers = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];

  const handleImport = async () => {
    setImporting(true);
    const toImport = includeDuplicates ? mappedPlayers : [...unique, ...duplicateGroups.map((g) => g.players[0])];
    const playerRepo = repo<Player>('players');
    await Promise.all(toImport.map((p) => playerRepo.create(p)));
    setImporting(false);
    setImportResult(`Imported ${toImport.length} player${toImport.length === 1 ? '' : 's'}.`);
  };

  return (
    <Stack spacing={3}>
      <PageHeader title="Import Players" subtitle="Upload a CSV or JSON roster, map columns, and check for duplicates." />
      <Button variant="outlined" component="label">
        Upload CSV or JSON
        <input type="file" hidden accept=".csv,.json" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </Button>

      {parseErrors.length > 0 && (
        <Alert severity="warning">{parseErrors.join('; ')}</Alert>
      )}

      {headers.length > 0 && (
        <>
          <Typography variant="h6">Column Mapping</Typography>
          <Table size="small">
            <TableHead>
              <TableRow><TableCell>Column</TableCell><TableCell>Maps to</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {headers.map((header) => (
                <TableRow key={header}>
                  <TableCell>{header}</TableCell>
                  <TableCell>
                    <Select
                      size="small"
                      fullWidth
                      value={mapping[header] ?? ''}
                      onChange={(e) => setMapping((m) => ({ ...m, [header]: (e.target.value || null) as keyof Player | null }))}
                    >
                      {PLAYER_FIELD_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value || 'ignore'} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Typography variant="h6">Preview ({mappedPlayers.length} rows)</Typography>
          <Table size="small">
            <TableHead>
              <TableRow><TableCell>Name</TableCell><TableCell>Email</TableCell><TableCell>Phone</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {mappedPlayers.slice(0, 10).map((p, i) => (
                <TableRow key={i}>
                  <TableCell>{p.displayName}</TableCell>
                  <TableCell>{p.email ?? '—'}</TableCell>
                  <TableCell>{p.phone ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {mappedPlayers.length > 10 && <Typography variant="body2" color="text.secondary">…and {mappedPlayers.length - 10} more.</Typography>}

          {duplicateGroups.length > 0 && (
            <Alert severity="warning">
              Found {duplicateGroups.length} possible duplicate{duplicateGroups.length === 1 ? '' : 's'} (matched by email, phone, or exact name).
              By default only the first entry in each group is imported.
              <Box sx={{ mt: 1 }}>
                <Button size="small" onClick={() => setIncludeDuplicates((v) => !v)}>
                  {includeDuplicates ? 'Exclude duplicates' : 'Import duplicates as separate players'}
                </Button>
              </Box>
            </Alert>
          )}

          {importResult && <Alert severity="success">{importResult}</Alert>}

          <Stack direction="row" spacing={2}>
            <Button variant="contained" disabled={importing || mappedPlayers.length === 0} onClick={handleImport}>
              {importing ? 'Importing…' : `Import ${includeDuplicates ? mappedPlayers.length : unique.length + duplicateGroups.length} Players`}
            </Button>
            {importResult && (
              <Button onClick={() => navigate(`/admin/tournaments/${tournamentId}/generate-teams`)}>
                Continue to Generate Teams →
              </Button>
            )}
          </Stack>
        </>
      )}
    </Stack>
  );
}

export default function RosterImport() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  if (!tournamentId) return <Alert severity="error">Missing tournament id</Alert>;
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <TournamentProvider tournamentId={tournamentId}>
        <RosterImportContent />
      </TournamentProvider>
    </Container>
  );
}
