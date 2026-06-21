const canonicalTeams = [
  { id: 1, name: 'Rally Royals 👑', abbreviation: 'RR', captain: 'Yogesh Dhadge', roster: ['Srinivaasan Arumugam Sampath', 'Charan Macharla', 'Kalam Shaik', 'Sandeep Gengineri', 'Chandrakant Dharme', 'Vasu Gandhi'] },
  { id: 2, name: "Karna's Crusaders ⚔️", abbreviation: 'KC', captain: 'Srikant Tenni', roster: ['Vibhor Sharma', 'Malla Cheerke', 'Anshul Goyal', 'Srinidhi Kulkarni', 'Lloyd Kumar', 'Dinkar Bhardwaj'] },
  { id: 3, name: 'Spin Kings 🎾👑', abbreviation: 'SK', captain: 'Uma Vommi', roster: ['Madhu', 'Noufal Mohamed', 'Kanak Periasamy', 'Fayaz', 'KP Krishna', 'Rajasekhar Mangalampally'] },
  { id: 4, name: 'KOC Challengers 🏆', abbreviation: 'KOCC', captain: 'Narayan Prasad', roster: ['Nivas Nazeer', 'Ravi Sengodan', 'Damu Palavali', 'Sarat Edara', 'Vidya Sagar Reddy', 'Sudhakar Nallapati'] },
  { id: 5, name: 'Rally Squad 🎾', abbreviation: 'RS', captain: 'Ritesh Kumar', roster: ['Manish Jangid', 'Srinivas Y', 'Trinadh Cheepilla', 'Biju Koshy', 'Jitender Kumar', 'Dinesh Timmareddy'] },
  { id: 6, name: 'POSH 😎', abbreviation: 'POSH', captain: 'Vinod Aripaka', roster: ['Gopi Guru', 'Venu Servepalli', 'Nazeer Mohammed', 'Naveenkumar Mohanram', 'Nizam Karimudeen', 'Ratnesh Sinha'] },
  { id: 7, name: 'Chill Titans ❄️⚔️', abbreviation: 'CT', captain: 'Satish Reddy Orugunta', roster: ['Gokul R', 'Prashanth Tiramareddi', 'Jaweed', 'Ram Kantheti', 'Durga', 'Hari Mothukuri'] },
  { id: 8, name: 'Mega Lions 🦁', abbreviation: 'ML', captain: 'Anil Kunda', roster: ['Mirza H', 'Raj Chejerla', 'Mohan Koripuri', 'Venky Dh', 'Rajasekhar Karru', 'Nagarjuna Saladi'] },
  { id: 9, name: 'Court Conquerors 🏹', abbreviation: 'CC', captain: 'Rajasekhar Chintha', roster: ['Venis V', 'Jilani Pathan', 'Bhaskar Boddireddy', 'Ali Mohamed', 'Sridhar K', 'Krishna Vennapusa'] },
  { id: 10, name: 'Royal Chill Badgers 🦡', abbreviation: 'RCB', captain: 'Janaki Ram Kantheti' },
  { id: 11, name: 'Volly Vipers 🐍', abbreviation: 'VV', captain: 'Kailas Magi' },
  { id: 12, name: 'Dallas Chargers ⚡', abbreviation: 'DC', captain: 'Vivekvardhan Reddy Mereddy' },
  { id: 13, name: 'Baseline Bashers 🏛️⚔️', abbreviation: 'BB', captain: 'Sashank T' },
  { id: 14, name: 'Deuce Devils 😈', abbreviation: 'DD', captain: 'Hari Mothukuri' },
  { id: 15, name: 'Chill Super Kings 👑❄️', abbreviation: 'CSK', captain: 'Anand Krishnamurthy' },
  { id: 16, name: 'Court Masters', abbreviation: 'CM', captain: 'Dinesh Reddy Timmareddy' }
];

function placeholderRoster() {
  return Array.from({ length: 6 }, (_, i) => ({ name: `Player ${i + 2}`, isCaptain: false, utr: '' }));
}

export function teamIdFromNumber(id) {
  return `team${id}`;
}

export function buildInitialTeams() {
  const teams = {};
  canonicalTeams.forEach((t, idx) => {
    const id = teamIdFromNumber(t.id);
    teams[id] = {
      id,
      name: t.name,
      abbreviation: t.abbreviation,
      password: `KOC${t.abbreviation}#3`,
      gradient: idx + 1,
      group: idx < 8 ? 'A' : 'B',
      players: [
        { name: t.captain, isCaptain: true, utr: '' },
        ...(t.roster ? t.roster.map(n => ({ name: n, isCaptain: false, utr: '' })) : placeholderRoster())
      ]
    };
  });
  return teams;
}

function canonicalPlayersForExistingTeam(team, t) {
  const existing = Array.isArray(team.players) ? team.players : [];
  const desiredCaptainName = t.captain;
  const existingCaptain = existing.find(player => player?.name === desiredCaptainName) || existing.find(player => player?.isCaptain) || {};
  const fallbackRoster = t.roster ? t.roster.map(name => ({ name, isCaptain: false, utr: '' })) : placeholderRoster();
  const rest = (existing.length > 0 ? existing : fallbackRoster)
    .filter(player => (player?.name || '') !== desiredCaptainName)
    .map(player => ({ ...player, isCaptain: false }));
  return [
    { ...existingCaptain, name: desiredCaptainName, isCaptain: true },
    ...rest
  ];
}

function playersChanged(currentPlayers, nextPlayers) {
  if (!Array.isArray(currentPlayers) || currentPlayers.length !== nextPlayers.length) return true;
  return nextPlayers.some((next, idx) => {
    const current = currentPlayers[idx] || {};
    return current.name !== next.name || !!current.isCaptain !== !!next.isCaptain;
  });
}

export function canonicalTeamIdentityUpdates(teamsData = {}) {
  return canonicalTeams.reduce((updates, t, idx) => {
    const id = teamIdFromNumber(t.id);
    const team = teamsData[id] || {};
    const nextPlayers = canonicalPlayersForExistingTeam(team, t);

    if (team.name !== t.name) updates[`${id}/name`] = t.name;
    if (team.abbreviation !== t.abbreviation) updates[`${id}/abbreviation`] = t.abbreviation;
    if (team.gradient !== idx + 1) updates[`${id}/gradient`] = idx + 1;
    if ((team.group || (idx < 8 ? 'A' : 'B')) !== (idx < 8 ? 'A' : 'B')) updates[`${id}/group`] = idx < 8 ? 'A' : 'B';
    if (!team.password) updates[`${id}/password`] = `KOC${t.abbreviation}#3`;
    if (!team.id) updates[`${id}/id`] = id;
    if (playersChanged(team.players, nextPlayers)) updates[`${id}/players`] = nextPlayers;
    return updates;
  }, {});
}

export const DEFAULT_ADMIN_PASSWORD = 'KOCPO#ADMIN';
