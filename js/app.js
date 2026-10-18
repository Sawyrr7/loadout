import { TRUCKS, CATEGORIES, PRESETS, HOMES, presetById } from './data.js';
import { expand, recommend, describe, feet } from './packer.js';
import { TruckScene } from './scene.js';

const CAT_COLORS = {
  living: '#5b7fa6', bedroom: '#9b7bc4', kitchen: '#4f9a75', office: '#d99a32',
  boxes: '#c49a6c', misc: '#cf6656', custom: '#3f8fa0',
};
const STORE = 'loadout.v1';
const $ = (id) => document.getElementById(id);

const state = {
  counts: {},
  custom: [],          // user-defined items, same shape as presets
  pinned: null,        // truck id the user picked, or null to follow the recommendation
  plan: null,
  shown: 0,
  timer: null,
};

const catalog = () => ({ ...presetById, ...Object.fromEntries(state.custom.map((c) => [c.id, c])) });

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE));
    if (saved?.counts) { state.counts = saved.counts; state.custom = saved.custom ?? []; return; }
  } catch { /* private mode or bad data: fall through to the default */ }
  state.counts = { ...HOMES.find((h) => h.id === 'one').counts };
}

function save() {
  try { localStorage.setItem(STORE, JSON.stringify({ counts: state.counts, custom: state.custom })); } catch { /* ignore */ }
}

// ---------- inventory panel ----------

function renderHomes() {
  $('homes').innerHTML = HOMES.map((h) => `<button class="chip" data-home="${h.id}">${h.name}</button>`).join('');
}

function renderInventory() {
  const groups = [...CATEGORIES, { id: 'custom', name: 'Your own items' }];
  const all = [...PRESETS, ...state.custom];
  const open = new Set([...document.querySelectorAll('#inventory details[open]')].map((d) => d.dataset.cat));
  if (!document.querySelector('#inventory details')) ['living', 'bedroom', 'boxes'].forEach((c) => open.add(c));

  $('inventory').innerHTML = groups.map((g) => {
    const items = all.filter((p) => p.cat === g.id);
    const total = items.reduce((n, p) => n + (state.counts[p.id] ?? 0), 0);
    const rows = items.map((p) => {
      const n = state.counts[p.id] ?? 0;
      return `<div class="row">
        <i class="dot" style="background:${CAT_COLORS[p.cat]}"></i>
        <div class="name">${escape(p.name)}<span class="size">${p.l}×${p.w}×${p.h} in · ${p.lbs} lb</span></div>
        <div class="stepper ${n ? '' : 'zero'}">
          <button data-dec="${p.id}" aria-label="One fewer ${escape(p.name)}">−</button>
          <output>${n}</output>
          <button data-inc="${p.id}" aria-label="One more ${escape(p.name)}">+</button>
        </div>
      </div>`;
    }).join('');
    const form = g.id === 'custom' ? `<form class="custom" id="customForm">
        <input name="name" placeholder="Item name, e.g. Piano" required maxlength="40">
        <div class="dims">
          <input name="l" type="number" min="1" max="400" placeholder="Length in" required>
          <input name="w" type="number" min="1" max="120" placeholder="Width in" required>
          <input name="h" type="number" min="1" max="120" placeholder="Height in" required>
        </div>
        <div class="dims">
          <input name="lbs" type="number" min="1" max="2000" placeholder="Weight lb" required>
          <label class="hint" style="grid-column: span 2; display:flex; gap:6px; align-items:center">
            <input name="upright" type="checkbox" style="width:auto"> Keep upright</label>
        </div>
        <button>Add item</button>
        <span class="hint">Measure the widest points. Sizes are inches.</span>
      </form>` : '';
    return `<details data-cat="${g.id}" ${open.has(g.id) ? 'open' : ''}>
      <summary>${g.name}<span class="count ${total ? 'on' : ''}">${total ? `${total} item${total > 1 ? 's' : ''}` : 'none'}</span></summary>
      ${rows}${form}
    </details>`;
  }).join('') + `<p class="hint" style="padding: 14px 22px 0; line-height:1.5">
    Truck interiors use U-Haul's published sizes, including the over-cab attic. Furniture gets 1 in. of
    padding for blankets. Wheel wells aren't modeled, so leave a little slack.</p>`;
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.inc || t.dataset.dec) {
    const id = t.dataset.inc || t.dataset.dec;
    const n = Math.max(0, Math.min(99, (state.counts[id] ?? 0) + (t.dataset.inc ? 1 : -1)));
    if (n) state.counts[id] = n; else delete state.counts[id];
    changed();
  } else if (t.dataset.home) {
    state.counts = { ...HOMES.find((h) => h.id === t.dataset.home).counts };
    state.pinned = null;
    changed({ replay: true });
  } else if (t.hasAttribute('data-clear')) {
    state.counts = {};
    state.pinned = null;
    changed();
  } else if (t.dataset.truck) {
    state.pinned = t.dataset.truck;
    repack({ replay: true });
  }
});

