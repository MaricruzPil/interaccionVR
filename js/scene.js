import * as THREE from 'three';
import {
  APP_CONFIG,
  BIN_POSITIONS,
  COLORS,
  SHAPE_DEFINITIONS,
  TABLE_POSITIONS,
  getShapeClearance,
  getShapeDefinition,
  getShapeHorizontalExtent,
  shuffle,
} from './config.js';
import { addPieceBody, addStaticBox, setBodyDynamic } from './physics.js';

const SLOT_POSITIONS = [
  { x: -0.46, z: -0.27 },
  { x: 0, z: -0.27 },
  { x: 0.46, z: -0.27 },
  { x: -0.24, z: 0.27 },
  { x: 0.24, z: 0.27 },
];

function makeMaterial(color, emissive = 0x000000, roughness = 0.34, metalness = 0.16) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: emissive === 0x000000 ? 0 : 0.32,
    roughness,
    metalness,
  });
}

function makeCanvasTexture(draw, width = 1024, height = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  draw(context, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return { canvas, context, texture };
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.closePath();
}

function makeLabelPlane(text, color, width = 0.62, height = 0.18) {
  const { texture } = makeCanvasTexture((context, canvasWidth, canvasHeight) => {
    context.fillStyle = '#0c2731';
    context.fillRect(0, 0, canvasWidth, canvasHeight);
    context.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
    context.lineWidth = 12;
    context.strokeRect(8, 8, canvasWidth - 16, canvasHeight - 16);
    context.fillStyle = '#eaf5ef';
    context.font = '700 68px Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvasWidth / 2, canvasHeight / 2 + 2);
  }, 512, 160);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true }),
  );
  mesh.userData.disposeTexture = texture;
  return mesh;
}

function createPieceMesh(shape) {
  let geometry;
  if (shape.kind === 'sphere') geometry = new THREE.SphereGeometry(shape.radius, 20, 14);
  if (shape.kind === 'box') geometry = new THREE.BoxGeometry(shape.size, shape.size, shape.size);
  if (shape.kind === 'pyramid') {
    geometry = new THREE.ConeGeometry(
      shape.radius * Math.SQRT2,
      shape.height,
      4,
      1,
      false,
      Math.PI / 4,
    );
  }
  if (shape.kind === 'hex-prism') {
    geometry = new THREE.CylinderGeometry(shape.radius, shape.radius, shape.height, 6);
  }

  const mesh = new THREE.Mesh(
    geometry,
    makeMaterial(shape.color, shape.emissive, 0.28, 0.22),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.categoryId = shape.id;
  mesh.userData.interactable = true;
  return mesh;
}

function createTable(scene, world, materials, tableDefinition) {
  const { width, depth, topY, thickness } = APP_CONFIG.table;
  const group = new THREE.Group();
  group.position.set(tableDefinition.x, 0, tableDefinition.z);
  group.userData.tableId = tableDefinition.id;

  const topMaterial = makeMaterial(COLORS.panel, 0x06131a, 0.44, 0.2);
  const trimMaterial = makeMaterial(COLORS.grid, 0x0c2029, 0.36, 0.3);
  const top = new THREE.Mesh(new THREE.BoxGeometry(width, thickness, depth), topMaterial);
  top.position.y = topY - thickness / 2;
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);

  const legHeight = topY - thickness;
  const legGeometry = new THREE.BoxGeometry(0.09, legHeight, 0.09);
  const legOffsets = [
    [-width / 2 + 0.12, -depth / 2 + 0.12],
    [width / 2 - 0.12, -depth / 2 + 0.12],
    [-width / 2 + 0.12, depth / 2 - 0.12],
    [width / 2 - 0.12, depth / 2 - 0.12],
  ];
  legOffsets.forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeometry, trimMaterial);
    leg.position.set(x, legHeight / 2, z);
    leg.castShadow = true;
    group.add(leg);
  });

  const label = makeLabelPlane(tableDefinition.label, COLORS.muted, 0.46, 0.13);
  label.position.set(0, topY + 0.055, -depth / 2 - 0.012);
  label.rotation.x = -Math.PI / 2;
  group.add(label);

  scene.add(group);
  addStaticBox(world, materials, {
    x: tableDefinition.x,
    y: topY - thickness / 2,
    z: tableDefinition.z,
    width,
    height: thickness,
    depth,
    label: tableDefinition.id,
  });

  legOffsets.forEach(([x, z], index) => {
    addStaticBox(world, materials, {
      x: tableDefinition.x + x,
      y: legHeight / 2,
      z: tableDefinition.z + z,
      width: 0.09,
      height: legHeight,
      depth: 0.09,
      label: `${tableDefinition.id}-pata-${index + 1}`,
    });
  });

  return {
    ...tableDefinition,
    mesh: group,
    topY,
    width,
    depth,
  };
}

