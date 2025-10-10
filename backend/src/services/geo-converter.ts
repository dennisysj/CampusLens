// geo-convert-370.ts
import Decimal from "decimal.js";

/**
 * Geo converter using Decimal for high-precision ECEF math.
 * Default origin height (h0) is set to 370 meters (user-provided).
 *
 * Usage:
 *   import { enuOffsetToGeodetic } from './geo-convert-370';
 *   const result = enuOffsetToGeodetic(49.25, -123.1, 5, 10, 0);
 *   console.log(result); // { lat, lon, h }
 */

type DecimalInstance = InstanceType<typeof Decimal>;

/* ---------- Types ---------- */
export interface Geodetic {
  lat: number; // degrees
  lon: number; // degrees
  h: number;   // meters (ellipsoidal)
}

export interface Ecef {
  X: DecimalInstance;
  Y: DecimalInstance;
  Z: DecimalInstance;
}

/* ---------- WGS84 constants (Decimal) ---------- */
const a = new Decimal(6378137.0); // semi-major axis (m)
const f = new Decimal(1).div(new Decimal(298.257223563)); // flattening
const e2 = f.times(new Decimal(2).minus(f)); // eccentricity^2

/* ---------- Helpers (deg <-> rad) ---------- */
const deg2rad = (deg: number) => (deg * Math.PI) / 180.0;
const rad2deg = (rad: number) => (rad * 180.0) / Math.PI;

/* ---------- Geodetic -> ECEF ---------- */
export function geodeticToEcef(latRad: number, lonRad: number, h: number): Ecef {
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinLon = Math.sin(lonRad);
  const cosLon = Math.cos(lonRad);

  const sinLatSq = new Decimal(sinLat * sinLat);
  const denom = new Decimal(1).minus(e2.times(sinLatSq));
  const N = a.div(denom.sqrt()); // prime vertical radius (Decimal)

  const NplusH = N.plus(new Decimal(h));

  const X = NplusH.times(cosLat * cosLon);
  const Y = NplusH.times(cosLat * sinLon);
  const Z = N.times(new Decimal(1).minus(e2)).plus(new Decimal(h)).times(sinLat);

  return { X, Y, Z };
}

/* ---------- ENU -> ECEF delta ---------- */
export function enuToEcefDelta(
  e: number,
  n: number,
  u: number,
  latRad: number,
  lonRad: number
): { dX: DecimalInstance; dY: DecimalInstance; dZ: DecimalInstance } {
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinLon = Math.sin(lonRad);
  const cosLon = Math.cos(lonRad);

  const dX = new Decimal(-sinLon * e)
    .minus(new Decimal(sinLat * cosLon).times(n))
    .plus(new Decimal(cosLat * cosLon).times(u));

  const dY = new Decimal(cosLon * e)
    .minus(new Decimal(sinLat * sinLon).times(n))
    .plus(new Decimal(cosLat * sinLon).times(u));

  const dZ = new Decimal(cosLat * n).plus(new Decimal(sinLat * u));

  return { dX, dY, dZ };
}

/* ---------- ECEF -> Geodetic (iterative) ---------- */
export function ecefToGeodetic(X: DecimalInstance, Y: DecimalInstance, Z: DecimalInstance, tol: number = 1e-12): Geodetic {
  // Convert to Number for trig computations
  const Xnum = X.toNumber();
  const Ynum = Y.toNumber();
  const Znum = Z.toNumber();

  const lonRad = Math.atan2(Ynum, Xnum); // Number (radians)

  // p = sqrt(X^2 + Y^2) as Decimal
  const p = X.pow(2).plus(Y.pow(2)).sqrt();

  // initial lat guess (Number)
  let pnum = p.toNumber();
  let lat = Math.atan2(Znum, pnum * (1 - e2.toNumber()));
  let latPrev = lat + 10 * tol;

  // iterate until convergence
  while (Math.abs(lat - latPrev) > tol) {
    latPrev = lat;
    const sinLat = Math.sin(lat);
    const sinLatSq = sinLat * sinLat;

    // N = a / sqrt(1 - e2*sin^2(lat))  (Decimal)
    const N = a.div(new Decimal(1).minus(e2.times(new Decimal(sinLatSq))).sqrt());

    // h = p / cos(lat) - N  (Decimal)
    const cosLat = Math.cos(lat);
    const h = p.div(cosLat).minus(N);

    // ratio N/(N+h)
    const ratio = N.div(N.plus(h)).toNumber();

    pnum = p.toNumber();
    const denomFactor = 1 - e2.toNumber() * ratio;
    lat = Math.atan2(Znum, pnum * denomFactor);
  }

  // final N and h
  const sinLatFinal = Math.sin(lat);
  const Nfinal = a.div(new Decimal(1).minus(e2.times(new Decimal(sinLatFinal * sinLatFinal))).sqrt());
  const hFinal = p.div(Math.cos(lat)).minus(Nfinal);

  return {
    lat: rad2deg(lat),
    lon: rad2deg(lonRad),
    h: hFinal.toNumber(),
  };
}