document.addEventListener('submit', (e) => {
  if (e.target.id !== 'customForm') return;
  e.preventDefault();
  const f = new FormData(e.target);
  const id = `custom-${Date.now().toString(36)}`;
  state.custom.push({
    id, cat: 'custom', name: String(f.get('name')).trim() || 'Custom item',
    l: Number(f.get('l')), w: Number(f.get('w')), h: Number(f.get('h')), lbs: Number(f.get('lbs')),
    orient: f.get('upright') ? 'upright' : 'any', stack: true,
  });
  state.counts[id] = 1;
  changed();
});

let pending = null;
function changed(opts = {}) {
  save();
  renderInventory();
  clearTimeout(pending);
  pending = setTimeout(() => repack(opts), 120);
}

// ---------- packing + scene ----------

const scene = new TruckScene($('canvas'), { onHover: showTooltip });

function repack({ replay = false } = {}) {
  stop();
  const items = expand(state.counts, catalog());
  const { results, best } = recommend(items, TRUCKS);
  const chosenId = state.pinned ?? best?.truck.id ?? TRUCKS.at(-1).id;
  const plan = results.find((r) => r.truck.id === chosenId);
  state.results = results;
  state.best = best;
  state.plan = plan;

  const newTruck = scene.truck?.id !== plan.truck.id;
  if (newTruck) scene.setTruck(plan.truck);
  const hadPile = scene.pileDepth > 0;
  state.shown = replay ? 0 : plan.steps.length;
  scene.setPlan(plan, state.shown);
  if (newTruck || hadPile !== scene.pileDepth > 0) scene.frame();
  renderTrucks();
  renderVerdict(items.length);
  renderPlayer();
  if (replay && plan.steps.length) play();
}

function renderTrucks() {
  $('trucks').innerHTML = state.results.map((r) => {
    const active = r.truck.id === state.plan.truck.id;
    const status = r.fits
      ? `<small class="ok">Fits · ${Math.round(r.fill * 100)}% full</small>`
      : `<small class="no">${r.leftover.length} won't fit</small>`;
    const pick = state.best?.truck.id === r.truck.id ? '<span class="pick">Best</span>' : '';
    return `<button class="truck-btn ${active ? 'active' : ''}" role="tab" aria-selected="${active}" data-truck="${r.truck.id}">
      ${pick}<b>${r.truck.name}</b>${status}</button>`;
  }).join('');
}

