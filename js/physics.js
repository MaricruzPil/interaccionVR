import * as CANNON from 'cannon-es';
import { APP_CONFIG } from './config.js';

export function createPhysicsWorld() {
  const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, APP_CONFIG.physics.gravity, 0),
  });

  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;
  world.solver.iterations = APP_CONFIG.physics.solverIterations;
  world.solver.tolerance = 0.001;

  const environmentMaterial = new CANNON.Material('environment');
  const pieceMaterial = new CANNON.Material('piece');
  const environmentContact = new CANNON.ContactMaterial(
    environmentMaterial,
    pieceMaterial,
    { friction: 0.62, restitution: 0.22 },
  );
  const pieceContact = new CANNON.ContactMaterial(
    pieceMaterial,
    pieceMaterial,
    { friction: 0.55, restitution: 0.18 },
  );

  world.addContactMaterial(environmentContact);
  world.addContactMaterial(pieceContact);
  world.defaultContactMaterial.friction = 0.55;
  world.defaultContactMaterial.restitution = 0.18;

  return {
    world,
    materials: { environment: environmentMaterial, piece: pieceMaterial },
  };
}

export function addStaticBox(world, materials, { x, y, z, width, height, depth, label = 'static' }) {
  const body = new CANNON.Body({
    mass: 0,
    material: materials.environment,
    type: CANNON.Body.STATIC,
    shape: new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2)),
    position: new CANNON.Vec3(x, y, z),
  });
  body.label = label;
  world.addBody(body);
  return body;
}

export function createPyramidShape(radius, height) {
  const halfBase = radius;
  const halfHeight = height / 2;
  const vertices = [
    new CANNON.Vec3(-halfBase, -halfHeight, -halfBase),
    new CANNON.Vec3(halfBase, -halfHeight, -halfBase),
    new CANNON.Vec3(halfBase, -halfHeight, halfBase),
    new CANNON.Vec3(-halfBase, -halfHeight, halfBase),
    new CANNON.Vec3(0, halfHeight, 0),
  ];
  const faces = [
    [0, 1, 2, 3],
    [0, 4, 1],
    [1, 4, 2],
    [2, 4, 3],
    [3, 4, 0],
  ];
  return new CANNON.ConvexPolyhedron({ vertices, faces });
}

export function createPieceShape(shape) {
  if (shape.kind === 'sphere') return new CANNON.Sphere(shape.radius);
  if (shape.kind === 'box') {
    const half = shape.size / 2;
    return new CANNON.Box(new CANNON.Vec3(half, half, half));
  }
  if (shape.kind === 'pyramid') return createPyramidShape(shape.radius, shape.height);
  if (shape.kind === 'hex-prism') {
    return new CANNON.Cylinder(shape.radius, shape.radius, shape.height, 6);
  }
  throw new Error(`Forma física desconocida: ${shape.kind}`);
}

export function addPieceBody(world, materials, shape, position) {
  const body = new CANNON.Body({
    mass: shape.mass,
    material: materials.piece,
    shape: createPieceShape(shape),
    position: new CANNON.Vec3(position.x, position.y, position.z),
    linearDamping: 0.08,
    angularDamping: 0.16,
    allowSleep: true,
    sleepSpeedLimit: 0.08,
    sleepTimeLimit: 0.6,
  });
  body.label = `pieza-${shape.id}`;
  body.userData = { originalMass: shape.mass };
  world.addBody(body);
  return body;
}

export function setBodyKinematic(body) {
  body.type = CANNON.Body.KINEMATIC;
  body.mass = 0;
  body.velocity.setZero();
  body.angularVelocity.setZero();
  body.updateMassProperties();
  body.collisionResponse = false;
  body.wakeUp();
}

export function setBodyDynamic(body, mass) {
  body.type = CANNON.Body.DYNAMIC;
  body.mass = mass;
  body.updateMassProperties();
  body.collisionResponse = true;
  body.wakeUp();
}

export function setBodyStatic(body) {
  body.type = CANNON.Body.STATIC;
  body.mass = 0;
  body.updateMassProperties();
  body.velocity.setZero();
  body.angularVelocity.setZero();
  body.sleep();
}

export function stepWorld(world, accumulator, frameDelta) {
  let nextAccumulator = accumulator + Math.min(frameDelta, APP_CONFIG.physics.maxFrameDelta);
  let steps = 0;

  while (
    nextAccumulator >= APP_CONFIG.physics.fixedStep
    && steps < APP_CONFIG.physics.maxSubSteps
  ) {
    world.step(APP_CONFIG.physics.fixedStep);
    nextAccumulator -= APP_CONFIG.physics.fixedStep;
    steps += 1;
  }

  if (steps === APP_CONFIG.physics.maxSubSteps) {
    nextAccumulator = 0;
  }

  return { accumulator: nextAccumulator, steps };
}
