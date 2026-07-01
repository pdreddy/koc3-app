// WhatsApp share links — ported from koc3-app's "share result on WhatsApp" flow. wa.me
// with a `text` query param opens WhatsApp (app or web) with the message pre-filled; no
// API key or backend needed, just URL-encoding.
function toWhatsAppUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function buildWhatsAppShareUrl(payload: {
  team1Name: string;
  team2Name: string;
  lines: { label: string; team1Players: string[]; team2Players: string[] }[];
}): string {
  const lines = payload.lines
    .map((l) => `${l.label}: ${l.team1Players.join(' / ') || 'TBD'} vs ${l.team2Players.join(' / ') || 'TBD'}`)
    .join('\n');
  return toWhatsAppUrl(`*${payload.team1Name} vs ${payload.team2Name}*\nLineups revealed:\n${lines}`);
}

export function buildScoreShareUrl(payload: {
  team1Name: string;
  team2Name: string;
  winnerName: string | null;
  lines: { label: string; team1Players: string[]; team2Players: string[]; scoreLabel: string }[];
}): string {
  const lines = payload.lines
    .map((l) => `${l.label}: ${l.team1Players.join('/')} vs ${l.team2Players.join('/')} — ${l.scoreLabel}`)
    .join('\n');
  const winnerLine = payload.winnerName ? `\n🏆 ${payload.winnerName} won` : '';
  return toWhatsAppUrl(`*${payload.team1Name} vs ${payload.team2Name}*${winnerLine}\n\n${lines}`);
}
