export const REGISTRATION_STATUS = { DRAFT: 'draft', SUBMITTED: 'submitted', APPROVED: 'approved', WAITLISTED: 'waitlisted', REJECTED: 'rejected' };
export const PAYMENT_STATUS = { UNPAID: 'unpaid', CHECKOUT_CREATED: 'checkoutCreated', PAID: 'paid', REFUNDED: 'refunded', FAILED: 'failed' };
export const BOOKING_STATUS = { HELD: 'held', CONFIRMED: 'confirmed', CANCELLED: 'cancelled', NO_SHOW: 'noShow' };

export function createPlayerRegistration(input = {}, scope = {}) {
  if (!input.playerName?.trim()) throw new Error('Player name is required');
  if (!input.email?.trim()) throw new Error('Player email is required');
  return {
    id: input.id || `reg_${Date.now()}`,
    type: 'player',
    playerName: input.playerName.trim(),
    email: input.email.trim().toLowerCase(),
    teamId: input.teamId || '',
    status: input.status || REGISTRATION_STATUS.SUBMITTED,
    paymentStatus: input.paymentStatus || PAYMENT_STATUS.UNPAID,
    clubId: scope.clubId || input.clubId || '',
    seasonId: scope.seasonId || input.seasonId || '',
    createdAt: input.createdAt || Date.now()
  };
}

export function createTeamRegistration(input = {}, scope = {}) {
  if (!input.teamName?.trim()) throw new Error('Team name is required');
  if (!input.captainEmail?.trim()) throw new Error('Captain email is required');
  return {
    id: input.id || `team_reg_${Date.now()}`,
    type: 'team',
    teamName: input.teamName.trim(),
    captainEmail: input.captainEmail.trim().toLowerCase(),
    status: input.status || REGISTRATION_STATUS.SUBMITTED,
    paymentStatus: input.paymentStatus || PAYMENT_STATUS.UNPAID,
    roster: Array.isArray(input.roster) ? input.roster : [],
    clubId: scope.clubId || input.clubId || '',
    seasonId: scope.seasonId || input.seasonId || '',
    createdAt: input.createdAt || Date.now()
  };
}

export function createPaymentIntentRecord(input = {}, scope = {}) {
  if (!input.registrationId) throw new Error('Registration id is required');
  if (!Number.isFinite(Number(input.amountCents)) || Number(input.amountCents) <= 0) throw new Error('Amount must be greater than zero');
  return {
    id: input.id || `pay_${Date.now()}`,
    provider: input.provider || 'stripe',
    registrationId: input.registrationId,
    amountCents: Number(input.amountCents),
    currency: String(input.currency || 'usd').toLowerCase(),
    status: input.status || PAYMENT_STATUS.CHECKOUT_CREATED,
    checkoutUrl: input.checkoutUrl || '',
    invoiceId: input.invoiceId || '',
    refundId: input.refundId || '',
    clubId: scope.clubId || input.clubId || '',
    seasonId: scope.seasonId || input.seasonId || '',
    createdAt: input.createdAt || Date.now()
  };
}

export function createPlayerProfile(input = {}, scope = {}) {
  if (!input.fullName?.trim()) throw new Error('Full name is required');
  return {
    id: input.id || String(input.fullName).toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    fullName: input.fullName.trim(),
    email: String(input.email || '').trim().toLowerCase(),
    verified: !!input.verified,
    rating: Number.isFinite(Number(input.rating)) ? Number(input.rating) : null,
    ratingHistory: Array.isArray(input.ratingHistory) ? input.ratingHistory : [],
    matchHistory: Array.isArray(input.matchHistory) ? input.matchHistory : [],
    availability: input.availability || {},
    preferredClubs: Array.isArray(input.preferredClubs) ? input.preferredClubs : [],
    clubId: scope.clubId || input.clubId || '',
    seasonId: scope.seasonId || input.seasonId || ''
  };
}

function toTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid booking time');
  return date.getTime();
}

export function bookingConflicts(candidate, bookings = []) {
  const start = toTime(candidate.startAt);
  const end = toTime(candidate.endAt);
  if (end <= start) throw new Error('Booking end must be after start');
  return bookings.filter(booking => {
    if (booking.status === BOOKING_STATUS.CANCELLED) return false;
    if (booking.courtId !== candidate.courtId) return false;
    const bookingStart = toTime(booking.startAt);
    const bookingEnd = toTime(booking.endAt);
    return start < bookingEnd && end > bookingStart;
  });
}

export function canCancelBooking(booking, policy = {}, now = Date.now()) {
  const minHours = Number(policy.minCancelHours ?? 12);
  const start = toTime(booking.startAt);
  return start - now >= minHours * 60 * 60 * 1000;
}

export function createNotification(input = {}, scope = {}) {
  if (!input.type) throw new Error('Notification type is required');
  return {
    id: input.id || `notification_${Date.now()}`,
    type: input.type,
    channels: input.channels || ['inApp'],
    recipientIds: input.recipientIds || [],
    payload: input.payload || {},
    status: input.status || 'queued',
    sendAt: input.sendAt || Date.now(),
    clubId: scope.clubId || input.clubId || '',
    seasonId: scope.seasonId || input.seasonId || ''
  };
}

export function createExportJob(input = {}, scope = {}) {
  return {
    id: input.id || `export_${Date.now()}`,
    type: input.type || 'csv',
    report: input.report || 'participation',
    status: input.status || 'queued',
    requestedBy: input.requestedBy || '',
    clubId: scope.clubId || input.clubId || '',
    seasonId: scope.seasonId || input.seasonId || '',
    createdAt: input.createdAt || Date.now()
  };
}
