import {AtomCoords} from "../models/data.model";

export function crossProduct(a: AtomCoords, b: AtomCoords): AtomCoords {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

export function dotProduct(a: AtomCoords, b: AtomCoords): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function norm(a: AtomCoords): number {
  return Math.sqrt(Math.pow(a.x, 2) + Math.pow(a.y, 2) + Math.pow(a.z, 2));
}

export function vectorDiff(a: AtomCoords, b: AtomCoords): AtomCoords {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z
  };
}

export function dihedralAngle(r1: AtomCoords, r2: AtomCoords, r3: AtomCoords, r4: AtomCoords): number {
  let u1 = vectorDiff(r1, r2);
  let u2 = vectorDiff(r2, r3);
  let u3 = vectorDiff(r3, r4);
  let y = norm(u2) * dotProduct(u1, crossProduct(u2, u3));
  let x = dotProduct(crossProduct(u1, u2), crossProduct(u2, u3));
  return -Math.atan2(y, x);
}

const rad2degConst = 180 / Math.PI;
export function rad2deg(rad: number): number {
  return rad * rad2degConst;
}
