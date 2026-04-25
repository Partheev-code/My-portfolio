/**
 * landscapeScene.js
 * Scene 4: "Colour Full" Sunrise Landscape.
 * Contains low-poly mountains, trees, and a huge glowing sun.
 */
import * as THREE from 'three';

export function createLandscapeScene(scene) {
  const landscapeGroup = new THREE.Group();
  
  // ── Sun ──────────────────────────────────────────────────
  const sunGeo = new THREE.SphereGeometry(60, 32, 32);
  const sunMat = new THREE.MeshStandardMaterial({
    color: 0xffaa00,
    emissive: new THREE.Color(0xff8800),
    emissiveIntensity: 4.0,
    roughness: 1.0,
  });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  sun.position.set(0, -10, -300); // Distant horizon
  landscapeGroup.add(sun);

  // ── Mountains ─────────────────────────────────────────────
  const mtnMat1 = new THREE.MeshStandardMaterial({ color: 0x4a235a, roughness: 0.9, flatShading: true });
  const mtnMat2 = new THREE.MeshStandardMaterial({ color: 0x154360, roughness: 0.9, flatShading: true });
  const mtnMat3 = new THREE.MeshStandardMaterial({ color: 0x117a65, roughness: 0.9, flatShading: true });

  const mtnGeo1 = new THREE.ConeGeometry(80, 160, 6);
  const mtn1 = new THREE.Mesh(mtnGeo1, mtnMat1);
  mtn1.position.set(-90, -30, -180);

  const mtnGeo2 = new THREE.ConeGeometry(120, 220, 7);
  const mtn2 = new THREE.Mesh(mtnGeo2, mtnMat2);
  mtn2.position.set(40, -40, -220);

  const mtnGeo3 = new THREE.ConeGeometry(60, 100, 5);
  const mtn3 = new THREE.Mesh(mtnGeo3, mtnMat3);
  mtn3.position.set(110, -20, -140);

  const mtnGeo4 = new THREE.ConeGeometry(70, 130, 6);
  const mtn4 = new THREE.Mesh(mtnGeo4, mtnMat1);
  mtn4.position.set(-150, -40, -160);

  landscapeGroup.add(mtn1, mtn2, mtn3, mtn4);

  // ── Trees (Scattered) ─────────────────────────────────────
  const treeGeo = new THREE.ConeGeometry(4, 15, 5);
  const trunkGeo = new THREE.CylinderGeometry(0.8, 1, 4, 5);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x229955, roughness: 0.8, flatShading: true });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 1.0 });

  for (let i = 0; i < 40; i++) {
    const treeGroup = new THREE.Group();
    
    const leaves = new THREE.Mesh(treeGeo, leafMat);
    leaves.position.y = 8;
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 2;
    
    treeGroup.add(leaves, trunk);
    
    // Random placement along the ground plane
    const angle = Math.random() * Math.PI * 2;
    const radius = 30 + Math.random() * 120;
    treeGroup.position.set(
      Math.cos(angle) * radius,
      -10 - Math.random() * 10,
      Math.sin(angle) * radius - 80
    );
    
    // Scale randomization
    const s = 0.5 + Math.random() * 1.2;
    treeGroup.scale.set(s, s, s);
    
    landscapeGroup.add(treeGroup);
  }

  // ── Lighting for Landscape ─────────────────────────────────
  const ambient = new THREE.AmbientLight(0x404040, 2.0); // Soft white daylight
  const sunLight = new THREE.PointLight(0xffaa00, 5.0, 1000, 1.5);
  sunLight.position.copy(sun.position);
  
  // Fill light from sky
  const hemiLight = new THREE.HemisphereLight(0x88ccff, 0x44aa44, 1.5);

  landscapeGroup.add(ambient, sunLight, hemiLight);

  // Hide initially until transition
  landscapeGroup.visible = false;
  scene.add(landscapeGroup);

  return { landscapeGroup, sun };
}
