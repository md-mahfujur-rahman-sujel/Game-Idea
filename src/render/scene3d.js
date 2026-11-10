import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BUILDINGS, SIM } from '../data/buildings.js';
import { ITEMS } from '../data/items.js';
import { tileKey, DIR_VEC, EDGE_DIR } from '../core/iso.js';
import { socketEdge, beltHasReceiver } from '../core/state.js';

const COLORS = {
  // Deeper, slightly cooler greens: the reference's massed foliage reads as
  // leaf green rather than the yellow-green of a sun-bleached lawn.
  grass: 0xa4da7a,
  grass2: 0x97d475,
  grassDark: 0x7ba243,
  soil: 0x7b5b4e,
  path: 0xc9c7a0,
  blue: 0x5aaef2,
  blueDark: 0x3879c7,
  blueLight: 0xb4d4ff,
  cream: 0xfff4de,
  white: 0xfffbef,
  terra: 0xad4950,
  terraDark: 0x86373f,
  brass: 0xc6d130,
  wood: 0x8a5f4c,
  woodLight: 0xb58a6c,
  mint: 0xccebe7,
  ink: 0x131414,
};

const ITEM_COLORS = Object.fromEntries(Object.entries(ITEMS).map(([key, item]) => [key, item.tint]));
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const gridGeo = new THREE.BoxGeometry(1, 0.18, 1);
// Softly rounded blocks, so machines and props read as toy-like instead of Minecraft-sharp.
const unitGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.12);
const sphereGeo = new THREE.SphereGeometry(0.5, 14, 10);
const blobGeo = new THREE.IcosahedronGeometry(0.5, 2);
const trunkGeo = new THREE.CylinderGeometry(0.6, 0.85, 1, 8);
const grassBladeGeo = new THREE.ConeGeometry(0.075, 0.42, 5, 1);
const pebbleGeo = new THREE.IcosahedronGeometry(0.5, 1);
// Geometry reused across every level rebuild. Clearing a group must not dispose it.
const SHARED_GEO = new Set([unitGeo, gridGeo, sphereGeo, grassBladeGeo, pebbleGeo, blobGeo, trunkGeo]);

