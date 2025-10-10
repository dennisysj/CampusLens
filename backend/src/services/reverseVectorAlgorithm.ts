// compute-asset-vector-units.ts
import { geodeticToEcef, enuToEcefDelta } from "./geo-converter";
// compute-asset-vector-relative.ts
import Decimal from "decimal.js";

// Import these helpers from your existing geo-convert module:
// - geodeticToEcef(latRad, lonRad, h) -> { X: Decimal, Y: Decimal, Z: Decimal }
// - enuToEcefDelta(eMeters, nMeters, uMeters, latRad, lonRad) -> { dX: Decimal, dY: Decimal, dZ: Decimal }
// - ecefDeltaToEnu(dX, dY, dZ, latRad, lonRad) -> { e: Decimal, n: Decimal, u: Decimal } in meters

type Geo = { lat: number; lon: number; h?: number }; // degrees
type RelativeVec = { e: number; n: number; u: number }; // relative platform units
type DecimalInstance = InstanceType<typeof Decimal>;
type RelativeVecDecimal = { e: DecimalInstance; n: DecimalInstance; u: DecimalInstance };

const DEFAULT_H0 = 370;

/**
 * Converts an ECEF delta vector to ENU (East-North-Up) coordinates.
 * 
 * Given a vector in ECEF coordinates and a reference point (lat, lon),
 * this rotates the ECEF vector into the local ENU frame at that reference point.
 * 
 * @param dX - ECEF X component (Decimal)
 * @param dY - ECEF Y component (Decimal)
 * @param dZ - ECEF Z component (Decimal)
 * @param latRad - Reference latitude in radians (Decimal)
 * @param lonRad - Reference longitude in radians (Decimal)
 * @returns ENU vector { e, n, u } as Decimals
 */
export function ecefDeltaToEnu(
  dX: DecimalInstance,
  dY: DecimalInstance,
  dZ: DecimalInstance,
  latRad: number,
  lonRad: number
): { e: DecimalInstance; n: DecimalInstance; u: DecimalInstance } {
  // Compute trigonometric values using Math then wrap in Decimal
  const sinLat = new Decimal(Math.sin(latRad));
  const cosLat = new Decimal(Math.cos(latRad));
  const sinLon = new Decimal(Math.sin(lonRad));
  const cosLon = new Decimal(Math.cos(lonRad));

  // Rotation matrix from ECEF to ENU:
  // 
  // | e |   | -sinLon          cosLon           0      |   | dX |
  // | n | = | -sinLat*cosLon  -sinLat*sinLon   cosLat |   | dY |
  // | u |   |  cosLat*cosLon   cosLat*sinLon   sinLat |   | dZ |

  // East component
  const e = sinLon.neg().times(dX).plus(cosLon.times(dY));

  // North component
  const n = sinLat.neg()
    .times(cosLon)
    .times(dX)
    .plus(sinLat.neg().times(sinLon).times(dY))
    .plus(cosLat.times(dZ));

  // Up component
  const u = cosLat
    .times(cosLon)
    .times(dX)
    .plus(cosLat.times(sinLon).times(dY))
    .plus(sinLat.times(dZ));

  return { e, n, u };
}


/**
 * Computes the placement vector for an asset relative to a user's position.
 * Works purely in relative coordinates - no unit conversion needed.
 * 
 * The idea: 
 * 1. Use GPS to find the absolute positions (in meters via ECEF)
 * 2. Calculate the user→asset vector in meters
 * 3. Scale this vector to match the SAME RELATIVE SCALE as the creator→asset vector
 * 
 * @param creator - GPS location where asset was created { lat, lon, h? } in degrees
 * @param user - GPS location of current user { lat, lon, h? } in degrees
 * @param vCA_relative - Vector from creator to asset in relative platform units { e, n, u }
 * @returns Vector to place asset relative to user, in the same relative scale
 */
export function computeAssetPlacementVector(
  creator: Geo,
  user: Geo,
  vCA_relative: RelativeVec
): RelativeVec {
  // Validation
  if (!isFinite(creator.lat) || !isFinite(creator.lon) || 
      !isFinite(user.lat) || !isFinite(user.lon)) {
    throw new Error("Invalid lat/lon.");
  }

  // Use default height if not provided
  const hC = typeof creator.h === "number" ? creator.h : DEFAULT_H0;
  const hU = typeof user.h === "number" ? user.h : DEFAULT_H0;

  // Convert degrees to radians using Number math
  const deg2rad = (deg: number) => (deg * Math.PI) / 180;
  const latC_rad = deg2rad(creator.lat);
  const lonC_rad = deg2rad(creator.lon);
  const latU_rad = deg2rad(user.lat);
  const lonU_rad = deg2rad(user.lon);

  // STEP 1: Convert creator→asset relative vector to Decimal (treat as meters for calculation)
  const vCA_m = {
    e: new Decimal(vCA_relative.e),
    n: new Decimal(vCA_relative.n),
    u: new Decimal(vCA_relative.u)
  };

  // STEP 2: Convert creator position to ECEF
  const Pc = geodeticToEcef(latC_rad, lonC_rad, hC);

  // STEP 3: Convert creator→asset vector to ECEF delta (treating relative units as meters)
  const delta_ca = enuToEcefDelta(
    vCA_m.e.toNumber(),
    vCA_m.n.toNumber(),
    vCA_m.u.toNumber(),
    latC_rad,
    lonC_rad
  );

  // STEP 4: Calculate asset's absolute ECEF position
  const Pa = {
    X: Pc.X.plus(delta_ca.dX),
    Y: Pc.Y.plus(delta_ca.dY),
    Z: Pc.Z.plus(delta_ca.dZ)
  };

  // STEP 5: Convert user position to ECEF
  const Pu = geodeticToEcef(latU_rad, lonU_rad, hU);

  // STEP 6: Compute user→asset vector in ECEF coordinates
  const d_ecef = {
    dX: Pa.X.minus(Pu.X),
    dY: Pa.Y.minus(Pu.Y),
    dZ: Pa.Z.minus(Pu.Z)
  };

  // STEP 7: Rotate ECEF vector into user's local ENU frame
  const enuResult = ecefDeltaToEnu(d_ecef.dX, d_ecef.dY, d_ecef.dZ, latU_rad, lonU_rad);

  // STEP 8: Return as relative coordinates (same scale as input)
  return {
    e: enuResult.e.toNumber(),
    n: enuResult.n.toNumber(),
    u: enuResult.u.toNumber()
  };
}

