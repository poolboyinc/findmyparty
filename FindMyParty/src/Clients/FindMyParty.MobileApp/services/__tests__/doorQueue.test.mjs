import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BATCH_MAX,
  DOOR_QUEUE_KEY,
  SETTLE_MARGIN_MS,
  admittedOnline,
  applyResults,
  batchToSend,
  dismissRefused,
  doorManifestKey,
  emptyQueue,
  enqueue,
  lookUp,
  offlinePreview,
  pendingAdmits,
  pruneSettled,
  readQueue,
  refusedBanner,
  writeQueue,
} from '../doorQueue.ts';

const PARTY = 'party-1';
const VULE = 'a'.repeat(32);
const MILA = 'b'.repeat(32);
const T0 = Date.UTC(2026, 10, 13, 22, 30);

const manifest = {
  partyId: PARTY,
  partyTitle: 'Neon Friday',
  generatedAt: new Date(T0).toISOString(),
  capacity: 300,
  checkedIn: 214,
  passes: [
    // Two outside with free entry before midnight for one of them: €0 to let one in, €5 for both.
    { codeId: VULE, kind: 'booking', guestName: 'Vule M.', levelName: 'Flame', outside: 2, pricePerGuest: 5, dueByAdmit: [0, 5], skipLine: true },
    { codeId: MILA, kind: 'guest', guestName: 'Mila K.', levelName: 'Ember', outside: 1, pricePerGuest: 5, dueByAdmit: [5], skipLine: false },
  ],
};

const scan = (id, codeId, admit = 1, at = T0) => ({
  clientScanId: id,
  code: `fmp1.${codeId}.1a2b3c4d`,
  admit,
  scannedAt: new Date(at).toISOString(),
  partyId: PARTY,
  codeId,
  guestName: codeId === VULE ? 'Vule M.' : 'Mila K.',
});

test('the keys are namespaced as the spec names them', () => {
  assert.equal(DOOR_QUEUE_KEY, '@findmyparty/door/queue');
  assert.equal(doorManifestKey(PARTY), '@findmyparty/door/manifest/party-1');
});

test('a scan with no signal is queued once, however often it is added', () => {
  let q = enqueue(emptyQueue(), scan('s1', VULE, 2));
  q = enqueue(q, scan('s1', VULE, 2));
  assert.equal(q.pending.length, 1);
  assert.equal(pendingAdmits(q, PARTY), 2);
  assert.equal(pendingAdmits(q, 'other-party'), 0);
});

test('a queued entry lowers the count still outside on this phone, so the pass is not let in twice', () => {
  const before = lookUp(manifest, T0, emptyQueue(), VULE);
  assert.equal(before.outside, 2);

  const q = enqueue(emptyQueue(), scan('s1', VULE, 1));
  const after = lookUp(manifest, T0, q, VULE);
  assert.equal(after.outside, 1);
  assert.equal(after.usedHere, 1);

  const q2 = enqueue(q, scan('s2', VULE, 1));
  assert.equal(lookUp(manifest, T0, q2, VULE).outside, 0);
});

test('ids are matched without dashes and in any letter case; an unknown pass is not on the list', () => {
  const dashed = `${'A'.repeat(8)}-${'A'.repeat(4)}-${'A'.repeat(4)}-${'A'.repeat(4)}-${'A'.repeat(12)}`;
  assert.equal(lookUp(manifest, T0, emptyQueue(), dashed).pass.guestName, 'Vule M.');
  assert.equal(lookUp(manifest, T0, emptyQueue(), 'c'.repeat(32)), null);
  assert.equal(lookUp(null, T0, emptyQueue(), VULE), null);
});