function createBin(scene, world, materials, binDefinition) {
  const { width, depth, height, wall, base } = APP_CONFIG.bin;
  const shape = getShapeDefinition(binDefinition.categoryId);
  const group = new THREE.Group();
  group.position.set(binDefinition.x, 0, binDefinition.z);
  group.userData.binId = binDefinition.id;
  group.userData.categoryId = binDefinition.categoryId;

  const binMaterial = makeMaterial(shape.color, shape.emissive, 0.38, 0.18);
  const edgeMaterial = makeMaterial(COLORS.white, 0x07151d, 0.3, 0.24);
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(width, base, depth), binMaterial);
  bottom.position.y = base / 2;
  bottom.receiveShadow = true;
  group.add(bottom);

  const wallHeight = height;
  const wallY = base + wallHeight / 2;
  const wallDefinitions = [
    { x: 0, y: wallY, z: -depth / 2 + wall / 2, w: width, h: wallHeight, d: wall },
    { x: 0, y: wallY, z: depth / 2 - wall / 2, w: width, h: wallHeight, d: wall },
    { x: -width / 2 + wall / 2, y: wallY, z: 0, w: wall, h: wallHeight, d: depth - wall * 2 },
    { x: width / 2 - wall / 2, y: wallY, z: 0, w: wall, h: wallHeight, d: depth - wall * 2 },
  ];
  wallDefinitions.forEach((definition) => {
    const wallMesh = new THREE.Mesh(
      new THREE.BoxGeometry(definition.w, definition.h, definition.d),
      binMaterial,
    );
    wallMesh.position.set(definition.x, definition.y, definition.z);
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    group.add(wallMesh);
    addStaticBox(world, materials, {
      x: binDefinition.x + definition.x,
      y: definition.y,
      z: binDefinition.z + definition.z,
      width: definition.w,
      height: definition.h,
      depth: definition.d,
      label: `${binDefinition.id}-pared`,
    });
  });

  const rim = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, depth)),
    new THREE.LineBasicMaterial({ color: shape.color, transparent: true, opacity: 0.85 }),
  );
  rim.position.y = base + height / 2;
  group.add(rim);

  const label = makeLabelPlane(shape.label, shape.color, 0.62, 0.18);
  label.position.set(0, base + height + 0.19, -depth / 2 - 0.018);
  group.add(label);

  scene.add(group);
  addStaticBox(world, materials, {
    x: binDefinition.x,
    y: base / 2,
    z: binDefinition.z,
    width,
    height: base,
    depth,
    label: `${binDefinition.id}-base`,
  });

  return {
    ...binDefinition,
    mesh: group,
    shape,
    baseY: base,
    topY: base + height,
    innerWidth: width - wall * 2,
    innerDepth: depth - wall * 2,
  };
}

function createEnvironment(scene, world, materials) {
  const { width, depth, height } = APP_CONFIG.room;
  const floorMaterial = makeMaterial(COLORS.deep, 0x041018, 0.62, 0.08);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(width, 29, COLORS.grid, 0x153a44);
  grid.scale.z = depth / width;
  grid.position.y = 0.004;
  grid.material.transparent = true;
  grid.material.opacity = 0.62;
  scene.add(grid);

  const floorBody = addStaticBox(world, materials, {
    x: 0,
    y: -0.07,
    z: 0,
    width,
    height: 0.14,
    depth,
    label: 'piso',
  });

  const wallMaterial = new THREE.MeshBasicMaterial({
    color: COLORS.grid,
    transparent: true,
    opacity: 0.12,
  });
  const wallDefinitions = [
    { x: 0, y: height / 2, z: -depth / 2, w: width, h: height, d: 0.08 },
    { x: 0, y: height / 2, z: depth / 2, w: width, h: height, d: 0.08 },
    { x: -width / 2, y: height / 2, z: 0, w: 0.08, h: height, d: depth },
    { x: width / 2, y: height / 2, z: 0, w: 0.08, h: height, d: depth },
  ];
  wallDefinitions.forEach((definition) => {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(definition.w, definition.h, definition.d),
      wallMaterial,
    );
    wall.position.set(definition.x, definition.y, definition.z);
    scene.add(wall);
    addStaticBox(world, materials, {
      ...definition,
      label: 'limite-laboratorio',
    });
  });

  const backdrop = new THREE.Mesh(
    new THREE.BoxGeometry(30, 30, 30),
    new THREE.MeshBasicMaterial({ color: COLORS.ink, side: THREE.BackSide, depthWrite: false }),
  );
  backdrop.renderOrder = -1;
  scene.add(backdrop);

  return { floor, floorBody };
}

