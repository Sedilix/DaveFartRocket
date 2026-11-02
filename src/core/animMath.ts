/** Frame-rate independent exponential smoothing toward a target. */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return target + (current - target) * Math.exp(-rate * dt);
}

/** Same as damp, but takes the shortest way around the circle. */
export function dampAngle(current: number, target: number, rate: number, dt: number): number {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + diff * (1 - Math.exp(-rate * dt));
}
