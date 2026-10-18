// 3D truck packing: an extreme-point heuristic that builds tiers from the cab back,
// floor to ceiling, the way movers load. Pure functions, no DOM, so it runs in tests too.
//
// Axes (inches): x = length, from the cab (0) toward the rear door; y = up; z = width,
// from the driver side (0) to the passenger side.

const EPS = 0.01;
const HEAVY_LBS = 100;      // heavy pieces stay on the floor
const MIN_SUPPORT = 0.7;    // share of an item's base that must rest on something
const ATTIC_MAX_LBS = 60;

/** Expands a { presetId: count } map into one entry per physical item. */
export function expand(counts, catalog) {
  const items = [];
  for (const [id, count] of Object.entries(counts)) {
    const spec = catalog[id];
    if (!spec) continue;
    for (let n = 0; n < count; n++) items.push({ ...spec, uid: `${id}#${n + 1}` });
  }
  return items;
}

/** Footprints the item may take, as [dx (length), dz (width), dy (height)], natural first. */
export function orientations(item) {
  const { l, w, h } = item;
  const options = item.orient === 'upright'
    ? [[l, w, h], [w, l, h]]
    : [[l, w, h], [w, l, h], [l, h, w], [h, l, w], [w, h, l], [h, w, l]];
  const seen = new Set();
  return options.filter((o) => {
    const key = o.join('x');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const overlaps1 = (a0, a1, b0, b1) => a0 < b1 - EPS && a1 > b0 + EPS;

function collides(box, placed) {
  for (const p of placed) {
    if (overlaps1(box.x, box.x + box.dx, p.x, p.x + p.dx)
      && overlaps1(box.y, box.y + box.dy, p.y, p.y + p.dy)
      && overlaps1(box.z, box.z + box.dz, p.z, p.z + p.dz)) return true;
  }
  return false;
}

/** Returns the items holding `box` up, or null if it would float, tip or crush something. */
function supporters(box, placed) {
  if (box.y < EPS) return [];
  let area = 0;
  const under = [];
  for (const p of placed) {
    if (Math.abs(p.y + p.dy - box.y) > EPS) continue;
    const ox = Math.min(box.x + box.dx, p.x + p.dx) - Math.max(box.x, p.x);
    const oz = Math.min(box.z + box.dz, p.z + p.dz) - Math.max(box.z, p.z);
    if (ox <= EPS || oz <= EPS) continue;
    if (!p.item.stack) return null;
    area += ox * oz;
    under.push(p);
  }
  return area >= MIN_SUPPORT * box.dx * box.dz ? under : null;
}

/** Slides a point back along one axis until it meets an item face or the wall. */
function project(point, axis, placed) {
  const [a, b] = axis === 'x' ? ['y', 'z'] : axis === 'y' ? ['x', 'z'] : ['x', 'y'];
  const size = { x: 'dx', y: 'dy', z: 'dz' };
  let best = 0;
  for (const p of placed) {
    const far = p[axis] + p[size[axis]];
    if (far > point[axis] + EPS || far <= best) continue;
    if (point[a] >= p[a] - EPS && point[a] < p[a] + p[size[a]] - EPS
      && point[b] >= p[b] - EPS && point[b] < p[b] + p[size[b]] - EPS) best = far;
  }
  return { ...point, [axis]: best };
}

/**
 * Lexicographic preference, best first:
 * 1. nearest the cab (build tiers front to back),
 * 2. least dead space trapped above an item nothing may sit on (stand mattresses on edge),
 * 3. thinnest tier, 4. lowest (heavier things much lower), 5. driver side first.
 */
function score(box, item, region) {
  const dead = item.stack ? 0 : (region.h - box.y - box.dy) * box.dx * box.dz;
  const lift = item.lbs >= 50 ? box.y * 50 : box.y;
  return [r(box.x), r(dead / 1000), r(box.x + box.dx), r(lift), r(box.z)];
}

const r = (v) => Math.round(v * 100) / 100;

function better(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

/**
 * Packs items into one region ({ l, w, h }). `gap` pads every side so real-world furniture,
 * blankets and fingers fit. Returns { placed, leftover } with placement order preserved.
 */
export function packRegion(items, region, { gap = 1 } = {}) {
  const placed = [];
  const leftover = [];
  let points = [{ x: 0, y: 0, z: 0 }];

  const place = (item) => {
    let best = null;
    const pad = item.box ? 0 : gap;   // boxes pack tight; furniture needs room for blankets
    for (const [l, w, h] of orientations(item)) {
      const dims = { dx: l + pad, dz: w + pad, dy: h + pad };
      for (const pt of points) {
        const box = { ...pt, ...dims };
        if (box.x + box.dx > region.l + EPS || box.y + box.dy > region.h + EPS || box.z + box.dz > region.w + EPS) continue;
        if (item.lbs >= HEAVY_LBS && box.y > EPS) continue;
        if (collides(box, placed)) continue;
        const under = supporters(box, placed);
        if (!under) continue;
        const s = score(box, item, region);
        if (!best || better(s, best.s)) best = { s, box, under };
      }
    }
    if (!best) return false;

    const entry = { item, ...best.box, on: best.under.map((u) => u.item) };
    placed.push(entry);

    const corners = [
      { x: entry.x + entry.dx, y: entry.y, z: entry.z },
      { x: entry.x, y: entry.y + entry.dy, z: entry.z },
      { x: entry.x, y: entry.y, z: entry.z + entry.dz },
    ];
    const fresh = [];
    for (const c of corners) {
      fresh.push(c, project(c, 'x', placed), project(c, 'y', placed), project(c, 'z', placed));
    }
    const keyed = new Map();
    for (const p of [...points, ...fresh]) {
      if (p.x >= region.l - EPS || p.y >= region.h - EPS || p.z >= region.w - EPS) continue;
      if (collides({ ...p, dx: EPS * 2, dy: EPS * 2, dz: EPS * 2 }, placed)) continue;
      keyed.set(`${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`, p);
    }
    points = [...keyed.values()];
    return true;
  };

  for (const item of items) if (!place(item)) leftover.push(item);
  // Later pieces open new corners, so give everything that missed one more try.
  const missed = leftover.splice(0);
  for (const item of missed) if (!place(item)) leftover.push(item);
  return { placed, leftover };
}

const volume = (i) => i.l * i.w * i.h;

const footprint = (i) => i.l * i.w;
const floorBound = (i) => (i.lbs >= HEAVY_LBS ? 1 : 0);

/** Candidate loading orders. Heavy floor-only pieces always go first so they claim floor. */
export const ORDERINGS = {
  volume: (a, b) => floorBound(b) - floorBound(a) || volume(b) - volume(a) || b.lbs - a.lbs,
  footprint: (a, b) => floorBound(b) - floorBound(a) || footprint(b) - footprint(a) || volume(b) - volume(a),
  height: (a, b) => floorBound(b) - floorBound(a) || Math.max(b.l, b.w, b.h) - Math.max(a.l, a.w, a.h) || volume(b) - volume(a),
  weight: (a, b) => b.lbs - a.lbs || volume(b) - volume(a),
};

export function loadingOrder(items, ordering = 'volume') {
  const cmp = ORDERINGS[ordering];
  return [...items].sort((a, b) => cmp(a, b) || a.uid.localeCompare(b.uid));
}

/**
 * Packs a truck with one loading order: light small things go to the over-cab attic first
 * (it frees deck space and is where fragile, light items belong), then the rest onto the deck.
 */
function packWith(items, truck, ordering, options) {
  const ordered = loadingOrder(items, ordering);
  let rest = ordered;
  let attic = { placed: [], leftover: [] };
  if (truck.attic) {
    const candidates = ordered.filter((i) => i.attic && i.lbs <= ATTIC_MAX_LBS);
    attic = packRegion(candidates, truck.attic, options);
    const inAttic = new Set(attic.placed.map((p) => p.item.uid));
    rest = ordered.filter((i) => !inAttic.has(i.uid));
  }
  const deck = packRegion(rest, truck.deck, options);

  const steps = [
    ...attic.placed.map((p) => ({ ...p, region: 'attic' })),
    ...deck.placed.map((p) => ({ ...p, region: 'deck' })),
  ];
  const capacity = truck.deck.l * truck.deck.w * truck.deck.h
    + (truck.attic ? truck.attic.l * truck.attic.w * truck.attic.h : 0);
  const used = steps.reduce((sum, s) => sum + volume(s.item), 0);
  const itemVolume = items.reduce((sum, i) => sum + volume(i), 0);
  const leftVolume = deck.leftover.reduce((sum, i) => sum + volume(i), 0);
  const depth = deck.placed.reduce((m, p) => Math.max(m, p.x + p.dx), 0);
  return {
    truck, steps, leftover: deck.leftover, ordering,
    fits: deck.leftover.length === 0,
    fill: used / capacity,
    usedCuft: used / 1728,
    itemCuft: itemVolume / 1728,
    depth,
    leftVolume,
  };
}

/** Tries every loading order and keeps the one that leaves the least behind, then the shortest load. */
export function packTruck(items, truck, options = {}) {
  let best = null;
  for (const ordering of Object.keys(ORDERINGS)) {
    const result = packWith(items, truck, ordering, options);
    if (!best || result.leftVolume < best.leftVolume
      || (result.leftVolume === best.leftVolume && result.depth < best.depth)) best = result;
  }
  return best;
}

/** Packs every truck size and picks the smallest one that takes everything. */
export function recommend(items, trucks, options = {}) {
  const results = trucks.map((t) => packTruck(items, t, options));
  const best = results.find((r) => r.fits) ?? null;
  return { results, best };
}

/** Plain-language instruction for one load step. */
export function describe(step, truck) {
  const region = step.region === 'attic' ? truck.attic : truck.deck;
  const where = step.region === 'attic'
    ? 'in the over-cab attic'
    : step.x < 1 ? 'against the cab wall' : `${feet(step.x)} back from the cab`;
  const level = step.y < 1
    ? 'on the floor'
    : step.on.length ? `on top of the ${step.on[0].name.toLowerCase()}` : 'stacked';
  const mid = step.z + step.dz / 2;
  const side = mid < region.w / 3 ? 'driver side' : mid > (2 * region.w) / 3 ? 'passenger side' : 'middle';
  const turned = !step.item.box && step.item.orient === 'any' && step.dy > step.item.h + 1.5;
  const standing = turned ? (step.item.h <= 14 ? ', on its side' : ', stood on end') : '';
  return `${step.item.name}: ${where}, ${level}, ${side}${standing}`;
}

export function feet(inches) {
  const ft = Math.floor(inches / 12);
  const inch = Math.round(inches - ft * 12);
  return inch === 12 ? `${ft + 1}'0"` : `${ft}'${inch}"`;
}
