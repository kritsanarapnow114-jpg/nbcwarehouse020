export type Tone = "ok" | "warn" | "danger" | "neutral" | "accent";

export const TONE_COLORS: Record<Tone, { bg: string; text: string }> = {
  ok: { bg: "#e5f4ec", text: "#17935a" },
  warn: { bg: "#fbf1df", text: "#b5790f" },
  danger: { bg: "#fbe9e9", text: "#c53f3f" },
  neutral: { bg: "#eef1f5", text: "#69748a" },
  accent: { bg: "#e7f3ec", text: "#3E9B6E" },
};

export const CATEGORY_COLORS: Record<string, string> = {
  RAW_MATERIAL: "#4c8c4a",
  PACKAGING: "#7ca86b",
  FINISHED_GOODS: "#c08a3e",
  SPARE_PARTS: "#a8917a",
};
export const CATEGORY_COLOR_FALLBACK = "#8b93a4";

export const CATEGORY_LABEL: Record<string, { en: string; th: string }> = {
  RAW_MATERIAL: { en: "Raw Material", th: "วัตถุดิบ" },
  PACKAGING: { en: "Packaging", th: "บรรจุภัณฑ์" },
  FINISHED_GOODS: { en: "Finished Goods", th: "สินค้าสำเร็จรูป" },
  SPARE_PARTS: { en: "Spare Parts", th: "อะไหล่" },
};

export const ZONE_LABEL: Record<string, string> = {
  A: "Dry raw material",
  B: "Liquids",
  C: "Packaging",
  D: "Finished goods",
  E: "Spare parts",
};

export const MOVEMENT_TYPE_TONE: Record<string, Tone> = {
  Receive: "ok",
  Issue: "danger",
  Adjust: "accent",
  Transfer: "ok",
  Opening: "neutral",
};
