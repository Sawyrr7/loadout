import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// World units are inches. The truck's cargo deck runs along +x from the cab wall (x = 0)
// to the rear door, y is up from the ground, z is centered on the truck.

const DECK_Y = 30;                       // load floor height off the ground
const COLORS = {
  living: 0x5b7fa6, bedroom: 0x9b7bc4, kitchen: 0x4f9a75, office: 0xd99a32,
  boxes: 0xc49a6c, misc: 0xcf6656, custom: 0x3f8fa0,
};

export class TruckScene {
  constructor(canvas, { onHover } = {}) {
    this.canvas = canvas;
    this.onHover = onHover;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 5, 8000);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minDistance = 120;
    this.controls.maxDistance = 1400;

    this.truckGroup = new THREE.Group();
    this.itemGroup = new THREE.Group();
    this.leftGroup = new THREE.Group();
    this.scene.add(this.truckGroup, this.itemGroup, this.leftGroup);

    this.meshes = [];          // one per load step, in order
    this.visible = 0;
    this.animations = [];
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(2, 2);

    this.buildStage();
    this.bindEvents();
    this.resize();
    this.renderer.setAnimationLoop((t) => this.tick(t));
  }

  buildStage() {
    this.scene.background = new THREE.Color(0xf3ede3);
    this.scene.fog = new THREE.Fog(0xf3ede3, 1400, 3200);

    this.scene.add(new THREE.HemisphereLight(0xfff8ee, 0xb9a88f, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(260, 520, 340);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -420, right: 420, top: 420, bottom: -420, near: 50, far: 1600 });
    sun.shadow.bias = -0.0004;
    sun.shadow.radius = 4;
    this.sun = sun;
    this.scene.add(sun, sun.target);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(2600, 64),
      new THREE.MeshStandardMaterial({ color: 0xe7dfd2, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Parking-space lines make the scale readable.
    const lines = new THREE.Group();
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xfaf7f1 });
    for (const z of [-80, 80]) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(520, 4), lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(120, 0.2, z);
      lines.add(line);
    }
    this.scene.add(lines);
    this.parkingLines = lines;
  }

  bindEvents() {
    new ResizeObserver(() => this.resize()).observe(this.canvas.parentElement);
    this.canvas.addEventListener('pointermove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      this.pointerPx = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    });
    this.canvas.addEventListener('pointerleave', () => { this.pointer.set(2, 2); this.onHover?.(null); });
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.canvas.parentElement;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(h, 1);
    // On wide layouts the verdict card sits on the left, so draw the truck a little right of center.
    const shift = window.innerWidth > 820 ? Math.min(190, w * 0.15) : 0;
    if (shift) this.camera.setViewOffset(w, h, -shift, -Math.min(40, h * 0.05), w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  /** Rebuilds the truck body for a size. */
  setTruck(truck) {
    this.truck = truck;
    disposeGroup(this.truckGroup);
    const { deck, attic } = truck;
    const g = this.truckGroup;
    const zc = -deck.w / 2;
    const frontX = attic ? -attic.l : 0;

    const white = new THREE.MeshStandardMaterial({ color: 0xfbfaf7, roughness: 0.55, metalness: 0.05 });
    const glassy = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.2, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.7 });
    const teal = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.45 });
    const shadowed = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

    // Wooden load floor.
    const floor = shadowed(new THREE.Mesh(new THREE.BoxGeometry(deck.l, 2, deck.w),
      new THREE.MeshStandardMaterial({ map: plankTexture(deck.l, deck.w), roughness: 0.85 })));
    floor.position.set(deck.l / 2, DECK_Y - 1, 0);
    g.add(floor);

    // The box body: the deck at full height, plus the attic nose overhanging the cab.
    // Driver side and front are solid; roof and passenger side are glass so you can see in.
    const atticY = attic ? DECK_Y + deck.h - attic.h : 0;
    const parts = [{ x0: 0, x1: deck.l, y0: DECK_Y, y1: DECK_Y + deck.h }];
    if (attic) parts.push({ x0: -attic.l, x1: 0, y0: atticY, y1: DECK_Y + deck.h });
    const wallT = 2;
    for (const p of parts) {
      const len = p.x1 - p.x0, hgt = p.y1 - p.y0, cx = (p.x0 + p.x1) / 2, cy = (p.y0 + p.y1) / 2;
      const wall = shadowed(new THREE.Mesh(new THREE.BoxGeometry(len, hgt, wallT), white));
      wall.position.set(cx, cy, zc - wallT / 2);
      const glassSide = new THREE.Mesh(new THREE.PlaneGeometry(len, hgt), glassy);
      glassSide.position.set(cx, cy, -zc);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(len, 1, deck.w), glassy);
      roof.position.set(cx, p.y1 + 0.5, 0);
      const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(len, hgt, deck.w)),
        new THREE.LineBasicMaterial({ color: 0x8a8f98, transparent: true, opacity: 0.6 }));
      outline.position.set(cx, cy, 0);
      g.add(wall, glassSide, roof, outline);
    }
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(deck.l - 10, 7, 0.6), teal);
    stripe.position.set(deck.l / 2, DECK_Y + deck.h * 0.3, zc - wallT - 0.3);
    g.add(stripe);

    const noseH = attic ? attic.h : deck.h;
    const front = shadowed(new THREE.Mesh(new THREE.BoxGeometry(wallT, noseH, deck.w + wallT * 2), white));
    front.position.set(frontX - wallT / 2, DECK_Y + deck.h - noseH / 2, 0);
    g.add(front);
    if (attic) {
      const atticFloor = shadowed(new THREE.Mesh(new THREE.BoxGeometry(attic.l, 2, deck.w), white));
      atticFloor.position.set(-attic.l / 2, atticY - 1, 0);
      const deckFront = shadowed(new THREE.Mesh(new THREE.BoxGeometry(wallT, atticY - DECK_Y, deck.w),
        new THREE.MeshStandardMaterial({ color: 0xece7de, roughness: 0.8 })));
      deckFront.position.set(-wallT / 2, (DECK_Y + atticY) / 2, 0);
      g.add(atticFloor, deckFront);
    }

    // Chassis, then the cab tucked under the attic.
    const chassis = shadowed(new THREE.Mesh(new THREE.BoxGeometry(deck.l + 90, 10, deck.w - 16), dark));
    chassis.position.set((deck.l - 90) / 2, DECK_Y - 9, 0);
    g.add(chassis);

    const cabLen = 66, cabW = deck.w - 6;
    const cabBottom = DECK_Y - 12;
    const cabTop = attic ? atticY - 2 : DECK_Y + Math.min(deck.h - 8, 62);
    const cabH = cabTop - cabBottom;
    const cabX = -2 - cabLen / 2;
    const cab = shadowed(new THREE.Mesh(new RoundedBoxGeometry(cabLen, cabH, cabW, 4, 7), white));
    cab.position.set(cabX, cabBottom + cabH / 2, 0);
    g.add(cab);
    const hood = shadowed(new THREE.Mesh(new RoundedBoxGeometry(30, 32, cabW - 4, 4, 6), white));
    hood.position.set(cabX - cabLen / 2 - 12, DECK_Y + 2, 0);
    g.add(hood);
    const glass = new THREE.MeshStandardMaterial({ color: 0x1e2a36, roughness: 0.15, metalness: 0.3 });
    const windshield = new THREE.Mesh(new THREE.PlaneGeometry(cabW - 14, cabH * 0.36), glass);
    windshield.position.set(cabX - cabLen / 2 - 0.5, cabBottom + cabH * 0.72, 0);
    windshield.rotation.y = -Math.PI / 2;
    g.add(windshield);
    for (const side of [-1, 1]) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(cabLen * 0.5, cabH * 0.32), glass);
      win.position.set(cabX - 8, cabBottom + cabH * 0.72, side * (cabW / 2 + 0.3));
      win.rotation.y = side > 0 ? 0 : Math.PI;
      g.add(win);
    }
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1, 14, cabW - 20), dark);
    grille.position.set(cabX - cabLen / 2 - 27.6, DECK_Y, 0);
    g.add(grille);
    const cabX0 = cabX;

    const wheelGeo = new THREE.CylinderGeometry(16, 16, 10, 28);
    const hubGeo = new THREE.CylinderGeometry(8, 8, 10.6, 20);
    const hubMat = new THREE.MeshStandardMaterial({ color: 0xc9ccd1, metalness: 0.6, roughness: 0.35 });
    for (const x of [cabX0 - 10, deck.l - 46, deck.l - 82]) {
      if (x === deck.l - 82 && deck.l < 200) continue;
      for (const side of [-1, 1]) {
        const wheel = shadowed(new THREE.Mesh(wheelGeo, dark));
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(x, 16, side * (deck.w / 2 - 8));
        const hub = new THREE.Mesh(hubGeo, hubMat);
        hub.rotation.x = Math.PI / 2;
        hub.position.copy(wheel.position);
        g.add(wheel, hub);
      }
    }

    // Loading ramp out the back.
    const ramp = shadowed(new THREE.Mesh(new THREE.BoxGeometry(110, 2, 34),
      new THREE.MeshStandardMaterial({ color: 0xa9adb3, metalness: 0.5, roughness: 0.5 })));
    ramp.position.set(deck.l + 54, DECK_Y / 2, deck.w / 2 - 26);
    ramp.rotation.z = -Math.atan2(DECK_Y, 110);
    g.add(ramp);

    this.parkingLines.position.x = deck.l / 2 - 120;
    this.frame();
  }

  /** Places the camera so the whole truck sits in view. */
  frame() {
    const { deck } = this.truck;
    const pile = this.pileDepth ?? 0;
    const spread = Math.min(pile, 240);
    const target = new THREE.Vector3(deck.l / 2 + spread * 0.3, DECK_Y + deck.h / 2 - spread * 0.2, spread * 0.5);
    const narrow = Math.max(1, 1.45 / this.camera.aspect);   // phones need to stand further back
    const dist = (260 + deck.l * 1.25 + spread * 1.4) * narrow;
    this.camera.position.set(target.x + dist * 0.42, target.y + dist * 0.55, target.z + dist * 0.78);
    this.controls.target.copy(target);
    this.controls.update();
    this.sun.target.position.copy(target);
  }

  /** Swaps in a packing result; `visible` steps are shown immediately. */
  setPlan(result, visible = result.steps.length) {
    disposeGroup(this.itemGroup);
    disposeGroup(this.leftGroup);
    this.meshes = [];
    this.animations = [];
    const { deck, attic } = this.truck;
    const zc = -deck.w / 2;

    result.steps.forEach((step, index) => {
      const mesh = makeItemMesh(step.item, step);
      const baseX = step.region === 'attic' ? -attic.l : 0;
      const baseY = step.region === 'attic' ? DECK_Y + deck.h - attic.h : DECK_Y;
      mesh.position.set(baseX + step.x + step.dx / 2, baseY + step.y + step.dy / 2, zc + step.z + step.dz / 2);
      mesh.userData = { step, index, home: mesh.position.clone() };
      mesh.visible = false;
      this.itemGroup.add(mesh);
      this.meshes.push(mesh);
    });

    // Whatever didn't fit waits on the pavement along the open (passenger) side.
    // Matching boxes stack three high, like a real staging pile.
    const startZ = deck.w / 2 + 40;
    const rowLen = deck.l * 1.5 + 60;
    let cursorX = -20, cursorZ = startZ, rowDepth = 0, last = null;
    for (const item of result.leftover) {
      const [dx, dz, dy] = [item.l, item.w, item.h];
      let pos;
      if (last && item.box && last.item.id === item.id && last.count < 3) {
        pos = last.pos.clone().setY(last.top + dy / 2);
        last.top += dy;
        last.count += 1;
      } else {
        if (cursorX + dx > rowLen) { cursorX = -20; cursorZ += rowDepth + 8; rowDepth = 0; }
        pos = new THREE.Vector3(cursorX + dx / 2, dy / 2, cursorZ + dz / 2);
        last = { item, pos, top: dy, count: 1 };
        cursorX += dx + 6;
        rowDepth = Math.max(rowDepth, dz);
      }
      const mesh = makeItemMesh(item, { dx, dy, dz }, true);
      mesh.position.copy(pos);
      mesh.userData = { leftover: item };
      this.leftGroup.add(mesh);
    }
    this.pileDepth = result.leftover.length ? cursorZ + rowDepth - startZ : 0;
    this.showUpTo(visible, false);
  }

  /**
   * Shows the first `count` steps. With `animate`, the newest one rolls in off the ramp;
   * pieces still in flight from earlier steps keep flying, so fast stepping looks like a stream.
   */
  showUpTo(count, animate = true) {
    const prev = this.visible;
    this.visible = Math.max(0, Math.min(count, this.meshes.length));
    const stepping = animate && this.visible === prev + 1;
    if (!stepping) this.animations = [];
    const flying = new Set(this.animations.map((a) => a.mesh));
    this.meshes.forEach((m, i) => {
      m.visible = i < this.visible;
      if (!flying.has(m)) m.position.copy(m.userData.home);
    });
    if (stepping) {
      const mesh = this.meshes[this.visible - 1];
      const end = mesh.userData.home.clone();
      const start = new THREE.Vector3(this.truck.deck.l + 70, end.y + 26, end.z);
      mesh.position.copy(start);
      this.animations.push({ mesh, start, end, t0: performance.now(), dur: 520 });
    }
    this.leftGroup.visible = this.visible >= this.meshes.length;
  }

  tick(now) {
    for (const a of this.animations) {
      const t = Math.min(1, (now - a.t0) / a.dur);
      const e = 1 - Math.pow(1 - t, 3);
      a.mesh.position.lerpVectors(a.start, a.end, e);
      a.mesh.position.y += Math.sin(t * Math.PI) * 18;   // a little hop over the lip
    }
    this.animations = this.animations.filter((a) => now - a.t0 < a.dur);

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const targets = [...this.meshes.filter((m) => m.visible), ...this.leftGroup.children];
    const hit = this.raycaster.intersectObjects(targets, true)[0];
    const root = hit ? rootOf(hit.object) : null;
    if (root !== this.hovered) {
      if (this.hovered) setHighlight(this.hovered, false);
      this.hovered = root;
      if (root) setHighlight(root, true);
    }
    this.onHover?.(root ? { ...root.userData, at: this.pointerPx } : null);

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

function makeItemMesh(item, dims, ghost = false) {
  const shrink = (d) => Math.max(d - 1.2, d * 0.94);
  const [w, h, d] = [shrink(dims.dx), shrink(dims.dy), shrink(dims.dz)];
  const color = COLORS[item.cat] ?? COLORS.custom;
  const material = new THREE.MeshStandardMaterial({
    color, roughness: item.box ? 0.92 : 0.6,
    transparent: ghost, opacity: ghost ? 0.55 : 1,
    emissive: ghost ? 0x9b1c1c : 0x000000, emissiveIntensity: ghost ? 0.35 : 0,
  });
  const group = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(2.4, w / 5, h / 5, d / 5)), material);
  body.castShadow = !ghost;
  body.receiveShadow = true;
  group.add(body);

  if (item.box) {
    // Packing tape across the top, along the longer side.
    const tape = new THREE.Mesh(new THREE.BoxGeometry(w >= d ? w * 1.002 : 3, 0.5, w >= d ? 3 : d * 1.002),
      new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.4 }));
    tape.position.y = h / 2;
    group.add(tape);
  }
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
    new THREE.LineBasicMaterial({ color: ghost ? 0xb42318 : 0x000000, transparent: true, opacity: ghost ? 0.9 : 0.12 }));
  group.add(edges);
  group.userData.material = material;
  group.userData.baseEmissive = material.emissive.getHex();
  return group;
}

function rootOf(object) {
  let o = object;
  while (o.parent && !o.userData.step && !o.userData.leftover) o = o.parent;
  return o.userData.step || o.userData.leftover ? o : null;
}

function setHighlight(group, on) {
  const m = group.userData.material;
  if (!m) return;
  m.emissive.setHex(on ? 0x3a2a00 : group.userData.baseEmissive);
}

function plankTexture(length, width) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#b98b5b';
  ctx.fillRect(0, 0, 512, 256);
  const rows = 8;
  for (let r = 0; r < rows; r++) {
    const y = (r * 256) / rows;
    ctx.fillStyle = r % 2 ? '#b4844f' : '#c09160';
    ctx.fillRect(0, y, 512, 256 / rows);
    ctx.fillStyle = 'rgba(70,40,15,0.35)';
    ctx.fillRect(0, y, 512, 2);
    for (let k = 0; k < 3; k++) {
      ctx.fillRect(((r * 137 + k * 181) % 512), y, 2, 256 / rows);
    }
  }
  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(length / 120, width / 60);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function disposeGroup(group) {
  for (const child of [...group.children]) {
    child.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) [o.material].flat().forEach((m) => { m.map?.dispose(); m.dispose(); });
    });
    group.remove(child);
  }
}
