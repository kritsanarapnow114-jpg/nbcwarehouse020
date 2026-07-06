/**
 * FEFO (First-Expired-First-Out) lot selection for Issue.
 * Lots on QC hold are never eligible. Lots with no expiry date sort last.
 * Ties are broken by location code ascending.
 */

export type FefoLot = {
  id: string;
  lotNo: string;
  qty: number;
  status: "OK" | "QC";
  expDate: Date | null;
  locationCode: string;
};

export function fefoSort<T extends FefoLot>(lots: T[]): T[] {
  return [...lots].sort((a, b) => {
    const ae = a.expDate ? a.expDate.getTime() : Number.POSITIVE_INFINITY;
    const be = b.expDate ? b.expDate.getTime() : Number.POSITIVE_INFINITY;
    if (ae !== be) return ae - be;
    return a.locationCode.localeCompare(b.locationCode);
  });
}

/** Lots eligible for issue: not on QC hold, has remaining qty. FEFO-ordered. */
export function eligibleLots<T extends FefoLot>(lots: T[]): T[] {
  return fefoSort(lots.filter((l) => l.status !== "QC" && l.qty > 0));
}

export function fefoLotFor<T extends FefoLot>(lots: T[]): T | null {
  return eligibleLots(lots)[0] ?? null;
}

export type FifoLot = {
  id: string;
  lotNo: string;
  qty: number;
  status: "OK" | "QC";
  recvDate: Date;
};

/** FIFO (First-In-First-Out): eligible lots ordered by received date ascending
 *  (oldest first). Used for BOM material consumption — those materials have no
 *  expiry and should be drawn oldest-stock-first. */
export function fifoLots<T extends FifoLot>(lots: T[]): T[] {
  return [...lots]
    .filter((l) => l.status !== "QC" && l.qty > 0)
    .sort((a, b) => {
      const d = a.recvDate.getTime() - b.recvDate.getTime();
      return d !== 0 ? d : a.lotNo.localeCompare(b.lotNo);
    });
}
