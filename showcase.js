import * as THREE from './assets/vendor/three.module.min.js';
import { GLTFLoader } from './assets/vendor/GLTFLoader.js';

const MODEL_ASSETS = [
  { label: 'Corner table', src: './assets/models/corner_table_v1.glb?v=2', frontOffset: Math.PI - Math.PI / 6 },
  { label: 'Desk phone', src: './assets/models/phone.glb?v=3', frontOffset: Math.PI },
  { label: 'Workspace station', src: './assets/models/Workspace.glb' },
  { label: 'Mug', src: './assets/models/Mug.glb', displayScale: 0.55 },
  { label: 'Key card reader', src: './assets/models/KeyCardReader.glb' },
  { label: 'Wall lever', src: './assets/models/WallLever.glb' },
  { label: 'Fuse', src: './assets/models/Fuse.glb' },
  { label: 'Recharger', src: './assets/models/Recharger.glb' },
  { label: 'Bathroom stalls', src: './assets/models/bathroom_stalls.glb' },
  { label: 'PC workstation', src: './assets/models/time-heist-pc.glb' },
  { label: 'Office desk', src: './assets/models/deskv3.glb' },
  { label: 'Monitor', src: './assets/models/monitor.glb', frontOffset: Math.PI },
  { label: 'Locker', src: './assets/models/Locker.glb' },
  { label: 'Whiteboard', src: './assets/models/Whiteboard.glb' },
  { label: 'Television', src: './assets/models/tv.glb' },
  { label: 'Restroom fixture', src: './assets/models/toilet.glb' },
];

const REVEAL_DURATION = 1000;
const MODEL_INTERVAL = 3800;
const EXIT_DURATION = 280;
const viewport = document.querySelector('.viewport-showcase');
const canvas = document.querySelector('.viewport-canvas');
const status = document.querySelector('.model-status');
const activeModelLabel = document.querySelector('[data-active-model]');
const activeModelCount = document.querySelector('[data-active-model-count]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const loader = new GLTFLoader();
const modelPromises = new Map();
const availableModels = [];
const compositionOffset = new THREE.Vector3();
const revealLightOffset = new THREE.Vector3(0, 1.1, 1.4);

if (viewport) viewport.dataset.viewer = 'loaded';

let renderer;
let scene;
let camera;
let modelRoot;
let revealLight;
let activeIndex = -1;
let compositionScale = 1;
let revealStartedAt = 0;
let nextSwapAt = Infinity;
let frontRotation = 0;
let started = false;
let cycleReady = false;
let swapPending = false;
let frameId;
let previousFrameTime;
let resizeObserver;

function updateComposition() {
  if (!camera || !viewport) return;
  camera.updateMatrixWorld();
  const cameraRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const compact = viewport.clientWidth <= 780;
  compositionScale = compact ? 0.82 : 1;
  compositionOffset.copy(cameraRight).multiplyScalar(compact ? 0 : -0.62);
  compositionOffset.y += compact ? 0.52 : 0.03;
}

function resize() {
  if (!renderer || !camera || !viewport) return;
  const width = Math.max(1, viewport.clientWidth);
  const height = Math.max(1, viewport.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.fov = width <= 780 ? 39 : 35;
  camera.updateProjectionMatrix();
  updateComposition();
}

function prepareModel(gltf, index) {
  const content = gltf.scene;
  content.traverse((child) => {
    if (!child.isMesh) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (!material?.color) return;
      const hsl = {};
      material.color.getHSL(hsl);
      material.color.setHSL(hsl.h, hsl.s, Math.min(1, hsl.l + 0.02));
      material.needsUpdate = true;
    });
  });

  const bounds = new THREE.Box3().setFromObject(content);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z) || 1;
  content.position.sub(center);

  const normalized = new THREE.Group();
  normalized.scale.setScalar(1 / maxDimension);
  normalized.add(content);

  const animated = new THREE.Group();
  animated.add(normalized);
  animated.visible = false;
  animated.userData.assetIndex = index;
  if (gltf.animations.length) {
    animated.userData.mixer = new THREE.AnimationMixer(content);
    animated.userData.actions = gltf.animations.map((clip) => (
      animated.userData.mixer.clipAction(clip)
    ));
    animated.userData.animationNames = gltf.animations.map((clip) => clip.name || 'Untitled clip');
  }
  scene.add(animated);
  return animated;
}

function loadModel(index) {
  if (modelPromises.has(index)) return modelPromises.get(index);
  const pending = loader.loadAsync(MODEL_ASSETS[index].src)
    .then((gltf) => prepareModel(gltf, index));
  modelPromises.set(index, pending);
  return pending;
}

function updateAssetReadout(index) {
  if (activeModelLabel) activeModelLabel.textContent = MODEL_ASSETS[index].label;
  if (activeModelCount) {
    activeModelCount.textContent = `${String(index + 1).padStart(2, '0')} / ${String(MODEL_ASSETS.length).padStart(2, '0')}`;
  }
}

async function showModel(index) {
  const nextModel = await loadModel(index);
  if (modelRoot) {
    modelRoot.visible = false;
    modelRoot.userData.actions?.forEach((action) => {
      action.paused = true;
    });
  }
  modelRoot = nextModel;
  modelRoot.visible = true;
  modelRoot.userData.actions?.forEach((action) => {
    action.reset().play();
    action.paused = reducedMotion.matches;
  });
  activeIndex = index;
  revealStartedAt = performance.now();
  nextSwapAt = revealStartedAt + MODEL_INTERVAL;
  if (viewport) {
    viewport.dataset.activeAnimationClips = String(modelRoot.userData.actions?.length || 0);
    viewport.dataset.activeAnimationNames = modelRoot.userData.animationNames?.join(', ') || '';
  }
  updateAssetReadout(index);
}