function renderVerdict(count) {
  const el = $('verdict');
  const p = state.plan;
  if (!count) {
    el.className = 'verdict';
    el.innerHTML = `<h2>What are you moving?</h2><p>Pick a home size or add pieces on the left, and the truck will pack itself.</p>`;
    return;
  }
  const best = state.best;
  let title, body;
  const bad = !p.fits;
  if (p.fits && best && best.truck.id === p.truck.id) {
    title = `A ${p.truck.label} fits it all`;
    body = `The smallest truck that takes everything. About ${Math.round((1 - p.fill) * 100)}% is still open for last-minute stuff.`;
  } else if (p.fits) {
    title = 'Fits, with room to spare';
    body = `You could save money with the ${best.truck.label}.`;
  } else if (best) {
    title = `${p.leftover.length} piece${p.leftover.length > 1 ? 's' : ''} won't fit`;
    body = `They're the red pile on the pavement. The ${best.truck.label} takes everything.`;
  } else {
    title = `Even a 26 ft truck is ${p.leftover.length} short`;
    body = 'Plan two trips, add a trailer, or book a container for the rest.';
  }
  el.className = `verdict ${bad ? 'bad' : ''}`;
  el.innerHTML = `<h2>${title}</h2><p>${body}</p>
    <div class="meter"><i style="width:${Math.min(100, p.fill * 100).toFixed(1)}%"></i></div>
    <div class="stats">
      <div>Pieces<b>${p.steps.length}${p.leftover.length ? ` / ${p.steps.length + p.leftover.length}` : ''}</b></div>
      <div>Volume<b>${Math.round(p.itemCuft)} ft³</b></div>
      <div>Deck used<b>${feet(p.depth)}</b></div>
    </div>`;
}

// ---------- load-order player ----------

function renderPlayer() {
  const steps = state.plan.steps;
  const scrub = $('scrub');
  scrub.max = steps.length;
  scrub.value = state.shown;
  $('play').innerHTML = state.timer
    ? '<svg width="16" height="16" viewBox="0 0 16 16"><rect x="3" y="2" width="3.5" height="12" rx="1" fill="currentColor"/><rect x="9.5" y="2" width="3.5" height="12" rx="1" fill="currentColor"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>';
  $('play').setAttribute('aria-label', state.timer ? 'Pause' : 'Play loading order');
  const text = $('stepText');
  if (!steps.length) text.innerHTML = 'Nothing to load yet';
  else if (state.shown === 0) text.innerHTML = `<span>0 / ${steps.length}</span>Empty truck. Press play to see the loading order.`;
  else {
    const step = steps[state.shown - 1];
    text.innerHTML = `<span>${state.shown} / ${steps.length}</span>${escape(describe(step, state.plan.truck))}`;
  }
}

function play() {
  stop();
  const steps = state.plan.steps.length;
  if (!steps) return;
  if (state.shown >= steps) state.shown = 0;
  scene.showUpTo(state.shown, false);
  const interval = Math.max(110, Math.min(520, 16000 / steps));
  state.timer = setInterval(() => {
    state.shown += 1;
    scene.showUpTo(state.shown, true);
    if (state.shown >= steps) stop();
    renderPlayer();
  }, interval);
  renderPlayer();
}

function stop() {
  clearInterval(state.timer);
  state.timer = null;
}

$('play').addEventListener('click', () => {
  if (state.timer) { stop(); renderPlayer(); } else play();
});
$('scrub').addEventListener('input', (e) => {
  stop();
  const next = Number(e.target.value);
  scene.showUpTo(next, next === state.shown + 1);
  state.shown = next;
  renderPlayer();
});
$('resetView').addEventListener('click', () => scene.frame());

function showTooltip(info) {
  const tip = $('tooltip');
  if (!info || !info.at) { tip.style.display = 'none'; return; }
  const item = info.step?.item ?? info.leftover;
  const detail = info.step
    ? `Step ${info.index + 1}: ${escape(describe(info.step, state.plan.truck).split(': ')[1])}`
    : "Didn't fit in this truck";
  tip.innerHTML = `<b>${escape(item.name)}</b><small>${item.l}×${item.w}×${item.h} in · ${item.lbs} lb</small><small>${detail}</small>`;
  tip.style.left = `${info.at.x}px`;
  tip.style.top = `${info.at.y}px`;
  tip.style.display = 'block';
}

function renderLegend() {
  $('legend').innerHTML = [...CATEGORIES.map((c) => [c.name, CAT_COLORS[c.id]]), ["Didn't fit", '#b42318']]
    .map(([name, color]) => `<span>${name}<i style="background:${color}"></i></span>`).join('');
}

load();
renderHomes();
renderInventory();
renderLegend();
repack({ replay: true });