function createPanel(scene) {
  const panel = makeCanvasTexture((context, width, height) => {
    context.fillStyle = '#0c2731';
    context.fillRect(0, 0, width, height);
  }, 1024, 640);
  const panelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.48, 0.92),
    new THREE.MeshBasicMaterial({ map: panel.texture, transparent: true }),
  );
  panelMesh.position.set(0, 1.72, -2.25);
  panelMesh.userData.disposeTexture = panel.texture;
  scene.add(panelMesh);

  function update(snapshot) {
    const { context, canvas } = panel;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#0b2731';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#54e0c1';
    context.lineWidth = 8;
    context.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

    context.fillStyle = '#54e0c1';
    context.font = '700 44px Arial, sans-serif';
    context.fillText('INSTRUMENTACIÓN / 3.2', 48, 76);
    context.fillStyle = '#eaf5ef';
    context.font = '700 68px Arial, sans-serif';
    context.fillText(`${snapshot.correct}/20`, 48, 154);
    context.fillStyle = '#a3c5c2';
    context.font = '30px Arial, sans-serif';
    context.fillText('aciertos', 250, 151);

    context.font = '30px Arial, sans-serif';
    context.fillStyle = '#eaf5ef';
    const lines = [
      `Esferas  ${snapshot.categoryCounts.esfera}/5`,
      `Cubos    ${snapshot.categoryCounts.cubo}/5`,
      `Pirámides ${snapshot.categoryCounts.piramide}/5`,
      `Prismas  ${snapshot.categoryCounts.prisma}/5`,
    ];
    lines.forEach((line, index) => context.fillText(line, 48, 224 + index * 39));

    context.fillStyle = '#a3c5c2';
    context.fillText(`errores ${snapshot.errors}   intentos ${snapshot.attempts}`, 48, 405);
    context.fillText(`precisión ${snapshot.accuracy}%   ${snapshot.elapsed}s`, 48, 446);
    context.fillStyle = snapshot.phase === 'finalizada' ? '#6ce6a5' : '#f4c866';
    context.font = '700 32px Arial, sans-serif';
    context.fillText(snapshot.phaseLabel, 48, 500);
    context.fillStyle = '#a3c5c2';
    context.font = '24px Arial, sans-serif';
    const timeText = snapshot.binTimes
      .map((time) => (time === null ? 'pendiente' : `${time}s`))
      .join('  ·  ');
    context.fillText(`botes: ${timeText}`, 48, 550);
    panel.texture.needsUpdate = true;
  }

  return { mesh: panelMesh, update };
}

function createNotification(scene) {
  const panel = makeCanvasTexture((context, width, height) => {
    context.clearRect(0, 0, width, height);
  }, 1024, 160);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.46, 0.23),
    new THREE.MeshBasicMaterial({ map: panel.texture, transparent: true }),
  );
  mesh.position.set(0.92, 1.62, -1.84);
  mesh.renderOrder = 4;
  mesh.visible = false;
  mesh.userData.disposeTexture = panel.texture;
  scene.add(mesh);

  let timeoutId = null;
  const colors = {
    info: '#a3c5c2',
    success: '#6ce6a5',
    warning: '#f4c866',
    error: '#ff647c',
  };

  function show(text, type = 'info') {
    const accent = colors[type] ?? colors.info;
    const { context, canvas } = panel;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#0b2731';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = accent;
    context.fillRect(0, 0, 18, canvas.height);
    context.strokeStyle = accent;
    context.lineWidth = 6;
    context.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
    context.fillStyle = '#eaf5ef';
    context.font = '700 34px Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text.slice(0, 72), canvas.width / 2 + 8, canvas.height / 2);
    panel.texture.needsUpdate = true;
    mesh.visible = true;
    if (timeoutId) window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      mesh.visible = false;
      timeoutId = null;
    }, 2800);
  }

  return { mesh, show };
}