/* ---------- Small-offset linear approx (fast) ---------- */
export function smallOffsetGeodetic(
  lat0Rad: number,
  lon0Rad: number,
  h0: number,
  e: number,
  n: number,
  u: number
): Geodetic {
  const sinLat = Math.sin(lat0Rad);
  const cosLat = Math.cos(lat0Rad);
  const sinLatSq = sinLat * sinLat;

  const N = a.div(new Decimal(1).minus(e2.times(new Decimal(sinLatSq))).sqrt());
  const M = a
    .times(new Decimal(1).minus(e2))
    .div(new Decimal(1).minus(e2.times(new Decimal(sinLatSq))).pow(1.5));

  const dlat = new Decimal(n).div(M.plus(new Decimal(h0)));
  const dlon = new Decimal(e).div(N.plus(new Decimal(h0))).div(cosLat);

  const latRad = lat0Rad + dlat.toNumber();
  const lonRad = lon0Rad + dlon.toNumber();
  const h = h0 + u;

  return {
    lat: rad2deg(latRad),
    lon: rad2deg(lonRad),
    h,
  };
}

/* ---------- High-level helpers (default h0 = 370 m) ---------- */

const DEFAULT_H0 = 370; // meters above sea level (user provided)

export function enuOffsetToGeodetic(
  originLatDeg: number,
  originLonDeg: number,
  e: number,
  n: number,
  u: number,
  h0: number = DEFAULT_H0
): Geodetic {
  const lat0Rad = deg2rad(originLatDeg);
  const lon0Rad = deg2rad(originLonDeg);

  const { X: X0, Y: Y0, Z: Z0 } = geodeticToEcef(lat0Rad, lon0Rad, h0);
  const { dX, dY, dZ } = enuToEcefDelta(e, n, u, lat0Rad, lon0Rad);

  const X = X0.plus(dX);
  const Y = Y0.plus(dY);
  const Z = Z0.plus(dZ);

  return ecefToGeodetic(X, Y, Z);
}

export function smallOffsetGeodeticWithDefaultH(
  originLatDeg: number,
  originLonDeg: number,
  e: number,
  n: number,
  u: number,
  h0: number = DEFAULT_H0
): Geodetic {
  return smallOffsetGeodetic(deg2rad(originLatDeg), deg2rad(originLonDeg), h0, e, n, u);
}

/* ---------- Debug helper: compare h0=0 vs h0=DEFAULT_H0 ---------- */
export function compareZeroVsDefaultH(
  originLatDeg: number,
  originLonDeg: number,
  e: number,
  n: number,
  u: number
) {
  const resDefault = enuOffsetToGeodetic(originLatDeg, originLonDeg, e, n, u, DEFAULT_H0);
  const resZero = enuOffsetToGeodetic(originLatDeg, originLonDeg, e, n, u, 0);
  return {
    defaultH: resDefault,
    zeroH: resZero,
    deltaLatMetersNorth: (resDefault.lat - resZero.lat) * (Math.PI / 180) * 6378137, // approx
    deltaLonMetersEast: (resDefault.lon - resZero.lon) * (Math.PI / 180) * 6378137 * Math.cos(deg2rad(originLatDeg)), // approx
  };
}

/* ---------- Example usage ---------- (uncomment to run)
const origin = { lat: 49.25, lon: -123.1 };
const enu = { e: 5.0, n: 10.0, u: 0.0 };

console.log('Accurate (default h=370):', enuOffsetToGeodetic(origin.lat, origin.lon, enu.e, enu.n, enu.u));
console.log('Approx (default h=370):', smallOffsetGeodeticWithDefaultH(origin.lat, origin.lon, enu.e, enu.n, enu.u));
console.log('Compare zero vs default H:', compareZeroVsDefaultH(origin.lat, origin.lon, enu.e, enu.n, enu.u));
*/