/**
 * Version with debug output showing intermediate calculations.
 */
export function computeAssetPlacementVectorWithDebug(
  creator: Geo,
  user: Geo,
  vCA_relative: RelativeVec
): {
  vectorRelative: RelativeVec;
  debug: {
    assetEcef: { X: string; Y: string; Z: string };
    userEcef: { X: string; Y: string; Z: string };
    vectorDecimal: { e: string; n: string; u: string };
  };
} {
  // Validation
  if (!isFinite(creator.lat) || !isFinite(creator.lon) || 
      !isFinite(user.lat) || !isFinite(user.lon)) {
    throw new Error("Invalid lat/lon.");
  }

  const hC = typeof creator.h === "number" ? creator.h : DEFAULT_H0;
  const hU = typeof user.h === "number" ? user.h : DEFAULT_H0;

  // Convert degrees to radians using Number math
  const deg2rad = (deg: number) => (deg * Math.PI) / 180;
  const latC_rad = deg2rad(creator.lat);
  const lonC_rad = deg2rad(creator.lon);
  const latU_rad = deg2rad(user.lat);
  const lonU_rad = deg2rad(user.lon);

  const vCA_m = {
    e: new Decimal(vCA_relative.e),
    n: new Decimal(vCA_relative.n),
    u: new Decimal(vCA_relative.u)
  };

  const Pc = geodeticToEcef(latC_rad, lonC_rad, hC);
  const delta_ca = enuToEcefDelta(
    vCA_m.e.toNumber(),
    vCA_m.n.toNumber(),
    vCA_m.u.toNumber(),
    latC_rad,
    lonC_rad
  );
  
  const Pa = {
    X: Pc.X.plus(delta_ca.dX),
    Y: Pc.Y.plus(delta_ca.dY),
    Z: Pc.Z.plus(delta_ca.dZ)
  };

  const Pu = geodeticToEcef(latU_rad, lonU_rad, hU);
  
  const d_ecef = {
    dX: Pa.X.minus(Pu.X),
    dY: Pa.Y.minus(Pu.Y),
    dZ: Pa.Z.minus(Pu.Z)
  };

  const enuResult = ecefDeltaToEnu(d_ecef.dX, d_ecef.dY, d_ecef.dZ, latU_rad, lonU_rad);

  const resultRelative: RelativeVec = {
    e: enuResult.e.toNumber(),
    n: enuResult.n.toNumber(),
    u: enuResult.u.toNumber()
  };

  return {
    vectorRelative: resultRelative,
    debug: {
      assetEcef: { 
        X: Pa.X.toString(), 
        Y: Pa.Y.toString(), 
        Z: Pa.Z.toString() 
      },
      userEcef: { 
        X: Pu.X.toString(), 
        Y: Pu.Y.toString(), 
        Z: Pu.Z.toString() 
      },
      vectorDecimal: {
        e: enuResult.e.toString(),
        n: enuResult.n.toString(),
        u: enuResult.u.toString()
      }
    }
  };
}

/**
 * Version that returns Decimal values directly.
 */
export function computeAssetPlacementVectorDecimal(
  creator: Geo,
  user: Geo,
  vCA_relative: RelativeVec
): RelativeVecDecimal {
  // Validation
  if (!isFinite(creator.lat) || !isFinite(creator.lon) || 
      !isFinite(user.lat) || !isFinite(user.lon)) {
    throw new Error("Invalid lat/lon.");
  }

  const hC = typeof creator.h === "number" ? creator.h : DEFAULT_H0;
  const hU = typeof user.h === "number" ? user.h : DEFAULT_H0;

  const deg2rad = (deg: number) => (deg * Math.PI) / 180;
  const latC_rad = deg2rad(creator.lat);
  const lonC_rad = deg2rad(creator.lon);
  const latU_rad = deg2rad(user.lat);
  const lonU_rad = deg2rad(user.lon);

  const vCA_m = {
    e: new Decimal(vCA_relative.e),
    n: new Decimal(vCA_relative.n),
    u: new Decimal(vCA_relative.u)
  };

  const Pc = geodeticToEcef(latC_rad, lonC_rad, hC);
  const delta_ca = enuToEcefDelta(
    vCA_m.e.toNumber(),
    vCA_m.n.toNumber(),
    vCA_m.u.toNumber(),
    latC_rad,
    lonC_rad
  );
  
  const Pa = {
    X: Pc.X.plus(delta_ca.dX),
    Y: Pc.Y.plus(delta_ca.dY),
    Z: Pc.Z.plus(delta_ca.dZ)
  };

  const Pu = geodeticToEcef(latU_rad, lonU_rad, hU);
  
  const d_ecef = {
    dX: Pa.X.minus(Pu.X),
    dY: Pa.Y.minus(Pu.Y),
    dZ: Pa.Z.minus(Pu.Z)
  };

  return ecefDeltaToEnu(d_ecef.dX, d_ecef.dY, d_ecef.dZ, latU_rad, lonU_rad);
}