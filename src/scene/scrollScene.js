/**
 * scrollScene.js
 * Drives all GSAP ScrollTrigger scroll-linked animations:
 *  - Camera follows a CatmullRom spline above the staircase (p 0→0.5)
 *  - Scene visibility swap at p = 0.5 (staircase → landscape)
 *  - Camera flies through landscape (p 0.5→1.0)
 *  - Skill badge reveal during the climb
 *  - Character walk cycle scrubbed via AnimationMixer.setTime()
 */
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Skill badge element IDs and when they appear (0–1 of climb progress)
const SKILL_IDS      = ['skill-html', 'skill-php', 'skill-cpp', 'skill-java'];
const SKILL_TRIGGERS = [0.22, 0.42, 0.62, 0.82];

export function initScrollScene({
  camera, scene, solarGroup, staircaseGroup, landscapeGroup, character, stepPositions, topPosition
}) {
  // ── Camera spline ──────────────────────────────────────────
  // Build control points orbiting the staircase at a comfortable distance
  const totalSteps = stepPositions.length;
  const splinePoints = [];

  // Camera offset — wide angle view of the staircase from outside
  const offsets = [
    new THREE.Vector3(-15,  8, 24),
    new THREE.Vector3(-21,  9, 18),
    new THREE.Vector3(-12, 11, 21),
    new THREE.Vector3(  9, 11, 24),
    new THREE.Vector3( 18, 12, 15),
    new THREE.Vector3( 15, 13,-15),
    new THREE.Vector3( -9, 14,-21),
    new THREE.Vector3(-18, 15,-12),
    new THREE.Vector3(  0, 18, 20),
  ];

  offsets.forEach((offset, idx) => {
    const stepIdx = Math.floor((idx / (offsets.length - 1)) * (totalSteps - 1));
    const stepPos = stepPositions[Math.min(stepIdx, totalSteps - 1)];
    splinePoints.push(new THREE.Vector3(
      stepPos.x + offset.x,
      stepPos.y + offset.y,
      stepPos.z + offset.z,
    ));
  });

  const cameraCurve = new THREE.CatmullRomCurve3(splinePoints, false, 'catmullrom', 0.5);

  // ── ScrollTrigger ─────────────────────────────────────────
  ScrollTrigger.create({
    trigger: '#scroll-spacer',
    start: 'top top',
    end: '+=6000',
    scrub: 1.2,
    onUpdate(self) {
      const p      = self.progress;
      const pClimb = Math.min(p / 0.5, 1.0);   // 0→1 during first half
      const pLand  = Math.max((p - 0.5) / 0.5, 0.0); // 0→1 during second half

      // ── Visibility Swap at p = 0.5 ─────────────────────────
      if (p < 0.5) {
        if (solarGroup)     solarGroup.visible     = true;
        if (staircaseGroup) staircaseGroup.visible  = true;
        if (landscapeGroup) landscapeGroup.visible  = false;
        scene.fog.color.setHex(0x000000);
        scene.background.setHex(0x000000);
      } else {
        if (solarGroup)     solarGroup.visible     = false;
        if (staircaseGroup) staircaseGroup.visible  = false;
        if (landscapeGroup) landscapeGroup.visible  = true;
        scene.fog.color.setHex(0xffaa55); // Sunrise fog
        scene.background.setHex(0xff8833);
      }

      // ── Character: move along step path ────────────────────
      if (stepPositions.length > 0) {
        const stepIdx = Math.min(
          Math.floor(pClimb * (stepPositions.length - 1)),
          stepPositions.length - 1
        );
        const nextIdx = Math.min(stepIdx + 1, stepPositions.length - 1);
        const stepFrac = (pClimb * (stepPositions.length - 1)) - stepIdx;

        const currentStep = stepPositions[stepIdx];
        const nextStep    = stepPositions[nextIdx];

        if (currentStep) {
          character.position.lerpVectors(currentStep, nextStep || currentStep, stepFrac);

          // Look towards next step
          if (nextStep && nextStep !== currentStep) {
            const dummy = new THREE.Object3D();
            dummy.position.copy(character.position);
            dummy.lookAt(nextStep);
            character.quaternion.slerp(dummy.quaternion, 0.1);
          }
        }
      }

      // ── GLTF Walk Cycle Scrubbing ───────────────────────────
      const { mixer, duration } = character.userData;
      if (mixer) {
        const loops = 24.0;
        const targetTime = (pClimb * loops * duration) % duration;
        mixer.setTime(targetTime);
      }

      // ── Camera Movement ─────────────────────────────────────
      if (!window.DEBUG_CAMERA) {
        if (p < 0.5) {
          // Orbit the staircase during the climb
          const camPoint = cameraCurve.getPoint(pClimb);
          camera.position.lerp(camPoint, 0.08);
          camera.lookAt(character.position);
        } else {
          // Fly through the landscape
          const startLandPos = new THREE.Vector3(0,  5, -30);
          const endLandPos   = new THREE.Vector3(0, 20, 100);
          const targetPos    = new THREE.Vector3().lerpVectors(startLandPos, endLandPos, pLand);
          camera.position.lerp(targetPos, 0.1);

          const sunPoint = new THREE.Vector3(0, -10, -300);
          const dummy    = new THREE.Object3D();
          dummy.position.copy(camera.position);
          dummy.lookAt(sunPoint);
          camera.quaternion.slerp(dummy.quaternion, 0.08);
        }
      }

      // ── Skill badges (Scene 2 — during climb) ───────────────
      SKILL_IDS.forEach((id, i) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (pClimb >= SKILL_TRIGGERS[i] && p < 0.5) {
          el.classList.add('visible');
        } else {
          el.classList.remove('visible');
        }
      });
    },
  });
}
