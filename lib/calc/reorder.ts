// Min/Max (reorder point / stock ceiling) status for a product.
// A level of 0 means "not set".
export type ReorderStatus = "low" | "over" | "ok" | "none";

export function reorderStatus(onHand: number, minQty: number, maxQty: number): ReorderStatus {
  if (minQty <= 0 && maxQty <= 0) return "none";
  if (minQty > 0 && onHand < minQty) return "low";
  if (maxQty > 0 && onHand > maxQty) return "over";
  return "ok";
}

export const REORDER_LABEL: Record<ReorderStatus, string> = {
  low: "Low · ต่ำกว่า Min",
  over: "Over · เกิน Max",
  ok: "OK · ปกติ",
  none: "—",
};

export const REORDER_COLOR: Record<ReorderStatus, { bg: string; text: string }> = {
  low: { bg: "#fbe9e9", text: "#c53f3f" },
  over: { bg: "#fff2df", text: "#b5790f" },
  ok: { bg: "#e4f4f8", text: "#0e8ea6" },
  none: { bg: "#eef1f5", text: "#9aa4b4" },
};
