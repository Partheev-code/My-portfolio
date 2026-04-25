/**
 * solarSystem.js
 * Black-and-white 3D solar system with:
 *  - A dense star-field (THREE.Points)
 *  - 7 greyscale planets in circular orbits
 * All rotation happens in the RAF loop, independent of scroll.
 */
import * as THREE from 'three';

const STAR_COUNT = 5000;

// ── Star field ──────────────────────────────────────────────
function createStarField() {
  const positions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const r     = 200 + Math.random() * 800;
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.8,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85,
  });

  return new THREE.Points(geo, mat);
}

// ── Planets ──────────────────────────────────────────────────
const PLANET_DATA = [
  { radius: 3.0, orbitR: 28, speed: 0.35, grey: 0.88 },
  { radius: 4.5, orbitR: 48, speed: 0.22, grey: 0.70 },
  { radius: 2.5, orbitR: 65, speed: 0.40, grey: 0.55 },
  { radius: 6.0, orbitR: 88, speed: 0.14, grey: 0.40 },
  { radius: 5.2, orbitR: 110, speed: 0.10, grey: 0.60 },
  { radius: 3.8, orbitR: 130, speed: 0.18, grey: 0.30 },
  { radius: 2.2, orbitR: 150, speed: 0.28, grey: 0.75 },
];

function createPlanets() {
  const planets = [];
  PLANET_DATA.forEach((data, i) => {
    const geo = new THREE.SphereGeometry(data.radius, 32, 16);
    const col = new THREE.Color(data.grey, data.grey, data.grey);
    const mat = new THREE.MeshStandardMaterial({
      color: col,
      roughness: 0.85,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geo, mat);

    // Initial angle offset so planets are spread
    const startAngle = (i / PLANET_DATA.length) * Math.PI * 2;
    mesh.position.set(
      Math.cos(startAngle) * data.orbitR,
      (Math.random() - 0.5) * 20,
      Math.sin(startAngle) * data.orbitR
    );
    mesh.userData = { orbitR: data.orbitR, speed: data.speed, angle: startAngle };
    planets.push(mesh);
  });
  return planets;
}

// ── Sun (central light source visual) ────────────────────────
function createSun() {
  const geo = new THREE.SphereGeometry(8, 32, 16);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const sun = new THREE.Mesh(geo, mat);
  sun.position.set(0, 0, -60); // behind the scene
  return sun;
}

// ── Public API ───────────────────────────────────────────────
export function createSolarSystem(scene) {
  const group = new THREE.Group();
  // Tilt the whole solar-system plane slightly for a dramatic angle
  group.rotation.x = Math.PI * 0.18;
  group.rotation.z = Math.PI * 0.06;
  // Push it back so it doesn't crowd the foreground staircase
  group.position.set(0, 0, -120);

  const stars   = createStarField();
  const sun     = createSun();
  const planets = createPlanets();

  // Ambient light for planets
  const ambientSolar = new THREE.AmbientLight(0xffffff, 0.05);
  const pointSun     = new THREE.PointLight(0xffffff, 2.0, 400, 1.5);
  pointSun.position.copy(sun.position);

  group.add(stars, sun, ambientSolar, pointSun, ...planets);
  scene.add(group);

  return { group, planets };
}

// Called every frame — pure RAF, no scroll dependency
export function updateSolarSystem(planets, elapsedSec) {
  planets.forEach((planet) => {
    planet.userData.angle += planet.userData.speed * 0.008;
    const a = planet.userData.angle;
    planet.position.x = Math.cos(a) * planet.userData.orbitR;
    planet.position.z = Math.sin(a) * planet.userData.orbitR;
    planet.rotation.y += 0.004;
  });
}
