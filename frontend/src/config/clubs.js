// Club (tenant) registry. Each club owns an isolated Firebase RTDB "dataRoot" —
// KOC's dataRoot is the existing `koc_s3` tree, so onboarding the registry does
// not move or touch any existing data.
export const DEFAULT_CLUB_ID = 'koc';

export const CLUBS = {
  koc: {
    id: 'koc',
    name: 'KOC3 / PPRC Tennis League',
    shortName: 'KOC3',
    dataRoot: 'koc_s3',
    status: 'active',
    branding: {
      logoUrl: '/logos/koc-logo.svg',
      tagline: 'Tennis League',
      themeColor: '#2563eb',
      documentTitle: 'KOC3 / PPRC Tennis',
    },
  },
};

export function getClub(clubId = DEFAULT_CLUB_ID) {
  return CLUBS[clubId] || CLUBS[DEFAULT_CLUB_ID];
}
