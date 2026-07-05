/**
 * Storage area / capacity math.
 * A product's width x length is the floor footprint of ONE PALLET of that
 * product (not of a single kg/pc). So area per base unit (kg/pc) =
 * (width x length) / (palletSize x stackLevels) -- a full pallet load
 * occupies one footprint, stacking lets multiple pallets share that
 * footprint vertically.
 * Bin capacity = width x length (stacking does not change bin capacity
 * itself, only how much floor-footprint one unit of a given product
 * consumes).
 *
 * Two independent color-threshold scales are used on purpose (per design spec):
 *  - bin's own status badge: Full >=95%, Near full >=80%, else OK
 *  - zone/total utilization bar fill: red >=85%, amber >=70%, else green
 */

export function areaPerUnit(
  width: number,
  length: number,
  stackLevels: number,
  palletSize: number
): number {
  return (width * length) / (Math.max(1, stackLevels) * Math.max(1, palletSize));
}

export function binCapacity(width: number, length: number): number {
  return width * length;
}

export function occupancyPct(usedArea: number, capArea: number): number {
  return capArea > 0 ? (usedArea / capArea) * 100 : 0;
}

export type BinTone = "empty" | "qc" | "expired" | "full" | "near" | "ok";

export function binStatusTone(opts: {
  empty: boolean;
  hasQcHold: boolean;
  hasExpired: boolean;
  pctOccupied: number;
}): BinTone {
  if (opts.empty) return "empty";
  if (opts.hasQcHold) return "qc";
  if (opts.hasExpired) return "expired";
  if (opts.pctOccupied >= 95) return "full";
  if (opts.pctOccupied >= 80) return "near";
  return "ok";
}

export type BarTone = "red" | "amber" | "green";

export function occupancyBarTone(pct: number): BarTone {
  if (pct >= 85) return "red";
  if (pct >= 70) return "amber";
  return "green";
}

export const BAR_TONE_COLOR: Record<BarTone, string> = {
  red: "#d24141",
  amber: "#e59a2b",
  green: "#3E9B6E",
};