function queueNextModel() {
  if (swapPending || !cycleReady || availableModels.length < 2) return;
  swapPending = true;
  const currentPosition = availableModels.indexOf(activeIndex);
  const nextPosition = (currentPosition + 1) % availableModels.length;
  showModel(availableModels[nextPosition]).finally(() => {
    swapPending = false;
  });
}

async function preloadRemainingModels() {
  const results = await Promise.allSettled(
    MODEL_ASSETS.slice(1).map((_, offset) => loadModel(offset + 1)),
  );
  results.forEach((result, offset) => {
    if (result.status === 'fulfilled') availableModels.push(offset + 1);
  });
  cycleReady = availableModels.length > 1;
}

function render(time = 0) {
  if (!renderer || !scene || !camera) return;
  const frameDelta = previousFrameTime === undefined
    ? 0
    : Math.min((time - previousFrameTime) / 1000, 0.1);
  previousFrameTime = time;
  if (modelRoot) {
    const revealProgress = Math.min(1, Math.max(0, (time - revealStartedAt) / REVEAL_DURATION));
    const revealEase = 1 - Math.pow(1 - revealProgress, 3);
    const exitProgress = Math.min(1, Math.max(0, (time - (nextSwapAt - EXIT_DURATION)) / EXIT_DURATION));
    const revealScale = reducedMotion.matches ? 1 : (0.66 + revealEase * 0.34) * (1 - exitProgress * 0.13);
    const assetScale = MODEL_ASSETS[activeIndex]?.displayScale || 1;
    const motionScale = revealScale * compositionScale * assetScale;
    const bob = reducedMotion.matches ? 0 : Math.sin(time * 0.0015) * 0.055;
    const revealRise = reducedMotion.matches ? 0 : (1 - revealEase) * -0.22;

    modelRoot.scale.setScalar(motionScale);
    modelRoot.position.copy(compositionOffset);
    modelRoot.position.y += bob + revealRise;
    const rotationElapsed = reducedMotion.matches ? 0 : Math.max(0, time - revealStartedAt);
    const assetFrontOffset = MODEL_ASSETS[activeIndex]?.frontOffset || 0;
    modelRoot.rotation.y = frontRotation + assetFrontOffset + rotationElapsed * 0.00028;
    if (!reducedMotion.matches) modelRoot.userData.mixer?.update(frameDelta);

    if (revealLight) {
      revealLight.position.copy(compositionOffset).add(revealLightOffset);
      revealLight.intensity = reducedMotion.matches ? 0 : (1 - revealEase) * 8.5;
    }

    if (time >= nextSwapAt) queueNextModel();
  }
  renderer.render(scene, camera);
  frameId = requestAnimationFrame(render);
}

async function startShowcase() {
  if (started) {
    if (!frameId) render();
    return;
  }
  if (!viewport || !canvas) return;
  started = true;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x25282d);
  camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  camera.position.copy(new THREE.Vector3(0.9, 0.45, 1.5).normalize().multiplyScalar(3.25));
  camera.lookAt(0, 0, 0);
  frontRotation = Math.atan2(camera.position.x, camera.position.z);

  scene.add(new THREE.HemisphereLight(0xdce8ff, 0x30343a, 2.8));
  const key = new THREE.DirectionalLight(0xffffff, 4.2);
  key.position.set(4, 6, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8db7ff, 2.8);
  rim.position.set(-5, 3, -4);
  scene.add(rim);
  revealLight = new THREE.PointLight(0xff9b45, 0, 7, 2);
  scene.add(revealLight);

  const grid = new THREE.GridHelper(9, 36, 0x59616b, 0x353b43);
  grid.position.y = -0.64;
  scene.add(grid);

  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(viewport);
  resize();
  render();

  try {
    await showModel(0);
    availableModels.push(0);
    viewport.classList.add('is-ready');
    preloadRemainingModels();
  } catch (error) {
    viewport.classList.add('is-error');
    if (status) status.textContent = 'Could not load the models';
    console.error(error);
  }
}

window.addEventListener('portfolio:project-open', (event) => {
  if (event.detail?.project !== 'time-heist') return;
  startShowcase().catch((error) => {
    viewport?.classList.add('is-error');
    if (status) status.textContent = 'Could not start the 3D viewer';
    console.error(error);
  });
});

window.addEventListener('portfolio:project-close', (event) => {
  if (event.detail?.project !== 'time-heist') return;
  cancelAnimationFrame(frameId);
  frameId = undefined;
  previousFrameTime = undefined;
});

if (document.querySelector('.startup-stage')?.classList.contains('project-time-heist')) {
  startShowcase();
}

document.addEventListener('visibilitychange', () => {
  if (!started) return;
  if (document.hidden) {
    cancelAnimationFrame(frameId);
    frameId = undefined;
    previousFrameTime = undefined;
  } else if (!frameId) {
    render();
  }
});

window.addEventListener('pagehide', () => {
  cancelAnimationFrame(frameId);
  resizeObserver?.disconnect();
  modelPromises.forEach((promise) => {
    promise.then((root) => {
      root.traverse((child) => {
        child.geometry?.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => material?.dispose());
      });
    }).catch(() => {});
  });
  renderer?.dispose();
});
