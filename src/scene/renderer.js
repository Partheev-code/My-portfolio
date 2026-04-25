/**
 * renderer.js
 * Sets up WebGLRenderer + EffectComposer with selective UnrealBloomPass.
 * Bloom is applied ONLY to objects on Layer 1 (the "bloom layer").
 */
import * as THREE from 'three';
import { EffectComposer, RenderPass, BloomEffect, EffectPass, BlendFunction } from 'postprocessing';

export const BLOOM_LAYER = 1;
const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM_LAYER);

export let bloomEffect;
let renderer, composer, camera, scene;

export function initRenderer(canvasEl) {
  renderer = new THREE.WebGLRenderer({
    canvas: canvasEl,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;   // neutral realistic exposure
  renderer.shadowMap.enabled = true;    // enable shadows so SpotLights cast real shadows
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  return renderer;
}

export function initComposer(rendererRef, sceneRef, cameraRef) {
  renderer = rendererRef;
  scene = sceneRef;
  camera = cameraRef;

  composer = new EffectComposer(renderer);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // Bloom effect — exported so we can adjust it for the daylight scene
  bloomEffect = new BloomEffect({
    blendFunction: BlendFunction.ADD,
    luminanceThreshold: 0.25,
    luminanceSmoothing: 0.1,
    intensity: 2.8,
    radius: 0.6,
    levels: 8,
  });

  const effectPass = new EffectPass(camera, bloomEffect);
  composer.addPass(effectPass);

  return composer;
}

export function handleResize(cameraRef) {
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
  
  cameraRef.aspect = window.innerWidth / window.innerHeight;
  
  // Adjust FOV for portrait/mobile to show more of the scene
  if (window.innerWidth < 768) {
    cameraRef.fov = 75;
  } else {
    cameraRef.fov = 55;
  }
  
  cameraRef.updateProjectionMatrix();
}
