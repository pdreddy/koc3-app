import React from 'react';
import { getTeamBrand } from '../data/teamBrands';

function LogoGlyph({ icon, mark }) {
  switch (icon) {
    case 'racquet':
      return <><path className="team-logo-stroke" d="M56 18c12 10 12 28 0 40s-30 12-40 0-12-30 0-40 30-12 40 0Z" /><path className="team-logo-stroke thin" d="M25 25l30 30M55 25L25 55M48 60l16 16" /><text x="40" y="49">{mark}</text></>;
    case 'knight':
      return <><path d="M24 68c4-20 16-36 34-42-2 12 6 15 11 24-12-2-21 2-28 12l17 6H24Z" /><text x="41" y="55">{mark}</text></>;
    case 'crown-ball':
      return <><path d="M17 31l12 9 11-18 11 18 12-9-4 27H21l-4-27Z" /><circle className="team-logo-ball" cx="40" cy="55" r="13" /><text x="40" y="48">{mark}</text></>;
    case 'shield':
      return <><path d="M40 10l28 10v22c0 18-11 29-28 38-17-9-28-20-28-38V20l28-10Z" /><text x="40" y="48">{mark}</text></>;
    case 'rally':
      return <><path d="M13 59c18-22 33-25 53-23-13 5-19 14-26 30l-8-11-19 4Z" /><circle cx="58" cy="24" r="6" /><text x="40" y="54">{mark}</text></>;
    case 'crown-word':
      return <><path d="M22 26l10 7 8-14 8 14 10-7-3 20H25l-3-20Z" /><text className="team-logo-word" x="40" y="61">{mark}</text></>;
    case 'helmet':
      return <><path d="M19 62c3-24 19-39 43-43v43H49l-7-13-11 13H19Z" /><path className="team-logo-stroke thin" d="M40 22v40M50 25v16" /><text x="40" y="55">{mark}</text></>;
    case 'lion':
    case 'lion-crown':
      return <><path d="M40 17l8 10 13-2-3 13 9 9-13 4-4 13-10-8-10 8-4-13-13-4 9-9-3-13 13 2 8-10Z" />{icon === 'lion-crown' && <path d="M25 18l9 6 6-12 6 12 9-6-3 14H28l-3-14Z" />}<text x="40" y="51">{mark}</text></>;
    case 'ball-shield':
      return <><path d="M40 11l26 10v20c0 16-10 27-26 35-16-8-26-19-26-35V21l26-10Z" /><circle className="team-logo-ball" cx="40" cy="42" r="14" /><text x="40" y="65">{mark}</text></>;
    case 'badger':
      return <><path d="M17 54c6-20 18-31 23-31s17 11 23 31c-8 12-38 12-46 0Z" /><path className="team-logo-cut" d="M33 25l7 31 7-31c-4-4-10-4-14 0Z" /><text x="40" y="66">{mark}</text></>;
    case 'viper':
      return <><path d="M19 59c11-31 40-38 44-15 2 12-10 15-20 11 10-3 15-9 8-15-10-9-23 8-32 19Z" /><text x="40" y="55">{mark}</text></>;
    case 'bolt':
      return <><path d="M48 8L17 47h20l-5 25 31-40H43l5-24Z" /><text x="40" y="64">{mark}</text></>;
    case 'burst-ball':
      return <><path d="M40 8l5 18 16-10-10 16 18 5-18 5 10 16-16-10-5 18-5-18-16 10 10-16-18-5 18-5-10-16 16 10 5-18Z" /><circle className="team-logo-ball" cx="40" cy="40" r="12" /><text x="40" y="66">{mark}</text></>;
    case 'devil':
      return <><path d="M20 24l13 9c5-3 9-3 14 0l13-9-5 20c2 18-28 25-30 0l-5-20Z" /><text x="40" y="55">{mark}</text></>;
    case 'master':
      return <><path d="M40 12c15 0 27 12 27 27 0 11-7 21-17 25l-10 8-10-8c-10-4-17-14-17-25 0-15 12-27 27-27Z" /><path className="team-logo-stroke thin" d="M26 50c8-10 20-10 28 0" /><text x="40" y="42">{mark}</text></>;
    default:
      return <><circle className="team-logo-ball" cx="40" cy="40" r="24" /><text x="40" y="47">{mark}</text></>;
  }
}

export default function TeamLogo({ team, size = 'md', showName = false, className = '' }) {
  const brand = getTeamBrand(team);
  const label = `${team?.name || brand.name} logo`;
  return (
    <span
      className={`team-logo team-logo-${size} ${className}`.trim()}
      style={{ '--team-logo-primary': brand.primary, '--team-logo-secondary': brand.secondary, '--team-logo-accent': brand.accent }}
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 80 80" role="img" focusable="false" aria-hidden="true">
        <defs>
          <linearGradient id={`teamLogoGrad-${brand.slug}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="var(--team-logo-accent)" />
            <stop offset=".48" stopColor="var(--team-logo-primary)" />
            <stop offset="1" stopColor="var(--team-logo-secondary)" />
          </linearGradient>
        </defs>
        <circle className="team-logo-glow" cx="40" cy="40" r="36" />
        <LogoGlyph icon={brand.icon} mark={brand.mark} />
      </svg>
      {showName && <span className="team-logo-name">{team?.name || brand.name}</span>}
    </span>
  );
}
