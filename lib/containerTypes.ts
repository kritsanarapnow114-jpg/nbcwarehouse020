// Container / packaging form each product is stored as on the warehouse floor.
// Client-safe (no server imports) so both the product form and the map can use it.
export type ContainerTypeDef = {
  code: string;
  en: string;
  th: string;
  color: string; // fill hue on the storage map (distinct from the free-slot green)
};

export const CONTAINER_TYPES: ContainerTypeDef[] = [
  { code: "IBC", en: "IBC", th: "IBC (ถังพลาสติกกรง)", color: "#2f6fd0" },
  { code: "SUPERSACK", en: "Supersack", th: "ซุปเปอร์แซค", color: "#8a5cd8" },
  { code: "BOX", en: "Box", th: "กล่อง", color: "#e08a2b" },
  { code: "OCTABIN", en: "Octabin", th: "ออคตาบิน", color: "#b7671a" },
  { code: "BAG", en: "Bag on pallet", th: "ถุงวางพาเลท", color: "#d059a3" },
  { code: "DRUM", en: "Drum", th: "ถัง (Drum)", color: "#3f9aa8" },
  { code: "OTHER", en: "Other", th: "อื่นๆ", color: "#8a94a6" },
];

export const CONTAINER_LABEL: Record<string, ContainerTypeDef> = Object.fromEntries(
  CONTAINER_TYPES.map((t) => [t.code, t])
);

export const CONTAINER_CODES = CONTAINER_TYPES.map((t) => t.code);

export function containerDef(code: string | null | undefined): ContainerTypeDef {
  return (code && CONTAINER_LABEL[code]) || CONTAINER_LABEL.OTHER;
}
