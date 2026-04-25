/**
 * cameraPathRecorder.js
 *
 * Developer tool — lets you draw the camera scroll path interactively.
 *
 * ── Controls ────────────────────────────────────────────────────────────────
 *   R          Toggle recording mode on / off
 *   Space      Drop a waypoint at the current camera position
 *   Backspace  Undo the last waypoint
 *   Enter      Apply the recorded path → scroll now follows it
 *   C          Copy waypoints as JS code to clipboard
 * ────────────────────────────────────────────────────────────────────────────
 */

import * as THREE from 'three';
import { setWaypoints, setPaused } from './cameraPathController.js';

// ── Internal state ────────────────────────────────────────────────────────────
let _scene    = null;
let _camera   = null;
let _controls = null;
let _recording = false;

const _recordedPoints = [];   // THREE.Vector3 array
const _sphereMeshes   = [];   // visual dots placed at each waypoint
let   _pathLine       = null; // CatmullRom preview line

// ── DOM refs ──────────────────────────────────────────────────────────────────
let _panel    = null;
let _statusEl = null;
let _countEl  = null;
let _outputEl = null;

// ── Public API ────────────────────────────────────────────────────────────────

export function initPathRecorder(scene, camera, controls) {
  _scene    = scene;
  _camera   = camera;
  _controls = controls;

  _injectStyles();
  _createPanel();
  _bindKeys();

  console.log('[pathRecorder] ✓ Ready — press R to start recording');
}

// ── UI creation ───────────────────────────────────────────────────────────────

function _createPanel() {
  _panel = document.createElement('div');
  _panel.id = 'pr-panel';
  _panel.innerHTML = `
    <div class="pr-header">
      <span class="pr-led" id="pr-led"></span>
      <span class="pr-title">PATH RECORDER</span>
    </div>
    <div class="pr-body">
      <div id="pr-status" class="pr-status pr-off">● IDLE — press R to start</div>

      <div id="pr-count" class="pr-count">0 waypoints</div>

      <div class="pr-kbd-grid">
        <span><kbd>R</kbd> Toggle record</span>
        <span><kbd>Space</kbd> Add point</span>
        <span><kbd>⌫</kbd> Undo last</span>
        <span><kbd>↵</kbd> Apply path</span>
        <span><kbd>C</kbd> Copy code</span>
      </div>

      <div class="pr-actions">
        <button id="pr-btn-apply"  onclick="window.__pr_apply()">▶ Apply Path</button>
        <button id="pr-btn-copy"   onclick="window.__pr_copy()">⎘ Copy Code</button>
        <button id="pr-btn-clear"  onclick="window.__pr_clear()">✕ Clear</button>
      </div>

      <pre id="pr-output" class="pr-output"></pre>
    </div>
  `;
  document.body.appendChild(_panel);

  _statusEl = document.getElementById('pr-status');
  _countEl  = document.getElementById('pr-count');
  _outputEl = document.getElementById('pr-output');

  // Expose button handlers to global scope
  window.__pr_apply = _applyPath;
  window.__pr_copy  = _copyToClipboard;
  window.__pr_clear = _clearAll;
}

