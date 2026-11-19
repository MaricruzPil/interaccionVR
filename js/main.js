import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { OculusHandModel } from 'three/addons/webxr/OculusHandModel.js';
import { OculusHandPointerModel } from 'three/addons/webxr/OculusHandPointerModel.js';
import { APP_CONFIG } from './config.js';
import { createPhysicsWorld, stepWorld } from './physics.js';
import { createLabScene } from './scene.js';
import { ClassificationGame } from './game.js';
import { InteractionInput } from './input.js';
import { AudioFeedback } from './audio.js';

const dom = {
  canvasShell: document.querySelector('#canvas-shell'),
  vrEntry: document.querySelector('#vr-entry'),
  xrSupport: document.querySelector('#xr-support'),
  sessionStatus: document.querySelector('#session-status'),
  liveMessage: document.querySelector('#live-message'),
  previewStatus: document.querySelector('#preview-status'),
  previewStart: document.querySelector('#preview-start'),
  previewReset: document.querySelector('#preview-reset'),
  openPreview: document.querySelector('#open-preview'),
  metricCorrect: document.querySelector('#metric-correct'),
  metricAttempts: document.querySelector('#metric-attempts'),
  metricErrors: document.querySelector('#metric-errors'),
  metricAccuracy: document.querySelector('#metric-accuracy'),
  metricTime: document.querySelector('#metric-time'),
  finalSummary: document.querySelector('#final-summary'),
};

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(0, 1.48, 3.85);
camera.lookAt(0, 0.86, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.domElement.setAttribute('aria-label', 'Previsualización del laboratorio 3.2');
dom.canvasShell.appendChild(renderer.domElement);

const physics = createPhysicsWorld();
const sceneData = createLabScene({ scene, world: physics.world, materials: physics.materials });
const audio = new AudioFeedback();

function displaySnapshot(snapshot) {
  dom.metricCorrect.textContent = `${snapshot.correct}/20`;
  dom.metricAttempts.textContent = snapshot.attempts;
  dom.metricErrors.textContent = snapshot.errors;
  dom.metricAccuracy.textContent = `${snapshot.accuracy}%`;
  dom.metricTime.textContent = `${snapshot.elapsed}s`;
  dom.previewStatus.textContent = `Estado: ${snapshot.phaseLabel}. ${snapshot.correct}/20 piezas validadas.`;
  if (snapshot.phase === 'finished') {
    dom.finalSummary.hidden = false;
    dom.finalSummary.textContent = `Resultado final: ${snapshot.correct}/20 · ${snapshot.elapsed}s · ${snapshot.accuracy}% de precisión · ${snapshot.errors} errores.`;
  } else {
    dom.finalSummary.hidden = true;
  }
}

function displayMessage({ text, type }) {
  dom.liveMessage.textContent = text;
  dom.liveMessage.dataset.type = type;
}

const game = new ClassificationGame({
  sceneData,
  audio,
  onUpdate: displaySnapshot,
  onMessage: displayMessage,
});

const controllers = [];
const handPointers = [];
const controllerModelFactory = new XRControllerModelFactory();
for (let index = 0; index < 2; index += 1) {
  const controller = renderer.xr.getController(index);
  scene.add(controller);
  const grip = renderer.xr.getControllerGrip(index);
  grip.add(controllerModelFactory.createControllerModel(grip));
  scene.add(grip);

  const hand = renderer.xr.getHand(index);
  hand.add(new OculusHandModel(hand));
  const pointer = new OculusHandPointerModel(hand, controller);
  hand.add(pointer);
  scene.add(hand);
  controllers.push(controller);
  handPointers.push(pointer);
}

const input = new InteractionInput({
  camera,
  renderer,
  sceneData,
  game,
  handPointers,
});

const sessionInit = {
  requiredFeatures: ['local-floor'],
  optionalFeatures: ['hand-tracking'],
};
const vrButton = VRButton.createButton(renderer, sessionInit);
vrButton.classList.add('vr-entry-button');
dom.vrEntry.appendChild(vrButton);

function updateVrButtonLabel() {
  const text = vrButton.textContent.trim();
  if (text.includes('ENTER VR')) vrButton.textContent = 'Entrar en VR';
  if (text.includes('EXIT VR')) vrButton.textContent = 'Salir de VR';
  if (text.includes('VR NOT SUPPORTED')) vrButton.textContent = 'VR no compatible';
  if (text.includes('VR NEEDS HTTPS')) vrButton.textContent = 'VR necesita HTTPS';
}
updateVrButtonLabel();
new MutationObserver(updateVrButtonLabel).observe(vrButton, {
  childList: true,
  subtree: true,
  characterData: true,
});

renderer.xr.addEventListener('sessionstart', () => {
  const session = renderer.xr.getSession();
  const enabledFeatures = session?.enabledFeatures ?? [];
  const handFeatureRequested = enabledFeatures.includes('hand-tracking');
  dom.sessionStatus.textContent = handFeatureRequested
    ? 'Sesión VR activa. Seguimiento de manos solicitado; confirma que ambas manos aparezcan en el visor.'
    : 'Sesión VR activa. El visor no confirmó hand-tracking en esta sesión.';
  if (game.phase === 'paused') game.resume();
});

renderer.xr.addEventListener('sessionend', () => {
  input.releaseAll();
  game.pause('Sesión VR finalizada. El cronómetro se pausó para no falsear el resultado.');
  dom.sessionStatus.textContent = 'Sesión VR cerrada. Puedes reanudar o reiniciar desde la vista previa.';
});

async function checkImmersiveVrSupport() {
  if (!navigator.xr) {
    dom.xrSupport.textContent = 'WebXR no está disponible en este navegador. La vista previa de escritorio sí funciona.';
    return;
  }
  try {
    const supported = await navigator.xr.isSessionSupported('immersive-vr');
    dom.xrSupport.textContent = supported
      ? 'Immersive VR está disponible. Hand Tracking se solicitará al entrar en el visor.'
      : 'Este navegador no confirma Immersive VR. Usa un visor compatible y HTTPS para la prueba real.';
  } catch (error) {
    dom.xrSupport.textContent = 'No se pudo consultar WebXR en tiempo de ejecución; la vista previa permanece disponible.';
    console.warn('WebXR support check failed', error);
  }
}
checkImmersiveVrSupport();

dom.previewStart.addEventListener('click', () => {
  audio.ensureContext();
  game.start();
});
dom.previewReset.addEventListener('click', () => game.reset());
dom.openPreview.addEventListener('click', () => {
  dom.canvasShell.closest('section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && !renderer.xr.isPresenting) {
    game.pause('La pestaña quedó oculta; el cronómetro se pausó.');
  }
});

function resize() {
  if (renderer.xr.isPresenting) return;
  const width = Math.max(320, dom.canvasShell.clientWidth);
  const height = Math.max(360, dom.canvasShell.clientHeight || 560);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

let previousTime = performance.now();
let accumulator = 0;

function animate(time) {
  const frameDelta = Math.min((time - previousTime) / 1000, APP_CONFIG.physics.maxFrameDelta);
  previousTime = time;
  input.update();
  game.beforePhysics(frameDelta);
  const result = stepWorld(physics.world, accumulator, frameDelta);
  accumulator = result.accumulator;
  game.afterPhysics(result.steps * APP_CONFIG.physics.fixedStep);
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
