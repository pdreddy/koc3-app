import React from 'react';

function initials(name = '', abbr = '') {
  if (abbr) return abbr.slice(0, 3).toUpperCase();
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'KOC';
}

export default function TeamShield({ team, size = 'md' }) {
  const gradClass = `team-grad-${team?.gradient || 1}`;
  return (
    <span className={`team-shield ${gradClass} ${size}`} aria-label={`${team?.name || 'Team'} logo`} role="img">
      <span className="shield-crown">♛</span>
      <span className="shield-ball">●</span>
      <span className="shield-racquets">╳</span>
      <strong>{initials(team?.name, team?.abbreviation)}</strong>
    </span>
  );
}
