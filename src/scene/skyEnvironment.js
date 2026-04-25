/**
 * skyEnvironment.js
 * - 3000 blinking stars
 * - Multiple Realistic Nebulas: parameterised generator to support multiple
 *   locations, shapes, and colour palettes.
 * - Animated sun orbit
 */
import * as THREE from 'three';

// ── Soft circular sprite texture ─────────────────────────────────────────────
function makeCircleTexture(size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width  = size;
  canvas.height = size;
  const ctx  = canvas.getContext('2d');
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.00, 'rgba(255,255,255,1.00)');
  grad.addColorStop(0.20, 'rgba(255,255,255,0.80)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.25)');
  grad.addColorStop(0.85, 'rgba(255,255,255,0.05)');
  grad.addColorStop(1.00, 'rgba(255,255,255,0.00)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

const SPRITE = makeCircleTexture(128);

// ── Nebula building functions ──────────────────────────────────────────────────
function buildNebula(scene, config) {
  const { cx, cy, cz, scheme, lobes, lanes, laneWidth, layers } = config;
  const MAIN_SPREAD = Math.max(...layers.map(l => l.spread));

  // Generates colour based on position in the cloud
  function getColor(t, yRatio) {
    const coreCol = new THREE.Color(scheme.core);
    const botCol  = new THREE.Color(scheme.bottom);
    const topCol  = new THREE.Color(scheme.top);
    const midCol  = new THREE.Color(scheme.mid);

    let base;
    if (t < 0.18) {
      base = coreCol.clone().lerp(botCol, t / 0.18);
    } else if (yRatio > 0.2) {
      base = midCol.clone().lerp(topCol, Math.min((yRatio - 0.2) / 0.6, 1));
      base.lerp(botCol, 1 - Math.min(t / 0.8, 1) * 0.5);
    } else if (yRatio < -0.15) {
      base = botCol.clone();
    } else {
      base = botCol.clone().lerp(midCol, 0.5);
    }

    const hsl = {};
    base.getHSL(hsl);
    return new THREE.Color().setHSL(
      (hsl.h + (Math.random() - 0.5) * 0.10 + 1) % 1,
      THREE.MathUtils.clamp(hsl.s + (Math.random() - 0.5) * 0.25, 0.2, 1),
      THREE.MathUtils.clamp(hsl.l + (Math.random() - 0.5) * 0.20, 0.1, 1),
    );
  }

  // Check if position falls in a dark dust lane
  function inLane(dx, dz) {
    if (!lanes || lanes.length === 0) return false;
    const a = Math.atan2(dz, dx);
    return lanes.some(la => {
      let d = Math.abs(a - la);
      if (d > Math.PI) d = Math.PI * 2 - d;
      return d < laneWidth;
    });
  }

  const nebulaObjects = [];

  layers.forEach(layer => {
    const { count, spread, radialBias, flatY, size, opacity, useLanes } = layer;
    const pos = [];
    const colors = [];

    let tries = 0;
    while (pos.length / 3 < count && tries++ < count * 15) {
      const lobe = lobes[Math.floor(Math.random() * lobes.length)];
      const lobeSpread = spread * lobe.r;

      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = Math.pow(Math.random(), radialBias) * lobeSpread;

      const dx = lobe.ox + r * Math.sin(phi) * Math.cos(theta);
      const dy = (lobe.oy + r * Math.sin(phi) * Math.sin(theta)) * flatY;
      const dz = lobe.oz + r * Math.cos(phi);

      if (useLanes && inLane(dx, dz)) continue;

      pos.push(cx + dx, cy + dy, cz + dz);

      const dist   = Math.sqrt(dx*dx + dy*dy + dz*dz);
      const t      = Math.min(dist / MAIN_SPREAD, 1);
      const yRatio = dy / (MAIN_SPREAD * 0.55);
      
      const col = getColor(t, yRatio);
      colors.push(col.r, col.g, col.b);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(colors), 3));

    const mat = new THREE.PointsMaterial({
      size: size,
      vertexColors: true,
      map: SPRITE,
      alphaTest: 0.005,
      transparent: true,
      opacity: opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    scene.add(new THREE.Points(geo, mat));
    nebulaObjects.push({ mat, base: opacity });
  });

  return nebulaObjects;
}

// ── Main export ───────────────────────────────────────────────────────────────
export function initSkyEnvironment(scene, sunLight, sunMesh) {

  scene.background = new THREE.Color(0x03050e);

  // ── Blinking Stars (Massive Hyper-Realistic Galaxy) ──────────────────────────
  const GROUPS = 20;      // Increased groups for twinkling
  const PER_GROUP = 1500; // ~30,000 stars total for extreme density
  const starGroups = [];
  
  // Real star color palette (Blue/White to Orange/Red)
  const STAR_COLORS = [
    new THREE.Color(0x9db4ff), // Hot Blue (O/B type)
    new THREE.Color(0xbbccff), // Light Blue (A type)
    new THREE.Color(0xffffff), // Pure White (F type)
    new THREE.Color(0xfff4e8), // Yellow-White (G type - Sun-like)
    new THREE.Color(0xffddaa), // Orange (K type)
    new THREE.Color(0xffb07c), // Red dwarf (M type)
  ];

  for (let g = 0; g < GROUPS; g++) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(PER_GROUP * 3);
    const colors = new Float32Array(PER_GROUP * 3);
    
    for (let i = 0; i < PER_GROUP; i++) {
      let x, y, z;
      
      const randType = Math.random();
      
      // Determine position across 3 distinct stellar populations
      if (randType < 0.35) {
        // 1) Deep space background stars (35% - Spherically uniform)
        // Ensures the universe is highly visible and dense from NO MATTER what angle you look.
        const theta = Math.random() * Math.PI * 2;
        const phi   = Math.acos(2 * Math.random() - 1);
        const r     = 600 + Math.random() * 2400; 
        x = r * Math.sin(phi) * Math.cos(theta);
        y = r * Math.sin(phi) * Math.sin(theta);
        z = r * Math.cos(phi);
      } else if (randType < 0.65) {
        // 2) Galactic Disc (30% - Fills the dark gaps between the arms)
        const p = Math.random();
        const r_plane = Math.pow(p, 1.2) * 2800; // Spread across the whole radius, focused slightly inward
        const angle = Math.random() * Math.PI * 2; // Completely random angle (fills gaps)
        
        // Disc has a thicker halo to make it volumetrically dense from outside
        const thickness = 600 * Math.exp(-r_plane * 0.002) + 120;
        
        x = r_plane * Math.cos(angle);
        y = (Math.pow(Math.random(), 3) - 0.5) * 2.0 * thickness;
        z = r_plane * Math.sin(angle);
      } else {
        // 3) Dense Spiral Arms (35% - The main bright structures)
        const p = Math.random();
        const r_plane = 100 + Math.pow(p, 1.5) * 2800; // Trailing arms up to 2900 units
        
        const branchAngle = (Math.PI * 2 / 3) * (i % 3); 
        
        // Thicker arms as they stretch outward
        const radialNoise = (Math.random() - 0.5) * (150 + p * 350);
        const r_final = r_plane + Math.abs(radialNoise) * (Math.random() < 0.5 ? 1 : -1); 
        
        // Spin creates the spiral shape
        const spin = r_final * 0.0025; 
        const angleNoise = (Math.random() - 0.5) * 0.55; 
        const angle = branchAngle + spin + angleNoise;
        
        // Compressed tightly in the Y axis for sharp arm definition
        const thickness = 350 * Math.exp(-r_plane * 0.0025) + 30; 
        
        x = r_final * Math.cos(angle);
        y = (Math.pow(Math.random(), 3) - 0.5) * 2.0 * thickness; 
        z = r_final * Math.sin(angle);
      }
      
      pos[i*3]   = x;
      pos[i*3+1] = y;
      pos[i*3+2] = z;

      // Select star tint favoring white/blue in outer arms, and orange/yellow in core/dust
      let distFromCenter = Math.sqrt(x*x + y*y + z*z);
      let randC = Math.random();
      let colorIndex;
      
      if (distFromCenter < 600 && randC > 0.4) {
        colorIndex = Math.floor(Math.random() * 3) + 3; // K, M, G types (warm core)
      } else if (distFromCenter > 1500 && randC > 0.5) {
        colorIndex = Math.floor(Math.random() * 2); // O, B types (hot blue arms)
      } else {
        colorIndex = Math.floor(Math.random() * STAR_COLORS.length); // Any
      }

      const c = STAR_COLORS[colorIndex];
      // Add slight variance to the chosen color
      colors[i*3]   = THREE.MathUtils.clamp(c.r + (Math.random() - 0.5) * 0.1, 0, 1);
      colors[i*3+1] = THREE.MathUtils.clamp(c.g + (Math.random() - 0.5) * 0.1, 0, 1);
      colors[i*3+2] = THREE.MathUtils.clamp(c.b + (Math.random() - 0.5) * 0.1, 0, 1);
    }
    
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const mat = new THREE.PointsMaterial({
      size: 0.6 + Math.random() * 1.8, // Bigger variance in star size
      vertexColors: true,
      sizeAttenuation: true, 
      transparent: true,
      opacity: 0.4 + Math.random() * 0.5,
      depthWrite: false, 
      blending: THREE.AdditiveBlending,
    });
    
    const pointsMesh = new THREE.Points(geo, mat);
    
    // Tilt the entire massive galaxy and set order to YXZ so it spins correctly 
    pointsMesh.rotation.order = "YXZ";
    pointsMesh.rotation.x = 0.55; 
    pointsMesh.rotation.z = 0.35; 
    
    scene.add(pointsMesh);
    
    starGroups.push({ 
      mesh: pointsMesh,
      mat, 
      speed: 0.2 + Math.random() * 0.8, // Slightly slower twinkling for scale
      phase: Math.random() * Math.PI * 2, 
      base: 0.3 + Math.random() * 0.4, 
      amp: 0.1 + Math.random() * 0.3 
    });
  }

  // ── Nebula 1: Trifid-style (Pink/Blue/White) ────────────────
  const trifidConfig = {
    cx: -200, cy: 180, cz: -500,
    scheme: { core: 0xffffff, bottom: 0xee2255, top: 0x0088cc, mid: 0x882299 },
    lobes: [
      { ox:   0, oy:   0, oz:   0, r: 1.00 }, // main centre
      { ox: -95, oy:  75, oz:  40, r: 0.60 }, // upper-left blue lobe
      { ox:  85, oy: -55, oz: -50, r: 0.55 }, // lower-right pink lobe
      { ox:  55, oy:  95, oz:  30, r: 0.45 }, // top blue wisp
      { ox: -65, oy: -80, oz:  25, r: 0.40 }, // bottom pink clump
    ],
    lanes: [0.52, 2.20, 4.45], // 3 radiating dark gaps
    laneWidth: 0.11,
    layers: [
      { count:  800, spread: 220, radialBias: 0.40, flatY: 0.45, size: 70, opacity: 0.030, useLanes: false }, // outer wisps
      { count: 1200, spread: 180, radialBias: 0.50, flatY: 0.50, size: 38, opacity: 0.050, useLanes: false }, // fluffy outer cloud
      { count: 1500, spread: 140, radialBias: 0.60, flatY: 0.55, size: 20, opacity: 0.075, useLanes: true  }, // mid-cloud + dark lanes
      { count: 1000, spread:  90, radialBias: 0.70, flatY: 0.65, size: 10, opacity: 0.110, useLanes: true  }, // bright filaments
      { count:  500, spread:  45, radialBias: 0.85, flatY: 0.75, size:  4, opacity: 0.400, useLanes: false }, // embedded core stars
    ]
  };

  // ── Nebula 2: Deep space (Emerald/Gold/Purple) ──────────────
  const emeraldConfig = {
    cx: 400, cy: -80, cz: -250, // Placed lower right, closer
    scheme: { core: 0xfff0bb, bottom: 0x00cc77, top: 0x8833cc, mid: 0xffaa22 },
    lobes: [
      // More elongated and horizontal shape, differing from Trifid
      { ox:    0, oy:    0, oz:   0, r: 1.00 },
      { ox:  120, oy:  -20, oz:  40, r: 0.70 }, // stretched right
      { ox: -130, oy:   10, oz: -30, r: 0.65 }, // stretched left
      { ox:   60, oy:   50, oz: -50, r: 0.50 }, // subtle top bump
    ],
    // Just a diagonal slash for the dust lane 
    lanes: [1.1, 4.2], 
    laneWidth: 0.09,
    layers: [
      { count:  700, spread: 240, radialBias: 0.45, flatY: 0.35, size: 75, opacity: 0.025, useLanes: false },
      { count: 1100, spread: 190, radialBias: 0.50, flatY: 0.40, size: 42, opacity: 0.040, useLanes: false },
      { count: 1400, spread: 150, radialBias: 0.60, flatY: 0.45, size: 24, opacity: 0.065, useLanes: true  },
      { count:  900, spread:  95, radialBias: 0.70, flatY: 0.55, size: 12, opacity: 0.090, useLanes: true  },
      { count:  400, spread:  40, radialBias: 0.85, flatY: 0.65, size:  5, opacity: 0.300, useLanes: false },
    ]
  };

  const nebula1 = buildNebula(scene, trifidConfig);
  const nebula2 = buildNebula(scene, emeraldConfig);
  const allNebulas = [...nebula1, ...nebula2];

  // ── Animated Sun ────────────────────────────────────────────
  const SUN_ORBIT_SPEED  = 0.004;
  const SUN_ORBIT_RADIUS = 300;

  function updateSky(elapsed) {
    // Star twinkle and majestic rotation
    starGroups.forEach(({ mesh, mat, speed, phase, base, amp }) => {
      mat.opacity = base + Math.sin(elapsed * speed + phase) * amp;
      mesh.rotation.y = elapsed * -0.015; // Slow, epic galactic spin
    });

    // Nebula shimmer (each layer at slightly different phase)
    allNebulas.forEach(({ mat, base }, i) => {
      mat.opacity = base + Math.sin(elapsed * 0.18 + i * 1.3) * (base * 0.18);
    });

    // Sun orbit
    const angle = elapsed * SUN_ORBIT_SPEED;
    const sunX  = Math.cos(angle) * SUN_ORBIT_RADIUS;
    const sunY  = Math.sin(angle) * SUN_ORBIT_RADIUS * 0.55 + SUN_ORBIT_RADIUS * 0.1;
    const sunZ  = Math.sin(angle * 0.6) * SUN_ORBIT_RADIUS * 0.4;

    if (sunLight) {
      sunLight.position.set(sunX, sunY, sunZ);
      sunLight.target.position.set(0, 0, 0);
      const elev = sunY / SUN_ORBIT_RADIUS;
      sunLight.intensity = THREE.MathUtils.clamp(elev * 3 + 0.3, 0.05, 1.2);
    }
    if (sunMesh) sunMesh.position.set(sunX, sunY, sunZ);
  }

  return { updateSky };
}