function segmentEntryTime(start, end, lower, upper) {
  let entry = 0;
  let exit = 1;
  const starts = [start.x, start.y, start.z];
  const deltas = [end.x - start.x, end.y - start.y, end.z - start.z];
  const lowers = [lower.x, lower.y, lower.z];
  const uppers = [upper.x, upper.y, upper.z];
  const boundaryEpsilon = 0.003;

  for (let axis = 0; axis < 3; axis += 1) {
    if (Math.abs(deltas[axis]) < 1e-8) {
      if (starts[axis] < lowers[axis] || starts[axis] > uppers[axis]) return null;
      continue;
    }
    if (starts[axis] >= uppers[axis] - boundaryEpsilon && deltas[axis] >= 0) return null;
    if (starts[axis] <= lowers[axis] + boundaryEpsilon && deltas[axis] <= 0) return null;
    let axisEntry = (lowers[axis] - starts[axis]) / deltas[axis];
    let axisExit = (uppers[axis] - starts[axis]) / deltas[axis];
    if (axisEntry > axisExit) [axisEntry, axisExit] = [axisExit, axisEntry];
    entry = Math.max(entry, axisEntry);
    exit = Math.min(exit, axisExit);
    if (entry > exit) return null;
  }
  return entry >= 0 && entry <= 1 ? entry : null;
}

function createKinematicMoveGuard(world) {
  const start = new THREE.Vector3();
  const delta = new THREE.Vector3();
  const safeTarget = new THREE.Vector3();
  const lower = new THREE.Vector3();
  const upper = new THREE.Vector3();

  return (piece, current, target) => {
    start.copy(current);
    delta.copy(target).sub(current);
    let safeFactor = 1;
    const horizontalClearance = piece.clearance + 0.004;
    const verticalClearance = piece.shape.height / 2 + 0.002;

    world.bodies.forEach((obstacle) => {
      if (obstacle === piece.body || !obstacle.shape) return;
      obstacle.updateAABB();
      lower.set(
        obstacle.aabb.lowerBound.x - horizontalClearance,
        obstacle.aabb.lowerBound.y - verticalClearance,
        obstacle.aabb.lowerBound.z - horizontalClearance,
      );
      upper.set(
        obstacle.aabb.upperBound.x + horizontalClearance,
        obstacle.aabb.upperBound.y + verticalClearance,
        obstacle.aabb.upperBound.z + horizontalClearance,
      );
      const hitTime = segmentEntryTime(start, target, lower, upper);
      if (hitTime !== null) safeFactor = Math.min(safeFactor, Math.max(0, hitTime - 0.012));
    });

    return safeTarget.copy(start).addScaledVector(delta, safeFactor);
  };
}

function isPlacementSafe(position, shape, placements) {
  const horizontalExtent = getShapeHorizontalExtent(shape);
  const margin = 0.012;
  if (
    Math.abs(position.x) + horizontalExtent + margin > APP_CONFIG.table.width / 2
    || Math.abs(position.z) + horizontalExtent + margin > APP_CONFIG.table.depth / 2
  ) return false;

  return placements.every((placed) => {
    const otherExtent = getShapeHorizontalExtent(placed.shape);
    return Math.abs(position.x - placed.position.x) > horizontalExtent + otherExtent + margin
      || Math.abs(position.z - placed.position.z) > horizontalExtent + otherExtent + margin;
  });
}

function createSafePlacements(shapes, random) {
  const placements = [];
  SLOT_POSITIONS.forEach((slot, index) => {
    const shape = shapes[index];
    const candidate = {
      x: slot.x + (random() - 0.5) * 0.025,
      z: slot.z + (random() - 0.5) * 0.025,
    };
    const position = isPlacementSafe(candidate, shape, placements)
      ? candidate
      : { ...slot };
    placements.push({ position, shape });
  });
  return placements.every((placement, index) => (
    isPlacementSafe(placement.position, placement.shape, placements.slice(0, index))
  ))
    ? placements
    : SLOT_POSITIONS.map((position, index) => ({ position: { ...position }, shape: shapes[index] }));
}

