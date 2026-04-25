import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { initRenderer, initComposer, handleResize, bloomEffect } from './scene/renderer.js';
import { createSolarSystem, updateSolarSystem } from './scene/solarSystem.js';
import { createStaircaseScene } from './scene/staircaseScene.js';
import { initSkyEnvironment } from './scene/skyEnvironment.js';
import { createGalleryScene } from './scene/galleryScene.js';
import { initCameraPath, updateCameraPath, getScrollProgress, setPaused } from './scene/cameraPathController.js';

// ── Core Three.js objects ──────────────────────────────────────
const canvas = document.getElementById('webgl-canvas');
const scene  = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  5000   // larger far plane so the sky sphere is visible
);
camera.position.set(-20, 8, 30);
camera.lookAt(0, 0, 0);

// ── Renderer + Composer ────────────────────────────────────────
const renderer = initRenderer(canvas);
const composer = initComposer(renderer, scene, camera);

// Set initial size and FOV for responsive mobile support
handleResize(camera);

// ── Orbit Controls (kept as fallback; disabled by cameraPath) ─────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping      = true;
controls.dampingFactor      = 0.08;
controls.rotateSpeed        = 0.4;
controls.enableZoom         = false; // MUST be false so mouse wheel controls the page scroll!
controls.enablePan          = true;
controls.panSpeed           = 0.5;
controls.screenSpacePanning = true;



// ── Scroll-driven Camera Path ──────────────────────────────────
// initCameraPath disables OrbitControls and takes over camera movement.
initCameraPath(camera, controls);

// ── Gallery Scene (Hidden) ─────────────────────────────────────
const { galleryGroup, cameraStartPos, cameraTarget, updateGallery } = createGalleryScene(scene);

// ── Transition Mechanics ───────────────────────────────────────
let isGalleryActive = false;
let isTransitioning = false;

// Once the character reaches the top of the stairs, fade and teleport
function transitionToGallery() {
  if (isTransitioning) return;
  isTransitioning = true;

  const overlay = document.getElementById('transition-overlay');
  if (overlay) overlay.classList.add('flash');
  console.log('[transition] Fading to gallery...');
  
  // Wait for the pristine white fade to reach peak opacity (2 seconds)
  setTimeout(() => {
    try {
      // 1. Completely disable the scroll-driven camera
      setPaused(true);

      // 2. Hide the staircase/galaxy entirely so it isn't rendered
      if (typeof sceneGroup !== 'undefined') {
        sceneGroup.visible = false;
      }
      
      // 3. Show the gallery room
      galleryGroup.visible = true;
      scene.fog = null;
      
      // Dial down the global bloom so the bright daylight isn't completely blinding!
      if (bloomEffect) {
        bloomEffect.intensity = 0.2;
      }
      
      // Teleport camera far away (y = -10000) inside the gallery room
      camera.position.copy(cameraStartPos);
      camera.position.add(galleryGroup.position);
      
      const targetGlobal = cameraTarget.clone().add(galleryGroup.position);
      controls.target.copy(targetGlobal);

      controls.update();
      
      console.log('[transition] Teleport to gallery successful.');
      isGalleryActive = true;
      // Show the project cards sidebar
      if (galleryOverlay) galleryOverlay.classList.add('active');
    } catch(e) {
      console.error('[transition] Error during teleport to gallery:', e);
    }

    // Fade back in to the new room (ALWAYS fire this so the screen doesn't stay white)
    setTimeout(() => {
      if (overlay) overlay.classList.remove('flash');
      isTransitioning = false;
    }, 300);
  }, 2000);
}

// Fade and teleport back to the space scene when scrolling backwards
function transitionToSpace() {
  if (isTransitioning) return;
  isTransitioning = true;

  const overlay = document.getElementById('transition-overlay');
  if (overlay) overlay.classList.add('flash');
  console.log('[transition] Fading back to space...');

  setTimeout(() => {
    try {
      // 1. Hide the gallery room
      galleryGroup.visible = false;
      
      // 2. Show the staircase/galaxy entirely again
      if (typeof sceneGroup !== 'undefined') {
        sceneGroup.visible = true;
      }
      
      // Restore global bloom
      if (typeof bloomEffect !== 'undefined') {
        // Space scene uses the intense original bloom
        bloomEffect.intensity = 2.8;
      }
      
      // 3. Reactivate scroll-driven camera
      setPaused(false);
      
      console.log('[transition] Teleport back to space successful.');
      isGalleryActive = false;
      // Hide the project cards sidebar
      if (galleryOverlay) galleryOverlay.classList.remove('active');
    } catch(e) {
      console.error('[transition] Error returning to space:', e);
    }

    setTimeout(() => {
      if (overlay) overlay.classList.remove('flash');
      isTransitioning = false;
    }, 300);
  }, 2000);
}

