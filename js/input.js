import * as THREE from 'three';

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
    this.pointerOrigin = new THREE.Vector3();
    this.pointerDirection = new THREE.Vector3();
    this.pointerQuaternion = new THREE.Quaternion();
    this.pointerToPiece = new THREE.Vector3();
    this.pointerClosestPoint = new THREE.Vector3();
    this.onPointerDown = this.onPointerDown.bind(this);
    renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
  }

  update() {
    this.sceneData.pieces.forEach((piece) => {
      piece.mesh.scale.setScalar(piece.state === 'sujeto' ? 1.08 : 1);
      if (piece.mesh.material?.emissiveIntensity !== undefined) {
        piece.mesh.material.emissiveIntensity = piece.state === 'sujeto' ? 0.7 : 0.32;
      }
    });

    this.handPointers.forEach((handPointer, index) => {
      const state = this.pointerStates[index];
      const pinched = Boolean(handPointer.isPinched?.());
      const heldPiece = this.game.getHoldingPiece(handPointer);

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
      if (hit?.mesh?.userData?.action && pinched && !state.wasPinched) {
        this.game.handleAction(hit.mesh.userData.action);
      }
      if (hit?.piece && pinched && !state.wasPinched) {
        this.game.beginGrab(hit.piece, handPointer, hit.point);
      }
      state.wasPinched = pinched;
    });
  }

  findHandHit(handPointer) {
    let nearest = null;
    const consider = (candidate, mesh) => {
      if (!candidate || !mesh) return;
      if (!nearest || candidate.distance < nearest.distance) {
        nearest = {
          distance: candidate.distance,
          mesh,
          piece: mesh.userData.piece ?? null,
          point: candidate.point?.clone?.() ?? null,
        };
      }
    };

    this.sceneData.interactables.forEach((mesh) => {
      const intersections = handPointer.intersectObject(mesh, false);
      if (!intersections?.length) return;
      consider(intersections[0], mesh);
    });

    // Algunos visores actualizan el modelo de mano un fotograma después del
    // rayo interno de OculusHandPointerModel. Repetimos la intersección con
    // la pose mundial del puntero para no perder el pinchado.
    const pointerObject = handPointer.pointerObject;
    if (pointerObject) {
      const internalRay = handPointer.raycaster?.ray;
      if (internalRay) {
        this.pointerOrigin.copy(internalRay.origin);
        this.pointerDirection.copy(internalRay.direction).normalize();
      } else {
        pointerObject.getWorldPosition(this.pointerOrigin);
        pointerObject.getWorldQuaternion(this.pointerQuaternion);
        this.pointerDirection.set(0, 0, -1)
          .applyQuaternion(this.pointerQuaternion)
          .normalize();
      }
      this.raycaster.set(this.pointerOrigin, this.pointerDirection);
      this.raycaster.intersectObjects(this.sceneData.interactables, false)
        .forEach((intersection) => consider(intersection, intersection.object));

      // Tolerancia pequeña alrededor del rayo: ayuda cuando el dedo apunta
      // al borde de una figura sin convertir toda la escena en seleccionable.
      this.sceneData.pieces.forEach((piece) => {
        if (piece.state === 'clasificado' || !piece.mesh.visible) return;
        this.pointerToPiece.set(
          piece.body.position.x - this.pointerOrigin.x,
          piece.body.position.y - this.pointerOrigin.y,
          piece.body.position.z - this.pointerOrigin.z,
        );
        const projection = this.pointerToPiece.dot(this.pointerDirection);
        if (projection <= 0) return;
        this.pointerClosestPoint.copy(this.pointerDirection)
          .multiplyScalar(projection)
          .add(this.pointerOrigin);
        const distanceToRay = this.pointerClosestPoint.distanceTo(piece.body.position);
        const hitRadius = Math.max(piece.clearance * 1.05, 0.14);
        if (distanceToRay <= hitRadius) {
          consider({ distance: projection, point: this.pointerClosestPoint }, piece.mesh);
        }
      });
    }

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