function createActionButton(scene, { label, action, x, y, z, color }) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.userData.action = action;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.18, 0.07),
    makeMaterial(color, 0x07151d, 0.3, 0.22),
  );
  body.castShadow = true;
  body.userData.action = action;
  body.userData.interactable = true;
  group.add(body);

  const labelMesh = makeLabelPlane(label, color, 0.46, 0.14);
  labelMesh.position.z = 0.041;
  group.add(labelMesh);
  scene.add(group);
  return { group, body, labelMesh, action };
}

function createLighting(scene) {
  scene.add(new THREE.HemisphereLight(0xbee7e5, 0x08131e, 2.2));
  const key = new THREE.DirectionalLight(0xf6fff7, 3.2);
  key.position.set(-2.5, 4.8, 2.3);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -3;
  scene.add(key);

  const mint = new THREE.PointLight(COLORS.mint, 1.7, 4.2, 2);
  mint.position.set(-2.1, 1.7, -0.6);
  scene.add(mint);
  const coral = new THREE.PointLight(COLORS.coral, 1.3, 4.4, 2);
  coral.position.set(2.1, 1.5, 0.7);
  scene.add(coral);
}

function createPieceRecords(scene, world, materials) {
  const pieces = [];
  const categoriesByTable = [
    ['esfera', 'cubo', 'piramide', 'prisma', 'esfera'],
    ['esfera', 'cubo', 'piramide', 'prisma', 'cubo'],
    ['esfera', 'cubo', 'piramide', 'prisma', 'piramide'],
    ['esfera', 'cubo', 'piramide', 'prisma', 'prisma'],
  ];

  TABLE_POSITIONS.forEach((table, tableIndex) => {
    const categories = shuffle(categoriesByTable[tableIndex]);
    categories.forEach((categoryId, slotIndex) => {
      const shape = getShapeDefinition(categoryId);
      const mesh = createPieceMesh(shape);
      const body = addPieceBody(world, materials, shape, { x: 0, y: 0, z: 0 });
      const piece = {
        id: `pieza-${String(pieces.length + 1).padStart(2, '0')}`,
        categoryId,
        shape,
        tableId: table.id,
        mesh,
        body,
        state: 'disponible',
        assignedBinId: null,
        attempt: 0,
        errorReported: false,
        stabilityTime: 0,
        enteredBinId: null,
        heldBy: null,
        grabOffset: new THREE.Vector3(),
        grabQuaternion: new THREE.Quaternion(),
        grabDirection: new THREE.Vector3(0, 0, -1),
        grabMode: 'near',
        grabDistance: 0,
        lastPosition: new THREE.Vector3(),
        lastHandVelocity: new THREE.Vector3(),
        initialPosition: new THREE.Vector3(),
        initialQuaternion: new THREE.Quaternion(),
        clearance: getShapeClearance(shape),
      };
      mesh.userData.piece = piece;
      scene.add(mesh);
      pieces.push(piece);
    });
  });

  return { pieces, slotPositions: SLOT_POSITIONS };
}

