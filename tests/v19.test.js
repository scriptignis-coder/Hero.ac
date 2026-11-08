import test from 'node:test';
import assert from 'node:assert/strict';
import { expiryFrom, durationText } from '../api/_lib.js';
import { dayStart } from '../api/pins.js';

test('permission durations', () => {
  const from = new Date('2026-01-31T10:00:00Z');
  assert.equal(expiryFrom(1, 'hour', from), '2026-01-31T11:00:00.000Z');
  assert.equal(expiryFrom(2, 'day', from), '2026-02-02T10:00:00.000Z');
  assert.equal(expiryFrom(1, 'week', from), '2026-02-07T10:00:00.000Z');
  assert.equal(expiryFrom(1, 'year', from), '2027-01-31T10:00:00.000Z');
  assert.equal(expiryFrom(0, 'lifetime', from), null);
  assert.equal(expiryFrom(3, 'days', from), '2026-02-03T10:00:00.000Z');   // plural accepted
  assert.throws(() => expiryFrom(0, 'day', from));
  assert.throws(() => expiryFrom(1001, 'day', from));
  assert.throws(() => expiryFrom(1, 'decade', from));
  assert.equal(durationText(2, 'day'), '2 days');
  assert.equal(durationText(1, 'month'), '1 month');
  assert.equal(durationText(0, 'lifetime'), 'lifetime');
});

test('daily PIN limit resets at midnight Tunis time', () => {
  assert.equal(dayStart(new Date('2026-11-08T23:30:00Z'), 'Africa/Tunis').toISOString(), '2026-11-08T23:00:00.000Z');
  assert.equal(dayStart(new Date('2026-11-08T22:59:00Z'), 'Africa/Tunis').toISOString(), '2026-11-07T23:00:00.000Z');
});
