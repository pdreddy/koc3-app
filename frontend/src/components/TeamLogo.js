import React, { useState } from 'react';
import { getTeamLogoUrl } from '../utils/teamLogos';

/**
 * Unified team logo component.
 * Priority: team.logoUrl (Firebase) → static SVG → initials fallback.
 * Props:
 *   team       – team object with { abbreviation, name, logoUrl? }
 *   abbreviation – shortcut when no team object
 *   name       – display name for alt text
 *   size       – diameter in px (default 48)
 *   style      – extra inline styles on the img/div
 */
export default function TeamLogo({ team, abbreviation, name, size = 48, style = {} }) {
  const abbr = team?.abbreviation || abbreviation || '';
  const displayName = team?.name || name || abbr || '?';
  const [imgError, setImgError] = useState(false);

  const url = (!imgError && (team?.logoUrl || getTeamLogoUrl(abbr))) || null;

  const base = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    ...style,
  };

  if (url) {
    return (
      <img
        src={url}
        alt={displayName}
        width={size}
        height={size}
        style={{ ...base, objectFit: 'contain', background: 'rgba(0,0,0,0.2)' }}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div style={{
      ...base,
      background: 'rgba(255,255,255,0.15)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 900,
      fontSize: Math.round(size * 0.34),
      color: '#fff',
      letterSpacing: '-1px',
    }}>
      {abbr || displayName[0]}
    </div>
  );
}