export function createLabScene({ scene, world, materials }) {
  scene.background = new THREE.Color(COLORS.ink);
  scene.fog = new THREE.Fog(COLORS.ink, 4.8, 8.6);
  createLighting(scene);
  createEnvironment(scene, world, materials);

  const tables = TABLE_POSITIONS.map((table) => createTable(scene, world, materials, table));
  const bins = BIN_POSITIONS.map((bin) => createBin(scene, world, materials, bin));
  const { pieces, slotPositions } = createPieceRecords(scene, world, materials);
  const scorePanel = createPanel(scene);
  const notification = createNotification(scene);
  const clampKinematicTarget = createKinematicMoveGuard(world);
  const startButton = createActionButton(scene, {
    label: 'COMENZAR',
    action: 'start',
    x: 0.98,
    y: 2.10,
    z: -1.86,
    color: COLORS.mint,
  });
  const resetButton = createActionButton(scene, {
    label: 'REINICIAR',
    action: 'reset',
    x: 1.57,
    y: 2.10,
    z: -1.86,
    color: COLORS.coral,
  });

  const interactables = [
    ...pieces.map((piece) => piece.mesh),
    startButton.body,
    resetButton.body,
  ];

  function resetPieces(random = Math.random) {
    const placementsByTable = TABLE_POSITIONS.map((_, tableIndex) => {
      const tablePieces = pieces.slice(tableIndex * 5, tableIndex * 5 + 5);
      return createSafePlacements(tablePieces.map((piece) => piece.shape), random);
    });

    pieces.forEach((piece, index) => {
      const tableIndex = Math.floor(index / 5);
      const slotIndex = index % 5;
      const table = TABLE_POSITIONS[tableIndex];
      const slot = placementsByTable[tableIndex][slotIndex].position;
      const shape = piece.shape;
      const position = {
        x: table.x + slot.x,
        y: APP_CONFIG.table.topY + shape.height / 2 + 0.012,
        z: table.z + slot.z,
      };

      piece.categoryId = shape.id;
      piece.shape = shape;
      piece.tableId = table.id;
      piece.body.position.set(position.x, position.y, position.z);
      piece.body.quaternion.setFromEuler(0, random() * Math.PI * 2, 0);
      piece.initialPosition.set(position.x, position.y, position.z);
      piece.initialQuaternion.copy(piece.body.quaternion);
      piece.body.velocity.setZero();
      piece.body.angularVelocity.setZero();
      setBodyDynamic(piece.body, shape.mass);
      piece.body.wakeUp();
      piece.state = 'disponible';
      piece.assignedBinId = null;
      piece.attempt = 0;
      piece.errorReported = false;
      piece.stabilityTime = 0;
      piece.enteredBinId = null;
      piece.heldBy = null;
      piece.lastPosition.set(position.x, position.y, position.z);
      piece.lastHandVelocity.set(0, 0, 0);
      piece.mesh.visible = true;
    });
  }

  resetPieces();

  function resolveTablePenetration(piece) {
    if (!piece || piece.state === 'sujeto' || piece.state === 'clasificado') return false;
    const supportY = piece.shape.height / 2 + 0.008;
    const table = tables.find((candidate) => {
      const relativeX = piece.body.position.x - candidate.x;
      const relativeZ = piece.body.position.z - candidate.z;
      const insideX = Math.abs(relativeX) <= candidate.width / 2 - piece.clearance * 0.25;
      const insideZ = Math.abs(relativeZ) <= candidate.depth / 2 - piece.clearance * 0.25;
      const penetrationTolerance = 0.018;
      return insideX
        && insideZ
        && piece.body.position.y < candidate.topY + supportY - penetrationTolerance;
    });
    if (!table) return false;

    piece.body.position.y = table.topY + supportY;
    if (piece.body.velocity.y < 0) piece.body.velocity.y = 0;
    piece.body.aabbNeedsUpdate = true;
    return true;
  }

  return {
    tables,
    bins,
    pieces,
    scorePanel,
    startButton,
    resetButton,
    notification,
    interactables,
    resetPieces,
    recoverPiece(piece) {
      if (!piece?.initialPosition) return;
      piece.body.position.copy(piece.initialPosition);
      piece.body.quaternion.copy(piece.initialQuaternion);
      piece.body.velocity.setZero();
      piece.body.angularVelocity.setZero();
      piece.state = 'disponible';
      piece.assignedBinId = null;
      piece.errorReported = false;
      piece.enteredBinId = null;
      piece.stabilityTime = 0;
      setBodyDynamic(piece.body, piece.shape.mass);
      piece.body.wakeUp();
    },
    clampKinematicTarget,
    resolveTablePenetration,
  };
}

export function updateVisualTransforms(pieces) {
  pieces.forEach((piece) => {
    piece.mesh.position.set(piece.body.position.x, piece.body.position.y, piece.body.position.z);
    piece.mesh.quaternion.set(
      piece.body.quaternion.x,
      piece.body.quaternion.y,
      piece.body.quaternion.z,
      piece.body.quaternion.w,
    );
  });
}

export function setActionButtonLabel(button, label, color) {
  const labelMesh = button.labelMesh;
  const oldTexture = labelMesh.material.map;
  const { texture } = makeCanvasTexture((context, width, height) => {
    context.fillStyle = '#0c2731';
    context.fillRect(0, 0, width, height);
    context.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
    context.lineWidth = 12;
    context.strokeRect(8, 8, width - 16, height - 16);
    context.fillStyle = '#eaf5ef';
    context.font = '700 58px Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(label, width / 2, height / 2);
  }, 512, 160);
  labelMesh.material.map = texture;
  labelMesh.material.needsUpdate = true;
  if (oldTexture) oldTexture.dispose();
}

export function setActionButtonVisibility(button, visible) {
  button.group.visible = visible;
  button.body.visible = visible;
  button.labelMesh.visible = visible;
}