function _injectStyles() {
  const s = document.createElement('style');
  s.textContent = `
    /* ── Panel ─────────────────────────────────────── */
    #pr-panel {
      position: fixed;
      top: 20px; right: 20px;
      width: 270px;
      background: rgba(6, 6, 14, 0.93);
      border: 1px solid rgba(200, 255, 0, 0.25);
      border-radius: 14px;
      font-family: 'Space Grotesk', 'Inter', sans-serif;
      font-size: 12px;
      color: #d8d8d8;
      z-index: 9990;
      backdrop-filter: blur(16px);
      box-shadow: 0 0 40px rgba(200,255,0,0.07), 0 8px 50px rgba(0,0,0,0.7);
      overflow: hidden;
      transition: border-color 0.3s, box-shadow 0.3s;
      user-select: none;
    }
    #pr-panel.is-recording {
      border-color: rgba(255, 55, 55, 0.7);
      box-shadow: 0 0 40px rgba(255,55,55,0.18), 0 8px 50px rgba(0,0,0,0.7);
    }

    /* ── Header ─────────────────────────────────────── */
    .pr-header {
      display: flex; align-items: center; gap: 9px;
      padding: 11px 15px;
      background: rgba(200,255,0,0.06);
      border-bottom: 1px solid rgba(200,255,0,0.12);
    }
    .pr-led {
      width: 8px; height: 8px; border-radius: 50%;
      background: #c8ff00;
      box-shadow: 0 0 6px #c8ff00;
      transition: background 0.3s, box-shadow 0.3s;
    }
    #pr-panel.is-recording .pr-led {
      background: #ff3333;
      box-shadow: 0 0 8px #ff3333;
      animation: pr-pulse 1s ease-in-out infinite;
    }
    @keyframes pr-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

    .pr-title {
      font-weight: 700; letter-spacing: 0.18em;
      font-size: 11px; color: #c8ff00;
    }

    /* ── Body ───────────────────────────────────────── */
    .pr-body {
      padding: 13px 15px;
      display: flex; flex-direction: column; gap: 11px;
    }

    /* Status badge */
    .pr-status {
      padding: 5px 9px; border-radius: 7px;
      font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
    }
    .pr-off { background: rgba(255,255,255,0.05); color: #777; }
    .pr-on  {
      background: rgba(255,55,55,0.18); color: #ff5555;
      animation: pr-blink 1.4s ease-in-out infinite;
    }
    .pr-done { background: rgba(0,255,140,0.12); color: #00ff8c; }
    @keyframes pr-blink { 0%,100%{opacity:1} 50%{opacity:0.65} }

    /* Big counter */
    .pr-count {
      text-align: center;
      font-size: 26px; font-weight: 700; color: #c8ff00;
      letter-spacing: -0.02em;
    }

    /* Keyboard grid */
    .pr-kbd-grid {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 5px 8px;
      background: rgba(255,255,255,0.03);
      border-radius: 9px; padding: 9px 10px;
      color: #999; line-height: 1.6;
    }
    .pr-kbd-grid kbd {
      background: rgba(200,255,0,0.13);
      border: 1px solid rgba(200,255,0,0.28);
      border-radius: 4px; padding: 1px 5px;
      color: #c8ff00; font-size: 10px; font-family: monospace;
    }

    /* Buttons */
    .pr-actions { display: flex; gap: 6px; }
    .pr-actions button {
      flex: 1; padding: 7px 4px; border-radius: 7px;
      border: 1px solid rgba(200,255,0,0.25);
      background: rgba(200,255,0,0.07); color: #c8ff00;
      font-size: 10px; font-weight: 700; cursor: pointer;
      letter-spacing: 0.04em; transition: all 0.2s;
    }
    .pr-actions button:hover {
      background: rgba(200,255,0,0.2); border-color: #c8ff00;
    }
    #pr-btn-clear {
      border-color: rgba(255,55,55,0.25); color: #ff6666;
      background: rgba(255,55,55,0.06);
    }
    #pr-btn-clear:hover {
      background: rgba(255,55,55,0.2); border-color: #ff4444;
    }

    /* Code output */
    .pr-output {
      display: none;
      background: rgba(0,0,0,0.5); border-radius: 7px;
      padding: 8px 10px; font-size: 9px; font-family: monospace;
      color: #4dff88; max-height: 90px; overflow-y: auto;
      border: 1px solid rgba(77,255,136,0.2); white-space: pre;
    }
  `;
  document.head.appendChild(s);
}

// ── Keyboard bindings ─────────────────────────────────────────────────────────

function _bindKeys() {
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.key) {
      case 'r':
      case 'R':
        _toggleRecording(); break;

      case ' ':
        if (_recording) { e.preventDefault(); _addWaypoint(); }
        break;

      case 'Backspace':
        if (_recording) { e.preventDefault(); _undoWaypoint(); }
        break;

      case 'Enter':
        if (_recording || _recordedPoints.length >= 2) {
          e.preventDefault(); _applyPath();
        }
        break;

      case 'c':
      case 'C':
        if (_recordedPoints.length > 0) _copyToClipboard();
        break;
    }
  });
}

// ── Core actions ──────────────────────────────────────────────────────────────

function _toggleRecording() {
  _recording = !_recording;

  if (_recording) {
    // Re-enable orbit so user can freely position the camera
    setPaused(true);
    if (_controls) _controls.enabled = true;

    _panel.classList.add('is-recording');
    _statusEl.className  = 'pr-status pr-on';
    _statusEl.textContent = '● REC — orbit then press Space';
    console.log('[pathRecorder] ─── RECORDING STARTED ───  orbit to position, Space to drop waypoints');
  } else {
    setPaused(false);
    if (_controls) _controls.enabled = false;
    _panel.classList.remove('is-recording');
    _statusEl.className  = 'pr-status pr-off';
    _statusEl.textContent = `● PAUSED — ${_recordedPoints.length} pts`;
  }
}