test('the offline sheet shows the same money as the door would: the perk on the first admission only', () => {
  const fresh = offlinePreview(manifest, T0, emptyQueue(), VULE);
  assert.equal(fresh.outside, 2);
  assert.equal(fresh.guestName, 'Vule M.');
  assert.equal(fresh.levelName, 'Flame');
  assert.equal(fresh.partyTitle, 'Neon Friday');
  assert.equal(fresh.skipLine, true);
  assert.deepEqual(fresh.dueByAdmit, [0, 5]);
  assert.deepEqual(fresh.lines, [
    { label: 'Entry, 2 × €5', amount: 10, perk: false },
    { label: 'Perk on this pass', amount: -5, perk: true },
  ]);

  // One already let in here: the discount went with them, the next guest pays full price.
  const after = offlinePreview(manifest, T0, enqueue(emptyQueue(), scan('s1', VULE, 1)), VULE);
  assert.equal(after.outside, 1);
  assert.deepEqual(after.dueByAdmit, [5]);
  assert.deepEqual(after.lines, [{ label: 'Entry, 1 × €5', amount: 5, perk: false }]);

  assert.equal(offlinePreview(manifest, T0, emptyQueue(), 'c'.repeat(32)), null);
});

test('a pass with nobody left outside has no offline preview to admit from', () => {
  const q = enqueue(emptyQueue(), scan('s1', MILA, 1));
  assert.equal(offlinePreview(manifest, T0, q, MILA).outside, 0);
});

test('the batch sends only what the server takes, oldest first, at most one hundred', () => {
  let q = emptyQueue();
  for (let i = 0; i < BATCH_MAX + 5; i++) q = enqueue(q, scan(`s${i}`, VULE, 1, T0 + i));
  const batch = batchToSend(q);
  assert.equal(batch.length, BATCH_MAX);
  assert.equal(batch[0].clientScanId, 's0');
  assert.deepEqual(Object.keys(batch[0]).sort(), ['admit', 'clientScanId', 'code', 'scannedAt']);
});

test('a flush: admitted items leave the queue and stay counted until a newer list arrives', () => {
  let q = enqueue(emptyQueue(), scan('s1', VULE, 1));
  q = enqueue(q, scan('s2', MILA, 1));
  const sentAt = T0 + 60_000;

  const { queue, refused } = applyResults(
    q,
    [
      { clientScanId: 's1', status: 'admitted', result: { admitted: 1 } },
      { clientScanId: 's2', status: 'admitted', result: { admitted: 1 } },
    ],
    sentAt,
  );
  assert.equal(queue.pending.length, 0);
  assert.equal(refused.length, 0);
  // The list on the phone was made before the flush: the admits still count against it.
  assert.equal(lookUp(manifest, T0, queue, VULE).outside, 1);
  assert.equal(lookUp(manifest, T0, queue, MILA).outside, 0);

  // A list fetched well after the flush already has them; counting them again would let nobody in.
  const later = sentAt + SETTLE_MARGIN_MS + 1;
  const fresher = { ...manifest, passes: [{ ...manifest.passes[0], outside: 1 }, { ...manifest.passes[1], outside: 0 }] };
  assert.equal(lookUp(fresher, later, queue, VULE).outside, 1);
  const pruned = pruneSettled(queue, PARTY, later);
  assert.equal(pruned.settled.length, 0);
});

test('a list fetched just after the flush may predate it, so the admits still count', () => {
  const q = applyResults(enqueue(emptyQueue(), scan('s1', VULE, 1)), [{ clientScanId: 's1', status: 'admitted' }], T0).queue;
  assert.equal(lookUp(manifest, T0 + 1_000, q, VULE).outside, 1);
  assert.equal(pruneSettled(q, PARTY, T0 + 1_000).settled.length, 1);
});

