const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const SEASON_ROOT = 'koc_s3';

function lineupByTeam(submission) {
  return Array.isArray(submission?.lineup) ? submission.lineup : [];
}

exports.revealLineupsOnLock = functions.database
  .ref(`/${SEASON_ROOT}/lineupSubmissions/{scheduleId}/{teamId}`)
  .onWrite(async (change, context) => {
    const after = change.after.val();
    const { scheduleId, teamId } = context.params;
    const root = admin.database().ref(SEASON_ROOT);

    if (!after) {
      await root.child(`lineupSubmissionMeta/${scheduleId}/${teamId}`).remove();
      return null;
    }

    const safeMeta = {
      scheduleId,
      teamId,
      opponentTeamId: after.opponentTeamId || '',
      submissionStatus: after.submissionStatus || null,
      submittedAt: after.submittedAt || null,
      lockedAt: after.lockedAt || null,
      unlockedAt: after.unlockedAt || null,
      unlockedBy: after.unlockedBy || null,
      unlockReason: after.unlockReason || null,
      whatsappShared: !!after.whatsappShared,
      whatsappSharedAt: after.whatsappSharedAt || null,
      lastUpdatedAt: after.lastUpdatedAt || null,
      version: after.version || null,
      revealedAt: after.revealedAt || null,
      revealId: after.revealId || null
    };
    await root.child(`lineupSubmissionMeta/${scheduleId}/${teamId}`).set(safeMeta);

    if (!after?.lockedAt || after.unlockedAt) return null;

    const scheduleSnap = await root.child(`schedule/${scheduleId}`).get();
    const fixture = scheduleSnap.val();
    if (!fixture?.team1Id || !fixture?.team2Id) return null;

    const submissionsSnap = await root.child(`lineupSubmissions/${scheduleId}`).get();
    const submissions = submissionsSnap.val() || {};
    const team1Submission = submissions[fixture.team1Id];
    const team2Submission = submissions[fixture.team2Id];
    if (!team1Submission?.lockedAt || !team2Submission?.lockedAt || team1Submission.unlockedAt || team2Submission.unlockedAt) return null;

    const existingRevealId = team1Submission.revealId || team2Submission.revealId;
    if (existingRevealId) return null;

    const now = Date.now();
    const revealId = `${scheduleId}-${now}`;
    const revealRecord = {
      revealId,
      scheduleId,
      revealCode: revealId.slice(-8).toUpperCase(),
      team1Id: fixture.team1Id,
      team2Id: fixture.team2Id,
      revealedAt: now,
      lineups: {
        [fixture.team1Id]: lineupByTeam(team1Submission),
        [fixture.team2Id]: lineupByTeam(team2Submission)
      }
    };

    const updates = {
      [`revealedLineups/${revealId}`]: revealRecord,
      [`lineupSubmissions/${scheduleId}/${fixture.team1Id}/revealedAt`]: now,
      [`lineupSubmissions/${scheduleId}/${fixture.team1Id}/revealId`]: revealId,
      [`lineupSubmissions/${scheduleId}/${fixture.team1Id}/submissionStatus`]: 'revealed',
      [`lineupSubmissions/${scheduleId}/${fixture.team1Id}/lastUpdatedAt`]: now,
      [`lineupSubmissions/${scheduleId}/${fixture.team2Id}/revealedAt`]: now,
      [`lineupSubmissions/${scheduleId}/${fixture.team2Id}/revealId`]: revealId,
      [`lineupSubmissions/${scheduleId}/${fixture.team2Id}/submissionStatus`]: 'revealed',
      [`lineupSubmissions/${scheduleId}/${fixture.team2Id}/lastUpdatedAt`]: now,
      [`lineupSubmissionMeta/${scheduleId}/${fixture.team1Id}/revealedAt`]: now,
      [`lineupSubmissionMeta/${scheduleId}/${fixture.team1Id}/revealId`]: revealId,
      [`lineupSubmissionMeta/${scheduleId}/${fixture.team1Id}/submissionStatus`]: 'revealed',
      [`lineupSubmissionMeta/${scheduleId}/${fixture.team1Id}/lastUpdatedAt`]: now,
      [`lineupSubmissionMeta/${scheduleId}/${fixture.team2Id}/revealedAt`]: now,
      [`lineupSubmissionMeta/${scheduleId}/${fixture.team2Id}/revealId`]: revealId,
      [`lineupSubmissionMeta/${scheduleId}/${fixture.team2Id}/submissionStatus`]: 'revealed',
      [`lineupSubmissionMeta/${scheduleId}/${fixture.team2Id}/lastUpdatedAt`]: now
    };

    return root.update(updates);
  });
