import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert, Chip, Container, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import { TournamentProvider, useTournament } from '@/contexts/TournamentContext';
import type { AuditLog } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';

function AuditLogsContent() {
  const { tournament, repo, loading: tournamentLoading } = useTournament();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tournamentLoading || !tournament) return;
    repo<AuditLog>('auditLogs')
      .list()
      .then((items) => {
        setLogs(items.sort((a, b) => b.timestamp - a.timestamp));
        setLoading(false);
      })
      .catch((e) => {
        // Most likely a non-admin viewing this — firestore.rules restricts auditLogs reads
        // to tournament admins.
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
  }, [tournament, tournamentLoading, repo]);

  if (loading) return <Typography color="text.secondary">Loading audit log…</Typography>;
  if (error) return <Alert severity="error">Couldn't load the audit log — you may not have admin access to this tournament. ({error})</Alert>;

  return (
    <Table size="small">
      <TableHead>
        <TableRow><TableCell>When</TableCell><TableCell>Action</TableCell><TableCell>By</TableCell><TableCell>Target</TableCell></TableRow>
      </TableHead>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.id}>
            <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
            <TableCell><Chip size="small" label={log.actionType.replaceAll('_', ' ')} /></TableCell>
            <TableCell>{log.performedByEmail ?? log.performedByUserId}</TableCell>
            <TableCell>{log.targetType}: {log.targetId}</TableCell>
          </TableRow>
        ))}
        {logs.length === 0 && <TableRow><TableCell colSpan={4}><Typography color="text.secondary">No activity recorded yet.</Typography></TableCell></TableRow>}
      </TableBody>
    </Table>
  );
}

export default function AuditLogs() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  if (!tournamentId) return <Alert severity="error">Missing tournament id</Alert>;
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <PageHeader title="Audit Log" subtitle="Every notable action taken on this tournament, self-attributed and immutable." />
      <TournamentProvider tournamentId={tournamentId}>
        <AuditLogsContent />
      </TournamentProvider>
    </Container>
  );
}
