// Lightweight, dependency-free exporters: results/standings → CSV (download),
// and rules/standings → PDF via the browser print dialog (Save as PDF). No new
// libraries, keeps the bundle small and works offline.

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function csvCell(value) {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers, rows) {
  const lines = [headers.map(csvCell).join(',')];
  rows.forEach(row => lines.push(row.map(csvCell).join(',')));
  return lines.join('\n');
}

export function exportCsv(filename, headers, rows) {
  downloadBlob(toCsv(headers, rows), filename, 'text/csv;charset=utf-8;');
}

// Build a CSV from standings group rows (as produced by Standings.statsForGroup).
export function standingsToCsv(groups) {
  const headers = ['Group', 'Rank', 'Team', 'Abbr', 'M', 'W', 'L', 'SetsFor', 'SetsAgainst', 'SinglesWins', 'GameDiff', 'Points'];
  const rows = [];
  groups.forEach(g => {
    g.rows.forEach((r, i) => {
      rows.push([g.id, i + 1, r.team, r.abbr, r.matches, r.wins, r.losses, r.setsFor, r.setsAgainst, r.singlesWins, r.gameDiff, r.points]);
    });
  });
  return { headers, rows };
}

// Print a DOM node to PDF using a temporary print window. Used for rules and
// standings "Export PDF" buttons.
export function printElementAsPdf(title, html) {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    alert('Pop-up blocked. Allow pop-ups to export PDF.');
    return;
  }
  win.document.write(`<!doctype html><html><head><title>${title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; padding: 24px; }
      h1 { font-size: 20px; } h2 { font-size: 15px; margin-top: 16px; }
      table { border-collapse: collapse; width: 100%; margin-top: 8px; font-size: 12px; }
      th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; }
      .muted { color: #64748b; font-size: 11px; }
    </style></head><body>${html}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 250);
}
