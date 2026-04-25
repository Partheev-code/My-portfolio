/**
 * cameraPathController.js
 *
 * Drives the camera along a CatmullRomCurve3 spline as the user scrolls.
 *
 * ──  Design decisions  ──────────────────────────────────────────────────────
 *  • Cinematic lerp (not locked scrub): the camera glides smoothly to target.
 *  • Camera always looks ~4 % ahead on the spline for a natural fly-through feel.
 *  • OrbitControls are disabled while scrollPath is in use.
 *  • Exposes  getScrollProgress()  so other modules can read t ∈ [0,1].
 *  • Exposes  debugDrawPath(scene)  to add a visible line for dev-mode check.
 * ────────────────────────────────────────────────────────────────────────────
 */

import * as THREE from 'three';

// ── World-space camera waypoints ─────────────────────────────────────────────
// Derived from the staircase step positions offset outward so the camera
// orbits the spiral from a cinematic distance.
//
// The staircase sceneGroup sits at  y = -(100 * 1.0) * 0.5 = -50.
// Each customStepPosition already has the yOffset baked in after the Proxy,
// so the step path runs roughly  Y ∈ [-97, -20].
// We sample 14 evenly-spaced steps and push the camera outward + upward.
// ─────────────────────────────────────────────────────────────────────────────

const WAYPOINTS = [
  new THREE.Vector3(5141.286, 4504.532, 930.515),
  new THREE.Vector3(4577.427, 4008.777, 838.347),
  new THREE.Vector3(4177.604, 3658.623, 765.124),
  new THREE.Vector3(3302.422, 2892.165, 604.836),
  new THREE.Vector3(2952.945, 2586.103, 540.829),
  new THREE.Vector3(2643.573, 2315.164, 484.168),
  new THREE.Vector3(2381.606, 2085.741, 436.189),
  new THREE.Vector3(2037.229, 1784.146, 373.117),
  new THREE.Vector3(1647.717, 1443.022, 301.778),
  new THREE.Vector3(1369.438, 1199.313, 250.811),
  new THREE.Vector3(1171.859, 1026.280, 214.625),
  new THREE.Vector3(999.071, 874.957, 182.979),
  new THREE.Vector3(848.385, 742.991, 155.381),
  new THREE.Vector3(726.144, 635.936, 132.993),
  new THREE.Vector3(631.775, 553.290, 115.709),
  new THREE.Vector3(513.020, 449.288, 93.959),
  new THREE.Vector3(435.694, 381.568, 79.797),
  new THREE.Vector3(342.206, 299.694, 62.675),
  new THREE.Vector3(281.260, 246.319, 51.512),
  new THREE.Vector3(247.298, 216.576, 45.292),
  new THREE.Vector3(226.736, 220.843, -99.660),
  new THREE.Vector3(136.664, 217.009, -210.577),
  new THREE.Vector3(-24.885, 210.524, -255.290),
  new THREE.Vector3(-179.135, 207.954, -186.490),
  new THREE.Vector3(-255.723, 208.700, -34.099),
  new THREE.Vector3(-235.494, 200.142, 120.823),
  new THREE.Vector3(-184.811, 158.928, 111.889),
  new THREE.Vector3(-140.560, 161.528, 161.505),
  new THREE.Vector3(-93.387, 116.814, 122.864),
  new THREE.Vector3(-53.371, 111.583, 148.872),
];

// Staircase centre in world space (for look-at blending)
const STAIR_CENTER = new THREE.Vector3(0, -37, 0);

// ── Spline ───────────────────────────────────────────────────────────────────
// `curve` is reassigned by setWaypoints() when the recorder applies a new path
let curve = new THREE.CatmullRomCurve3(WAYPOINTS, false, 'catmullrom', 0.5);

// When paused (recorder is active) updateCameraPath() is a no-op
let _paused = false;

// ── State ────────────────────────────────────────────────────────────────────
let _camera   = null;
let _controls = null;

// Smooth current position / look target (lerp targets)
const _pos      = new THREE.Vector3();   // current lerped camera position
const _lookAt   = new THREE.Vector3();   // current lerped look-at point
const _targetPos  = new THREE.Vector3(); // spline sample destination
const _targetLook = new THREE.Vector3(); // look-ahead spline sample

// t values
let _tRaw     = 0;   // raw scroll t [0,1]
let _tSmooth  = 0;   // lerped t (drives anim without scroll jitter)

// lerp speed — lower = smoother/floatier, higher = snappier
const LERP_SPEED = 2.0;  

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * initCameraPath(camera, controls)
 * Call once after the scene is set up. Starts listening to scroll.
 */
