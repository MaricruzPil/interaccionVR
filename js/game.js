import * as THREE from 'three';
import {
  APP_CONFIG,
  COLORS,
  PIECE_STATES,
  SHAPE_DEFINITIONS,
} from './config.js';
import {
  setBodyDynamic,
  setBodyKinematic,
  setBodyStatic,
} from './physics.js';
import {
  setActionButtonLabel,
  setActionButtonVisibility,
  updateVisualTransforms,
} from './scene.js';

const PHASE_LABELS = {
  idle: 'en espera',
  running: 'en curso',
  paused: 'pausada',
  finished: 'finalizada',
};

export class ClassificationGame {
  constructor({ sceneData, audio, onUpdate = () => {}, onMessage = () => {} }) {
    this.sceneData = sceneData;
    this.audio = audio;
    this.onUpdate = onUpdate;
    this.onMessage = onMessage;
    this.phase = 'idle';
    this.startedAt = null;
    this.finishedAt = null;
    this.pauseStartedAt = null;
    this.pausedDuration = 0;
    this.lastHudUpdate = 0;
    this.lastFloorMessageAt = 0;
    this.heldPieces = new Set();
    this.metrics = this.createMetrics();
    setActionButtonVisibility(this.sceneData.startButton, true);
    setActionButtonVisibility(this.sceneData.resetButton, true);
    this.refreshHud(true);
  }

  createMetrics() {
    return {
      correct: 0,
      errors: 0,
      attempts: 0,
      categoryCounts: Object.fromEntries(SHAPE_DEFINITIONS.map((shape) => [shape.id, 0])),
      binTimes: Object.fromEntries(this.sceneData.bins.map((bin) => [bin.id, null])),
    };
  }

  reset() {
    this.releaseAll();
    this.sceneData.resetPieces();
    this.phase = 'idle';
    this.startedAt = null;
    this.finishedAt = null;
    this.pauseStartedAt = null;
    this.pausedDuration = 0;
    this.metrics = this.createMetrics();
    setActionButtonLabel(this.sceneData.startButton, 'COMENZAR', COLORS.mint);
    setActionButtonVisibility(this.sceneData.startButton, true);
    setActionButtonVisibility(this.sceneData.resetButton, true);
    this.message('Escenario reiniciado. Pulsa COMENZAR dentro del laboratorio.', 'info');
    this.refreshHud(true);
  }

  start() {
    if (this.phase === 'running') return;
    if (this.phase === 'paused') {
      this.resume();
      return;
    }

    this.releaseAll();
    this.sceneData.resetPieces();
    this.phase = 'running';
    this.startedAt = performance.now();
    this.finishedAt = null;
    this.pauseStartedAt = null;
    this.pausedDuration = 0;
    this.metrics = this.createMetrics();
    setActionButtonLabel(this.sceneData.startButton, 'EN CURSO', COLORS.mint);
    setActionButtonVisibility(this.sceneData.startButton, false);
    setActionButtonVisibility(this.sceneData.resetButton, true);
    this.message('Partida iniciada. Clasifica las veinte piezas.', 'info');
    this.audio?.start();
    this.refreshHud(true);
  }

  pause(reason = 'La sesión VR terminó; el cronómetro quedó pausado.') {
    if (this.phase !== 'running') return;
    this.phase = 'paused';
    this.pauseStartedAt = performance.now();
    this.releaseAll();
    setActionButtonLabel(this.sceneData.startButton, 'CONTINUAR', COLORS.yellow);
    setActionButtonVisibility(this.sceneData.startButton, true);
    setActionButtonVisibility(this.sceneData.resetButton, true);
    this.message(reason, 'warning');
    this.refreshHud(true);
  }

  resume() {
    if (this.phase !== 'paused') return;
    this.pausedDuration += performance.now() - this.pauseStartedAt;
    this.pauseStartedAt = null;
    this.phase = 'running';
    setActionButtonLabel(this.sceneData.startButton, 'EN CURSO', COLORS.mint);
    setActionButtonVisibility(this.sceneData.startButton, false);
    this.message('Cronómetro reanudado.', 'info');
    this.refreshHud(true);
  }

