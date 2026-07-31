/** Round to 3 decimals to avoid float dust in bag/remaining math. */
export function r3(n: number) {
  return Math.round(n * 1000) / 1000;
}

export type BagSlot = { bagNo: number; size: number; isPartial: boolean };

/**
 * Split a staged quantity into individual bags of the standard pallet size, with
 * a final smaller "partial" bag for the remainder. If no pallet size is known,
 * the whole quantity is a single partial bag.
 */
export function splitBags(qtyStaged: number, palletSize: number | null | undefined): BagSlot[] {
  const p = palletSize && palletSize > 0 ? palletSize : 0;
  if (p <= 0) return [{ bagNo: 1, size: r3(qtyStaged), isPartial: true }];
  const full = Math.floor(r3(qtyStaged / p));
  const bags: BagSlot[] = [];
  for (let i = 0; i < full; i++) bags.push({ bagNo: i + 1, size: p, isPartial: false });
  const rem = r3(qtyStaged - full * p);
  if (rem > 0.0001) bags.push({ bagNo: full + 1, size: rem, isPartial: true });
  if (bags.length === 0) bags.push({ bagNo: 1, size: r3(qtyStaged), isPartial: true });
  return bags;
}

/** Size (kg) of a specific bag slot of a staged item. */
export function bagSize(qtyStaged: number, palletSize: number | null | undefined, bagNo: number): number {
  return splitBags(qtyStaged, palletSize).find((b) => b.bagNo === bagNo)?.size ?? 0;
}