// ── Solar System ───────────────────────────────────────────────
const solarData = createSolarSystem(scene);
const planets   = solarData.planets;

// ── Custom Staircase + God Rays + Sun refs ─────────────────────
const { updateGodRays, sunLight, sunMesh, sceneGroup } = createStaircaseScene(scene, null /* no callback needed anymore */);

// ── Sky Environment (procedural sky + stars + animated sun) ────
const { updateSky } = initSkyEnvironment(scene, sunLight, sunMesh);

// ── Scroll HTML Overlays ───────────────────────────────────────
const heroOverlay    = document.getElementById('hero-overlay');
const aboutOverlay   = document.getElementById('about-overlay');
const skillsOverlay  = document.getElementById('skills-overlay');
const contactOverlay = document.getElementById('contact-overlay');
const galleryOverlay = document.getElementById('gallery-overlay');

// ── 3D Carousel Logic ──────────────────────────────────────────
(function initCarousel() {
  const cards   = Array.from(document.querySelectorAll('#carousel-track .glass-project-card'));
  const dots    = Array.from(document.querySelectorAll('#carousel-dots .carousel-dot'));
  const btnPrev = document.getElementById('carousel-prev');
  const btnNext = document.getElementById('carousel-next');
  const total   = cards.length;
  let   current = 0;

  if (!total) return;

  function mod(n, m) { return ((n % m) + m) % m; }

  function applyPositions() {
    const prevIdx = mod(current - 1, total);
    const nextIdx = mod(current + 1, total);

    cards.forEach((card, i) => {
      card.classList.remove('is-active', 'is-prev', 'is-next');
      if (i === current)  card.classList.add('is-active');
      else if (i === prevIdx) card.classList.add('is-prev');
      else if (i === nextIdx) card.classList.add('is-next');
      // anything else stays hidden (default CSS state)
    });

    dots.forEach((dot, i) => dot.classList.toggle('active', i === current));
  }

  function goNext() { current = mod(current + 1, total); applyPositions(); }
  function goPrev() { current = mod(current - 1, total); applyPositions(); }

  // Attach listeners with useCapture=false for normal bubbling
  if (btnPrev) btnPrev.addEventListener('click', goPrev, false);
  if (btnNext) btnNext.addEventListener('click', goNext, false);

  // Dot navigation
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => { current = i; applyPositions(); }, false);
  });

  // Keyboard arrow support
  document.addEventListener('keydown', (e) => {
    if (!document.getElementById('gallery-overlay')?.classList.contains('active')) return;
    if (e.key === 'ArrowRight') goNext();
    if (e.key === 'ArrowLeft')  goPrev();
  });

  // Set initial state
  applyPositions();
})();


// ── Resize handler ─────────────────────────────────────────────
window.addEventListener('resize', () => handleResize(camera));

// ── Scroll progress bar ────────────────────────────────────────
const _progressBar = document.getElementById('scroll-progress-bar');
window.addEventListener('scroll', () => {
  const t = getScrollProgress();
  if (_progressBar) _progressBar.style.width = `${(t * 100).toFixed(2)}%`;
}, { passive: true });

// ── RAF loop ───────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta   = clock.getDelta();           
  const elapsed = clock.elapsedTime;          

  const t = getScrollProgress();

  updateSolarSystem(planets, elapsed);
  updateGodRays(delta, t);    // character walk + spiral particles + god rays synced to scroll
  updateSky(elapsed);         // animated sun + sky colour + stars
  updateGallery(elapsed);     // hyper-realistic animated water rippling

  // Bidirectional Transition Logic based on scroll
  if (!isTransitioning) {
    if (!isGalleryActive && t >= 0.999) {
      transitionToGallery();
    } else if (isGalleryActive && t < 0.999) {
      transitionToSpace();
    }
  }

  // Handle Scroll Overlays
  if (heroOverlay) {
    if (t < 0.08) heroOverlay.classList.add('visible');
    else heroOverlay.classList.remove('visible');
  }

  if (aboutOverlay) {
    if (t > 0.15 && t < 0.35) aboutOverlay.classList.add('visible');
    else aboutOverlay.classList.remove('visible');
  }

  if (skillsOverlay) {
    if (t > 0.45 && t < 0.70) skillsOverlay.classList.add('visible');
    else skillsOverlay.classList.remove('visible');
  }

  if (contactOverlay) {
    if (t > 0.73 && t < 0.97) contactOverlay.classList.add('visible');
    else contactOverlay.classList.remove('visible');
  }

  // Scroll-driven camera path — moves camera along the spline each frame
  updateCameraPath(delta);

  // Evaluate free-roam camera damping when active
  if (controls && controls.enabled) {
    controls.update();
  }

  composer.render();
}

