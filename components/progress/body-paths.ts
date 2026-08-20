// Silhouette geometry for the muscle heat map (issue #299). Deliberately a
// schematic, not an anatomy atlas: the neutral outline is a handful of soft
// shapes, and every paintable region is a plain ellipse path keyed by the
// region ids in lib/muscle-map.ts. Both views share the 200x420 viewBox.

export const BODY_VIEWBOX = '0 0 200 420';

// Ellipse as path data, so regions render as <path> and stay easy to swap for
// hand-drawn outlines later.
function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  return `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${-rx * 2} 0 Z`;
}

// Vertical capsule (rounded-ended limb segment).
function capsule(cx: number, top: number, bottom: number, r: number): string {
  return `M ${cx - r} ${top} a ${r} ${r} 0 0 1 ${r * 2} 0 L ${cx + r} ${bottom} a ${r} ${r} 0 0 1 ${-r * 2} 0 Z`;
}

// The neutral body drawn under the regions; identical for front and back.
export const BODY_OUTLINE_PATHS: readonly string[] = [
  ellipse(100, 26, 16, 17), // head
  capsule(100, 42, 56, 7), // neck
  // Torso: shoulders tapering to the waist, then the hips.
  'M 60 66 Q 100 52 140 66 L 133 172 L 127 210 L 73 210 L 67 172 Z',
  capsule(44, 72, 194, 10), // left arm
  capsule(156, 72, 194, 10), // right arm
  capsule(82, 212, 402, 16), // left leg
  capsule(118, 212, 402, 16), // right leg
];

// Paintable regions per view, keyed by the ids MUSCLE_REGIONS references.
export const REGION_PATHS: Record<'front' | 'back', Record<string, string>> = {
  front: {
    'delt-front-left': ellipse(57, 78, 11, 9),
    'delt-front-right': ellipse(143, 78, 11, 9),
    'delt-side-left': ellipse(42, 86, 7, 11),
    'delt-side-right': ellipse(158, 86, 7, 11),
    'chest-left': ellipse(82, 102, 17, 13),
    'chest-right': ellipse(118, 102, 17, 13),
    'biceps-left': ellipse(44, 124, 9, 16),
    'biceps-right': ellipse(156, 124, 9, 16),
    'forearm-left': ellipse(44, 168, 8, 18),
    'forearm-right': ellipse(156, 168, 8, 18),
    abs: ellipse(100, 146, 16, 25),
    'quad-left': ellipse(82, 262, 14, 38),
    'quad-right': ellipse(118, 262, 14, 38),
  },
  back: {
    'delt-rear-left': ellipse(57, 78, 11, 9),
    'delt-rear-right': ellipse(143, 78, 11, 9),
    'traps-mid': ellipse(100, 94, 16, 19),
    'lat-left': ellipse(80, 132, 15, 26),
    'lat-right': ellipse(120, 132, 15, 26),
    'triceps-left': ellipse(44, 124, 9, 16),
    'triceps-right': ellipse(156, 124, 9, 16),
    'lower-back': ellipse(100, 174, 12, 14),
    'glute-left': ellipse(84, 216, 15, 16),
    'glute-right': ellipse(116, 216, 15, 16),
    'ham-left': ellipse(82, 276, 13, 32),
    'ham-right': ellipse(118, 276, 13, 32),
    'calf-left': ellipse(82, 350, 10, 22),
    'calf-right': ellipse(118, 350, 10, 22),
  },
};