  finish() {
    if (this.phase === 'finished') return;
    this.phase = 'finished';
    this.finishedAt = performance.now();
    this.releaseAll();
    setActionButtonLabel(this.sceneData.startButton, 'COMPLETADA', COLORS.success);
    setActionButtonVisibility(this.sceneData.startButton, false);
    setActionButtonVisibility(this.sceneData.resetButton, true);
    this.message(
      `Laboratorio completo: 20/20, precisión ${this.getAccuracy()} %, errores ${this.metrics.errors}.`,
      'success',
    );
    this.audio?.finish();
    this.refreshHud(true);
  }

  handleAction(action) {
    if (action === 'reset') this.reset();
    if (action === 'start') this.start();
  }

  beginGrab(piece, pointer) {
    if (this.phase !== 'running' || !piece || piece.state === PIECE_STATES.CLASSIFIED) return false;
    if (piece.heldBy || this.heldPieces.has(piece)) return false;
    if (!pointer?.pointerObject) return false;

    const pointerPosition = new THREE.Vector3();
    pointer.pointerObject.getWorldPosition(pointerPosition);
    piece.grabMode = 'near';
    piece.grabDistance = pointerPosition.distanceTo(piece.body.position);
    piece.grabOffset.set(
      piece.body.position.x - pointerPosition.x,
      piece.body.position.y - pointerPosition.y,
      piece.body.position.z - pointerPosition.z,
    );
    piece.grabQuaternion.set(
      piece.body.quaternion.x,
      piece.body.quaternion.y,
      piece.body.quaternion.z,
      piece.body.quaternion.w,
    );
    piece.heldBy = pointer;
    piece.errorReported = false;
    piece.stabilityTime = 0;
    piece.lastHandVelocity.set(0, 0, 0);
    piece.state = PIECE_STATES.HELD;
    setBodyKinematic(piece.body);
    pointer.setAttached(true);
    this.heldPieces.add(piece);
    this.audio?.grab();
    return true;
  }

  updateHeldPiece(piece, delta) {
    const pointer = piece.heldBy;
    if (!pointer?.pointerObject) {
      this.releaseGrab(piece);
      return;
    }

    const pointerPosition = new THREE.Vector3();
    pointer.pointerObject.getWorldPosition(pointerPosition);
    const target = pointerPosition.add(piece.grabOffset);
    const halfWidth = APP_CONFIG.room.width / 2 - 0.18;
    const halfDepth = APP_CONFIG.room.depth / 2 - 0.18;
    target.x = THREE.MathUtils.clamp(target.x, -halfWidth, halfWidth);
    target.y = THREE.MathUtils.clamp(target.y, piece.clearance + 0.12, 2.25);
    target.z = THREE.MathUtils.clamp(target.z, -halfDepth, halfDepth);

    const safeDelta = Math.max(delta, 1 / 120);
    const currentPosition = new THREE.Vector3(
      piece.body.position.x,
      piece.body.position.y,
      piece.body.position.z,
    );
    const displacement = target.clone().sub(currentPosition);
    const maximumHandMove = APP_CONFIG.interaction.maxHandMove;
    if (displacement.length() > maximumHandMove) {
      target.copy(currentPosition).add(displacement.normalize().multiplyScalar(maximumHandMove));
    }
    const smoothedTarget = currentPosition.clone().lerp(
      target,
      APP_CONFIG.interaction.grabSmoothing,
    );
    const guardedTarget = this.sceneData.clampKinematicTarget?.(
      piece,
      currentPosition,
      smoothedTarget,
    ) ?? smoothedTarget;
    const handVelocity = new THREE.Vector3(
      (guardedTarget.x - piece.body.position.x) / safeDelta,
      (guardedTarget.y - piece.body.position.y) / safeDelta,
      (guardedTarget.z - piece.body.position.z) / safeDelta,
    );
    const velocityLength = handVelocity.length();
    if (velocityLength > APP_CONFIG.interaction.maxGrabVelocity) {
      handVelocity.multiplyScalar(
        APP_CONFIG.interaction.maxGrabVelocity / velocityLength,
      );
    }
    piece.lastHandVelocity.copy(handVelocity);
    piece.body.velocity.setZero();
    piece.body.position.set(guardedTarget.x, guardedTarget.y, guardedTarget.z);
    piece.body.quaternion.set(
      piece.grabQuaternion.x,
      piece.grabQuaternion.y,
      piece.grabQuaternion.z,
      piece.grabQuaternion.w,
    );
    piece.body.aabbNeedsUpdate = true;
  }

