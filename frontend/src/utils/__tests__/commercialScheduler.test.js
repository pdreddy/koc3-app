import { buildAutoSchedule } from '../commercialScheduler';

const teams = Array.from({ length: 4 }, (_, index) => ({ id: `t${index + 1}`, name: `Team ${index + 1}` }));

describe('commercial scheduler', () => {
  test('generates round robin without blackout dates', () => {
    const schedule = buildAutoSchedule(teams, { format: 'roundRobin', courtCount: 2, blackoutDates: ['2027-01-01'] }, { startDate: '2027-01-01' });
    expect(Object.values(schedule)).toHaveLength(6);
    expect(Object.values(schedule)[0].date).toBe('2027-01-02');
  });

  test('generates first-round knockout schedule', () => {
    const schedule = buildAutoSchedule(teams, { format: 'knockout', courtCount: 2 }, { startDate: '2027-01-01' });
    expect(Object.values(schedule)).toHaveLength(2);
    expect(Object.values(schedule).every(match => match.format === 'knockout')).toBe(true);
  });

  test('generates adjacent ladder matches', () => {
    const schedule = buildAutoSchedule(teams, { format: 'ladder', courtCount: 3 }, { startDate: '2027-01-01' });
    expect(Object.values(schedule)).toHaveLength(3);
    expect(schedule['ladder-m1']).toMatchObject({ team1Id: 't1', team2Id: 't2' });
  });
});
