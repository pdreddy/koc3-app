import { BOOKING_STATUS, bookingConflicts, canCancelBooking, createPaymentIntentRecord, createPlayerProfile, createPlayerRegistration, createTeamRegistration } from '../commercialModels';

describe('commercial registration/payment/profile models', () => {
  test('validates player registration required fields', () => {
    expect(() => createPlayerRegistration({ email: 'a@example.com' })).toThrow('Player name is required');
    expect(createPlayerRegistration({ playerName: 'Jane Doe', email: 'JANE@EXAMPLE.COM' }, { clubId: 'c', seasonId: 's' })).toMatchObject({ email: 'jane@example.com', clubId: 'c', seasonId: 's', paymentStatus: 'unpaid' });
  });

  test('validates team registration and payment amount', () => {
    expect(createTeamRegistration({ teamName: 'Aces', captainEmail: 'cap@example.com' })).toMatchObject({ type: 'team', status: 'submitted' });
    expect(() => createPaymentIntentRecord({ registrationId: 'r1', amountCents: 0 })).toThrow('Amount must be greater than zero');
    expect(createPaymentIntentRecord({ registrationId: 'r1', amountCents: 2500, currency: 'USD' })).toMatchObject({ provider: 'stripe', currency: 'usd' });
  });

  test('creates verified player profiles with history containers', () => {
    expect(createPlayerProfile({ fullName: 'Uma Player', verified: true, rating: '8.45' })).toMatchObject({ id: 'uma_player', verified: true, rating: 8.45, matchHistory: [] });
  });
});

describe('court booking policies', () => {
  test('detects overlapping bookings on same court only', () => {
    const candidate = { courtId: 'court_1', startAt: '2027-01-01T10:00:00', endAt: '2027-01-01T11:00:00' };
    const conflicts = bookingConflicts(candidate, [
      { courtId: 'court_1', startAt: '2027-01-01T10:30:00', endAt: '2027-01-01T11:30:00', status: BOOKING_STATUS.CONFIRMED },
      { courtId: 'court_2', startAt: '2027-01-01T10:30:00', endAt: '2027-01-01T11:30:00', status: BOOKING_STATUS.CONFIRMED },
      { courtId: 'court_1', startAt: '2027-01-01T10:15:00', endAt: '2027-01-01T10:45:00', status: BOOKING_STATUS.CANCELLED }
    ]);
    expect(conflicts).toHaveLength(1);
  });

  test('enforces cancellation window', () => {
    const booking = { startAt: '2027-01-02T10:00:00' };
    expect(canCancelBooking(booking, { minCancelHours: 12 }, new Date('2027-01-01T20:00:00').getTime())).toBe(true);
    expect(canCancelBooking(booking, { minCancelHours: 12 }, new Date('2027-01-02T01:00:00').getTime())).toBe(false);
  });
});