  releaseGrab(piece) {
    if (!piece || piece.state !== PIECE_STATES.HELD) return;
    const pointer = piece.heldBy;
    if (pointer) pointer.setAttached(false);
    piece.heldBy = null;
    this.heldPieces.delete(piece);
    piece.grabMode = 'near';
    piece.grabDistance = 0;
    setBodyDynamic(piece.body, piece.shape.mass);

    piece.body.velocity.set(
      piece.lastHandVelocity.x,
      piece.lastHandVelocity.y,
      piece.lastHandVelocity.z,
    );
    const speed = piece.body.velocity.length();
    if (speed > APP_CONFIG.interaction.maxReleaseVelocity) {
      piece.body.velocity.scale(
        APP_CONFIG.interaction.maxReleaseVelocity / speed,
        piece.body.velocity,
      );
    }
    piece.body.angularVelocity.set(0, 0, 0);
    piece.body.wakeUp();
    piece.attempt += 1;
    piece.errorReported = false;
    piece.stabilityTime = 0;
    piece.state = PIECE_STATES.FLIGHT;

    const releasedBin = this.findContainingBin(piece);
    piece.enteredBinId = releasedBin?.id ?? null;
    this.audio?.release();
  }

  releaseAll() {
    [...this.heldPieces].forEach((piece) => this.releaseGrab(piece));
  }

  getHoldingPiece(pointer) {
    return [...this.heldPieces].find((piece) => piece.heldBy === pointer) ?? null;
  }

  beforePhysics(delta) {
    this.sceneData.pieces.forEach((piece) => {
      piece.lastPosition.set(piece.body.position.x, piece.body.position.y, piece.body.position.z);
      if (piece.state === PIECE_STATES.HELD) this.updateHeldPiece(piece, delta);
    });
  }

  afterPhysics(simulatedSeconds) {
    this.sceneData.pieces.forEach((piece) => {
      this.sceneData.resolvePiecePenetration?.(piece);
      this.recoverInvalidPiece(piece);
    });
    updateVisualTransforms(this.sceneData.pieces);
    if (this.phase === 'running') {
      this.sceneData.pieces.forEach((piece) => this.updatePieceState(piece, simulatedSeconds));
    }
    this.refreshHud();
  }

  recoverInvalidPiece(piece) {
    if (piece.state === PIECE_STATES.CLASSIFIED || piece.state === PIECE_STATES.HELD) return;
    const values = [
      piece.body.position.x,
      piece.body.position.y,
      piece.body.position.z,
      piece.body.velocity.x,
      piece.body.velocity.y,
      piece.body.velocity.z,
    ];
    const invalid = values.some((value) => !Number.isFinite(value));
    const outside = Math.abs(piece.body.position.x) > APP_CONFIG.room.width / 2 + 0.4
      || Math.abs(piece.body.position.z) > APP_CONFIG.room.depth / 2 + 0.4
      || piece.body.position.y < -0.45;
    if (!invalid && !outside) return;
    this.sceneData.recoverPiece?.(piece);
    this.message('Una pieza fue recuperada al salir del volumen físico.', 'warning');
  }

