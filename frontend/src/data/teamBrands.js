const TEAM_BRANDS = {
  team1: { slug: 'rudra-racquets', mark: 'R', icon: 'racquet', primary: '#ef1b25', secondary: '#7f0000', accent: '#ffcf33', name: 'Rudra Racquets' },
  team2: { slug: 'karnas-crusaders', mark: 'K', icon: 'knight', primary: '#dc2626', secondary: '#111827', accent: '#f97316', name: "Karna's Crusaders" },
  team3: { slug: 'spin-kings', mark: 'SK', icon: 'crown-ball', primary: '#84cc16', secondary: '#1f2937', accent: '#facc15', name: 'Spin Kings' },
  team4: { slug: 'koc-challengers', mark: 'KOC', icon: 'shield', primary: '#0ea5e9', secondary: '#0f172a', accent: '#93c5fd', name: 'KOC Challengers' },
  team5: { slug: 'rally-squad', mark: 'RS', icon: 'rally', primary: '#f59e0b', secondary: '#111827', accent: '#fb923c', name: 'Rally Squad' },
  team6: { slug: 'posh', mark: 'POSH', icon: 'crown-word', primary: '#db2777', secondary: '#831843', accent: '#f9a8d4', name: 'POSH' },
  team7: { slug: 'chill-titans', mark: 'CT', icon: 'helmet', primary: '#06b6d4', secondary: '#0f172a', accent: '#67e8f9', name: 'Chill Titans' },
  team8: { slug: 'mega-lions', mark: 'ML', icon: 'lion', primary: '#facc15', secondary: '#111827', accent: '#f97316', name: 'Mega Lions' },
  team9: { slug: 'court-conquerors', mark: 'CC', icon: 'ball-shield', primary: '#38bdf8', secondary: '#0f172a', accent: '#e0f2fe', name: 'Court Conquerors' },
  team10: { slug: 'royal-chill-badgers', mark: 'RCB', icon: 'badger', primary: '#e5e7eb', secondary: '#111827', accent: '#14b8a6', name: 'Royal Chill Badgers' },
  team11: { slug: 'volly-vipers', mark: 'VV', icon: 'viper', primary: '#65a30d', secondary: '#0f172a', accent: '#22c55e', name: 'Volley Vipers' },
  team12: { slug: 'dallas-chargers', mark: 'DC', icon: 'bolt', primary: '#f59e0b', secondary: '#075985', accent: '#38bdf8', name: 'Dallas Chargers' },
  team13: { slug: 'baseline-bashers', mark: 'BB', icon: 'burst-ball', primary: '#a855f7', secondary: '#0f172a', accent: '#f0abfc', name: 'Baseline Bashers' },
  team14: { slug: 'deuce-devils', mark: 'DD', icon: 'devil', primary: '#ef4444', secondary: '#111827', accent: '#f97316', name: 'Deuce Devils' },
  team15: { slug: 'chill-super-kings', mark: 'CSK', icon: 'lion-crown', primary: '#eab308', secondary: '#111827', accent: '#fde68a', name: 'Chill Super Kings' },
  team16: { slug: 'court-masters', mark: 'CM', icon: 'master', primary: '#2563eb', secondary: '#0f172a', accent: '#93c5fd', name: 'Court Masters' }
};

export function getTeamBrand(team = {}) {
  return TEAM_BRANDS[team.id] || Object.values(TEAM_BRANDS).find(brand => brand.mark === team.abbreviation) || {
    slug: 'koc-team',
    mark: team.abbreviation || 'KOC',
    icon: 'ball-shield',
    primary: '#2563eb',
    secondary: '#0f172a',
    accent: '#facc15',
    name: team.name || 'KOC Team'
  };
}

export default TEAM_BRANDS;
