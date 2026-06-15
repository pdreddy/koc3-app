// Initial seed data: 9 real teams + 7 placeholder teams (admin can rename/edit later)
const realTeams = [
  { name: 'Rally Royals', abbreviation: 'RR', captain: 'Yogesh', roster: ['Srinivaasan Arumugam Sampath','Charan Macharla','Kalam Shaik','Sandeep Gengineri','Chandrakant Dharme','Vasu Gandhi'] },
  { name: "Karna's Crusaders", abbreviation: 'KC', captain: 'Srikanth', roster: ['Vibhor Sharma','Malla Cheerke','Anshul Goyal','Srinidhi Kulkarni','Lloyd Kumar','Dinkar Bhardwaj'] },
  { name: 'Spin Kings', abbreviation: 'SK', captain: 'Uma V', roster: ['Madhu','Noufal Mohamed','Kanak Periasamy','Fayaz','KP Krishna','Rajasekhar Mangalampally'] },
  { name: 'KOC Challengers', abbreviation: 'KOCC', captain: 'Narayan Prasad', roster: ['Nivas Nazeer','Ravi Sengodan','Damu Palavali','Sarat Edara','Vidya Sagar Reddy','Sudhakar Nallapati'] },
  { name: 'Rally Squad', abbreviation: 'RS', captain: 'Manish Jangid', roster: ['Srinivas Y','Trinadh Cheepilla','Biju Koshy','Jitender Kumar','Ritesh Kumar','Dinesh Timmareddy'] },
  { name: 'Agni Aces', abbreviation: 'AA', captain: 'Vinod Aripaka', roster: ['Gopi Guru','Venu Servepalli','Nazeer Mohammed','Naveenkumar Mohanram','Nizam Karimudeen','Ratnesh Sinha'] },
  { name: 'Chill Titans', abbreviation: 'CT', captain: 'Satish Orugunta', roster: ['Gokul R','Prashanth Tiramareddi','Jaweed','Ram Kantheti','Durga','Hari Mothukuri'] },
  { name: 'Mega Lions', abbreviation: 'ML', captain: 'Anil Kunda', roster: ['Mirza H','Raj Chejerla','Mohan Koripuri','Venky Dh','Rajasekhar Karru','Nagarjuna Saladi'] },
  { name: 'Court Conquerors', abbreviation: 'CC', captain: 'Rajasekhar Chintha', roster: ['Venis V','Jilani Pathan','Bhaskar Boddireddy','Ali Mohamed','Sridhar K','Krishna Vennapusa'] }
];

const placeholderTeams = [
  { name: 'Team 10', abbreviation: 'T10' },
  { name: 'Team 11', abbreviation: 'T11' },
  { name: 'Team 12', abbreviation: 'T12' },
  { name: 'Team 13', abbreviation: 'T13' },
  { name: 'Team 14', abbreviation: 'T14' },
  { name: 'Team 15', abbreviation: 'T15' },
  { name: 'Team 16', abbreviation: 'T16' }
];

export function buildInitialTeams() {
  const teams = {};
  realTeams.forEach((t, idx) => {
    const id = `team${idx + 1}`;
    teams[id] = {
      id,
      name: t.name,
      abbreviation: t.abbreviation,
      password: `KOC${t.abbreviation}#2`,
      gradient: idx + 1,
      players: [
        { name: t.captain, isCaptain: true },
        ...t.roster.map(n => ({ name: n, isCaptain: false }))
      ]
    };
  });
  placeholderTeams.forEach((t, idx) => {
    const id = `team${idx + 10}`;
    teams[id] = {
      id,
      name: t.name,
      abbreviation: t.abbreviation,
      password: `KOC${t.abbreviation}#2`,
      gradient: idx + 10,
      players: [
        { name: 'Captain', isCaptain: true },
        ...Array.from({ length: 6 }, (_, i) => ({ name: `Player ${i + 2}`, isCaptain: false }))
      ]
    };
  });
  return teams;
}

export const DEFAULT_ADMIN_PASSWORD = 'KOCPO#ADMIN';
