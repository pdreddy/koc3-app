// Single source of truth for the top-level Firestore collection name. Firestore document
// references must alternate collection/document/collection/document — there is no way to
// nest a collection directly under another collection (e.g. a "platform" namespace prefix
// in front of "tournaments") without an intervening document, so tournaments live directly
// at the top level: tournaments/{tournamentId}/{subcollection}/{docId}. Isolation between
// tournaments comes from each one being its own document with its own subcollections, not
// from a namespace prefix.
export const TOURNAMENTS_COLLECTION = 'tournaments';

// Every subcollection a tournament document can have. Shared between TournamentRepository
// (constrains what tournamentRepository() will construct) and TournamentContext (constrains
// what repo() will construct) so the two can't drift apart.
export type TournamentSubcollection =
  | 'teams' | 'players' | 'matches' | 'schedules' | 'standings' | 'permissions' | 'invites'
  | 'lineups' | 'auditLogs' | 'announcements' | 'sponsors' | 'gallery' | 'playoffMatches'
  | 'notifications';
