"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LocationRow } from "@/lib/views/locations";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Modal, ModalHeader } from "@/components/ui/Modal";
import { Tone } from "@/components/ui/tone";
import { deleteLocationAction } from "@/lib/actions/locations";
import { showToast } from "@/components/ui/Toast";
import { EditLocationModal } from "./EditLocationModal";

const STATUS_BADGE: Record<LocationRow["tone"], { tone: Tone; label: string }> = {
  ok: { tone: "ok", label: "OK (ปกติ)" },
  qc: { tone: "warn", label: "QC Hold (ติด QC)" },
  expired: { tone: "danger", label: "Expired (หมดอายุ)" },
  full: { tone: "danger", label: "Full (เต็ม)" },
  near: { tone: "warn", label: "Near full (ใกล้เต็ม)" },
  empty: { tone: "neutral", label: "Empty (ว่าง)" },
};

function dotColor(c: LocationRow["contents"][number]): string {
  if (c.expired) return "#d24141";
  if (c.lotStatus === "QC") return "#e59a2b";
  return "#3E9B6E";
}

export function LocationsTable({ rows }: { rows: LocationRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<LocationRow | null>(null);
  const [editing, setEditing] = useState<LocationRow | null>(null);

  async function handleDelete(e: React.MouseEvent, row: LocationRow) {
    e.stopPropagation();
    if (!confirm(`Delete bin ${row.code}? (ลบที่เก็บนี้?)`)) return;
    try {
      await deleteLocationAction(row.code);
      showToast("Location deleted");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete location.");
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-[14px] border border-[#e7ebf1] bg-white shadow-[0_1px_2px_rgba(20,30,48,.04),0_6px_18px_rgba(20,30,48,.035)]">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#f7f9fb] text-left text-[#69748a]">
              <Th>Bin</Th>
              <Th>Zone</Th>
              <Th>Contents · Lot (สินค้าในช่อง)</Th>
              <Th align="right">Used / Cap (m²)</Th>
              <Th>Utilization</Th>
              <Th>Status (สถานะ)</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const badge = STATUS_BADGE[r.tone];
              return (
                <tr
                  key={r.code}
                  onClick={() => setSelected(r)}
                  className="cursor-pointer border-t border-[#eef1f5] align-top hover:bg-[#f7f9fb]"
                >
                  <Td className="font-num text-[12px] text-[#3a4658]">{r.code}</Td>
                  <Td className="text-[#69748a]">
                    Zone {r.zone}
                    <div className="text-[11px] text-[#9aa4b4]">{r.zoneLabel}</div>
                  </Td>
                  <Td>
                    {r.contents.length === 0 ? (
                      <span className="text-[#9aa4b4]">— empty (ว่าง) —</span>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {r.contents.map((c, i) => (
                          <div key={i} className="leading-tight">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="h-2 w-2 flex-none rounded-full"
                                style={{ background: dotColor(c) }}
                              />
                              <span className="font-medium">{c.nameEn}</span>
                              <span className="font-num text-[10.5px] text-[#9aa4b4]">
                                {c.productCode}
                              </span>
                              <span className="font-num text-[10.5px] text-[#9aa4b4]">
                                · {c.lotNo}
                              </span>
                            </div>
                            <div className="font-num pl-3.5 text-[11px] text-[#9aa4b4]">
                              {c.qty.toLocaleString()} {c.unit} · {c.area.toFixed(2)} m² (stack ×
                              {c.stackLevels})
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Td>
                  <Td align="right" className="font-num">
                    {r.usedArea.toFixed(1)} / {r.capArea.toFixed(1)}
                    <div className="text-[11px] text-[#9aa4b4]">
                      {r.width}×{r.length} m
                    </div>
                  </Td>
                  <Td>
                    <div className="w-[130px]">
                      <ProgressBar pct={r.pct} color={r.barColor} height={9} />
                      <div className="font-num mt-1 text-[11px] text-[#69748a]">{r.pct}%</div>
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </Td>
                  <Td align="center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        title="Edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(r);
                        }}
                        className="cursor-pointer border-0 bg-transparent text-[14px] text-[#69748a] hover:text-[#3a4658]"
                      >
                        ✎
                      </button>
                      <button
                        title="Delete"
                        onClick={(e) => handleDelete(e, r)}
                        className="cursor-pointer border-0 bg-transparent text-[15px] text-[#c2606f]"
                      >
                        🗑
                      </button>
                    </div>
                  </Td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-[#9aa4b4]">
                  No bins found (ไม่พบที่เก็บ)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} width={640}>
        {selected && (
          <>
            <ModalHeader
              title={
                <span>
                  <span className="font-num text-[12px] text-[#9aa4b4]">{selected.code}</span>{" "}
                  Zone {selected.zone} · Bin Contents
                </span>
              }
              onClose={() => setSelected(null)}
            />
            <div className="max-h-[420px] overflow-auto px-5 py-3">
              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr className="text-left text-[#9aa4b4]">
                    <th className="py-2 font-medium">Material Description</th>
                    <th className="py-2 font-medium">SAP Material Master</th>
                    <th className="py-2 font-medium">Lot</th>
                    <th className="py-2 text-right font-medium">Qty</th>
                    <th className="py-2 text-right font-medium">Area (m²)</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.contents.map((c, i) => (
                    <tr key={i} className="border-t border-[#eef1f5]">
                      <td className="py-2 font-medium">{c.nameEn}</td>
                      <td className="font-num py-2">{c.productCode}</td>
                      <td className="font-num py-2">{c.lotNo}</td>
                      <td className="font-num py-2 text-right">
                        {c.qty.toLocaleString()} {c.unit}
                      </td>
                      <td className="font-num py-2 text-right">{c.area.toFixed(2)}</td>
                    </tr>
                  ))}
                  {selected.contents.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-[#9aa4b4]">
                        Empty bin (ว่าง)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Modal>

      {editing && (
        <EditLocationModal location={editing} open={!!editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function Th({
  children,
  align = "left",
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`p-[11px_16px] text-[11.5px] font-medium ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  className = "",
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  return (
    <td
      className={`p-[12px_16px] ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} ${className}`}
    >
      {children}
    </td>
  );
}
