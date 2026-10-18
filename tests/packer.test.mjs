import test from 'node:test';
import assert from 'node:assert/strict';
import { TRUCKS, HOMES, presetById } from '../js/data.js';
import { expand, orientations, packRegion, packTruck, recommend, describe, feet } from '../js/packer.js';

const truck = (id) => TRUCKS.find((t) => t.id === id);
const home = (id) => expand(HOMES.find((h) => h.id === id).counts, presetById);

function assertValid(result) {
  const all = result.steps;
  for (const s of all) {
    const region = s.region === 'attic' ? result.truck.attic : result.truck.deck;
    assert.ok(s.x >= -1e-6 && s.y >= -1e-6 && s.z >= -1e-6, `${s.item.uid} below zero`);
    assert.ok(s.x + s.dx <= region.l + 0.01, `${s.item.uid} sticks out the back`);
    assert.ok(s.y + s.dy <= region.h + 0.01, `${s.item.uid} through the roof`);
    assert.ok(s.z + s.dz <= region.w + 0.01, `${s.item.uid} through a wall`);
    if (s.item.lbs >= 100) assert.ok(s.y < 0.01, `${s.item.uid} is heavy but stacked`);
  }
  for (const region of ['attic', 'deck']) {
    const boxes = all.filter((s) => s.region === region);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        const hit = ['x', 'y', 'z'].every((k) => {
          const d = 'd' + k;
          return a[k] < b[k] + b[d] - 0.01 && a[k] + a[d] > b[k] + 0.01;
        });
        assert.ok(!hit, `${a.item.uid} overlaps ${b.item.uid}`);
      }
    }
  }
}

test('upright items never tip over', () => {
  assert.deepEqual(orientations(presetById.fridge).map((o) => o[2]), [70, 70]);
  assert.equal(orientations(presetById.sofa).length, 6);
  assert.equal(orientations({ l: 10, w: 10, h: 10, orient: 'any' }).length, 1);
});

test('a single box sits in the front driver-side corner on the floor', () => {
  const { placed } = packRegion([{ ...presetById['box-m'], uid: 'b' }], { l: 100, w: 100, h: 100 });
  assert.equal(placed.length, 1);
  assert.deepEqual([placed[0].x, placed[0].y, placed[0].z], [0, 0, 0]);
});

test('boxes stack instead of floating, and nothing sits on a mattress', () => {
  const items = [
    { ...presetById.queen, uid: 'q' },
    ...Array.from({ length: 12 }, (_, n) => ({ ...presetById['box-l'], uid: `b${n}` })),
  ];
  const { placed } = packRegion(items, { l: 60, w: 92, h: 86 });
  for (const p of placed) {
    if (p.y > 0.01) {
      assert.ok(p.on.length > 0, `${p.item.uid} floats`);
      assert.ok(p.on.every((u) => u.stack), `${p.item.uid} rests on something unstackable`);
    }
  }
});

test('something too big for the box is left over', () => {
  const { placed, leftover } = packRegion([{ ...presetById.sofa, uid: 's' }], { l: 50, w: 50, h: 50 });
  assert.equal(placed.length, 0);
  assert.equal(leftover.length, 1);
});

test('every home template packs without overlaps or out-of-bounds pieces', () => {
  for (const id of ['studio', 'one', 'two']) {
    for (const t of TRUCKS) assertValid(packTruck(home(id), t));
  }
});

test('bigger homes need bigger trucks', () => {
  const pick = (id) => recommend(home(id), TRUCKS).best?.truck.id ?? 'none';
  const sizes = ['studio', 'one', 'two'].map(pick);
  const rank = (s) => (s === 'none' ? 99 : Number(s));
  assert.ok(rank(sizes[0]) <= rank(sizes[1]) && rank(sizes[1]) <= rank(sizes[2]), sizes.join(' → '));
  console.log('recommended:', sizes.join(' → '));
});

test('a 1-bedroom does not fit a 10 ft truck', () => {
  const r = packTruck(home('one'), truck('10'));
  assert.equal(r.fits, false);
  assert.ok(r.leftover.length > 0);
});

test('instructions read like a person wrote them', () => {
  const r = packTruck(expand({ fridge: 1, 'box-m': 2 }, presetById), truck('15'));
  const first = r.steps.find((s) => s.item.id === 'fridge');
  assert.match(describe(first, r.truck), /^Refrigerator: against the cab wall, on the floor, driver side$/);
  assert.equal(feet(30), `2'6"`);
});

test('packing a 2-bedroom into all four trucks stays fast', () => {
  const start = performance.now();
  recommend(home('two'), TRUCKS);
  const ms = performance.now() - start;
  console.log(`2-bedroom, 4 trucks: ${ms.toFixed(0)} ms`);
  assert.ok(ms < 4000);
});