function _addWaypoint() {
  const pt = _camera.position.clone();
  _recordedPoints.push(pt);

  // ── Visual dot ──────────────────────────────────────────────────────
  const isFirst = _recordedPoints.length === 1;
  const sphere  = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 12, 12),
    new THREE.MeshBasicMaterial({
      color      : isFirst ? 0x00ff88 : 0xffdd00,
      transparent: true,
      opacity    : 0.9,
      depthTest  : false,   // always visible through geometry
    })
  );
  sphere.position.copy(pt);
  sphere.renderOrder = 999;
  _scene.add(sphere);
  _sphereMeshes.push(sphere);

  // ── Rebuild preview spline line ──────────────────────────────────────
  _rebuildLine();

  // ── Update UI ───────────────────────────────────────────────────────
  const n = _recordedPoints.length;
  _countEl.textContent = `${n} waypoint${n !== 1 ? 's' : ''}`;
  _statusEl.textContent = `● REC — ✓ pt ${n} added • Space for next`;

  console.log(`[pathRecorder] WP${n}: new THREE.Vector3(${pt.x.toFixed(3)}, ${pt.y.toFixed(3)}, ${pt.z.toFixed(3)}),`);
}

function _undoWaypoint() {
  if (_recordedPoints.length === 0) return;
  _recordedPoints.pop();

  const last = _sphereMeshes.pop();
  if (last) _scene.remove(last);

  _rebuildLine();

  const n = _recordedPoints.length;
  _countEl.textContent  = `${n} waypoint${n !== 1 ? 's' : ''}`;
  _statusEl.textContent = `● REC — undone, ${n} pts`;
}

function _applyPath() {
  if (_recordedPoints.length < 2) {
    _statusEl.className  = 'pr-status pr-off';
    _statusEl.textContent = '⚠ Need ≥2 waypoints first';
    return;
  }

  // Stop recording, disable orbit
  _recording = false;
  setPaused(false);
  if (_controls) _controls.enabled = false;
  _panel.classList.remove('is-recording');

  // Hot-swap the live spline used by cameraPathController
  setWaypoints([..._recordedPoints]);

  _statusEl.className  = 'pr-status pr-done';
  _statusEl.textContent = `✓ Applied — scroll to preview`;
  _countEl.textContent  = `${_recordedPoints.length} waypoints`;

  // Show code in the output box
  const code = _pointsAsCode();
  _outputEl.textContent = code;
  _outputEl.style.display = 'block';

  console.log('[pathRecorder] ─── PATH APPLIED ─── Paste these into WAYPOINTS in cameraPathController.js:');
  console.log(code);
}

function _copyToClipboard() {
  const code = _pointsAsCode();
  navigator.clipboard.writeText(code).then(() => {
    const prev = _countEl.textContent;
    _countEl.textContent = '✓ Copied!';
    setTimeout(() => { _countEl.textContent = prev; }, 1600);
  }).catch(() => {
    // Fallback: log to console
    console.log('[pathRecorder] Copy failed — here are the points:');
    console.log(code);
  });
}

function _clearAll() {
  _recordedPoints.length = 0;
  _sphereMeshes.forEach(s => _scene.remove(s));
  _sphereMeshes.length = 0;
  if (_pathLine) { _scene.remove(_pathLine); _pathLine = null; }

  _recording = false;
  setPaused(false);
  _panel.classList.remove('is-recording');
  if (_controls) _controls.enabled = false;

  _statusEl.className   = 'pr-status pr-off';
  _statusEl.textContent = '● IDLE — press R to start';
  _countEl.textContent  = '0 waypoints';
  _outputEl.style.display = 'none';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _rebuildLine() {
  if (_pathLine) { _scene.remove(_pathLine); _pathLine = null; }
  if (_recordedPoints.length < 2) return;

  const curve  = new THREE.CatmullRomCurve3(_recordedPoints, false, 'catmullrom', 0.5);
  const pts    = curve.getPoints(300);
  const geo    = new THREE.BufferGeometry().setFromPoints(pts);
  const mat    = new THREE.LineBasicMaterial({
    color     : 0xff2255,
    transparent: true,
    opacity   : 0.9,
    depthTest : false,
  });
  _pathLine = new THREE.Line(geo, mat);
  _pathLine.renderOrder = 998;
  _scene.add(_pathLine);
}

function _pointsAsCode() {
  return _recordedPoints
    .map(p => `  new THREE.Vector3(${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)}),`)
    .join('\n');
}
