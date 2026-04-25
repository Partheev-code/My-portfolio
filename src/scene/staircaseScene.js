/**
 * staircaseScene.js
 * Loads the user's custom stair.glb (100-step spiral staircase).
 * Creates 3000 particles that cascade step-by-step down the spiral helix.
 * Returns { sceneGroup, character, stepPositions, topPosition, updateGodRays }
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createCharacterWalker } from './characterWalker.js';

const loader = new GLTFLoader();

const STEP_COUNT      = 100;                           // user confirmed 100 steps
const TOTAL_ROTATIONS = 2.5;                           // typical spiral — adjust if needed
const ANGLE_PER_STEP  = (TOTAL_ROTATIONS * Math.PI * 2) / STEP_COUNT;
const HELIX_RISE      = 1.0;                           // fallback before GLB loads

// ── Realistic God Rays ────────────────────────────────────────────────────────
// 3 shadow-casting SpotLights that reflect and cast shadows on the staircase.
function buildGodRays(topY, spiralRadius) {
  const group  = new THREE.Group();
  const rayLen = topY * 1.5;

  // ── SpotLight 1: Main key light — bright warm beam straight down ──────
  const keyLight = new THREE.SpotLight(0xffe8bb, 12.0, rayLen * 1.1, Math.PI / 6, 0.35, 1.5);
  keyLight.position.set(0, topY + 0.5, 0);
  keyLight.target.position.set(0, 0, 0);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far  = rayLen * 1.2;
  keyLight.shadow.bias = -0.001;
  group.add(keyLight, keyLight.target);

  // ── SpotLight 2: Fill — offset for step-edge highlights ──────────────
  const fillSpot = new THREE.SpotLight(0xffc877, 5.0, rayLen * 0.9, Math.PI / 9, 0.5, 2.0);
  fillSpot.position.set(spiralRadius * 0.3, topY + 0.5, spiralRadius * 0.3);
  fillSpot.target.position.set(0, topY * 0.3, 0);
  fillSpot.castShadow = true;
  fillSpot.shadow.mapSize.set(1024, 1024);
  group.add(fillSpot, fillSpot.target);

  // ── SpotLight 3: Cool rim from side ──────────────────────────────────
  const rimSpot = new THREE.SpotLight(0xaaccff, 3.0, rayLen * 0.7, Math.PI / 8, 0.6, 2.0);
  rimSpot.position.set(-spiralRadius * 0.6, topY * 0.75, spiralRadius * 0.4);
  rimSpot.target.position.set(0, topY * 0.25, 0);
  group.add(rimSpot, rimSpot.target);

  return { group, update: () => {} };
}


// ── Spiral Cascade Flow ───────────────────────────────────────────────────────
// 3000 particles cascade step-by-step down a 100-step spiral helix.
// Each particle: arc along tread → tip over edge → fall riser → next step.
function buildSpiralFlow(modelHeight, spiralRadius) {
  const COUNT   = 3000;
  const stepH   = modelHeight / STEP_COUNT;   // vertical height per step
  const stepRot = ANGLE_PER_STEP;             // radians each step arcs through

  // Per-particle typed arrays
  const stepIdx    = new Int16Array(COUNT);
  const treadProg  = new Float32Array(COUNT);
  const fallProg   = new Float32Array(COUNT);
  const onTread    = new Uint8Array(COUNT);
  const radialOff  = new Float32Array(COUNT);
  const treadSpeed = new Float32Array(COUNT);
  const fallSpeed  = new Float32Array(COUNT);
  const turbPhase  = new Float32Array(COUNT);

  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(COUNT * 3);

  function resetParticle(i, startStep) {
    stepIdx[i]    = Math.min(startStep, STEP_COUNT - 1);
    treadProg[i]  = Math.random();
    fallProg[i]   = 0;
    onTread[i]    = 1;
    radialOff[i]  = (Math.random() - 0.5) * 0.8;    // spread inner↔outer
    treadSpeed[i] = 0.003 + Math.random() * 0.005;  // arc traversal speed
    fallSpeed[i]  = 0.055 + Math.random() * 0.07;   // riser fall speed
    turbPhase[i]  = Math.random() * Math.PI * 2;
  }

  // Scatter all particles across the full staircase at start
  for (let i = 0; i < COUNT; i++) {
    resetParticle(i, Math.floor(Math.random() * STEP_COUNT));
    treadProg[i] = Math.random();

    // Pre-compute initial positions so scene fills immediately
    const si  = stepIdx[i];
    const ang = si * stepRot + treadProg[i] * stepRot;
    const r   = spiralRadius + radialOff[i] * 0.4;
    pos[i * 3]     = Math.cos(ang) * r;
    pos[i * 3 + 1] = modelHeight - si * stepH;
    pos[i * 3 + 2] = Math.sin(ang) * r;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xcce8ff,
    size: 0.055,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geo, mat);

  // ── Per-frame update ──────────────────────────────────────────────────
  function update(elapsed) {
    const p = geo.attributes.position.array;

    for (let i = 0; i < COUNT; i++) {
      const si      = stepIdx[i];
      const treadY  = modelHeight - si * stepH;   // Y of this step's tread
      const baseAng = si * stepRot;               // helix angle at start of this step
      const r       = spiralRadius + radialOff[i] * 0.4;

      if (onTread[i]) {
        // ── Arc along the spiral tread ────────────────────────
        treadProg[i] += treadSpeed[i];
        const ang  = baseAng + treadProg[i] * stepRot;
        const sway = Math.sin(elapsed * 3.0 + turbPhase[i]) * 0.05;

        p[i * 3]     = Math.cos(ang) * (r + sway);
        p[i * 3 + 1] = treadY;
        p[i * 3 + 2] = Math.sin(ang) * (r + sway);

        if (treadProg[i] >= 1.0) {
          onTread[i]  = 0;
          fallProg[i] = 0;
        }
      } else {
        // ── Fall down the riser, accelerating with gravity ────
        fallProg[i] += fallSpeed[i] * (1.0 + fallProg[i] * 1.8);
        const ang  = baseAng + stepRot;           // fixed at end-of-tread angle
        const sway = Math.sin(elapsed * 4.5 + turbPhase[i]) * 0.04;

        p[i * 3]     = Math.cos(ang) * (r + sway);
        p[i * 3 + 1] = treadY - fallProg[i] * stepH;
        p[i * 3 + 2] = Math.sin(ang) * (r + sway);

        if (fallProg[i] >= 1.0) {
          const next = si + 1;
          if (next >= STEP_COUNT) {
            // Reached bottom → reset to top quarter
            resetParticle(i, Math.floor(Math.random() * Math.floor(STEP_COUNT * 0.25)));
          } else {
            stepIdx[i]    = next;
            onTread[i]    = 1;
            treadProg[i]  = 0;
            fallProg[i]   = 0;
            radialOff[i] += (Math.random() - 0.5) * 0.1; // tiny splash scatter
          }
        }
      }
    }

    geo.attributes.position.needsUpdate = true;
  }

  return { points, update };
}

// ── Main Scene Builder ────────────────────────────────────────────────────────
export function createStaircaseScene(scene, onReachTop) {
  const sceneGroup = new THREE.Group();
  const character  = new THREE.Group();

  // ── Sun helpers ───────────────────────────────────────────
  function addSun(pos, color, intensity, size = 4) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(size, 24, 24),
      new THREE.MeshBasicMaterial({ color })
    );
    mesh.position.copy(pos);
    scene.add(mesh);

    const light = new THREE.DirectionalLight(color, intensity);
    light.position.copy(pos);
    light.target.position.set(0, 0, 0);
    scene.add(light, light.target);
  }

  // ── Top sun (main, shadow-casting) ───────────────────────
  const SUN_TOP = new THREE.Vector3(40, 120, 60);
  const sunGeo  = new THREE.SphereGeometry(6, 32, 32);
  const sunMat  = new THREE.MeshBasicMaterial({ color: 0xfff8e0 });
  const sunMesh = new THREE.Mesh(sunGeo, sunMat);
  sunMesh.position.copy(SUN_TOP);
  scene.add(sunMesh);

  const sunLight = new THREE.DirectionalLight(0xfff5e0, 1.2); // natural sun
  sunLight.position.copy(SUN_TOP);
  sunLight.target.position.set(0, 0, 0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near   = 1;
  sunLight.shadow.camera.far    = 400;
  sunLight.shadow.camera.left   = -60;
  sunLight.shadow.camera.right  =  60;
  sunLight.shadow.camera.top    =  60;
  sunLight.shadow.camera.bottom = -60;
  sunLight.shadow.bias = -0.001;
  scene.add(sunLight, sunLight.target);

  // ── Fill suns (no shadows — just even fill from every side) ──
  addSun(new THREE.Vector3(-120, 20,   0), 0xffeedd, 0.5, 3); // left
  addSun(new THREE.Vector3( 120, 20,   0), 0xffeedd, 0.5, 3); // right
  addSun(new THREE.Vector3(   0, -80,  0), 0xaaccff, 0.3, 3); // bottom
  addSun(new THREE.Vector3(   0, 20, 120), 0xfff0dd, 0.4, 3); // front
  addSun(new THREE.Vector3(   0, 20,-120), 0xddeeff, 0.4, 3); // back

  // Ambient: low floor so shadows are visible but no face is pitch black
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  sceneGroup.add(character, ambientLight);
  scene.add(sceneGroup);



  // ── Fallback step positions (replaced after GLB loads) ────
  const stepPositions = [];
  for (let i = 0; i < STEP_COUNT; i++) {
    const angle = i * ANGLE_PER_STEP;
    stepPositions.push(new THREE.Vector3(
      Math.cos(angle) * 4.5,
      i * HELIX_RISE,
      Math.sin(angle) * 4.5,
    ));
  }

  let godRaysUpdate = (_e) => {};

  // ── Load stair.glb ────────────────────────────────────────
  loader.load(
    '/models/stair.glb',
    (gltf) => {
      const model = gltf.scene;

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow    = true;
          child.receiveShadow = true;

          const mat = child.material;
          if (!mat) return;

          // ── Force-brighten dark materials ────────────────────
          // If the base color is too dark, boost it so it's always visible
          if (mat.color) {
            const { r, g, b } = mat.color;
            const brightness = r * 0.299 + g * 0.587 + b * 0.114;
            if (brightness < 0.25) {
              // Scale the colour up so it's at least 25% brightness
              const scale = 0.35 / Math.max(brightness, 0.001);
              mat.color.setRGB(
                Math.min(r * scale, 1),
                Math.min(g * scale, 1),
                Math.min(b * scale, 1)
              );
            }
          }

          // Reduce metalness / roughness so materials react better to light
          if (mat.metalness !== undefined) mat.metalness = Math.min(mat.metalness, 0.3);
          if (mat.roughness !== undefined) mat.roughness = Math.max(mat.roughness, 0.5);

          // Boost any baked emissive glow
          if (mat.emissive) {
            const e = mat.emissive;
            if (e.r + e.g + e.b > 0.05) {
              mat.emissiveIntensity = Math.max(mat.emissiveIntensity ?? 1, 2.5);
            }
          }
        }
      });

      // Auto-centre model at origin
      const box    = new THREE.Box3().setFromObject(model);
      const center = new THREE.Vector3();
      const size   = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);

      model.position.x -= center.x;
      model.position.y -= box.min.y;
      model.position.z -= center.z;

      sceneGroup.add(model);

      const modelHeight = size.y;
      const modelRadius = Math.max(size.x, size.z) * 0.5;

      // Use custom recorded step positions mapping to the exact stair.glb path
      stepPositions.length = 0;
      const customStepPositions = [
        new THREE.Vector3(0.014, -47.097, 16.147),
        new THREE.Vector3(2.804, -46.313, 15.499),
        new THREE.Vector3(5.836, -45.529, 14.459),
        new THREE.Vector3(7.952, -44.745, 12.920),
        new THREE.Vector3(10.044, -43.961, 11.070),
        new THREE.Vector3(12.103, -43.177, 8.813),
        new THREE.Vector3(13.608, -42.393, 6.187),
        new THREE.Vector3(14.942, -41.610, 3.397),
        new THREE.Vector3(15.732, -40.826, 0.634),
        new THREE.Vector3(15.758, -40.042, -2.393),
        new THREE.Vector3(15.401, -39.258, -5.553),
        new THREE.Vector3(14.297, -38.474, -8.378),
        new THREE.Vector3(12.536, -37.690, -10.872),
        new THREE.Vector3(9.982, -36.906, -12.972),
        new THREE.Vector3(7.337, -36.122, -14.688),
        new THREE.Vector3(4.373, -35.338, -15.706),
        new THREE.Vector3(1.226, -34.554, -16.111),
        new THREE.Vector3(-1.902, -33.770, -15.979),
        new THREE.Vector3(-4.691, -32.986, -15.462),
        new THREE.Vector3(-7.690, -32.202, -14.224),
        new THREE.Vector3(-10.355, -31.418, -12.816),
        new THREE.Vector3(-12.484, -30.634, -10.578),
        new THREE.Vector3(-13.853, -29.851, -7.733),
        new THREE.Vector3(-15.342, -29.067, -4.801),
        new THREE.Vector3(-16.223, -28.283, -1.796),
        new THREE.Vector3(-15.964, -27.499, 1.433),
        new THREE.Vector3(-15.408, -26.715, 4.239),
        new THREE.Vector3(-14.147, -25.931, 6.994),
        new THREE.Vector3(-12.738, -25.147, 9.745),
        new THREE.Vector3(-10.499, -24.363, 11.714),
        new THREE.Vector3(-8.129, -23.579, 13.767),
        new THREE.Vector3(-5.399, -22.795, 15.383),
        new THREE.Vector3(-2.312, -22.011, 15.881),
        new THREE.Vector3(0.641, -21.227, 16.060),
        new THREE.Vector3(3.562, -20.443, 15.360),
        new THREE.Vector3(6.503, -19.659, 14.037),
        new THREE.Vector3(9.039, -18.875, 12.592),
        new THREE.Vector3(11.418, -18.092, 10.887),
        new THREE.Vector3(13.854, -17.308, 8.502),
        new THREE.Vector3(15.262, -16.524, 6.053),
        new THREE.Vector3(16.469, -15.740, 3.202),
        new THREE.Vector3(16.375, -14.956, -0.379),
        new THREE.Vector3(16.139, -14.172, -3.183),
        new THREE.Vector3(15.242, -13.388, -6.356),
        new THREE.Vector3(13.517, -12.604, -8.850),
        new THREE.Vector3(11.043, -11.820, -10.769),
        new THREE.Vector3(8.491, -11.036, -12.590),
        new THREE.Vector3(6.118, -10.252, -13.911),
        new THREE.Vector3(3.260, -9.468, -14.622),
        new THREE.Vector3(0.429, -8.684, -15.001),
        new THREE.Vector3(-2.317, -7.900, -15.278),
        new THREE.Vector3(-5.033, -7.117, -14.287),
        new THREE.Vector3(-7.537, -6.333, -12.979),
        new THREE.Vector3(-9.674, -5.549, -11.093),
        new THREE.Vector3(-11.611, -4.765, -8.869),
        new THREE.Vector3(-13.099, -3.981, -6.468),
        new THREE.Vector3(-14.264, -3.197, -3.758),
        new THREE.Vector3(-14.501, -2.413, -0.973),
        new THREE.Vector3(-14.593, -1.629, 1.762),
        new THREE.Vector3(-13.978, -0.845, 4.385),
        new THREE.Vector3(-12.686, -0.061, 7.065),
        new THREE.Vector3(-11.261, 0.723, 9.498),
        new THREE.Vector3(-9.183, 1.507, 11.626),
        new THREE.Vector3(-6.898, 2.291, 13.228),
        new THREE.Vector3(-4.254, 3.075, 14.415),
        new THREE.Vector3(-1.479, 3.859, 15.145),
        new THREE.Vector3(1.467, 4.642, 14.814),
        new THREE.Vector3(4.452, 5.426, 14.448),
        new THREE.Vector3(6.901, 6.210, 13.461),
        new THREE.Vector3(9.406, 6.994, 11.374),
        new THREE.Vector3(11.424, 7.778, 9.640),
        new THREE.Vector3(12.981, 8.562, 7.438),
        new THREE.Vector3(14.419, 9.346, 4.732),
        new THREE.Vector3(15.363, 10.130, 2.020),
        new THREE.Vector3(16.058, 10.914, -0.962),
        new THREE.Vector3(15.452, 11.698, -4.180),
        new THREE.Vector3(14.419, 12.482, -6.979),
        new THREE.Vector3(12.499, 13.266, -9.079),
        new THREE.Vector3(10.385, 14.050, -11.205),
        new THREE.Vector3(7.911, 14.834, -12.947),
        new THREE.Vector3(5.065, 15.618, -14.077),
        new THREE.Vector3(2.677, 16.401, -14.563),
        new THREE.Vector3(-0.071, 17.185, -14.718),
        new THREE.Vector3(-3.104, 17.969, -13.832),
        new THREE.Vector3(-5.486, 18.753, -12.859),
        new THREE.Vector3(-7.825, 19.537, -11.699),
        new THREE.Vector3(-9.933, 20.321, -10.153),
        new THREE.Vector3(-11.624, 21.105, -7.970),
        new THREE.Vector3(-13.127, 21.889, -5.397),
        new THREE.Vector3(-14.322, 22.673, -2.664),
        new THREE.Vector3(-14.957, 23.457, -0.239),
        new THREE.Vector3(-15.244, 24.241, 2.943),
        new THREE.Vector3(-14.638, 25.025, 5.859),
        new THREE.Vector3(-13.131, 25.809, 8.371),
        new THREE.Vector3(-11.254, 26.593, 10.784),
        new THREE.Vector3(-8.986, 27.376, 12.733),
        new THREE.Vector3(-6.437, 28.160, 14.413),
        new THREE.Vector3(-3.708, 28.944, 15.284),
        new THREE.Vector3(-0.700, 29.728, 15.646),
        new THREE.Vector3(2.407, 30.512, 15.567),
        new THREE.Vector3(12.264, 33.444, 14.283),
      ];
      
      const yOffsetReference = -(STEP_COUNT * HELIX_RISE) * 0.5; // Same logic as yOffset

      for (const pt of customStepPositions) {
        stepPositions.push(new THREE.Vector3(pt.x, pt.y - yOffsetReference, pt.z));
      }

      character.position.copy(stepPositions[0]);

      // Realistic god rays — spotlights + cone shafts (reflects on staircase)
      const { group: raysGroup, update: raysUpdate } = buildGodRays(modelHeight, modelRadius);
      sceneGroup.add(raysGroup);

      // 3000-particle spiral cascade
      const { points, update: flowUpdate } = buildSpiralFlow(modelHeight, modelRadius);
      sceneGroup.add(points);

      // 3D character walking up the staircase
      const stepHeight = modelHeight / STEP_COUNT;
      const charWalker = createCharacterWalker(sceneGroup, stepPositions, stepHeight, onReachTop);

      // Internal elapsed accumulator (particles need total time, not delta)
      let _elapsed = 0;

      // Combine all per-frame updates into one callback
      godRaysUpdate = (delta, scrollProgress = -1) => {
        _elapsed += delta;
        raysUpdate(_elapsed);
        flowUpdate(_elapsed);
        charWalker.update(delta, scrollProgress);
      };

      console.log(`[stair.glb] ✓  ${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} | r=${modelRadius.toFixed(1)}`);
    },
    (xhr) => console.log(`[stair.glb] ${Math.round(xhr.loaded / xhr.total * 100)}%`),
    (err) => console.error('[stair.glb] error:', err)
  );

  const yOffset = -(STEP_COUNT * HELIX_RISE) * 0.5;
  sceneGroup.position.y = yOffset;

  const worldStepPositions = new Proxy(stepPositions, {
    get(target, prop) {
      if (prop === 'length')   return target.length;
      if (prop === 'map')      return (fn) => target.map(fn);
      if (prop === 'forEach')  return (fn) => target.forEach(fn);
      const idx = parseInt(prop);
      if (!isNaN(idx) && target[idx])
        return new THREE.Vector3(target[idx].x, target[idx].y + yOffset, target[idx].z);
      return target[prop];
    }
  });

  const topPosition = new THREE.Vector3(
    stepPositions[STEP_COUNT - 1]?.x ?? 0,
    (stepPositions[STEP_COUNT - 1]?.y ?? 0) + yOffset,
    stepPositions[STEP_COUNT - 1]?.z ?? 0,
  );

  const updateGodRays = (elapsed, t) => godRaysUpdate(elapsed, t);

  return {
    sceneGroup,
    character,
    stepsGroup:   sceneGroup,
    doorwayGroup: sceneGroup,
    topPosition,
    stepPositions: worldStepPositions,
    updateGodRays,
    sunLight,
    sunMesh,
  };
}