  updatePieceState(piece, delta) {
    if (piece.state === PIECE_STATES.HELD || piece.state === PIECE_STATES.CLASSIFIED) return;

    const containingBin = this.findContainingBin(piece);
    if (containingBin && !piece.enteredBinId) {
      piece.enteredBinId = containingBin.id;
    }

    if (containingBin && piece.enteredBinId === containingBin.id) {
      if (piece.errorReported) return;
      if (piece.state !== PIECE_STATES.STABILIZING) {
        piece.state = PIECE_STATES.STABILIZING;
        piece.stabilityTime = 0;
      }

      // La confirmación depende de permanecer dentro del bote, no de que la
      // pieza deje de girar por completo. La física sigue activa mientras tanto.
      piece.stabilityTime += delta;
      const confirmationTime = APP_CONFIG.physics.containmentConfirmSeconds
        ?? APP_CONFIG.physics.stabilitySeconds;
      if (piece.stabilityTime >= confirmationTime) {
        if (containingBin.categoryId === piece.categoryId) {
          this.classify(piece, containingBin);
        } else {
          this.confirmError(piece, containingBin);
        }
      }
      return;
    }

    if (piece.state === PIECE_STATES.STABILIZING || piece.state === PIECE_STATES.ERROR) {
      piece.state = PIECE_STATES.FLIGHT;
      piece.stabilityTime = 0;
    }

    if (
      piece.body.position.y <= piece.clearance + 0.015
      && piece.body.velocity.length() <= 0.24
      && performance.now() - this.lastFloorMessageAt > 1200
    ) {
      piece.state = PIECE_STATES.RECOVERABLE;
      this.lastFloorMessageAt = performance.now();
      this.message('Una pieza está en el piso: todavía es recuperable.', 'warning');
    }
  }

  findContainingBin(piece) {
    return this.sceneData.bins.find((bin) => {
      const tolerance = 0.06;
      const relativeX = piece.body.position.x - bin.x;
      const relativeZ = piece.body.position.z - bin.z;
      const insideX = Math.abs(relativeX) <= bin.width / 2 + tolerance;
      const insideZ = Math.abs(relativeZ) <= bin.depth / 2 + tolerance;
      const insideY = piece.body.position.y >= bin.baseY - tolerance
        && piece.body.position.y <= bin.topY + piece.shape.height / 2 + tolerance;
      return insideX && insideZ && insideY;
    }) ?? null;
  }

  classify(piece, bin) {
    piece.state = PIECE_STATES.CLASSIFIED;
    piece.assignedBinId = bin.id;
    setBodyStatic(piece.body);
    this.metrics.correct += 1;
    this.metrics.attempts += 1;
    this.metrics.categoryCounts[piece.categoryId] += 1;
    if (this.metrics.categoryCounts[piece.categoryId] === 5) {
      this.metrics.binTimes[bin.id] = this.getElapsedSeconds();
    }
    this.audio?.correct();
    this.message(`Acierto: ${piece.shape.singular} en ${piece.shape.label.toLowerCase()}.`, 'success');
    if (this.metrics.correct === 20) this.finish();
  }

  confirmError(piece, bin) {
    if (piece.errorReported) return;
    piece.errorReported = true;
    piece.state = PIECE_STATES.ERROR;
    this.metrics.errors += 1;
    this.metrics.attempts += 1;
    this.audio?.error();
    this.message(`Error: ${piece.shape.singular} no corresponde a este bote. Puedes recuperarla.`, 'error');
  }

  getElapsedSeconds() {
    if (!this.startedAt) return 0;
    const end = this.finishedAt ?? (this.phase === 'paused' ? this.pauseStartedAt : performance.now());
    const elapsed = end - this.startedAt - this.pausedDuration;
    return Math.max(0, Math.round(elapsed / 100) / 10);
  }

  getAccuracy() {
    if (this.metrics.attempts === 0) return 0;
    return Math.round((this.metrics.correct / this.metrics.attempts) * 1000) / 10;
  }

  getSnapshot() {
    return {
      phase: this.phase,
      phaseLabel: PHASE_LABELS[this.phase],
      correct: this.metrics.correct,
      errors: this.metrics.errors,
      attempts: this.metrics.attempts,
      accuracy: this.getAccuracy(),
      elapsed: this.getElapsedSeconds(),
      categoryCounts: { ...this.metrics.categoryCounts },
      binTimes: this.sceneData.bins.map((bin) => this.metrics.binTimes[bin.id]),
    };
  }

  refreshHud(force = false) {
    const now = performance.now();
    if (!force && now - this.lastHudUpdate < 100) return;
    this.lastHudUpdate = now;
    const snapshot = this.getSnapshot();
    this.sceneData.scorePanel.update(snapshot);
    this.onUpdate(snapshot);
  }

  message(text, type = 'info') {
    this.sceneData.notification?.show(text, type);
    this.onMessage({ text, type });
  }
}