test('refused items leave the queue, give back their spot here, and make the banner', () => {
  let q = enqueue(emptyQueue(), scan('s1', VULE, 2));
  q = enqueue(q, scan('s2', MILA, 1));
  const { queue, refused } = applyResults(
    q,
    [
      { clientScanId: 's1', status: 'refused', code: 'offline_too_old', title: 'Scanned too long ago to count. Scan the pass again.' },
      { clientScanId: 's2', status: 'admitted' },
    ],
    T0,
  );
  assert.equal(queue.pending.length, 0);
  assert.equal(refused.length, 1);
  assert.equal(queue.refused[0].guestName, 'Vule M.');
  // Nobody was let in on Vule's pass after all.
  assert.equal(lookUp(manifest, T0, queue, VULE).outside, 2);
  assert.equal(refusedBanner(queue.refused), '1 offline scan was refused: Scanned too long ago to count. Scan the pass again.');

  const two = applyResults(
    enqueue(queue, scan('s3', MILA, 1)),
    [{ clientScanId: 's3', status: 'refused', code: 'already_used', title: 'Scanned at 23:12 at Door 2.' }],
    T0,
  ).queue;
  assert.equal(refusedBanner(two.refused), '2 offline scans were refused: Scanned at 23:12 at Door 2.');
  assert.equal(refusedBanner(dismissRefused(two).refused), null);
});

test('a refusal with no sentence still says something', () => {
  const { queue } = applyResults(enqueue(emptyQueue(), scan('s1', VULE)), [{ clientScanId: 's1', status: 'refused', code: 'invalid_code' }], T0);
  assert.equal(refusedBanner(queue.refused), '1 offline scan was refused: invalid_code');
});

test('an item the server did not answer for stays queued', () => {
  let q = enqueue(emptyQueue(), scan('s1', VULE));
  q = enqueue(q, scan('s2', MILA));
  const { queue } = applyResults(q, [{ clientScanId: 's1', status: 'admitted' }], T0);
  assert.deepEqual(
    queue.pending.map((p) => p.clientScanId),
    ['s2'],
  );
});

test('a restart in the middle of a flush loses nothing and sends the same ids again', () => {
  let q = enqueue(emptyQueue(), scan('s1', VULE, 2));
  q = enqueue(q, scan('s2', MILA, 1));
  const firstTry = batchToSend(q);

  // The app is killed while the batch is on its way: only what was written survives.
  const stored = writeQueue(q);
  const restarted = readQueue(stored);

  assert.deepEqual(restarted, q);
  assert.deepEqual(batchToSend(restarted), firstTry);
  assert.equal(lookUp(manifest, T0, restarted, VULE).outside, 0);

  // The server had already taken s1 the first time; the same id returns the first answer.
  const { queue } = applyResults(
    restarted,
    [
      { clientScanId: 's1', status: 'admitted' },
      { clientScanId: 's2', status: 'admitted' },
    ],
    T0 + 5_000,
  );
  assert.equal(queue.pending.length, 0);
  assert.equal(readQueue(writeQueue(queue)).settled.length, 2);
});

test('a missing or broken store starts an empty queue', () => {
  assert.deepEqual(readQueue(null), emptyQueue());
  assert.deepEqual(readQueue('not json'), emptyQueue());
  assert.deepEqual(readQueue('{"pending":"nope"}'), emptyQueue());
  assert.deepEqual(readQueue('{"pending":[{"clientScanId":1}]}').pending, []);
});

test('an entry let in online also counts on the phone until a newer list arrives', () => {
  const q = admittedOnline(emptyQueue(), { partyId: PARTY, codeId: VULE, admit: 2 }, T0);
  assert.equal(lookUp(manifest, T0 - 5_000, q, VULE).outside, 0);
  assert.equal(pendingAdmits(q, PARTY), 0);
  assert.equal(lookUp(manifest, T0 + SETTLE_MARGIN_MS + 1, q, VULE).outside, 2);
});

test('settled entries of another party are kept when one party prunes, and a day-old one goes', () => {
  let q = admittedOnline(emptyQueue(), { partyId: 'other', codeId: VULE, admit: 1 }, T0);
  q = admittedOnline(q, { partyId: PARTY, codeId: VULE, admit: 1 }, T0);
  const pruned = pruneSettled(q, PARTY, T0 + SETTLE_MARGIN_MS + 1);
  assert.deepEqual(
    pruned.settled.map((s) => s.partyId),
    ['other'],
  );
  assert.equal(pruneSettled(q, PARTY, T0 + 25 * 60 * 60_000).settled.length, 0);
});
