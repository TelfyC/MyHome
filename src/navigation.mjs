// Pure navigation geometry is shared by the renderer and regression tests.
export function pointInPolygon(x, z, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i], [xj, zj] = polygon[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
export function circleHitsBox(x, z, radius, box) {
  const dx = x - Math.max(box.minX, Math.min(x, box.maxX));
  const dz = z - Math.max(box.minZ, Math.min(z, box.maxZ));
  return dx * dx + dz * dz < radius * radius;
}
export function canOccupy(x, z, polygon, colliders, radius = .18) {
  return pointInPolygon(x, z, polygon) && !colliders.some(box => circleHitsBox(x, z, radius, box));
}
export function moveWithCollision(position, dx, dz, polygon, colliders, radius = .18) {
  let {x,z} = position;
  // Substeps prevent tunnelling through glass or thin walls at low frame rates.
  const steps = Math.max(1, Math.ceil(Math.hypot(dx,dz) / (radius * .5)));
  for (let i=0; i<steps; i++) {
    if (canOccupy(x+dx/steps,z,polygon,colliders,radius)) x+=dx/steps;
    if (canOccupy(x,z+dz/steps,polygon,colliders,radius)) z+=dz/steps;
  }
  return {x,z};
}
