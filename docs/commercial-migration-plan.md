# Commercial migration plan

## Target data model

Move season data from fixed `koc_s3/*` paths to tenant-scoped paths:

```text
clubs/{clubId}/seasons/{seasonId}/teams
clubs/{clubId}/seasons/{seasonId}/matches
clubs/{clubId}/seasons/{seasonId}/schedule
clubs/{clubId}/seasons/{seasonId}/standings
clubs/{clubId}/seasons/{seasonId}/playerHistory
clubs/{clubId}/members
clubs/{clubId}/playerProfiles
clubs/{clubId}/adminUsers
clubs/{clubId}/branding
```

## Migration steps

1. Freeze score entry for the legacy season.
2. Export `koc_s3/*` paths from Firebase.
3. Create `clubs/koc/seasons/koc_s3/*` target paths.
4. Copy season records: teams, matches, schedule, standings, ratings, histories, eligibility, reports, and audit logs.
5. Copy club records: admin config, admin users, members, profiles, branding, sponsors.
6. Backfill `clubId` and `seasonId` on every copied season record.
7. Run count/checksum verification for every source/target path.
8. Switch frontend `PATHS` to `buildTenantPaths({ clubId, seasonId })`.
9. Keep legacy paths read-only for rollback until the season is signed off.

## Firebase security rules requirements

- Users can only read/write clubs where they have a membership or admin role.
- Season writes require season-level permission.
- Captains can enter scores only for their own team.
- Finance admins can manage payments but not scores.
- Facility managers can manage courts/bookings but not billing.
- Platform owners can manage all clubs.
