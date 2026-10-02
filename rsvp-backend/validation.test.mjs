import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRSVP } from './src/worker.js';
const valid = () => ({ submission_id: crypto.randomUUID(), full_name: 'Example Guest', phone: '+91 9999999999', attendance: 'Joyfully accepting', days: 'Both days', additional_guests: 1, guest_names: 'Example Plus One', notes: 'Vegetarian', _honey: '' });
test('accepts and normalizes a valid guest response', () => {
  const data = validateRSVP({ ...valid(), full_name: ' Example Guest ' });
  assert.equal(data.full_name, 'Example Guest'); assert.equal(data.additional_guests, 1);
});
test('declines cannot add attending guests', () => {
  const data = validateRSVP({ ...valid(), attendance: 'Regretfully declining', additional_guests: 99 });
  assert.equal(data.days, 'Not attending'); assert.equal(data.additional_guests, 0); assert.equal(data.notes, '');
});
for (const [label, change] of Object.entries({ emptyName: { full_name: ' ' }, invalidPhone: { phone: 'abc' }, longPhone: { phone: '9'.repeat(16) }, invalidDays: { days: 'Three days' }, excessiveGuests: { additional_guests: 9 }, fractionalGuests: { additional_guests: 1.5 }, invalidAttendance: { attendance: 'maybe' }, invalidReceipt: { submission_id: 'not-a-uuid' }, honeypot: { _honey: 'bot' }, oversizedNote: { notes: 'a'.repeat(1001) } })) {
  test('rejects ' + label, () => assert.throws(() => validateRSVP({ ...valid(), ...change })));
}