export function initCameraPath(camera, controls) {
  _camera   = camera;
  _controls = controls;

  // Disable free-roam orbit while we drive the camera
  if (_controls) _controls.enabled = false;

  // Seed the smooth state at the camera's current position
  _pos.copy(camera.position);
  _lookAt.copy(STAIR_CENTER);

  // Listen to scroll
  window.addEventListener('scroll', _onScroll, { passive: true });

  // Seed initial t from current scroll (page may have been reloaded mid-scroll)
  _onScroll();

  console.log('[cameraPath] ✓ scroll-driven camera path active');
}

/**
 * updateCameraPath(delta)
 * Call every frame from the RAF loop.
 * delta = seconds since last frame (from THREE.Clock.getDelta())
 */
export function updateCameraPath(delta) {
  if (!_camera) return;

  // Frame-rate independent lerp factor to handle varying screen refresh rates smoothly
  const dt = Math.min(delta, 0.1); // cap delta to prevent huge jumps on lag spikes
  const lf = 1 - Math.exp(-LERP_SPEED * dt);

  // Smoothly interpolate t (ALWAYS run this so getScrollProgress resolves accurately)
  _tSmooth += (_tRaw - _tSmooth) * lf;

  if (_paused) return;

  // Sample spline for position and look-ahead
  const tClamped   = Math.max(0, Math.min(1, _tSmooth));
  const tLookAhead = Math.max(0, Math.min(1, _tSmooth + 0.04));

  curve.getPointAt(tClamped,   _targetPos);
  curve.getPointAt(tLookAhead, _targetLook);

  // Blend look-at target smoothly near the top to avoid abrupt snapping 
  // (starts blending from t=0.85, fully looking at center at t=0.95)
  const blendFactor = Math.max(0, Math.min(1, (tClamped - 0.85) / 0.10));
  _lookAt.copy(_targetLook).lerp(STAIR_CENTER, blendFactor);

  // Assign position directly based on the smooth t (removes double-lerp lag and jitter)
  _pos.copy(_targetPos);

  _camera.position.copy(_pos);
  _camera.lookAt(_lookAt);
}

/**
 * setWaypoints(points)
 * Hot-swap the camera spline at runtime.
 * Called by cameraPathRecorder when the user finishes drawing their path.
 * @param {THREE.Vector3[]} points  — at least 2 points
 */
export function setWaypoints(points) {
  if (!points || points.length < 2) {
    console.warn('[cameraPath] setWaypoints: need ≥ 2 points');
    return;
  }
  curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);

  // Re-seed smooth state so camera doesn't snap to old spline position
  if (_camera) {
    _pos.copy(_camera.position);
    curve.getPointAt(Math.max(0, Math.min(1, _tRaw + 0.04)), _lookAt);
  }

  console.log(`[cameraPath] ✓ new path set — ${points.length} waypoints`);
}

/**
 * setPaused(flag)
 * When true, updateCameraPath() does nothing so OrbitControls can take over.
 * Used by the path recorder while the user is positioning the camera.
 */
export function setPaused(flag) {
  _paused = flag;
}

/**
 * getScrollProgress() → number [0,1]
 * Other modules can read scroll progress without coupling to scrollY.
 * Returns the smoothed cinematic t value, not the raw scroll.
 */
export function getScrollProgress() {
  return _tSmooth;
}

/**
 * debugDrawPath(scene)
 * Adds a glowing magenta line through all spline points.
 * Call once for dev purposes; remove the call in production.
 */
export function debugDrawPath(scene) {
  const points = curve.getPoints(200);
  const geo    = new THREE.BufferGeometry().setFromPoints(points);
  const mat    = new THREE.LineBasicMaterial({
    color      : 0xff00ff,
    linewidth  : 2,
    transparent: true,
    opacity    : 0.8,
  });
  const line = new THREE.Line(geo, mat);
  scene.add(line);

  // Also mark each waypoint with a small sphere
  WAYPOINTS.forEach((wp, i) => {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 8, 8),
      new THREE.MeshBasicMaterial({ color: i === 0 ? 0x00ff00 : 0xff6600 })
    );
    m.position.copy(wp);
    scene.add(m);
  });

  console.log('[cameraPath] debug path drawn ✓ (remove debugDrawPath() call before shipping)');
}

// ── Private ──────────────────────────────────────────────────────────────────
function _onScroll() {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  if (maxScroll <= 0) { _tRaw = 0; return; }
  _tRaw = Math.max(0, Math.min(1, window.scrollY / maxScroll));
}
