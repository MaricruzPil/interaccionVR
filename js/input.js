import * as THREE from 'three';
import { APP_CONFIG, COLORS } from './config.js';

export class InteractionInput {
  constructor({ camera, renderer, sceneData, game, handPointers }) {
    this.camera = camera;
    this.renderer = renderer;
    this.sceneData = sceneData;
    this.game = game;
    this.handPointers = handPointers;
    this.raycaster = new THREE.Raycaster();
    this.pointerStates = handPointers.map(() => ({ wasPinched: false }));
    this.canvasPointer = new THREE.Vector2();
    this.onPointerDown = this.onPointerDown.bind(this);
    renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
  }

  update() {
    this.sceneData.pieces.forEach((piece) => {
      piece.isTargeted = false;
    });

    this.handPointers.forEach((handPointer, index) => {
      const state = this.pointerStates[index];
      const pinched = Boolean(handPointer.isPinched?.());
      const heldPiece = this.game.getHoldingPiece(handPointer);

      if (!handPointer.visible && heldPiece) {
        this.game.releaseGrab(heldPiece);
        state.wasPinched = false;
        return;
      }
      if (heldPiece && !pinched) {
        this.game.releaseGrab(heldPiece);
        state.wasPinched = pinched;
        return;
      }
      if (heldPiece) {
        state.wasPinched = pinched;
        return;
      }

      const hit = this.findHandHit(handPointer);
      handPointer.setCursor(hit ? hit.distance : 1.5);
      if (hit?.piece) hit.piece.isTargeted = true;
      if (hit?.mesh?.userData?.action && pinched && !state.wasPinched) {
        this.game.handleAction(hit.mesh.userData.action);
      }
      if (hit?.piece && pinched && !state.wasPinched) {
        this.game.beginGrab(hit.piece, handPointer);
      }
      state.wasPinched = pinched;
    });

    this.sceneData.pieces.forEach((piece) => {
      const held = piece.state === 'sujeto';
      const highlighted = held || piece.isTargeted;
      piece.mesh.scale.setScalar(held ? 1.08 : piece.isTargeted ? 1.045 : 1);
      if (piece.mesh.material?.emissiveIntensity !== undefined) {
        piece.mesh.material.emissiveIntensity = held ? 0.58 : piece.isTargeted ? 0.44 : 0.16;
      }
      if (piece.mesh.material?.emissive?.setHex) {
        piece.mesh.material.emissive.setHex(highlighted ? COLORS.mint : piece.shape.emissive);
      }
    });
    this.updateBinHints();
  }

  updateBinHints() {
    this.sceneData.bins.forEach((bin) => bin.setHighlight?.(false));
    const heldPieces = this.sceneData.pieces.filter((piece) => piece.state === 'sujeto');
    heldPieces.forEach((piece) => {
      let nearestBin = null;
      let nearestDistance = Infinity;
      this.sceneData.bins.forEach((bin) => {
        const dx = piece.body.position.x - bin.x;
        const dy = piece.body.position.y - bin.topY;
        const dz = piece.body.position.z - bin.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestBin = bin;
        }
      });
      if (nearestBin && nearestDistance <= APP_CONFIG.interaction.binAssistDistance) {
        nearestBin.setHighlight?.(true, nearestBin.categoryId === piece.categoryId);
      }
    });
  }

  findHandHit(handPointer) {
    let nearest = null;
    this.sceneData.interactables.forEach((mesh) => {
      const intersections = handPointer.intersectObject(mesh, false);
      if (!intersections?.length) return;
      const candidate = intersections[0];
      if (!nearest || candidate.distance < nearest.distance) {
        nearest = {
          distance: candidate.distance,
          mesh,
          piece: mesh.userData.piece ?? null,
        };
      }
    });
    return nearest;
  }

  onPointerDown(event) {
    if (this.renderer.xr.isPresenting) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.canvasPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.canvasPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.canvasPointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.sceneData.interactables, false);
    const hit = hits[0];
    if (hit?.object?.userData?.action) this.game.handleAction(hit.object.userData.action);
  }

  releaseAll() {
    this.game.releaseAll();
    this.pointerStates.forEach((state) => {
      state.wasPinched = false;
    });
  }
}
