/**
 * characterWalker.js
 *
 * Loads the rigged Soldier.glb, plays its Walk animation,
 * and walks the character up the 100-step spiral staircase
 * step-by-step, facing the direction of travel.
 *
 * Usage:
 *   // inside staircaseScene.js GLB callback, after stepPositions are set:
 *   const charWalker = createCharacterWalker(sceneGroup, stepPositions, stepHeight);
 *
 *   // in the RAF loop (via godRaysUpdate):
 *   charWalker.update(delta);
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export function createCharacterWalker(parentGroup, stepPositions, stepHeight, onReachTop) {
  const loader = new GLTFLoader();
  let mixer = null;
  let charRoot = null;
  let isReady = false;

  // Build a mathematically smooth path curve through all human-clicked waypoints
  const pathCurve = new THREE.CatmullRomCurve3(stepPositions, false, 'catmullrom', 0.5);
  const pathLength = pathCurve.getLength();

  // 3.5 meters/units per second for a brisk walking pace
  const WALK_SPEED = 3.5;
  let distanceTraveled = 0;

  // Scale the character so it looks right relative to step height
  // Soldier.glb is ≈ 1.8 units tall; we want about 2 × stepHeight
  const charScale = Math.max(stepHeight * 8.8, 0.18
  ); // Increased size

  // Small upward offset so the character sits ON the step, not inside it
  const FOOT_OFFSET = 0;

  loader.load(
    '/models/realistic_character.glb',
    (gltf) => {
      charRoot = gltf.scene;
      charRoot.scale.setScalar(charScale);
      charRoot.castShadow = true;

      charRoot.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      parentGroup.add(charRoot);

      // Set up animation mixer — play the "Walk" clip on loop
      mixer = new THREE.AnimationMixer(charRoot);

      const walkClip = THREE.AnimationClip.findByName(gltf.animations, 'Walk');
      if (walkClip) {
        const action = mixer.clipAction(walkClip);
        action.play();
      } else if (gltf.animations.length > 0) {
        // Fallback: play whatever the first animation is
        mixer.clipAction(gltf.animations[0]).play();
      }

      // Place at bottom step immediately
      if (stepPositions.length > 0) {
        charRoot.position.copy(stepPositions[0]);
        charRoot.position.y += FOOT_OFFSET;
      }

      isReady = true;
      console.log('[characterWalker] realistic_character.glb loaded ✓  scale =', charScale.toFixed(3));
    },
    undefined,
    (err) => console.error('[characterWalker] Failed to load realistic_character.glb:', err)
  );

  // Shared vector pool (avoids GC pressure in RAF)
  function update(delta, scrollProgress = -1) {
    if (!isReady || stepPositions.length < 2) return;

    let u;
    if (scrollProgress >= 0) {
      // Sync strictly to the scroll camera progress
      u = scrollProgress;
      
      // Calculate how far we moved this frame to speed up/slow down animation
      const currentDistance = u * pathLength;
      const speed = Math.abs(currentDistance - distanceTraveled) / (delta || 0.016);
      distanceTraveled = currentDistance;
      
      // Advance animation mixer but scaled by how fast we are scrolling
      // (so if you scroll fast, they walk fast; if you stop, they stop)
      if (mixer) {
        const timeScale = Math.min(speed / WALK_SPEED, 3.0); // cap max speed
        mixer.update(delta * timeScale);
      }
    } else {
      // Advance animation mixer normally
      if (mixer) mixer.update(delta);

      // Advance realistic distance (constant m/s across the entire curved staircase)
      distanceTraveled += WALK_SPEED * delta;
      u = distanceTraveled / pathLength;
    }

    // Clamp at the top
    if (u >= 1.0) {
      u = 1.0;
    }

    // Extract exact smooth point and direction tangent
    const currentPoint = pathCurve.getPointAt(u);
    const tangent = pathCurve.getTangentAt(u);

    // Position character accurately on spline
    currentPoint.y += FOOT_OFFSET;
    charRoot.position.copy(currentPoint);

    // Aim the character horizontally along the smooth invisible curve path
    tangent.y = 0;
    if (tangent.lengthSq() > 0.0001) {
      charRoot.rotation.y = Math.atan2(tangent.x, tangent.z);
    }
  }

  return { update };
}
