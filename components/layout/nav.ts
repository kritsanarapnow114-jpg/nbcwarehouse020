export type NavItem = {
  key: string;
  href: string;
  icon: string;
  en: string;
  th: string;
};

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", href: "/dashboard", icon: "▤", en: "Dashboard", th: "แดชบอร์ด" },
  { key: "products", href: "/products", icon: "▦", en: "Products", th: "รายการสินค้า" },
  { key: "aging", href: "/aging", icon: "◔", en: "Inventory Aging", th: "อายุคงเหลือ" },
  { key: "locations", href: "/locations", icon: "▧", en: "Locations", th: "ที่จัดเก็บ" },
  { key: "map", href: "/map", icon: "▨", en: "Map Location", th: "แผนผังคลัง" },
  { key: "receive", href: "/receive", icon: "▼", en: "Receive", th: "รับสินค้า" },
  { key: "pack", href: "/pack", icon: "▼", en: "Pack Order", th: "รับจากผลิต" },
  { key: "po", href: "/po", icon: "◫", en: "Purchase Order", th: "ใบสั่งซื้อ" },
  { key: "plan", href: "/plan", icon: "◰", en: "Packaging Plan", th: "แผนสั่งบรรจุภัณฑ์" },
  { key: "issue", href: "/issue", icon: "▲", en: "Issue", th: "จ่ายสินค้า" },
  { key: "adjust", href: "/adjust", icon: "◆", en: "Adjust", th: "ปรับปรุงสต็อก" },
  { key: "transfer", href: "/transfer", icon: "⇄", en: "Transfer", th: "ย้ายที่เก็บ" },
  { key: "count", href: "/count", icon: "☑", en: "Stock Count", th: "นับสต็อก" },
  { key: "nonstock", href: "/nonstock", icon: "◲", en: "Non-Stock", th: "แปลงเข้าสต็อก" },
  { key: "abc", href: "/abc", icon: "◧", en: "ABC Analysis", th: "วิเคราะห์ ABC" },
  { key: "reports", href: "/reports", icon: "▥", en: "Reports", th: "รายงานสรุป" },
  { key: "compare", href: "/compare", icon: "⇌", en: "Compare Periods", th: "เทียบช่วงเวลา" },
];

/** Sidebar sections: a big heading with its sub-items, so the long menu is
 *  easier to scan. Item keys reference NAV_ITEMS above. */
export type NavGroup = { key: string; en: string; th: string; items: string[] };

export const NAV_GROUPS: NavGroup[] = [
  { key: "overview", en: "Overview", th: "ภาพรวม", items: ["dashboard"] },
  {
    key: "inventory",
    en: "Inventory",
    th: "สินค้าคงคลัง",
    items: ["products", "aging", "locations", "map"],
  },
  {
    key: "operations",
    en: "Operations",
    th: "งานประจำวัน",
    items: ["receive", "pack", "po", "plan", "issue", "adjust", "transfer", "count", "nonstock"],
  },
  {
    key: "analytics",
    en: "Analytics & Reports",
    th: "วิเคราะห์ & รายงาน",
    items: ["abc", "reports", "compare"],
  },
];

export const PAGE_TITLES: Record<string, { title: string; sub: string }> = {
  "/dashboard": { title: "Dashboard", sub: "แดชบอร์ด · Warehouse overview" },
  "/products": { title: "Products", sub: "รายการสินค้า · Master catalog & on-hand" },
  "/aging": { title: "Inventory Aging", sub: "อายุคงเหลือ · Age & expiry risk" },
  "/locations": { title: "Locations", sub: "ที่จัดเก็บ · Bin capacity & utilization" },
  "/map": { title: "Map Location", sub: "แผนผังคลัง · ผังตำแหน่งจัดเก็บ · Rack ชั้น L1-L3 + พื้นวางซ้อน" },
  "/receive": { title: "Receive", sub: "รับสินค้า · Goods receipt (ตาม PO)" },
  "/pack": { title: "Pack Order", sub: "รับจากฝ่ายผลิต · SU + น้ำหนัก → รอตรวจสอบ → เข้าสต็อก" },
  "/po": { title: "Purchase Order", sub: "ใบสั่งซื้อ · PO tracking" },
  "/plan": { title: "Packaging Plan", sub: "แผนสั่งบรรจุภัณฑ์ · จากแผนการผลิต (MRP)" },
  "/issue": { title: "Issue", sub: "จ่ายสินค้า · FEFO outbound" },
  "/adjust": { title: "Adjust", sub: "ปรับปรุงสต็อก · Stock adjustment" },
  "/transfer": { title: "Transfer", sub: "ย้ายที่เก็บ · Bin-to-bin transfer" },
  "/count": { title: "Stock Count", sub: "นับสต็อก · Cycle count" },
  "/nonstock": { title: "Non-Stock", sub: "แปลงเข้าสต็อก · Non-Stock holdings → convert to Stock" },
  "/abc": { title: "ABC Analysis", sub: "วิเคราะห์ ABC · Pareto by value (A/B/C)" },
  "/reports": { title: "Reports", sub: "รายงานสรุป · Receiving, Issuing, Loss, Production, PO, Transfer, Stock Card" },
  "/settings": { title: "Settings", sub: "ตั้งค่า · Data management" },
  "/search": { title: "Search", sub: "ค้นหา · สินค้า / PO / Invoice / SAP Material Document / Lot" },
  "/compare": { title: "Compare Periods", sub: "เทียบช่วงเวลา · เทียบข้อมูล 2 ช่วงเวลา (รับ/จ่าย/มูลค่า/ท็อป)" },
};
