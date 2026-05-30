const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dedupeGuardianRowsByUserId } = require('../src/utils/studentContactSync');

test('dedupeGuardianRowsByUserId keeps father relation when same user is father and guardian', () => {
  const rows = [
    { uid: 10, type: 'father', rel: 'Father' },
    { uid: 10, type: 'guardian', rel: 'Guardian' },
    { uid: 20, type: 'mother', rel: 'Mother' },
  ];
  const out = dedupeGuardianRowsByUserId(rows, 'guardian');
  assert.equal(out.length, 2);
  const fatherGuardian = out.find((r) => r.uid === 10);
  assert.ok(fatherGuardian);
  assert.equal(fatherGuardian.type, 'father');
  assert.equal(fatherGuardian.rel, 'Father');
  assert.equal(fatherGuardian.isPrimaryContact, true);
});

test('dedupeGuardianRowsByUserId preserves three distinct contacts', () => {
  const rows = [
    { uid: 1, type: 'father', rel: 'Father' },
    { uid: 2, type: 'mother', rel: 'Mother' },
    { uid: 3, type: 'guardian', rel: 'Guardian' },
  ];
  const out = dedupeGuardianRowsByUserId(rows, 'guardian');
  assert.equal(out.length, 3);
  const guardianRow = out.find((r) => r.uid === 3);
  assert.equal(guardianRow.isPrimaryContact, true);
});

test('dedupeGuardianRowsByUserId collapses all three slots to father when same user', () => {
  const rows = [
    { uid: 485, type: 'father', rel: 'Father' },
    { uid: 485, type: 'mother', rel: 'Mother' },
    { uid: 485, type: 'guardian', rel: 'Legal Guardian' },
  ];
  const out = dedupeGuardianRowsByUserId(rows, 'guardian');
  assert.equal(out.length, 1);
  assert.equal(out[0].uid, 485);
  assert.equal(out[0].type, 'father');
  assert.equal(out[0].rel, 'Father');
  assert.equal(out[0].isPrimaryContact, true);
});
