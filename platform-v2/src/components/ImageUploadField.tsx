import { useRef, useState } from 'react';
import { Avatar, Button, Stack, TextField, Typography } from '@mui/material';
import UploadIcon from '@mui/icons-material/Upload';
import { uploadTournamentImage } from '@/services/storageService';

/**
 * A TextField (still pasteable, for anyone who already has a hosted URL) plus an upload
 * button that pushes a file to Firebase Storage and fills the field with the resulting
 * download URL — every branding/sponsor/gallery field already expects a plain URL string,
 * so this is a drop-in upgrade rather than a schema change.
 */
export function ImageUploadField({
  label, value, onChange, tournamentId, storagePath,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  tournamentId: string;
  storagePath: string; // e.g. "branding/logo" or `gallery/${crypto.randomUUID()}`
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const url = await uploadTournamentImage(tournamentId, storagePath, file);
      onChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Stack spacing={0.5}>
      <Stack direction="row" spacing={1} alignItems="center">
        <TextField fullWidth size="small" label={label} value={value} onChange={(e) => onChange(e.target.value)} />
        {value && <Avatar src={value} variant="rounded" />}
        <Button
          size="small" variant="outlined" component="label" startIcon={<UploadIcon />} disabled={uploading}
        >
          {uploading ? 'Uploading…' : 'Upload'}
          <input
            ref={inputRef} type="file" accept="image/*" hidden
            onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); e.target.value = ''; }}
          />
        </Button>
      </Stack>
      {error && <Typography variant="caption" color="error">{error}</Typography>}
    </Stack>
  );
}
