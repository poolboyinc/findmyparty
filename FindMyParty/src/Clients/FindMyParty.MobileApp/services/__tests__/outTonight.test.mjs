import { test } from 'node:test';
import assert from 'node:assert/strict';
import { outTonightLine, venuesLitText } from '../../components/account/out-tonight.ts';

const podgorica = { name: 'Podgorica', outTonight: 0, venuesLit: 0 };

test('people out tonight, with a comma and a plus', () => {
  assert.equal(outTonightLine({ ...podgorica, outTonight: 1200, venuesLit: 14 }), '1,200+ out tonight in Podgorica');
  assert.equal(outTonightLine({ ...podgorica, outTonight: 40, venuesLit: 2 }), '40+ out tonight in Podgorica');
  assert.equal(outTonightLine({ ...podgorica, outTonight: 12300, venuesLit: 2 }), '12,300+ out tonight in Podgorica');
});

test('the city name comes from the server', () => {
  assert.equal(outTonightLine({ name: 'Herceg Novi', outTonight: 50, venuesLit: 1 }), '50+ out tonight in Herceg Novi');
});

test('nobody counted yet but venues lit', () => {
  assert.equal(outTonightLine({ ...podgorica, venuesLit: 1 }), '1 venue lit tonight in Podgorica');
  assert.equal(outTonightLine({ ...podgorica, venuesLit: 3 }), '3 venues lit tonight in Podgorica');
});

test('nothing on, or no city yet: no line', () => {
  assert.equal(outTonightLine(podgorica), null);
  assert.equal(outTonightLine(null), null);
  assert.equal(outTonightLine(undefined), null);
});

test('the city picker says how many venues are lit, or that nothing is on', () => {
  assert.equal(venuesLitText({ venuesLit: 14 }), '14 venues lit');
  assert.equal(venuesLitText({ venuesLit: 1 }), '1 venue lit');
  assert.equal(venuesLitText({ venuesLit: 0 }), 'Nothing on yet');
});
