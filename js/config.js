export const APP_CONFIG = {
  title: '3.2 Interacción virtual',
  author: 'Maricruz Pineda Lara',
  threeVersion: '0.160.0',
  cannonVersion: '0.20.0',
  room: { width: 5.8, depth: 4.8, height: 2.6 },
  table: { width: 1.48, depth: 1.08, topY: 0.84, thickness: 0.12 },
  bin: { width: 0.76, depth: 0.68, height: 0.52, wall: 0.075, base: 0.08 },
  interaction: {
    grabSmoothing: 0.985,
    maxHandMove: 0.65,
    maxGrabVelocity: 12,
    maxReleaseVelocity: 1.8,
    grabSettleMs: 140,
    releaseMomentumThreshold: 1.15,
    binAssistDistance: 0.34,
    remoteGrabDistance: 0.72,
    nearGrabDistance: 0.36,
  },
  physics: {
    gravity: -9.81,
    fixedStep: 1 / 60,
    maxFrameDelta: 0.1,
    maxSubSteps: 6,
    solverIterations: 12,
    stabilitySeconds: 0.55,
    stableLinearSpeed: 0.11,
    stableAngularSpeed: 0.24,
  },
};

export const COLORS = {
  ink: 0xe8efeb,
  deep: 0xd7e4e0,
  panel: 0x9bb8b4,
  grid: 0x789793,
  white: 0xf7f5ef,
  muted: 0x687978,
  mint: 0x4e9e91,
  coral: 0xc97e6b,
  yellow: 0xc6a15a,
  blue: 0x7faac4,
  violet: 0x8e7eb0,
  success: 0x569b73,
  danger: 0xc65e6b,
};

export const SHAPE_DEFINITIONS = [
  {
    id: 'esfera',
    label: 'Esferas',
    singular: 'Esfera',
    color: COLORS.mint,
    emissive: 0x123e38,
    kind: 'sphere',
    radius: 0.125,
    height: 0.25,
    mass: 0.72,
  },
  {
    id: 'cubo',
    label: 'Cubos',
    singular: 'Cubo',
    color: COLORS.coral,
    emissive: 0x4a1711,
    kind: 'box',
    size: 0.23,
    radius: 0.2,
    height: 0.23,
    mass: 1.0,
  },
  {
    id: 'piramide',
    label: 'Pirámides',
    singular: 'Pirámide',
    color: COLORS.yellow,
    emissive: 0x49370c,
    kind: 'pyramid',
    radius: 0.17,
    height: 0.27,
    mass: 0.88,
  },
  {
    id: 'prisma',
    label: 'Prismas',
    singular: 'Prisma',
    color: COLORS.blue,
    emissive: 0x122c58,
    kind: 'hex-prism',
    radius: 0.14,
    height: 0.25,
    mass: 0.92,
  },
];

export const TABLE_POSITIONS = [
  { id: 'mesa-norte-oeste', x: -1.62, z: -1.18, label: 'MESA A' },
  { id: 'mesa-norte-este', x: 1.62, z: -1.18, label: 'MESA B' },
  { id: 'mesa-sur-oeste', x: -1.62, z: 1.18, label: 'MESA C' },
  { id: 'mesa-sur-este', x: 1.62, z: 1.18, label: 'MESA D' },
];

export const BIN_POSITIONS = [
  { id: 'bote-esfera', x: -0.72, z: -1.98, categoryId: 'esfera' },
  { id: 'bote-cubo', x: 0.72, z: -1.98, categoryId: 'cubo' },
  { id: 'bote-piramide', x: -0.72, z: 1.98, categoryId: 'piramide' },
  { id: 'bote-prisma', x: 0.72, z: 1.98, categoryId: 'prisma' },
];

export const PIECE_STATES = Object.freeze({
  AVAILABLE: 'disponible',
  HELD: 'sujeto',
  FLIGHT: 'liberado/en vuelo',
  STABILIZING: 'estabilizándose',
  CLASSIFIED: 'clasificado',
  ERROR: 'error',
  RECOVERABLE: 'recuperable',
});

export function getShapeClearance(shape) {
  if (shape.kind === 'box') return Math.sqrt(3) * (shape.size / 2);
  if (shape.kind === 'pyramid') return Math.sqrt(2) * shape.radius;
  return shape.radius;
}

export function getShapeHorizontalExtent(shape) {
  if (shape.kind === 'box') return shape.size / 2;
  return shape.radius;
}

export function getShapeDefinition(id) {
  return SHAPE_DEFINITIONS.find((shape) => shape.id === id);
}

export function shuffle(items, random = Math.random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}
