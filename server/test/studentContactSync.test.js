const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  dedupeGuardianRowsByUserId,
  enrichParentRowFromGuardianLinks,
} = require('../src/utils/studentContactSync');

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

test('enrichParentRowFromGuardianLinks fills father from Parent-role link with Guardian relation', () => {
  const row = {
    student_id: 485,
    father_name: '',
    mother_name: '',
    father_user_id: null,
  };
  const links = [
    {
      student_id: 485,
      relation: 'Guardian',
      user_id: 9001,
      first_name: 'Ahmed',
      last_name: 'Khan',
      email: 'ahmed@example.com',
      phone: '9999999999',
      occupation: 'Engineer',
      avatar: null,
      role_id: 4,
    },
    {
      student_id: 485,
      relation: 'Guardian',
      user_id: 9002,
      first_name: 'Fatima',
      last_name: 'Khan',
      email: 'fatima@example.com',
      phone: '8888888888',
      occupation: 'Teacher',
      avatar: null,
      role_id: 4,
    },
  ];
  const out = enrichParentRowFromGuardianLinks(row, links);
  assert.equal(out.father_name, 'Ahmed Khan');
  assert.equal(out.mother_name, 'Fatima Khan');
  assert.equal(out.father_user_id, 9001);
});