animate();

// ── Contact Form ───────────────────────────────────────────────
(function initContactForm() {
  const form    = document.getElementById('contact-form');
  const btn     = document.getElementById('cf-submit');
  const success = document.getElementById('cf-success');
  const error   = document.getElementById('cf-error');

  if (!form) return;

  function resetMessages() {
    success.classList.remove('show');
    error.classList.remove('show');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    resetMessages();

    // Basic validation
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    btn.classList.add('loading');
    btn.disabled = true;

    const data = {
      name:    document.getElementById('cf-name').value.trim(),
      email:   document.getElementById('cf-email').value.trim(),
      message: document.getElementById('cf-message').value.trim(),
    };

    try {
      // ── Option A: Google Forms (Silent Background Submission) ──────────
      // Converts our custom form data into Google's required URL-encoded format
      const formParams = new URLSearchParams();
      formParams.append('entry.82022235', data.name);
      formParams.append('entry.1158197903', data.email);
      formParams.append('entry.1464668248', data.message);

      // Using mode: 'no-cors' lets us silently submit to Google Forms from any domain.
      // Note: Google Forms returns an opaque response, so we just assume success if no network error.
      await fetch('https://docs.google.com/forms/d/e/1FAIpQLSdfTEW5bP7iS35rKI8I8WmDU7iv_pTUvJ2IiH3Gz2sb9iMsGQ/formResponse', {
        method: 'POST',
        mode: 'no-cors',
        body: formParams
      });

      // Simulate a brief wait then show success
      await new Promise(r => setTimeout(r, 600));
      success.classList.add('show');
      form.reset();
    } catch (err) {
      console.error('[contact] Submission error:', err);
      error.classList.add('show');
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  });

  // Live-clear messages when user starts typing again
  form.addEventListener('input', resetMessages);
})();

// ── Background Music Logic ─────────────────────────────────────
(function initAudio() {
  const bgMusic = document.getElementById('bg-music');
  const toggleBtn = document.getElementById('audio-toggle');
  const playIcon = document.getElementById('audio-icon-play');
  const pauseIcon = document.getElementById('audio-icon-pause');
  let isPlaying = false;
  let hasManuallyToggled = false; // Track if user explicitly clicked the button

  if (!bgMusic || !toggleBtn) return;

  // Set initial music volume (optional)
  bgMusic.volume = 0.4;

  function updateUIState(playing) {
    isPlaying = playing;
    if (isPlaying) {
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
      toggleBtn.classList.add('playing');
    } else {
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
      toggleBtn.classList.remove('playing');
    }
  }

  function toggleAudio(e) {
    if (e) {
      e.stopPropagation();
      hasManuallyToggled = true; // User took manual control
    }
    
    if (isPlaying) {
      bgMusic.pause();
      updateUIState(false);
    } else {
      bgMusic.play().then(() => {
        updateUIState(true);
      }).catch(err => console.log('Audio play failed:', err));
    }
  }

  toggleBtn.addEventListener('click', toggleAudio);

  // Attempt to autoplay on load
  const attemptAutoplay = () => {
    bgMusic.play().then(() => {
      // Autoplay succeeded!
      updateUIState(true);
    }).catch((error) => {
      // Autoplay was prevented by the browser. 
      console.log('Autoplay blocked by browser. Waiting for first user interaction.', error);
      
      const startAudioOnInteract = () => {
        // Remove the listeners immediately
        document.removeEventListener('pointerdown', startAudioOnInteract);
        document.removeEventListener('keydown', startAudioOnInteract);
        document.removeEventListener('touchstart', startAudioOnInteract);

        // If user already clicked the play/pause button directly, respect their choice
        if (hasManuallyToggled) return;

        bgMusic.play().then(() => {
          updateUIState(true);
        }).catch(err => console.log('Playback failed after interaction:', err));
      };

      // Listen for any interaction to unlock audio
      document.addEventListener('pointerdown', startAudioOnInteract, { once: true });
      document.addEventListener('keydown', startAudioOnInteract, { once: true });
      document.addEventListener('touchstart', startAudioOnInteract, { once: true });
    });
  };

  // Give the browser a tiny moment to load before attempting
  setTimeout(attemptAutoplay, 100);
})();