export class WorkshopScene3D {
  constructor(ctrl) {
    this.ctrl = ctrl;
    this.level = null;
    this.s = null;
    this.settings = { gridOverlay: false, statusOverlay: true, reducedMotion: false };
    this.selection = null;
    this.build = null;
    this.hoverTile = null;
    this.pathTiles = [];
    this.pathTone = '';
    this.hintTiles = [];
    this.time = 0;
    this.speed = 1;
    this.lastFrame = 0;
    this.drag = null;
    this.activePointers = new Map();
    this.spin = 0;
    this.tiltSpin = 0;
    this.maxDistance = 160;
    this.minDistance = 6.5;
    this.materials = new Map();
    this.beltMeshes = new Map();
    this.itemMeshes = new Map();
    this.ghostMaterial = null;
    this.selectionMaterial = null;
    this.gridMaterial = null;
    this.workerMeshes = [];
    this.windGroups = [];

    this.world = new THREE.Scene();
    // A slightly deeper pastel blue leaves room for the warmer machinery without
    // washing the greens out.
    this.world.background = new THREE.Color(0xa8d0f5);
    this.world.fog = new THREE.Fog(0xa8d0f5, 105, 250);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 450);
    this.cameraTarget = new THREE.Vector3(18, 0, 12);
    // Wheel zoom is anchored on the pointer, which slides the orbit pivot off the island centre
    // on purpose. This remembers where the player deliberately put the pivot, so starting an
    // orbit can unwind only the zoom-induced slide and leave pans and jump-tos alone.
    this.pivotAnchor = this.cameraTarget.clone();
    this.pivotHoming = false;
    // The screen point a zoom glide is converging on, refreshed while the wheel keeps spinning.
    this.zoomAnchor = { x: 0, y: 0 };
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (err) {
      const host = document.getElementById('game');
      if (host) host.textContent = 'This device could not start the 3D view. Try updating your browser or graphics drivers.';
      throw err;
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // ACES dims and greys saturated colours; Neutral keeps the pastels bright.
    this.renderer.toneMapping = THREE.NeutralToneMapping ?? THREE.LinearToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.domElement.setAttribute('role', 'img');
    this.renderer.domElement.setAttribute('aria-label', 'Three-dimensional voxel workshop. Drag to orbit horizontally and vertically around the fixed island center; use the on-screen rotation slider for smooth horizontal rotation and its N button to face north. Right-drag or Shift-drag to pan; scroll to zoom toward the pointer; on touch, twist two fingers to rotate, slide vertically to tilt, pinch to zoom, and slide horizontally to pan.');
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.style.display = 'block';
    document.getElementById('game').replaceChildren(this.renderer.domElement);

    // Keep the fill cool but low, and let a stronger warm sun carry the light:
    // shadowed sides and seams fall into deeper green while the board stays bright.
    this.world.add(new THREE.HemisphereLight(0xdff0ff, 0xb8c98a, 1.5));
    const sun = new THREE.DirectionalLight(0xfff4de, 3.0);
    sun.position.set(-25, 42, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -48;
    sun.shadow.camera.right = 48;
    sun.shadow.camera.top = 48;
    sun.shadow.camera.bottom = -48;
    sun.shadow.bias = -0.0003;
    this.sun = sun;
    this.world.add(sun, sun.target);

    this.groundRoot = new THREE.Group();
    this.decorRoot = new THREE.Group();
    this.objectRoot = new THREE.Group();
    this.beltRoot = new THREE.Group();
    this.bufferRoot = new THREE.Group();
    this.workerRoot = new THREE.Group();
    this.customerRoot = new THREE.Group();
    this.fxRoot = new THREE.Group();
    this.gridRoot = new THREE.Group();
    this.world.add(this.groundRoot, this.decorRoot, this.objectRoot, this.beltRoot, this.bufferRoot, this.workerRoot, this.customerRoot, this.fxRoot, this.gridRoot);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.installInput();
    this.resize();
    this.frame = this.frame.bind(this);
    this.raf = requestAnimationFrame(this.frame);
    if (ctrl?.onSceneReady) ctrl.onSceneReady(this);
  }

  mat(color, opts = {}) {
    const key = `${color}:${opts.opacity ?? 1}:${opts.transparent ? 1 : 0}:${opts.flat ? 1 : 0}`;
    if (this.materials.has(key)) return this.materials.get(key);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.82,
      metalness: 0.04,
      transparent: !!opts.transparent,
      opacity: opts.opacity ?? 1,
      flatShading: opts.flat ?? false,
      depthWrite: !opts.transparent,
    });
    this.materials.set(key, material);
    return material;
  }

  cube(parent, x, y, z, sx, sy, sz, color, opts = {}) {
    const mesh = new THREE.Mesh(unitGeo, this.mat(color, opts));
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = opts.castShadow !== false;
    mesh.receiveShadow = opts.receiveShadow !== false;
    if (opts.name) mesh.name = opts.name;
    parent.add(mesh);
    return mesh;
  }

  ball(parent, x, y, z, scale, color) {
    const mesh = new THREE.Mesh(sphereGeo, this.mat(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(scale, scale, scale);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  addVoxelTree(parent, x, z, scale = 1, fruit = true) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.userData.windPhase = (x * 12.9898 + z * 78.233) % (Math.PI * 2);
    this.windGroups.push(g);
    parent.add(g);
    // Soft rounded trees: a tapered trunk under overlapping smooth foliage blobs.
    const trunk = new THREE.Mesh(trunkGeo, this.mat(COLORS.wood));
    trunk.position.set(0, 0.65 * scale, 0);
    trunk.scale.set(0.3 * scale, 1.3 * scale, 0.3 * scale);
    trunk.castShadow = true;
    g.add(trunk);
    for (const [bx, by, bz, size, color] of [[0, 1.55, 0, 1.3, 0x4f8a10], [-0.38, 1.95, -0.12, 0.95, 0x5a9a12], [0.36, 1.9, 0.2, 0.92, 0x7ba243], [0.02, 2.3, 0, 0.8, 0x9ed12a]]) {
      const blob = new THREE.Mesh(blobGeo, this.mat(color));
      blob.position.set(bx * scale, by * scale, bz * scale);
      blob.scale.setScalar(size * scale);
      blob.castShadow = true;
      g.add(blob);
    }
    if (fruit) {
      for (const [fx, fy, fz, color] of [[-0.5, 1.7, 0.4, 0xc98e7e], [0.55, 1.75, -0.2, 0x9e4b4f], [0.15, 2.0, 0.6, 0xc6cb72]]) {
        const piece = new THREE.Mesh(sphereGeo, this.mat(color));
        piece.position.set(fx * scale, fy * scale, fz * scale);
        piece.scale.setScalar(0.17 * scale);
        g.add(piece);
      }
    }
    return g;
  }

  addFlowerPatch(parent, x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    parent.add(g);
    this.cube(g, 0, 0.12, 0, 0.92, 0.24, 0.66, COLORS.woodLight);
    this.cube(g, 0, 0.27, 0, 0.82, 0.12, 0.55, COLORS.soil);
    [[-0.28, -0.16, 0xc07a78], [0, 0.16, 0xc6cb72], [0.26, -0.12, 0xf2e9d4], [0.2, 0.2, 0xa87e9c]].forEach(([dx, dz, color]) => {
      this.cube(g, dx, 0.47, dz, 0.18, 0.26, 0.18, 0x4d760d);
      this.cube(g, dx, 0.62, dz, 0.22, 0.18, 0.22, color);
    });
    return g;
  }

  addCrates(parent, x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    parent.add(g);
    [[-0.23, 0, 0xc98e7e], [0.24, 0, 0xa3464a], [0, 0.44, 0xc6cb72]].forEach(([dx, dz, fruit]) => {
      this.cube(g, dx, 0.2, dz, 0.44, 0.4, 0.42, COLORS.woodLight);
      this.cube(g, dx, 0.42, dz, 0.44, 0.08, 0.42, COLORS.wood);
      this.cube(g, dx, 0.27, dz - 0.22, 0.42, 0.08, 0.04, COLORS.wood);
      this.cube(g, dx, 0.27, dz + 0.22, 0.42, 0.08, 0.04, COLORS.wood);
      this.cube(g, dx, 0.5, dz, 0.19, 0.18, 0.19, fruit);
    });
    return g;
  }

  // Rebuilds only the centrepiece when the story advances, so each finished chapter shows.
  setLandmarkStage(stage) {
    const next = Math.max(0, Math.min(5, Math.floor(stage || 0)));
    this.landmarkStage = next;
    if (!this.landmarkGroup || !this.landmarkGroup.parent) return;
    const { parent, position } = this.landmarkGroup;
    const x = position.x;
    const z = position.z;
    parent.remove(this.landmarkGroup);
    this.clearGroup(this.landmarkGroup);
    this.addDessertLandmark(parent, x, z, next);
  }

  addDessertLandmark(parent, x, z, stage = this.landmarkStage || 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    parent.add(g);
    this.landmarkGroup = g;
    const cylinder = (rt, rb, h, y, color, segments = 20) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segments), this.mat(color));
      mesh.position.y = y;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
      return mesh;
    };
    cylinder(1.12, 1.25, 0.24, 0.18, COLORS.blueDark);
    cylinder(0.88, 1.02, 0.32, 0.46, COLORS.brass);
    cylinder(0.8, 0.84, 0.78, 0.98, 0xd3a58c);
    cylinder(0.88, 0.78, 0.18, 1.42, COLORS.cream);
    const frosting = new THREE.Mesh(sphereGeo, this.mat(0xfff7e6));
    frosting.position.set(0, 1.54, 0);
    frosting.scale.set(0.8, 0.23, 0.8);
    frosting.castShadow = true;
    g.add(frosting);
    for (const [dx, dz, tint] of [[-0.38, 0.22, 0x9e4b4f], [0.34, 0.28, 0x9e4b4f], [0.16, -0.42, 0xc6cb72]]) {
      const fruit = new THREE.Mesh(sphereGeo, this.mat(tint));
      fruit.position.set(dx, 1.74, dz);
      fruit.scale.set(0.19, 0.17, 0.19);
      fruit.castShadow = true;
      g.add(fruit);
    }
    cylinder(0.12, 0.2, 0.3, 1.88, 0x708549, 8);
    // One addition per finished story chapter, so the centrepiece visibly grows.
    if (stage >= 1) {
      cylinder(0.62, 0.7, 0.3, 1.5, 0xf2c4cf, 20);
      cylinder(0.1, 0.16, 0.26, 1.86, 0x708549, 8).position.y = 2.1;
    }
    if (stage >= 2) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const flag = new THREE.Mesh(sphereGeo, this.mat(i % 2 ? 0xf6b8c4 : 0xa8d8f0));
        flag.position.set(Math.cos(a) * 1.28, 0.62, Math.sin(a) * 1.28);
        flag.scale.set(0.16, 0.16, 0.16);
        g.add(flag);
      }
    }
    if (stage >= 3) {
      cylinder(1.5, 1.6, 0.14, 0.08, COLORS.cream, 28);
    }
    if (stage >= 4) {
      for (const s of [-1, 1]) {
        const gem = new THREE.Mesh(sphereGeo, this.mat(0xffe08a));
        gem.position.set(s * 0.5, 1.66, 0.3);
        gem.scale.set(0.15, 0.2, 0.15);
        g.add(gem);
      }
    }
    if (stage >= 5) {
      const crown = new THREE.Mesh(sphereGeo, this.mat(0xffd35e));
      crown.position.set(0, 2.34, 0);
      crown.scale.set(0.3, 0.3, 0.3);
      g.add(crown);
    }
    // The original cake sculpture anchors the workshop without blocking routes.
    g.scale.setScalar(1.4);
    return g;
  }

  // Hills outside the board, in half-tile steps so they read as voxel terraces. Flat next
  // to the board, rising with distance, and sinking again toward the island rim.
  terrainHeight(x, z) {
    const { gridW, gridH } = this.level;
    const cx = gridW / 2;
    const cz = gridH / 2;
    const out = Math.max(Math.abs(x - cx) - gridW / 2, Math.abs(z - cz) - gridH / 2);
    const t = THREE.MathUtils.clamp((out - 1.5) / 12, 0, 1);
    const ramp = t * t * (3 - 2 * t);
    const n = (Math.sin(x * 0.21) + Math.cos(z * 0.17) + 0.8 * Math.sin((x + z) * 0.11) + 0.5 * Math.sin(x * 0.43 + z * 0.37) + 3.3) / 6.6;
    // Beyond the meadow the land keeps going: broad hills rise toward the horizon and
    // flatten again at the far edge, which sits inside the fog, so there is no visible rim.
    const dist = Math.hypot(x - cx, z - cz);
    const far = THREE.MathUtils.smoothstep(dist, 56, 125) * (1 - THREE.MathUtils.smoothstep(dist, 150, 190));
    const farNoise = (Math.sin(x * 0.055 + 1.3) + Math.cos(z * 0.048) + 0.6 * Math.sin((x - z) * 0.037) + 2.6) / 5.2;
    return ramp * (0.4 + n * 3.0) + far * (2 + farNoise * 9);
  }

  // A round island: voxel grass columns over dirt, tapering into a soil and stone keel,
  // so the world reads as a small planet with real depth instead of a flat slab.
  buildIsland() {
    const { gridW, gridH } = this.level;
    const cx = gridW / 2;
    const cz = gridH / 2;
    // R stays the radius of the detailed meadow (scenery); W is the whole continuous world.
    const R = Math.max(gridW, gridH) * 1.15;
    const W = 190;
    this.islandRadius = R;
    if (this.islandMaterial) this.islandMaterial.dispose();
    this.islandMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.95, side: THREE.DoubleSide });

    // Top surface: a polar grid of smooth rolling hills that rolls over into a rounded shoulder.
    const rings = 170;
    const segs = 240;
    const positions = [];
    const colors = [];
    const indices = [];
    const grass = new THREE.Color(0x97d475);
    const light = new THREE.Color(0xa9e889);
    const haze = new THREE.Color(0xa8d0f5);
    const hill = new THREE.Color(0x6fb35e);
    const c = new THREE.Color();
    for (let i = 0; i <= rings; i++) {
      // Denser rings near the board, wider ones out in the hills.
      const u = i / rings;
      const rho = (u * u * 0.55 + u * 0.45) * W;
      for (let j = 0; j < segs; j++) {
        const a = (j / segs) * Math.PI * 2;
        const x = cx + Math.cos(a) * rho;
        const z = cz + Math.sin(a) * rho;
        const y = this.terrainHeight(x, z) - 0.22;
        positions.push(x, y, z);
        const variation = (Math.sin(x * 0.9 + z * 0.4) + Math.cos(z * 0.72 - x * 0.18)) * 0.035;
        c.copy(grass).lerp(light, THREE.MathUtils.clamp((y + 0.22) / 3 + variation, 0, 1));
        // Distant ground turns deeper green with height, then hazes toward the sky.
        c.lerp(hill, THREE.MathUtils.smoothstep(rho, 50, 110) * 0.55);
        c.lerp(haze, THREE.MathUtils.smoothstep(rho, 110, 185) * 0.7);
        colors.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < segs; j++) {
        const a = i * segs + j;
        const b = i * segs + (j + 1) % segs;
        const c2 = (i + 1) * segs + j;
        const d = (i + 1) * segs + (j + 1) % segs;
        indices.push(a, b, c2, b, d, c2);
      }
    }
    const topGeo = new THREE.BufferGeometry();
    topGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    topGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    topGeo.setIndex(indices);
    topGeo.computeVertexNormals();
    const top = new THREE.Mesh(topGeo, this.islandMaterial);
    top.receiveShadow = true;
    top.frustumCulled = false;
    this.groundRoot.add(top);

    this.addFarForest(cx, cz);

    if (this.sun) {
      this.sun.position.set(cx - 25, 42, cz + 20);
      this.sun.target.position.set(cx, 0, cz);
      this.sun.target.updateMatrixWorld();
    }
  }

  // Instanced blobs on the distant hills, so the horizon reads as forested land.
  addFarForest(cx, cz) {
    const count = 900;
    const mesh = new THREE.InstancedMesh(blobGeo, this.mat(0xffffff), count);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const haze = new THREE.Color(0xa8d0f5);
    const palette = [0x5a9a12, 0x4f8a10, 0x6aab20, 0x468010];
    let seed = 4242;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let i = 0;
    for (let tries = 0; tries < 4000 && i < count; tries++) {
      const a = rnd() * Math.PI * 2;
      const r = 52 + Math.sqrt(rnd()) * 118;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      const scale = 2.2 + rnd() * 3.2;
      dummy.position.set(x, this.terrainHeight(x, z) - 0.22 + scale * 0.35, z);
      dummy.rotation.set(0, rnd() * Math.PI * 2, 0);
      dummy.scale.set(scale * 1.1, scale * (0.8 + rnd() * 0.3), scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.setHex(palette[Math.floor(rnd() * palette.length)]);
      color.lerp(haze, THREE.MathUtils.smoothstep(r, 90, 185) * 0.6);
      mesh.setColorAt(i++, color);
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    this.groundRoot.add(mesh);
  }

  addGreenhouse(parent, x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    parent.add(g);
    this.cube(g, 0, 0.14, 0, 1.95, 0.28, 1.95, COLORS.woodLight);
    this.cube(g, 0, 0.78, 0, 1.75, 0.9, 1.75, 0xdce9f0, { transparent: true, opacity: 0.5, castShadow: false });
    for (const [dx, dz] of [[-0.86, -0.86], [0.86, -0.86], [-0.86, 0.86], [0.86, 0.86]]) {
      this.cube(g, dx, 0.78, dz, 0.1, 0.95, 0.1, COLORS.blue);
    }
    this.cube(g, 0, 1.3, 0, 1.95, 0.12, 1.95, COLORS.blue);
    this.cube(g, 0, 1.45, 0, 1.45, 0.18, 1.45, COLORS.blueLight);
    this.cube(g, 0, 1.62, 0, 0.9, 0.16, 0.9, 0xdce9f0);
    for (const [dx, dz, c] of [[-0.4, -0.3, 0x4d760d], [0.35, 0.3, 0x89b215], [0.3, -0.4, 0x557f2f], [-0.35, 0.4, 0x89b215]]) {
      this.cube(g, dx, 0.55, dz, 0.3, 0.5, 0.3, c);
    }
    return g;
  }

  addWindsock(parent, x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    parent.add(g);
    this.cube(g, 0, 1.1, 0, 0.07, 2.2, 0.07, COLORS.wood);
    for (let i = 0; i < 4; i++) {
      this.cube(g, 0.14 + i * 0.2, 2.05 - i * 0.03, 0, 0.22, 0.22 - i * 0.04, 0.22 - i * 0.04, i % 2 ? COLORS.cream : COLORS.terra);
    }
    return g;
  }

  // A blank ceramic-style sign: no lettering, so it can never carry anyone's mark.
  addSign(parent, x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    parent.add(g);
    this.cube(g, 0, 0.45, 0, 0.1, 0.9, 0.1, COLORS.wood);
    this.cube(g, 0, 1.0, 0, 0.78, 0.5, 0.1, COLORS.blue);
    this.cube(g, 0, 1.0, 0.04, 0.58, 0.32, 0.06, COLORS.cream);
    this.cube(g, 0, 1.0, 0.08, 0.16, 0.16, 0.05, COLORS.terra);
    return g;
  }

  // Hedges along the north and south margins plus scattered trees in the surrounding
  // meadow, so the board reads as part of a larger world. Margins are never buildable.
  addBorderScenery() {
    const { gridW, gridH } = this.level;
    for (const z of [0.55, gridH - 0.55]) {
      for (let i = 0, x = 2.5; x < gridW - 2; x += 1, i++) {
        if (i % 9 === 4) {
          this.addFlowerPatch(this.decorRoot, x, z);
          continue;
        }
        const shrub = new THREE.Group();
        shrub.position.set(x, 0.14, z);
        this.decorRoot.add(shrub);
        for (const [dx, dz, size, tint] of [[-0.28, 0, 0.38, 0x4d760d], [0.05, -0.06, 0.48, 0x5e8a33], [0.34, 0.02, 0.36, 0x708549]]) {
          const leaf = new THREE.Mesh(blobGeo, this.mat(tint));
          leaf.position.set(dx, 0.35, dz);
          leaf.scale.set(size * 1.25, size * 0.82, size);
          leaf.castShadow = true;
          shrub.add(leaf);
        }
      }
    }
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const cx = gridW / 2;
    const cz = gridH / 2;
    let placed = 0;
    for (let tries = 0; tries < 900 && placed < 80; tries++) {
      const a = rnd() * Math.PI * 2;
      const r = 12 + rnd() * (this.islandRadius - 14);
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r * 0.95;
      if (x > -3 && x < gridW + 3 && z > -3 && z < gridH + 3) continue;
      if (Math.hypot(x - cx, z - cz) > this.islandRadius - 6) continue;
      const tree = this.addVoxelTree(this.groundRoot, x, z, 0.9 + rnd() * 0.8, rnd() > 0.75);
      tree.position.y = this.terrainHeight(x, z) - 0.22;
      placed++;
    }
  }

  addIslandGroundLife() {
    const { gridW, gridH } = this.level;
    const cx = gridW / 2;
    const cz = gridH / 2;
    let seed = 7351;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pick = (margin = 2.5) => {
      for (let tries = 0; tries < 120; tries++) {
        const a = rnd() * Math.PI * 2;
        const r = 15 + rnd() * (this.islandRadius - 18);
        const x = cx + Math.cos(a) * r;
        const z = cz + Math.sin(a) * r * 0.95;
        const onBoard = x > -margin && x < gridW + margin && z > -margin && z < gridH + margin;
        if (!onBoard && Math.hypot(x - cx, z - cz) < this.islandRadius - 4) return [x, z];
      }
      return null;
    };

    const grass = new THREE.InstancedMesh(grassBladeGeo, this.mat(0xffffff), 560);
    const flowers = new THREE.InstancedMesh(sphereGeo, this.mat(0xffffff), 104);
    const stones = new THREE.InstancedMesh(pebbleGeo, this.mat(0xffffff), 52);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let g = 0;
    let f = 0;
    let s = 0;
    const flowerColors = [0xc6cb72, 0xc07a78, 0xf2e9d4, 0xb48aa6];
    for (let cluster = 0; cluster < 210; cluster++) {
      const point = pick();
      if (!point) continue;
      const [x, z] = point;
      const y = this.terrainHeight(x, z) - 0.18;
      const blades = 2 + Math.floor(rnd() * 3);
      for (let i = 0; i < blades && g < 560; i++) {
        dummy.position.set(x + (rnd() - 0.5) * 0.42, y + 0.2, z + (rnd() - 0.5) * 0.42);
        dummy.rotation.set((rnd() - 0.5) * 0.18, rnd() * Math.PI, (rnd() - 0.5) * 0.18);
        const scale = 0.55 + rnd() * 0.85;
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        grass.setMatrixAt(g, dummy.matrix);
        color.setHSL(0.25 + rnd() * 0.06, 0.42 + rnd() * 0.18, 0.37 + rnd() * 0.17);
        grass.setColorAt(g++, color);
      }
      if (cluster % 5 === 0 && f < 104) {
        dummy.position.set(x, y + 0.28, z);
        dummy.scale.setScalar(0.11 + rnd() * 0.06);
        dummy.rotation.set(0, rnd() * Math.PI * 2, 0);
        dummy.updateMatrix();
        flowers.setMatrixAt(f, dummy.matrix);
        flowers.setColorAt(f++, color.setHex(flowerColors[Math.floor(rnd() * flowerColors.length)]));
      }
      if (cluster % 7 === 0 && s < 52) {
        const stoneScale = 0.24 + rnd() * 0.44;
        dummy.position.set(x + (rnd() - 0.5) * 0.7, y + stoneScale * 0.34, z + (rnd() - 0.5) * 0.7);
        dummy.scale.set(stoneScale * (0.8 + rnd() * 0.6), stoneScale * 0.68, stoneScale);
        dummy.rotation.set(rnd() * 0.5, rnd() * Math.PI, rnd() * 0.4);
        dummy.updateMatrix();
        stones.setMatrixAt(s, dummy.matrix);
        color.setHex([0x8d9a94, 0xa6b0aa, 0x74807a][Math.floor(rnd() * 3)]);
        stones.setColorAt(s++, color);
      }
    }
    for (const [instanced, count] of [[grass, g], [flowers, f], [stones, s]]) {
      instanced.count = count;
      instanced.instanceMatrix.needsUpdate = true;
      if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
      instanced.castShadow = instanced !== grass;
      instanced.receiveShadow = true;
      this.groundRoot.add(instanced);
    }
  }

  // A dense, dark ring of foliage around the island's shoulder. It frames the
  // default view with layered green instead of open sky, and supplies the deep
  // foreground shadow that makes the reference feel lush and enclosed.
  addRimThicket() {
    const { gridW, gridH } = this.level;
    const cx = gridW / 2;
    const cz = gridH / 2;
    const R = this.islandRadius || Math.max(gridW, gridH) * 1.15;
    let seed = 90210;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const count = 190;
    const mesh = new THREE.InstancedMesh(blobGeo, this.mat(0xffffff), count);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const palette = [0x5a9a12, 0x6aab20, 0x7ba243, 0x4f8a10, 0x8cc43a];
    let i = 0;
    while (i < count) {
      const a = rnd() * Math.PI * 2;
      const r = R * (0.76 + rnd() * 0.2);
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r * 0.98;
      const base = this.terrainHeight(x, z) - 0.22;
      const cluster = 2 + Math.floor(rnd() * 3);
      for (let k = 0; k < cluster && i < count; k++) {
        const scale = 0.9 + rnd() * 1.6;
        dummy.position.set(x + (rnd() - 0.5) * 1.1, base + scale * 0.42, z + (rnd() - 0.5) * 1.1);
        dummy.rotation.set(rnd() * 0.4, rnd() * Math.PI * 2, rnd() * 0.3);
        dummy.scale.set(scale * (1 + rnd() * 0.4), scale * (0.7 + rnd() * 0.3), scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        color.setHex(palette[Math.floor(rnd() * palette.length)]);
        color.offsetHSL(0, 0, (rnd() - 0.5) * 0.06);
        mesh.setColorAt(i, color);
        i++;
      }
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.groundRoot.add(mesh);

    // A taller outer canopy closes the bottom corners with dark leaves instead
    // of open sky, so the board sits inside the meadow rather than floating in it.
    const canopyCount = 64;
    const canopy = new THREE.InstancedMesh(blobGeo, this.mat(0xffffff), canopyCount);
    const canopyPalette = [0x4f8a10, 0x5a9a12, 0x64a31a, 0x468010];
    let ci = 0;
    while (ci < canopyCount) {
      const a = rnd() * Math.PI * 2;
      const r = R * (0.88 + rnd() * 0.11);
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r * 0.98;
      const base = this.terrainHeight(x, z) - 0.22;
      const cluster = 2 + Math.floor(rnd() * 2);
      for (let k = 0; k < cluster && ci < canopyCount; k++) {
        const scale = 1.5 + rnd() * 1.8;
        dummy.position.set(x + (rnd() - 0.5) * 1.4, base + scale * 0.55, z + (rnd() - 0.5) * 1.4);
        dummy.rotation.set(rnd() * 0.4, rnd() * Math.PI * 2, rnd() * 0.3);
        dummy.scale.set(scale * (1 + rnd() * 0.5), scale * (0.85 + rnd() * 0.4), scale);
        dummy.updateMatrix();
        canopy.setMatrixAt(ci, dummy.matrix);
        color.setHex(canopyPalette[Math.floor(rnd() * canopyPalette.length)]);
        color.offsetHSL(0, 0, (rnd() - 0.5) * 0.05);
        canopy.setColorAt(ci, color);
        ci++;
      }
    }
    canopy.count = ci;
    canopy.instanceMatrix.needsUpdate = true;
    if (canopy.instanceColor) canopy.instanceColor.needsUpdate = true;
    canopy.castShadow = true;
    canopy.receiveShadow = true;
    this.groundRoot.add(canopy);
  }

  drawGround() {
    this.clearGroup(this.groundRoot);
    this.clearGroup(this.decorRoot);
    // Margins and plots are raised 0.14, so the scenery standing on them is lifted to match.
    this.decorRoot.position.y = 0.14;
    const { gridW, gridH, x0, x1, y0, y1, blocked = [] } = this.level;
    // InstancedMesh uses instanceColor on its own; enabling vertexColors here
    // would read a missing per-vertex color attribute from BoxGeometry and turn
    // every grass tile black.
    if (this.groundMaterial) this.groundMaterial.dispose();
    this.groundMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    const mesh = new THREE.InstancedMesh(gridGeo, this.groundMaterial, gridW * gridH);
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    let index = 0;
    for (let z = 0; z < gridH; z++) {
      for (let x = 0; x < gridW; x++) {
        const nonBuildable = x < x0 || x > x1 || z < y0 || z > y1;
        const inBlocked = blocked.some(([bx, by, bw, bh]) => x >= bx && x < bx + bw && z >= by && z < by + bh);
        // Raised margins and plots frame a slightly sunken work pad, giving the ground depth.
        if (nonBuildable || inBlocked) matrix.makeScale(1, 1.8, 1).setPosition(x + 0.5, -0.022, z + 0.5);
        else matrix.makeTranslation(x + 0.5, -0.09, z + 0.5);
        mesh.setMatrixAt(index, matrix);
        // Soft per-tile variation instead of a hard checkerboard: reads as grass, not a chessboard.
        const jitter = ((Math.imul(x, 73856093) ^ Math.imul(z, 19349663)) >>> 0) % 1000 / 1000 - 0.5;
        if (inBlocked) color.setHex(0x97d475).offsetHSL(0, 0, jitter * 0.03);
        else if (nonBuildable) color.setHex(0x83b04a).offsetHSL(0, 0, jitter * 0.03);
        else if (x >= x1 - 3) color.setHex(0xe3dcab).offsetHSL(0, 0, jitter * 0.03);
        else color.setHex(0xa4da7a).offsetHSL(0, 0, jitter * 0.035 + ((x + z) % 2 ? 0.008 : 0));
        mesh.setColorAt(index++, color);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.receiveShadow = true;
    this.groundRoot.add(mesh);

    const edge = new THREE.Mesh(new THREE.BoxGeometry(gridW + 0.3, 6, gridH + 0.3), this.mat(0x6e5447));
    edge.position.set(gridW / 2, -3.17, gridH / 2);
    edge.receiveShadow = true;
    this.groundRoot.add(edge);

    this.buildIsland();
    this.windGroups = [];
    this.addIslandGroundLife();
    this.addRimThicket();

    this.buildGridLines();
    const centerX = gridW / 2;
    const centerZ = gridH / 2;
    this.addDessertLandmark(this.decorRoot, centerX, centerZ, this.landmarkStage || 0);
    for (const [bx, by, bw, bh] of blocked) {
      if (Math.abs(bx + bw / 2 - centerX) < 0.2 && Math.abs(by + bh / 2 - centerZ) < 0.2) continue;
      if (bx < centerX) {
        // orchard side: greenhouses in the corner plots
        this.addGreenhouse(this.decorRoot, bx + bw / 2, by + bh / 2);
      } else {
        this.addVoxelTree(this.decorRoot, bx + 0.8, by + 1.1, 0.9, true);
        this.addWindsock(this.decorRoot, bx + 1.5, by + 0.5);
      }
      this.addFlowerPatch(this.decorRoot, bx + bw + 0.4, by + 0.6);
    }
    for (let z = 3; z < gridH - 2; z += 5) {
      this.addVoxelTree(this.decorRoot, 0.9, z + 0.5, 0.9, z % 2 === 0);
      this.addVoxelTree(this.decorRoot, gridW - 1.0, z + 0.5, 0.82, true);
    }
    this.addCrates(this.decorRoot, gridW - 1.8, centerZ - 3.2);
    this.addCrates(this.decorRoot, gridW - 1.8, centerZ + 3.2);
    this.addMarketStall(this.decorRoot, gridW - 1.4, centerZ);
    this.addSign(this.decorRoot, gridW - 1.0, centerZ - 2.2);
    this.addSign(this.decorRoot, gridW - 1.0, centerZ + 2.2);
    this.addBorderScenery();
  }

  buildGridLines() {
    this.clearGroup(this.gridRoot);
    if (!this.gridRoot || !this.settings.gridOverlay || !this.level) return;
    const points = [];
    for (let x = 0; x <= this.level.gridW; x++) {
      points.push(new THREE.Vector3(x, 0.014, 0), new THREE.Vector3(x, 0.014, this.level.gridH));
    }
    for (let z = 0; z <= this.level.gridH; z++) {
      points.push(new THREE.Vector3(0, 0.014, z), new THREE.Vector3(this.level.gridW, 0.014, z));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    if (!this.gridMaterial) {
      this.gridMaterial = new THREE.LineBasicMaterial({ color: 0x3c5842, transparent: true, opacity: 0.22 });
    }
    this.gridRoot.add(new THREE.LineSegments(geometry, this.gridMaterial));
  }

  addMarketStall(parent, x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    parent.add(g);
    this.cube(g, 0, 0.36, 0, 2.2, 0.72, 1.65, 0xf2e9d4);
    this.cube(g, 0, 0.82, 0, 2.35, 0.18, 1.8, COLORS.wood);
    for (let i = 0; i < 7; i++) {
      const x0 = -1.04 + i * 0.35;
      this.cube(g, x0, 1.24, 0, 0.34, 0.62, 1.85, i % 2 ? 0xc6cb72 : 0x9cbbe2);
    }
    for (const [dx, dz, c] of [[-0.55, 0.5, 0xc98e7e], [0, 0.5, 0xa3464a], [0.55, 0.5, 0xc6cb72]]) {
      this.cube(g, dx, 0.91, dz, 0.34, 0.2, 0.34, c);
    }
    return g;
  }

  clearGroup(group) {
    if (!group) return;
    while (group.children.length) {
      const child = group.children[group.children.length - 1];
      group.remove(child);
      if (child.children && child.children.length) this.clearGroup(child);
      if (child.geometry && !SHARED_GEO.has(child.geometry)) child.geometry.dispose();
    }
  }

  // Belt item meshes live directly in the world scene, not in a root that refreshAll
  // clears. Remove them explicitly so a rebuild cannot leave stale items behind.
  clearItemMeshes() {
    for (const mesh of this.itemMeshes.values()) {
      this.world.remove(mesh);
      this.clearGroup(mesh);
    }
    this.itemMeshes.clear();
  }

  setLevel(level) {
    this.level = level;
    if (!this.gridRoot) {
      this.gridRoot = new THREE.Group();
      this.world.add(this.gridRoot);
    }
    this.drawGround();
    this.centerOnLevel();
    this.buildGridLines();
  }

  setState(state) {
    this.s = state;
  }

  addBuildingModel(o) {
    const def = BUILDINGS[o.type];
    const g = new THREE.Group();
    g.position.set(o.x, 0, o.y);
    g.rotation.y = -(o.rot || 0) * Math.PI / 2;
    g.userData.objectId = o.id;
    const w = def.w;
    const d = def.h;
    const cx = w / 2;
    const cz = d / 2;
    const base = (color = 0xc9b49c, height = 0.44) => this.cube(g, cx, height / 2, cz, w * 0.92, height, d * 0.92, color);

    // Shared toy-style helpers: rounded cylinders, blobs and a friendly face (PRD 9 style).
    const front = cz + 0.42;
    this.cylCache = this.cylCache || new Map();
    const cyl = (rt, rb, h, x, y, z, color, seg = 20) => {
      const key = `${rt}|${rb}|${h}|${seg}`;
      let geo = this.cylCache.get(key);
      if (!geo) {
        geo = new THREE.CylinderGeometry(rt, rb, h, seg);
        SHARED_GEO.add(geo);
        this.cylCache.set(key, geo);
      }
      const m = new THREE.Mesh(geo, this.mat(color));
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };
    const blob = (x, y, z, sx, sy, sz, color, shadow = true) => {
      const m = new THREE.Mesh(sphereGeo, this.mat(color));
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      m.castShadow = shadow;
      g.add(m);
      return m;
    };
    const face = (y, zf = front, fx = cx) => {
      for (const s of [-1, 1]) {
        blob(fx + s * 0.16, y, zf, 0.1, 0.12, 0.05, 0x1f2325, false);
        blob(fx + s * 0.16 + 0.02, y + 0.04, zf + 0.03, 0.035, 0.035, 0.02, 0xffffff, false);
        blob(fx + s * 0.28, y - 0.1, zf - 0.01, 0.1, 0.06, 0.04, 0xf2a3a3, false);
      }
      blob(fx, y - 0.09, zf + 0.02, 0.12, 0.05, 0.04, 0x7a4a42, false);
    };

    if (o.type === 'orchard') {
      base(0x5e4a3c, 0.25);
      this.cube(g, cx, 0.31, cz, 1.88, 0.16, 1.88, 0x86b77b);
      this.addVoxelTree(g, 0.64, 0.8, 0.78, true);
      this.addVoxelTree(g, 1.36, 1.32, 0.68, true);
      cyl(0.2, 0.17, 0.2, 1.62, 0.4, 0.42, COLORS.woodLight, 14);
      blob(1.56, 0.54, 0.42, 0.16, 0.16, 0.16, 0xd9a18c);
      blob(1.68, 0.52, 0.38, 0.16, 0.16, 0.16, 0x9e4b4f);
    } else if (o.type === 'teaPatch') {
      base(COLORS.soil, 0.26);
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 5; col++) {
          const lush = col % 2 ? 0x5f9f3a : 0x89c23a;
          blob(0.28 + col * 0.36, 0.52, 0.38 + row * 0.56, 0.34, 0.3, 0.34, lush);
          blob(0.28 + col * 0.36, 0.66, 0.38 + row * 0.56, 0.2, 0.18, 0.2, 0xb6dc6a, false);
        }
      }
    } else if (o.type === 'waterPump') {
      base(0x8a6a58, 0.3);
      cyl(0.46, 0.5, 0.64, cx, 0.62, cz, 0xb9a79a);
      cyl(0.4, 0.4, 0.04, cx, 0.96, cz, 0x6da8e1);
      cyl(0.5, 0.5, 0.08, cx, 0.95, cz, 0xe3d5c4);
      face(0.66, cz + 0.46);
      for (const s of [-1, 1]) cyl(0.05, 0.05, 0.8, cx + s * 0.42, 1.38, cz, COLORS.wood, 8);
      cyl(0.0, 0.6, 0.3, cx, 1.94, cz, COLORS.terra, 4).rotation.y = Math.PI / 4;
      cyl(0.04, 0.04, 0.8, cx, 1.6, cz, COLORS.wood, 8).rotation.z = Math.PI / 2;
      cyl(0.13, 0.1, 0.16, cx, 1.28, cz, COLORS.brass, 12);
    } else if (o.type === 'dairyCrate') {
      base(COLORS.wood, 0.24);
      this.cube(g, cx, 0.62, cz, 0.86, 0.72, 0.82, COLORS.woodLight);
      face(0.64, cz + 0.42);
      for (const [mx, mz] of [[-0.24, -0.1], [0, 0.0], [0.24, -0.1]]) {
        cyl(0.11, 0.12, 0.42, cx + mx, 1.2, cz + mz, COLORS.cream, 14);
        cyl(0.07, 0.07, 0.1, cx + mx, 1.46, cz + mz, COLORS.blue, 10);
        blob(cx + mx, 1.33, cz + mz + 0.1, 0.1, 0.12, 0.03, 0x6da8e1, false);
      }
    } else if (o.type === 'freezer') {
      base(0x4972a3, 0.3);
      this.cube(g, cx, 0.94, cz, 1.72, 1.08, 1.72, 0x9cbbe2);
      this.cube(g, cx, 1.58, cz, 1.86, 0.2, 1.86, 0xdce9f0);
      for (const [fx, fz, fs] of [[0.4, 0.5, 0.3], [1.0, 0.3, 0.24], [1.5, 0.75, 0.28], [0.6, 1.5, 0.22]]) blob(fx, 1.74, fz, fs, fs * 0.6, fs, 0xf4fbff, false);
      for (const sx of [-1, 1]) {
        blob(cx + sx * 0.28, 1.34, 1.1, 0.12, 0.14, 0.05, 0x1f2325, false);
        blob(cx + sx * 0.28 + 0.02, 1.38, 1.13, 0.04, 0.04, 0.02, 0xffffff, false);
        blob(cx + sx * 0.46, 1.22, 1.08, 0.12, 0.07, 0.04, 0xf2a3a3, false);
      }
      this.cube(g, cx, 0.94, 1.06, 1.2, 0.82, 0.12, 0xc9deea);
      this.cube(g, 1.54, 0.97, 1.12, 0.12, 0.68, 0.12, COLORS.brass);
      this.cube(g, 0.44, 1.42, 1.08, 0.17, 0.7, 0.12, 0xf2f7f6);
      this.cube(g, 0.44, 1.15, 1.16, 0.12, 0.24, 0.08, 0xc07a78);
      for (let i = 0; i < 3; i++) this.cube(g, 0.58 + i * 0.42, 1.7, 1.14, 0.16, 0.08, 0.12, 0xe4f1f7);
    } else if (o.type === 'counter') {
      base(0x7a5a4a, 0.34);
      this.cube(g, cx, 0.73, cz, 1.74, 0.62, 1.72, 0xf2e9d4);
      this.cube(g, cx, 1.1, cz, 1.94, 0.16, 1.88, COLORS.wood);
      this.cube(g, cx, 1.0, cz + 0.88, 1.52, 0.32, 0.12, 0x9cbbe2);
      for (let i = 0; i < 8; i++) this.cube(g, 0.08 + i * 0.26, 1.63, cz, 0.23, 0.76, 1.98, i % 2 ? 0xc6cb72 : 0x6da8e1);
      this.cube(g, cx, 2.03, cz, 2.04, 0.12, 2.05, COLORS.blueDark);
      this.cube(g, cx, 2.12, cz, 1.86, 0.1, 1.86, 0xc6cb72);
      // scalloped awning edge, a bell and an ice-cream cone sign on top
      for (let i = 0; i < 8; i++) blob(0.12 + i * 0.25, 1.28, cz + 0.98, 0.26, 0.2, 0.2, i % 2 ? 0xc6cb72 : 0x6da8e1);
      blob(cx, 2.42, cz, 0.34, 0.34, 0.34, 0xf6b8c4);
      cyl(0.0, 0.17, 0.34, cx, 2.18, cz, 0xe3b877, 12).rotation.x = Math.PI;
      blob(cx, 2.62, cz, 0.12, 0.12, 0.12, 0x9e4b4f);
      blob(cx + 0.7, 1.24, cz + 0.8, 0.16, 0.16, 0.16, COLORS.brass);
    } else {
      const palettes = {
        washer: [0x618fbb, 0x9cbbe2],
        press: [0xa0655a, 0xc6cb72],
        brewer: [0x4972a3, 0x8fb2d8],
        mixer: [0xa0655a, 0xd3a48c],
      };
      const [body, accent] = palettes[o.type] || [COLORS.blue, COLORS.blueLight];
      base(0x7a5a4a, 0.3);
      if (o.type === 'washer') {
        cyl(0.42, 0.46, 0.92, cx, 0.76, cz, body);
        cyl(0.46, 0.46, 0.1, cx, 1.26, cz, accent);
        blob(cx, 0.5, cz + 0.36, 0.34, 0.3, 0.12, 0xdfeaf2);
        blob(cx, 0.49, cz + 0.4, 0.24, 0.2, 0.1, 0x2e7bd7);
        face(1.1, cz + 0.4);
        for (const [bx, by, bz, bs] of [[-0.15, 1.45, 0.05, 0.2], [0.12, 1.58, -0.08, 0.16], [0.2, 1.4, 0.12, 0.12]]) blob(cx + bx, by, cz + bz, bs, bs, bs, 0xe9f6ff, false);
      } else if (o.type === 'press') {
        this.cube(g, cx, 0.62, cz, 0.84, 0.64, 0.84, body);
        face(0.66);
        cyl(0.38, 0.38, 0.1, cx, 1.02, cz, COLORS.terra);
        cyl(0.09, 0.09, 0.8, cx, 1.45, cz, COLORS.brass, 10);
        this.cube(g, cx, 1.88, cz, 0.74, 0.1, 0.1, COLORS.woodLight);
        blob(cx - 0.37, 1.88, cz, 0.16, 0.16, 0.16, accent);
        blob(cx + 0.37, 1.88, cz, 0.16, 0.16, 0.16, accent);
      } else if (o.type === 'brewer') {
        blob(cx, 0.92, cz, 0.84, 0.78, 0.84, body);
        face(0.94, cz + 0.38);
        cyl(0.2, 0.32, 0.12, cx, 1.34, cz, accent);
        blob(cx, 1.46, cz, 0.14, 0.14, 0.14, COLORS.brass);
        blob(cx + 0.46, 0.98, cz, 0.34, 0.14, 0.14, COLORS.brass);
        blob(cx - 0.44, 0.96, cz, 0.12, 0.34, 0.12, COLORS.brass);
        for (const [sy, ss] of [[1.7, 0.16], [1.92, 0.2]]) blob(cx, sy, cz, ss, ss, ss, 0xf4fbff, false);
      } else if (o.type === 'mixer') {
        this.cube(g, cx, 0.58, cz, 0.84, 0.56, 0.84, body);
        face(0.6);
        cyl(0.42, 0.3, 0.34, cx, 1.04, cz, accent);
        cyl(0.38, 0.38, 0.02, cx, 1.22, cz, 0xf2c4cf);
        cyl(0.08, 0.08, 0.84, cx - 0.32, 1.38, cz - 0.12, COLORS.brass, 10);
        this.cube(g, cx - 0.08, 1.8, cz - 0.12, 0.6, 0.12, 0.12, COLORS.cream);
        blob(cx + 0.18, 1.52, cz - 0.12, 0.12, 0.34, 0.12, 0xdcdcdc);
      } else {
        this.cube(g, cx, 0.88, cz, 0.82, 1.12, 0.82, body);
        this.cube(g, cx, 1.48, cz, 0.9, 0.16, 0.9, accent);
        face(0.9);
      }
    }

    if (o.inputs) o.inputs.forEach((socket, index) => {
      const edge = socketEdge(o, index);
      const p = this.portPosition(o, edge);
      this.cube(g, p.x, 0.68, p.z, 0.22, 0.22, 0.22, socket.family === 'water' ? 0x6da8e1 : socket.family === 'cream' ? 0xf2e9d4 : 0xc6cb72);
      if (socket.label) this.cube(g, p.x, 0.9, p.z, 0.12, 0.12, 0.12, 0xfbf5e1);
    });
    for (const lane of o.lanes || []) {
      const localDirection = EDGE_DIR[lane.edge];
      const [lx, lz] = lane.tile;
      this.cube(g, lx + 0.5, 0.64, lz + 0.5, 0.24, 0.2, 0.24, lane.item === 'peach' ? 0xd9a18c : lane.item === 'apple' ? 0x9e4b4f : 0x708549);
      const marker = this.cube(g, lx + 0.5 + DIRS[localDirection][0] * 0.19, 0.76, lz + 0.5 + DIRS[localDirection][1] * 0.19, 0.11, 0.11, 0.11, COLORS.cream);
      marker.rotation.y = localDirection * Math.PI / 2;
    }
    if (def.kind === 'machine') {
      const p = this.portPosition(o, o.rot || 0);
      this.cube(g, p.x, 0.66, p.z, 0.24, 0.24, 0.24, COLORS.brass);
    }
    this.objectRoot.add(g);
  }

  portPosition(o, dir) {
    const { w, h } = BUILDINGS[o.type];
    const localDir = (dir - (o.rot || 0) + 4) % 4;
    if (localDir === 0) return { x: w, z: h / 2 };
    if (localDir === 2) return { x: 0, z: h / 2 };
    if (localDir === 1) return { x: w / 2, z: h };
    return { x: w / 2, z: 0 };
  }

  addBelt(belt) {
    const group = new THREE.Group();
    const cx = belt.x + 0.5;
    const cz = belt.y + 0.5;
    const alongX = belt.dir % 2 === 0;
    this.cube(group, cx, 0.1, cz, alongX ? 0.9 : 0.42, 0.16, alongX ? 0.42 : 0.9, COLORS.blueDark);
    this.cube(group, cx, 0.2, cz, alongX ? 0.82 : 0.34, 0.08, alongX ? 0.34 : 0.82, COLORS.blue);
    const slats = 4;
    for (let i = 0; i < slats; i++) {
      const t = -0.3 + i * 0.2;
      this.cube(group, cx + (alongX ? t : 0), 0.255, cz + (alongX ? 0 : t), alongX ? 0.05 : 0.34, 0.06, alongX ? 0.34 : 0.05, 0xddebf4);
    }
    for (const side of [-1, 1]) {
      this.cube(group, cx + (alongX ? 0 : side * 0.18), 0.25, cz + (alongX ? side * 0.18 : 0), alongX ? 0.9 : 0.05, 0.09, alongX ? 0.05 : 0.9, COLORS.brass);
    }
    // Direction marker: a terracotta shaft and diamond head pointing the way the belt moves.
    const [dx, dz] = DIRS[belt.dir];
    this.cube(group, cx - dx * 0.06, 0.33, cz - dz * 0.06, alongX ? 0.3 : 0.07, 0.05, alongX ? 0.07 : 0.3, COLORS.terra, { castShadow: false });
    const head = this.cube(group, cx + dx * 0.17, 0.33, cz + dz * 0.17, 0.15, 0.05, 0.15, COLORS.terra, { castShadow: false });
    head.rotation.y = Math.PI / 4;
    if (this.s && !beltHasReceiver(this.s, belt)) {
      const warning = this.cube(group, cx + dx * 0.43, 0.4, cz + dz * 0.43, 0.085, 0.085, 0.085, COLORS.terraDark, { castShadow: false });
      warning.rotation.y = Math.PI / 4;
    }
    group.userData.belt = belt;
    this.beltRoot.add(group);
    this.beltMeshes.set(tileKey(belt.x, belt.y), group);
  }

  addItemMesh(type) {
    const group = new THREE.Group();
    const color = ITEM_COLORS[type] || COLORS.cream;
    if (type === 'tub' || type === 'melted') {
      this.cube(group, 0, 0.19, 0, 0.38, 0.32, 0.38, color);
      this.cube(group, 0, 0.37, 0, 0.42, 0.09, 0.42, 0xe8f1ee);
      // A dotted freshness arc above the tub. Each dot is a segment; syncItems
      // lights the surviving fraction and turns the arc terracotta near melt.
      if (type === 'tub') {
        const dots = [];
        const count = 12;
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2;
          const dot = this.cube(
            group,
            Math.cos(angle) * 0.25, 0.52, Math.sin(angle) * 0.25,
            0.055, 0.026, 0.055,
            COLORS.mint,
            { castShadow: false, receiveShadow: false },
          );
          dots.push(dot);
        }
        group.userData.freshnessArc = dots;
      }
    } else {
      this.cube(group, 0, 0.23, 0, 0.32, 0.38, 0.32, color);
      this.cube(group, 0.04, 0.44, 0, 0.14, 0.12, 0.14, type.toLowerCase().includes('apple') ? 0x5e8a33 : 0x708549);
    }
    return group;
  }

  updateFreshnessArc(mesh, item) {
    const dots = mesh.userData.freshnessArc;
    if (!dots) return;
    if (item.type !== 'tub' || item.fresh == null) {
      for (const dot of dots) dot.visible = false;
      return;
    }
    const ratio = THREE.MathUtils.clamp(item.fresh / SIM.coldFreshTicks, 0, 1);
    const lit = Math.ceil(ratio * dots.length);
    const color = item.fresh <= SIM.coldWarnTicks ? COLORS.terra : COLORS.mint;
    dots.forEach((dot, i) => {
      dot.visible = i < lit;
      if (dot.visible) dot.material = this.mat(color);
    });
  }

  // Chibi cast (PRD 9): big round head, tiny body, glossy eyes, blush. Every species is an
  // original design: Mo the mole, Sprig the squirrel, Pip the rabbit, and round-eared neighbours.
  addWorker(x, z, bodyColor, headColor, role = 'worker') {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.userData.baseY = 0;
    g.userData.phase = Math.random() * Math.PI * 2;
    g.userData.role = role;
    const blob = (px, py, pz, sx, sy, sz, color, shadow = true) => {
      const m = new THREE.Mesh(sphereGeo, this.mat(color));
      m.position.set(px, py, pz);
      m.scale.set(sx, sy, sz);
      m.castShadow = shadow;
      g.add(m);
      return m;
    };
    // body, apron, feet, hands
    blob(0, 0.3, 0, 0.46, 0.44, 0.4, bodyColor);
    blob(0, 0.27, 0.13, 0.3, 0.3, 0.2, COLORS.cream);
    blob(-0.11, 0.05, 0.05, 0.16, 0.1, 0.22, 0x5a4638);
    blob(0.11, 0.05, 0.05, 0.16, 0.1, 0.22, 0x5a4638);
    blob(-0.27, 0.32, 0.04, 0.15, 0.15, 0.15, headColor);
    blob(0.27, 0.32, 0.04, 0.15, 0.15, 0.15, headColor);
    // head
    blob(0, 0.78, 0, 0.66, 0.58, 0.58, headColor);
    // face: eyes with highlights, blush, nose
    for (const sx of [-1, 1]) {
      blob(sx * 0.13, 0.8, 0.27, 0.1, 0.12, 0.05, 0x1f2325, false);
      blob(sx * 0.13 + 0.02, 0.84, 0.3, 0.035, 0.035, 0.02, 0xffffff, false);
      blob(sx * 0.22, 0.7, 0.24, 0.1, 0.06, 0.04, 0xf2a3a3, false);
    }
    blob(0, 0.72, 0.3, role === 'mole' ? 0.12 : 0.06, role === 'mole' ? 0.09 : 0.05, 0.05, role === 'mole' ? 0xe99aa6 : 0x6b4b43, false);
    // species
    if (role === 'rabbit') {
      for (const sx of [-1, 1]) {
        blob(sx * 0.13, 1.22, 0, 0.14, 0.46, 0.12, headColor);
        blob(sx * 0.13, 1.2, 0.03, 0.07, 0.3, 0.06, 0xf2b6bd, false);
      }
    } else if (role === 'worker') {
      for (const sx of [-1, 1]) blob(sx * 0.2, 1.1, 0, 0.14, 0.2, 0.1, headColor);
      blob(0, 0.36, -0.28, 0.26, 0.5, 0.26, 0xc77f45);
    } else if (role === 'mole') {
      for (const sx of [-1, 1]) blob(sx * 0.27, 1.02, 0, 0.13, 0.13, 0.08, bodyColor);
    } else {
      for (const sx of [-1, 1]) blob(sx * 0.26, 1.06, 0, 0.18, 0.18, 0.1, headColor);
    }
    const destination = role === 'customer' ? this.customerRoot : this.workerRoot;
    destination.add(g);
    if (role !== 'customer') this.workerMeshes.push(g);
    return g;
  }

  rebuildWorkersAndCustomers() {
    this.clearGroup(this.workerRoot);
    this.workerMeshes = [];
    if (!this.s) return;
    const orchard = this.s.objects.find(o => o.type === 'orchard');
    const firstMachine = this.s.objects.find(o => BUILDINGS[o.type].kind === 'machine');
    const counter = this.s.objects.find(o => o.type === 'counter');
    if (orchard) this.addWorker(orchard.x + orchard.w + 0.3, orchard.y + 0.8, 0x8a5f4c, 0xb58a6c, 'mole');
    if (firstMachine) this.addWorker(firstMachine.x + 0.9, firstMachine.y - 0.1, 0x4972a3, 0xb58a6c, 'worker');
    if (counter) this.addWorker(counter.x - 0.5, counter.y + counter.h + 0.2, 0x708549, 0xf0e4cf, 'rabbit');
    this.rebuildCustomers();
  }

  rebuildCustomers() {
    this.clearGroup(this.customerRoot);
    if (!this.s) return;
    const counter = this.s.objects.find(o => o.type === 'counter');
    if (counter) {
      const customers = this.s.orders.active.filter(order => !order.errand).slice(0, 5);
      customers.forEach((order, i) => {
        const customer = this.addWorker(counter.x + 0.15 + i * 0.4, counter.y + counter.h + 1.05, [0xb06a6c, 0xa18f93, 0x8a5f4c][i % 3], [0xe8c9ae, 0xc3a183, 0xe6d6c2][i % 3], 'customer');
        customer.scale.setScalar(0.82);
      });
    }
  }

  refreshAll() {
    if (!this.s || !this.level) return;
    this.clearGroup(this.objectRoot);
    this.clearGroup(this.beltRoot);
    this.clearGroup(this.bufferRoot);
    this.clearGroup(this.workerRoot);
    this.clearGroup(this.customerRoot);
    this.beltMeshes.clear();
    this.clearItemMeshes();
    for (const object of this.s.objects) this.addBuildingModel(object);
    for (const belt of Object.values(this.s.belts)) this.addBelt(belt);
    this.rebuildWorkersAndCustomers();
    this.refreshBuffers();
    this.redrawSelection();
    this.redrawPath();
    this.redrawHints();
    this.redrawGhost();
  }

  refreshBuffers() {
    if (!this.bufferRoot || !this.s) return;
    this.clearGroup(this.bufferRoot);
    for (const o of this.s.objects) {
      const x = o.x + o.w / 2;
      const z = o.y + o.h / 2;
      let offset = 0;
      for (const lane of o.lanes || []) for (const item of lane.buf) {
        const box = this.addItemMesh(item.type);
        box.position.set(x + offset, 0.9, z);
        this.bufferRoot.add(box);
        offset += 0.28;
      }
      for (const input of o.inputs || []) for (const item of input.buf) {
        const box = this.addItemMesh(item.type);
        box.position.set(x + offset, 1.06, z + 0.12);
        this.bufferRoot.add(box);
        offset += 0.28;
      }
      for (const item of o.output || []) {
        const box = this.addItemMesh(item.type);
        box.position.set(x + offset, 1.08, z - 0.12);
        this.bufferRoot.add(box);
        offset += 0.28;
      }
    }
  }

  refreshCustomers() {
    this.rebuildCustomers();
  }

  // ---- Cosmetic effects (PRD §6.11). Pooled particles, render-only: they read the
  // simulation state to spot events and never write to it.
  initFx() {
    const N = 300;
    const mesh = new THREE.InstancedMesh(sphereGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), N);
    mesh.frustumCulled = false;
    const dummy = new THREE.Object3D();
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    const white = new THREE.Color(0xffffff);
    for (let i = 0; i < N; i++) {
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, white);
    }
    this.world.add(mesh);
    this.fx = {
      N, mesh, dummy, color: new THREE.Color(), next: 0,
      pos: new Float32Array(N * 3), vel: new Float32Array(N * 3),
      life: new Float32Array(N), max: new Float32Array(N), size: new Float32Array(N), grav: new Float32Array(N),
    };
  }

  burst(x, y, z, o) {
    const f = this.fx;
    if (!f) return;
    const rnd = Math.random;
    for (let n = 0; n < o.count; n++) {
      const i = f.next;
      f.next = (f.next + 1) % f.N;
      const a = rnd() * Math.PI * 2;
      const h = (o.spread ?? 1) * (0.4 + rnd() * 0.6);
      f.pos.set([x + (rnd() - 0.5) * (o.jitter ?? 0.2), y, z + (rnd() - 0.5) * (o.jitter ?? 0.2)], i * 3);
      f.vel.set([Math.cos(a) * h, (o.up ?? 3) * (0.6 + rnd() * 0.6), Math.sin(a) * h], i * 3);
      f.life[i] = f.max[i] = (o.life ?? 1) * (0.75 + rnd() * 0.5);
      f.size[i] = (o.size ?? 0.1) * (0.7 + rnd() * 0.6);
      f.grav[i] = o.grav ?? 9;
      f.mesh.setColorAt(i, f.color.setHex(o.colors[Math.floor(rnd() * o.colors.length)]));
    }
    if (f.mesh.instanceColor) f.mesh.instanceColor.needsUpdate = true;
  }

  updateFx(delta) {
    if (!this.fx) this.initFx();
    const f = this.fx;
    const s = this.s;
    if (s) {
      const tr = this.fxTrack;
      if (!tr || tr.s !== s) {
        this.fxTrack = { s, ids: new Set(s.objects.map(o => o.id)), out: new Map(s.objects.map(o => [o.id, o.output?.length || 0])), fulfilled: s.counters.fulfilled };
      } else if (!this.settings.reducedMotion) {
        const ids = new Set();
        for (const o of s.objects) {
          ids.add(o.id);
          const cx = o.x + o.w / 2;
          const cz = o.y + o.h / 2;
          if (!tr.ids.has(o.id)) {
            this.burst(cx, 0.15, cz, { count: 12, colors: [0xd9cfa4, 0xc9c7a0, 0xe8e0bb], spread: 1.6, up: 1.4, grav: 6, size: 0.1, life: 0.7, jitter: Math.max(o.w, o.h) * 0.6 });
          }
          const now = o.output?.length || 0;
          if (now > (tr.out.get(o.id) ?? now)) {
            this.burst(cx, 1.2, cz, { count: 7, colors: [0xffffff, 0xf2f8ff], spread: 0.35, up: 1.1, grav: -0.6, size: 0.2, life: 1.0 });
          }
          tr.out.set(o.id, now);
        }
        tr.ids = ids;
        if (s.counters.fulfilled > tr.fulfilled) {
          const counter = s.objects.find(o => o.type === 'counter');
          if (counter) {
            const cx = counter.x + counter.w / 2;
            const cz = counter.y + counter.h / 2;
            this.burst(cx, 1.0, cz, { count: 14, colors: [0xffd23c, 0xffe27a, 0xf2b705], spread: 1.2, up: 4.5, grav: 11, size: 0.12, life: 0.9 });
            this.burst(cx, 1.0, cz, { count: 20, colors: [0xff7a8a, 0x7ad0ff, 0xb7f06a, 0xffe27a, 0xd19bff], spread: 2.4, up: 3.5, grav: 6, size: 0.09, life: 1.3 });
          }
        }
      }
      if (this.fxTrack) this.fxTrack.fulfilled = s.counters.fulfilled;
    }
    const dt = Math.min(delta, 50) / 1000;
    const d = f.dummy;
    let alive = false;
    for (let i = 0; i < f.N; i++) {
      if (f.life[i] <= 0) continue;
      f.life[i] -= dt;
      if (f.life[i] <= 0 || this.settings.reducedMotion) {
        f.life[i] = 0;
        d.scale.setScalar(0);
      } else {
        f.vel[i * 3 + 1] -= f.grav[i] * dt;
        f.pos[i * 3] += f.vel[i * 3] * dt;
        f.pos[i * 3 + 1] = Math.max(0.05, f.pos[i * 3 + 1] + f.vel[i * 3 + 1] * dt);
        f.pos[i * 3 + 2] += f.vel[i * 3 + 2] * dt;
        d.position.set(f.pos[i * 3], f.pos[i * 3 + 1], f.pos[i * 3 + 2]);
        d.scale.setScalar(f.size[i] * Math.sqrt(f.life[i] / f.max[i]) * 2);
      }
      d.updateMatrix();
      f.mesh.setMatrixAt(i, d.matrix);
      alive = true;
    }
    if (alive) f.mesh.instanceMatrix.needsUpdate = true;
  }

  syncItems() {
    if (!this.s) return;
    const active = new Set();
    for (const belt of Object.values(this.s.belts)) {
      if (!belt.item) continue;
      const key = tileKey(belt.x, belt.y);
      active.add(key);
      let mesh = this.itemMeshes.get(key);
      if (!mesh || mesh.userData.type !== belt.item.type) {
        if (mesh) {
          this.world.remove(mesh);
          this.clearGroup(mesh);
        }
        mesh = this.addItemMesh(belt.item.type);
        mesh.userData.type = belt.item.type;
        // Items that appear from a machine or source (no belt feeding this tile from behind)
        // pop out with a hop and a bounce; items handed over from a belt do not.
        const [bdx, bdz] = DIRS[belt.dir];
        const behind = this.s.belts[tileKey(belt.x - bdx, belt.y - bdz)];
        const fresh = (belt.item.progress || 0) < 0.15;
        mesh.userData.born = fresh && !(behind && behind.dir === belt.dir) ? this.time : -99;
        this.world.add(mesh);
        this.itemMeshes.set(key, mesh);
      }
      const [dx, dz] = DIRS[belt.dir];
      // Render-only interpolation. The sim advances items in 10 Hz steps; here each item
      // glides by the fraction of the current tick that has elapsed. Position runs from the
      // tile's entry edge (progress 0) to its exit edge (progress 1), so a hand-off to the next
      // tile continues from exactly the same world point and a blocked item simply stops at
      // the edge. The sim state is only read, never written.
      const moving = !belt.item.blocked && !this.s.paused;
      const alpha = moving ? THREE.MathUtils.clamp((this.ctrl?.acc || 0) / SIM.tickMs, 0, 1) : 0;
      const progress = THREE.MathUtils.clamp((belt.item.progress || 0) + (moving ? SIM.beltStep * alpha : 0), 0, 1);
      const t = progress - 0.5;
      mesh.position.set(belt.x + 0.5 + dx * t, 0.3 + (moving ? Math.sin(this.time * 5 + belt.x + belt.y) * 0.012 : 0), belt.y + 0.5 + dz * t);
      const age = this.time - (mesh.userData.born ?? -99);
      if (age >= 0 && age < 0.5 && !this.settings.reducedMotion) {
        const k = age / 0.5;
        const eb = 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2);
        mesh.scale.setScalar(0.3 + 0.7 * eb);
        mesh.position.y += Math.sin(k * Math.PI) * 0.32 * (1 - k);
      } else if (mesh.scale.x !== 1) {
        mesh.scale.setScalar(1);
      }
      this.updateFreshnessArc(mesh, belt.item);
    }
    for (const [key, mesh] of this.itemMeshes) {
      if (!active.has(key)) {
        this.world.remove(mesh);
        this.clearGroup(mesh);
        this.itemMeshes.delete(key);
      }
    }
  }

  redrawSelection() {
    if (!this.selectionRoot) {
      this.selectionRoot = new THREE.Group();
      this.fxRoot.add(this.selectionRoot);
    }
    this.clearGroup(this.selectionRoot);
    if (!this.selection || !this.s) return;
    let x, z, w = 1, h = 1;
    if (this.selection.kind === 'object') {
      const object = this.s.objects.find(o => o.id === this.selection.id);
      if (!object) return;
      ({ x, y: z, w, h } = { x: object.x, y: object.y, w: object.w, h: object.h });
    } else {
      ({ x, y: z } = this.selection);
    }
    if (!this.selectionMaterial) {
      this.selectionMaterial = new THREE.LineBasicMaterial({ color: 0xf2f0ae, linewidth: 2 });
    }
    const box = new THREE.BoxGeometry(w, 0.035, h);
    const line = new THREE.LineSegments(new THREE.EdgesGeometry(box), this.selectionMaterial);
    box.dispose();
    line.position.set(x + w / 2, 0.055, z + h / 2);
    this.selectionRoot.add(line);
  }

  setSelection(selection) {
    this.selection = selection;
    this.redrawSelection();
  }

  setPath(tiles, tone) {
    this.pathTiles = tiles || [];
    this.pathTone = tone || '';
    this.redrawPath();
  }

  redrawPath() {
    if (!this.pathRoot) {
      this.pathRoot = new THREE.Group();
      this.fxRoot.add(this.pathRoot);
    }
    this.clearGroup(this.pathRoot);
    const colors = { blocked: 0xb25a5e, starved: 0xc2c96a, flow: 0x2e7bd7 };
    const color = colors[this.pathTone];
    if (!color) return;
    for (const tile of this.pathTiles) this.cube(this.pathRoot, tile.x + 0.5, 0.045, tile.y + 0.5, 0.94, 0.035, 0.94, color, { transparent: true, opacity: 0.32 });
  }

  setHints(tiles) {
    this.hintTiles = tiles || [];
    this.redrawHints();
  }

  redrawHints() {
    if (!this.hintRoot) {
      this.hintRoot = new THREE.Group();
      this.fxRoot.add(this.hintRoot);
    }
    this.clearGroup(this.hintRoot);
    for (const [x, z] of this.hintTiles) this.cube(this.hintRoot, x + 0.5, 0.065, z + 0.5, 0.92, 0.04, 0.92, 0xe8e6a0, { transparent: true, opacity: 0.36 });
  }

  setBuild(build) {
    this.build = build;
    this.redrawGhost();
  }

  setHover(tile) {
    this.hoverTile = tile;
    this.redrawGhost();
  }

  redrawGhost() {
    if (!this.ghostRoot) {
      this.ghostRoot = new THREE.Group();
      this.fxRoot.add(this.ghostRoot);
    }
    this.clearGroup(this.ghostRoot);
    if (!this.build || !this.build.tile) return;
    const { x, y } = this.build.tile;
    const def = BUILDINGS[this.build.type];
    if (!def) return;
    const tint = this.build.valid ? 0xa9d98f : 0xc06a6a;
    if (!this.ghostMaterial) {
      this.ghostMaterial = new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.32, depthWrite: false });
    }
    this.ghostMaterial.color.setHex(tint);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(def.w, 0.16, def.h), this.ghostMaterial);
    foot.position.set(x + def.w / 2, 0.3, y + def.h / 2);
    this.ghostRoot.add(foot);
    const dir = DIRS[this.build.rot || 0];
    const arrow = this.cube(this.ghostRoot, x + def.w / 2 + dir[0] * 0.42, 0.48, y + def.h / 2 + dir[1] * 0.42, 0.22, 0.22, 0.22, tint);
    arrow.rotation.y = Math.atan2(dir[0], dir[1]);
    for (const t of this.build.targets || []) {
      this.cube(this.ghostRoot, t.x + 0.5, 0.08, t.y + 0.5, 0.3, 0.16, 0.3, t.ok === false ? 0xc06a6a : 0xa9d98f);
    }
  }

  setSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    this.buildGridLines();
  }

  focusTile(x, z) {
    // A zoom glide still in flight would slide the pivot straight back off this tile.
    this.zoomPending = 0;
    const next = this.cameraTarget.clone();
    next.x = x + 0.5;
    next.z = z + 0.5;
    const delta = next.sub(this.cameraTarget);
    this.cameraTarget.add(delta);
    this.camera.position.add(delta);
    // A jump-to places the pivot absolutely, so it also settles the anchor: rotating afterwards
    // must not drag the view back off the tile the player asked for.
    this.pivotAnchor.copy(this.cameraTarget);
    this.updateCameraPose();
  }

  panBy(dx, dy) {
    this.camera.updateMatrixWorld();
    const previous = this.cameraTarget.clone();
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    up.y = 0;
    up.normalize();
    const scale = this.camera.position.distanceTo(this.cameraTarget) * 0.0014;
    this.cameraTarget.addScaledVector(right, -dx * scale);
    this.cameraTarget.addScaledVector(up, dy * scale);
    if (this.level) {
      this.cameraTarget.x = THREE.MathUtils.clamp(this.cameraTarget.x, -2, this.level.gridW + 2);
      this.cameraTarget.z = THREE.MathUtils.clamp(this.cameraTarget.z, -2, this.level.gridH + 2);
    }
    const applied = this.cameraTarget.clone().sub(previous);
    this.camera.position.add(applied);
    this.pivotAnchor.add(applied);
    this.updateCameraPose();
  }

  zoomBy(factor) {
    const offset = this.camera.position.clone().sub(this.cameraTarget);
    const length = THREE.MathUtils.clamp(offset.length() / factor, this.minDistance, this.maxDistance);
    offset.setLength(length);
    this.camera.position.copy(this.cameraTarget).add(offset);
    this.camera.lookAt(this.cameraTarget);
  }

  centerOnLevel() {
    if (!this.level) return;
    // The resting framing puts the orbit pivot and the screen centre on the island centre, so a
    // fresh level is always composed the same way from the same side. Pointer zoom may slide the
    // pivot away from here; rotating eases it back.
    this.cameraTarget.set(this.level.gridW / 2, 0.5, this.level.gridH / 2);
    this.pivotAnchor.copy(this.cameraTarget);
    this.pivotHoming = false;
    this.zoomPending = 0;
    // Frame the island a little closer and from a slightly higher three-quarter
    // angle, so lush ground and props fill the frame instead of open sky.
    const distance = THREE.MathUtils.clamp((this.islandRadius || Math.max(this.level.gridW, this.level.gridH) * 1.15) * 2.1, this.minDistance, this.maxDistance);
    const viewDirection = new THREE.Vector3(0.57, 0.9, 0.78).normalize();
    this.camera.position.copy(this.cameraTarget).addScaledVector(viewDirection, distance);
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld();
    this.spin = 0;
    this.tiltSpin = 0;
    this.glide = null;
    this.reportOrbit();
  }

  groundPoint(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.ray.intersectPlane(this.groundPlane, new THREE.Vector3());
  }

  // Moves the view centre and camera together, clamped to the island. Returns the applied move.
  // `deliberate` marks a pan the player chose, as opposed to the slide a pointer zoom causes, so
  // the anchor homing unwinds toward travels with it.
  shiftTarget(delta, deliberate = false) {
    const before = this.cameraTarget.clone();
    this.cameraTarget.add(delta);
    if (this.level) {
      this.cameraTarget.x = THREE.MathUtils.clamp(this.cameraTarget.x, -8, this.level.gridW + 8);
      this.cameraTarget.z = THREE.MathUtils.clamp(this.cameraTarget.z, -8, this.level.gridH + 8);
    }
    const applied = this.cameraTarget.clone().sub(before);
    if (deliberate) this.pivotAnchor.add(applied);
    this.camera.position.add(applied);
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld();
    return applied;
  }

  // Keeps the ground point you grabbed under the cursor while dragging.
  dragPan(clientX, clientY) {
    const grab = this.drag?.grab;
    if (!grab) return;
    const now = this.groundPoint(clientX, clientY);
    if (!now) return;
    const applied = this.shiftTarget(grab.clone().sub(now), true);
    const t = performance.now();
    const dt = Math.max(1, t - this.drag.lastT);
    this.drag.lastT = t;
    this.drag.vx = this.drag.vx * 0.5 + (applied.x / dt) * 0.5;
    this.drag.vz = this.drag.vz * 0.5 + (applied.z / dt) * 0.5;
  }

  // Zooms toward the pointer, so the spot under the cursor stays put. A point beyond the region
  // the pivot is even allowed to occupy (open sky, the far treeline) would need an unbounded
  // slide to hold still, so those zoom from the centre rather than yank the view to the clamp.
  zoomAt(factor, clientX, clientY) {
    const before = this.groundPoint(clientX, clientY);
    const level = this.level;
    const inReach = !!level && !!before
      && before.x > -8 && before.x < level.gridW + 8
      && before.z > -8 && before.z < level.gridH + 8;
    this.zoomBy(factor);
    if (!inReach) return;
    this.camera.updateMatrixWorld();
    const after = this.groundPoint(clientX, clientY);
    if (after) this.shiftTarget(before.sub(after));
  }

  // The orbit pivot sits below the ground, so a plain pole-to-pole range would swing the
  // camera underneath the world. Keep the camera at least 1.8 units above the ground and
  // never past the horizon, so the underside is never visible.
  maxPhi() {
    const r = Math.max(1, this.camera.position.distanceTo(this.cameraTarget));
    const ratio = THREE.MathUtils.clamp((1.8 - this.cameraTarget.y) / r, 0, 0.995);
    // A fixed tilt ceiling keeps the view off the horizon, where the whole far forest is on
    // screen (slow) and the camera can graze the hills (jitter). Every input path shares it,
    // so the per-frame safety clamp below has nothing to fight with.
    return Math.min(1.26, Math.acos(ratio));
  }

  // Runs every frame, so no input path (drag, touch, slider, zoom, a saved pose) can leave
  // the camera under the world.
  keepCameraAboveGround() {
    const dist = this.camera.position.distanceTo(this.cameraTarget);
    const offset = this.camera.position.clone().sub(this.cameraTarget);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    const limit = this.maxPhi();
    const startPhi = spherical.phi;
    spherical.phi = Math.min(spherical.phi, limit);
    const place = () => this.camera.position.copy(this.cameraTarget).add(new THREE.Vector3().setFromSpherical(spherical));
    place();
    // The hills rise above the board, so the camera also has to clear the real terrain under
    // it. Solve the tilt directly instead of stepping, so there is no visible snapping.
    const clearance = THREE.MathUtils.lerp(1.3, 2.6, THREE.MathUtils.smoothstep(dist, 10, 40));
    for (let i = 0; i < 4 && this.level; i++) {
      const p = this.camera.position;
      const need = this.terrainHeight(p.x, p.z) - 0.22 + clearance;
      if (p.y >= need) break;
      const cos = THREE.MathUtils.clamp((need - this.cameraTarget.y) / Math.max(1, spherical.radius), 0, 0.999);
      spherical.phi = Math.min(spherical.phi, Math.acos(cos));
      place();
    }
    if (spherical.phi === startPhi) return;
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld();
    if (this.drag?.rotate) this.drag.phi = Math.min(this.drag.phi, spherical.phi);
  }

  updateCameraPose() {
    if (this.drag?.rotate) {
      const spherical = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.cameraTarget));
      spherical.theta = this.drag.theta;
      spherical.phi = this.drag.phi;
      spherical.makeSafe();
      this.camera.position.copy(this.cameraTarget).add(new THREE.Vector3().setFromSpherical(spherical));
    }
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld();
    this.reportOrbit();
  }

  rotateOrbit(yawAmount, pitchAmount = 0) {
    // Rotating orbits the spot you are looking at and never walks the view back to the centre,
    // so you can slide somewhere, zoom in and look around it freely.
    const offset = this.camera.position.clone().sub(this.cameraTarget);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta = THREE.MathUtils.euclideanModulo(spherical.theta + yawAmount + Math.PI, Math.PI * 2) - Math.PI;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi + pitchAmount, 0.045, this.maxPhi());
    this.camera.position.copy(this.cameraTarget).add(new THREE.Vector3().setFromSpherical(spherical));
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld();
    this.reportOrbit();
  }

  setOrbitYawDegrees(degrees) {
    const theta = THREE.MathUtils.euclideanModulo(degrees * Math.PI / 180 + Math.PI, Math.PI * 2) - Math.PI;
    const offset = this.camera.position.clone().sub(this.cameraTarget);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta = theta;
    this.camera.position.copy(this.cameraTarget).add(new THREE.Vector3().setFromSpherical(spherical));
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld();
    if (this.drag?.rotate) this.drag.theta = THREE.MathUtils.euclideanModulo(theta + Math.PI, Math.PI * 2) - Math.PI;
    this.spin = 0;
    this.tiltSpin = 0;
    this.glide = null;
    this.reportOrbit();
  }

  reportOrbit() {
    const spherical = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.cameraTarget));
    const degrees = THREE.MathUtils.euclideanModulo(spherical.theta * 180 / Math.PI, 360);
    this.ctrl?.onCameraOrbit?.(degrees);
  }

  rotateYaw(amount) {
    this.rotateOrbit(amount, 0);
  }

  resize() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  installInput() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId);
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.glide = null;
      this.spin = 0;
      this.tiltSpin = 0;
      if (this.activePointers.size === 2) {
        const pts = [...this.activePointers.values()];
        this.drag = {
          id: e.pointerId,
          pinch: true,
          x: (pts[0].x + pts[1].x) / 2,
          y: (pts[0].y + pts[1].y) / 2,
          distance: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
          angle: Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x),
          moved: true,
        };
        return;
      }
      const offset = this.camera.position.clone().sub(this.cameraTarget);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      // Left-drag or one-finger drag orbits around the world;
      // right-drag, middle-drag or Shift-drag grabs the ground and pans it.
      // Zoomed in, a plain drag slides the view across the world so you can look around close up,
      // and the right button or Shift rotates instead. Zoomed out the roles are the other way round.
      const closeUp = offset.length() < 45;
      const alt = e.button === 2 || e.button === 1 || e.shiftKey;
      const pan = e.pointerType === 'touch' ? closeUp : (alt !== closeUp);
      const rotate = !pan;
      this.drag = {
        id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, pan, rotate,
        theta: spherical.theta, phi: spherical.phi,
        grab: pan ? this.groundPoint(e.clientX, e.clientY) : null,
        vx: 0, vz: 0, vTheta: 0, vPhi: 0, lastT: performance.now(),
      };
    });
    canvas.addEventListener('pointermove', e => {
      if (this.activePointers.has(e.pointerId)) this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      // A wheel glide spans several frames, so keep aiming at the cursor rather than at the
      // point the wheel was first spun on.
      if (this.zoomPending && !this.drag) {
        this.zoomAnchor.x = e.clientX;
        this.zoomAnchor.y = e.clientY;
      }
      if (this.drag?.pinch && this.activePointers.size >= 2) {
        const pts = [...this.activePointers.values()];
        const midpoint = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const angle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
        const twist = Math.atan2(Math.sin(angle - this.drag.angle), Math.cos(angle - this.drag.angle));
        if (this.drag.distance > 0 && distance > 0) this.zoomBy(distance / this.drag.distance);
        const dx = midpoint.x - this.drag.x;
        const dy = midpoint.y - this.drag.y;
        const rect = canvas.getBoundingClientRect();
        // Two-finger gestures mirror map apps: twist to rotate, vertical slide to tilt,
        // pinch to zoom, and horizontal slide to pan across the island.
        this.rotateOrbit(-twist, -dy / Math.max(1, rect.height) * Math.PI);
        this.panBy(dx, 0);
        this.drag.x = midpoint.x;
        this.drag.y = midpoint.y;
        this.drag.distance = distance;
        this.drag.angle = angle;
        return;
      }
      if (!this.drag || this.drag.id !== e.pointerId) {
        const tile = this.tileAt(e.clientX, e.clientY);
        if (tile) {
          this.hoverTile = tile;
          this.ctrl?.onHover?.(tile);
        }
        return;
      }
      const dx = e.clientX - this.drag.x;
      const dy = e.clientY - this.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) this.drag.moved = true;
      if (!this.drag.moved) return;
      if (this.drag.rotate) {
        const rect = canvas.getBoundingClientRect();
        // One canvas-width sweeps a full circle; one canvas-height sweeps pole to pole.
        const dTheta = -dx / Math.max(1, rect.width) * Math.PI * 2;
        const dPhi = -dy / Math.max(1, rect.height) * Math.PI;
        this.drag.theta = THREE.MathUtils.euclideanModulo(this.drag.theta + dTheta + Math.PI, Math.PI * 2) - Math.PI;
        this.drag.phi = THREE.MathUtils.clamp(this.drag.phi + dPhi, 0.045, this.maxPhi());
        const now = performance.now();
        const dt = Math.max(1, now - this.drag.lastT);
        this.drag.lastT = now;
        const velocityBlend = 1 - Math.exp(-dt / 35);
        this.drag.vTheta += (dTheta / dt - this.drag.vTheta) * velocityBlend;
        this.drag.vPhi += (dPhi / dt - this.drag.vPhi) * velocityBlend;
        this.updateCameraPose();
      } else {
        this.dragPan(e.clientX, e.clientY);
      }
      this.drag.x = e.clientX;
      this.drag.y = e.clientY;
    });
    canvas.addEventListener('pointerup', e => {
      this.activePointers.delete(e.pointerId);
      if (this.drag?.pinch) {
        this.drag = null;
        return;
      }
      if (!this.drag || this.drag.id !== e.pointerId) return;
      // A quick flick keeps the world spinning or gliding for a moment, then eases to a stop.
      if (this.drag.moved && !this.settings.reducedMotion && performance.now() - this.drag.lastT < 80) {
        if (this.drag.pan && Math.hypot(this.drag.vx, this.drag.vz) > 0.003) this.glide = { x: this.drag.vx, z: this.drag.vz };
        if (this.drag.rotate && Math.abs(this.drag.vTheta) > 0.0003) this.spin = this.drag.vTheta;
        if (this.drag.rotate && Math.abs(this.drag.vPhi) > 0.0003) this.tiltSpin = this.drag.vPhi;
      }
      if (!this.drag.moved && e.button === 0) {
        const tile = this.tileAt(e.clientX, e.clientY);
        if (tile) this.ctrl?.onClick?.(tile);
      }
      this.drag = null;
    });
    canvas.addEventListener('pointercancel', e => {
      this.activePointers.delete(e.pointerId);
      this.drag = null;
      this.spin = 0;
      this.tiltSpin = 0;
      this.glide = null;
    });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.glide = null;
      this.spin = 0;
      this.tiltSpin = 0;
      // Wheel notches are queued and eased in over a few frames, so zoom glides instead of
      // jumping, which is what read as stutter up close.
      this.zoomPending = THREE.MathUtils.clamp((this.zoomPending || 0) - e.deltaY * 0.0016, -0.9, 0.9);
      this.zoomAnchor.x = e.clientX;
      this.zoomAnchor.y = e.clientY;
      // While the wheel is the active gesture the player is holding a corner of the frame;
      // homing resumes the next time they rotate.
      this.pivotHoming = false;
    }, { passive: false });
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
  }

  tileAt(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const point = this.raycaster.ray.intersectPlane(this.groundPlane, new THREE.Vector3());
    if (!point) return null;
    const x = Math.floor(point.x);
    const y = Math.floor(point.z);
    if (x < 0 || y < 0 || x >= this.level?.gridW || y >= this.level?.gridH) return null;
    return { x, y };
  }

  frame(now) {
    this.raf = requestAnimationFrame(this.frame);
    const delta = this.lastFrame ? Math.min(now - this.lastFrame, 100) : 16.7;
    this.lastFrame = now;
    this.time += delta / 1000;
    if (!this.settings.reducedMotion) {
      for (const tree of this.windGroups) {
        const sway = Math.sin(this.time * 1.15 + tree.userData.windPhase) * 0.018;
        tree.rotation.z = sway;
        tree.rotation.x = Math.cos(this.time * 0.9 + tree.userData.windPhase) * 0.012;
      }
    }
    if (this.spin || this.tiltSpin) {
      this.rotateOrbit(this.spin * delta, this.tiltSpin * delta);
      const damping = Math.pow(0.92, delta / 16.7);
      this.spin *= damping;
      this.tiltSpin *= damping;
      if (Math.abs(this.spin) < 0.00005) this.spin = 0;
      if (Math.abs(this.tiltSpin) < 0.00005) this.tiltSpin = 0;
    }
    if (this.zoomPending) {
      const portion = this.zoomPending * (1 - Math.pow(0.002, delta / 1000));
      this.zoomPending -= portion;
      if (Math.abs(this.zoomPending) < 0.0008) this.zoomPending = 0;
      this.zoomAt(Math.exp(portion), this.zoomAnchor.x, this.zoomAnchor.y);
    }
    // Unwinds only the pivot slide a pointer zoom caused. The anchor tracks every deliberate pan,
    // and a jump-to or re-centre settles it outright, so those placements are never undone.
    if (this.pivotHoming) {
      const slide = this.cameraTarget.clone().sub(this.pivotAnchor);
      // Run the last step to completion rather than stopping short, so repeated zoom-and-rotate
      // cycles cannot ratchet the pivot a few hundredths away from where the player left it.
      if (slide.length() < 0.04) {
        this.shiftTarget(slide.negate());
        this.pivotHoming = false;
      } else {
        this.shiftTarget(slide.multiplyScalar(-(1 - Math.pow(0.004, delta / 1000))));
      }
    }
    if (this.glide) {
      this.shiftTarget(new THREE.Vector3(this.glide.x * delta, 0, this.glide.z * delta), true);
      const k = Math.pow(0.9, delta / 16.7);
      this.glide.x *= k;
      this.glide.z *= k;
      if (Math.hypot(this.glide.x, this.glide.z) < 0.0004) this.glide = null;
    }
    if (this.s) {
      this.syncItems();
      this.updateFx(delta);
      if (!this.settings.reducedMotion) {
        this.animateWorkers();
        this.workersAtRest = false;
      } else if (!this.workersAtRest) {
        this.workerMeshes.forEach(worker => { worker.position.y = 0; worker.rotation.set(0, 0, 0); });
        this.workersAtRest = true;
      }
      this.ctrl?.tick?.(delta);
    }
    this.keepCameraAboveGround();
    this.renderer.render(this.world, this.camera);
  }

  // Each role does a short looping job: the mole tends (sway), the squirrel tinkers
  // (quick tilts with pauses), the rabbit serves (a hop with pauses).
  animateWorkers() {
    const t = this.time;
    for (const w of this.workerMeshes) {
      const p = w.userData.phase;
      const role = w.userData.role;
      if (role === 'mole') {
        w.rotation.z = Math.sin(t * 1.6 + p) * 0.1;
        w.position.y = Math.abs(Math.sin(t * 1.6 + p)) * 0.03;
      } else if (role === 'rabbit') {
        const hop = Math.max(0, Math.sin(t * 2.2 + p));
        w.position.y = hop > 0.75 ? (hop - 0.75) * 0.9 : 0;
        w.rotation.z = 0;
      } else {
        const pulse = Math.max(0, Math.sin(t * 2 + p));
        w.rotation.z = pulse > 0.6 ? Math.sin(t * 22) * 0.12 : 0;
        w.position.y = Math.sin(t * 2.4 + p) * 0.03;
      }
    }
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    if (this.onResize) window.removeEventListener('resize', this.onResize);
    if (this.groundMaterial) this.groundMaterial.dispose();
    if (this.islandMaterial) this.islandMaterial.dispose();
    if (this.keelMaterial) this.keelMaterial.dispose();
    if (this.fx) this.fx.mesh.material.dispose();
    if (this.ghostMaterial) this.ghostMaterial.dispose();
    if (this.selectionMaterial) this.selectionMaterial.dispose();
    if (this.gridMaterial) this.gridMaterial.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.materials.forEach(material => material.dispose());
    this.materials.clear();
  }
}
