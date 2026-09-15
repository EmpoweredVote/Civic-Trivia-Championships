/**
 * Scene props: things that are not figures but stand on the same floor.
 *
 * Drawn by BobitField in the same pass as the figures so a bobit can walk in front of one.
 * Geometry is in the same rig units figures use, so a prop and a figure at the same `scale`
 * agree about how big the world is.
 */

/**
 * Barrel length in rig units, from the pivot. The muzzle is at its far end.
 *
 * SIZED BY SCREENSHOT, 2026-09-14. The first pass used 96/17/26, which is roughly a person's
 * arm span -- on the band, against a 42px bobit, it rendered as a dark speck you had to look
 * for. A cannon that fires a person should be bigger than the person, and the joke needs to be
 * legible at a glance, so it is about 1.5x a figure now.
 */
const BARREL_LEN = 150;
const BARREL_R = 26;
const WHEEL_R = 40;

/**
 * Where the barrel's mouth is, in field px.
 *
 * The cannon fires FROM here, so a flight has to start here -- otherwise the bobit appears out
 * of thin air beside the muzzle, which is precisely the thing the scene is trying not to do.
 */
export function cannonMuzzle(
  x: number, groundY: number, scale: number, angle: number, flip = false,
) {
  const a = (angle * Math.PI) / 180;
  const dir = flip ? -1 : 1;
  const pivotY = groundY - WHEEL_R * scale;
  return {
    x: x + dir * Math.cos(a) * BARREL_LEN * scale,
    y: pivotY + Math.sin(a) * BARREL_LEN * scale,
  };
}

/**
 * A stubby cartoon cannon: a wheel, a barrel on a pivot, and a firing knob on the breech.
 *
 * `angle` is degrees from horizontal, NEGATIVE being nose-up, which matches `cannonMuzzle` --
 * the two must agree or the shot leaves from somewhere other than the barrel.
 */
export function drawCannon(
  ctx: CanvasRenderingContext2D,
  x: number, groundY: number, scale: number, angle: number, flip = false,
  color = '#3F4854',
) {
  const a = (angle * Math.PI) / 180;
  const dir = flip ? -1 : 1;

  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(dir * scale, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // wheel
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, -WHEEL_R, WHEEL_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#AAB2BF';
  ctx.beginPath();
  ctx.arc(0, -WHEEL_R, WHEEL_R * 0.34, 0, Math.PI * 2);
  ctx.fill();

  // barrel, pivoted at the axle
  ctx.save();
  ctx.translate(0, -WHEEL_R);
  ctx.rotate(a);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-14, -BARREL_R);
  ctx.lineTo(BARREL_LEN, -BARREL_R * 0.8);
  ctx.lineTo(BARREL_LEN, BARREL_R * 0.8);
  ctx.lineTo(-14, BARREL_R);
  ctx.closePath();
  ctx.fill();
  // muzzle ring
  ctx.fillStyle = '#AAB2BF';
  ctx.beginPath();
  ctx.ellipse(BARREL_LEN, 0, BARREL_R * 0.34, BARREL_R * 0.86, 0, 0, Math.PI * 2);
  ctx.fill();
  // firing knob on the breech
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(-18, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}
