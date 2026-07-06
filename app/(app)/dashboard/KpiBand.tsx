"use client";

import { useEffect, useState, useActionState } from "react";
import { KpiResult } from "@/lib/calc/kpi";
import { Modal, ModalHeader } from "@/components/ui/Modal";
import { buttonClass } from "@/components/ui/Button";
import {
  getKpiLogsAction,
  addKpiLogAction,
  getQualityBreakdownAction,
  getAccuracyBreakdownAction,
  getRecentIssueDocsAction,
  AddKpiLogState,
} from "@/lib/actions/kpi";
import { fmtDateBE } from "@/lib/calc/date";

export function KpiBand({ kpis }: { kpis: KpiResult[] }) {
  const [openKey, setOpenKey] = useState<KpiResult["key"] | null>(null);
  const active = kpis.find((k) => k.key === openKey) ?? null;

  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {kpis.map((k) => (
        <button
          key={k.key}
          onClick={() => setOpenKey(k.key)}
          className="relative rounded-[14px] border border-[#e7ebf1] bg-white p-[15px_16px] text-left shadow-[0_1px_2px_rgba(20,30,48,.04),0_6px_18px_rgba(20,30,48,.045)]"
        >
          <span className="absolute right-3.5 top-3 text-[12px] text-[#c2ccd6]">
            ✎
          </span>
          <div className="mb-2 flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: k.tone === "ok" ? "#3E9B6E" : "#e59a2b" }}
            />
            <span className="text-[11px] leading-tight text-[#69748a]">
              {k.label} ({k.th})
            </span>
          </div>
          <div
            className="font-num text-[20px] font-bold"
            style={{ color: k.tone === "ok" ? "#16202e" : "#c9821f" }}
          >
            {k.value}
          </div>
          <div className="mt-1.5 text-[10px] text-[#9aa4b4]">
            {k.target} · {k.sub}
          </div>
        </button>
      ))}

      {active && active.loggable && (
        <KpiLogModal kpi={active} onClose={() => setOpenKey(null)} />
      )}
      {active && !active.loggable && active.key === "quality" && (
        <QualityModal onClose={() => setOpenKey(null)} />
      )}
      {active && !active.loggable && active.key === "accuracy" && (
        <AccuracyModal onClose={() => setOpenKey(null)} />
      )}
    </div>
  );
}

type Log = {
  id: string;
  date: string;
  detail: string | null;
  amount: number | null;
  incident: boolean | null;
  issueDocNo: string | null;
  onTime: boolean | null;
};

function KpiLogModal({ kpi, onClose }: { kpi: KpiResult; onClose: () => void }) {
  const [logs, setLogs] = useState<Log[] | null>(null);
  const [issueDocs, setIssueDocs] = useState<string[]>([]);
  const keyUpper = kpi.key.toUpperCase() as "SAFETY" | "COST" | "DELIVERY";

  useEffect(() => {
    getKpiLogsAction(keyUpper).then(setLogs);
    if (keyUpper === "DELIVERY") getRecentIssueDocsAction().then(setIssueDocs);
  }, [keyUpper]);

  const [, formAction, pending] = useActionState<AddKpiLogState, FormData>(
    async (prev, fd) => {
      const res = await addKpiLogAction(prev, fd);
      if (!res.error) getKpiLogsAction(keyUpper).then(setLogs);
      return res;
    },
    {}
  );

  return (
    <Modal open onClose={onClose} width={560}>
      <ModalHeader title={`${kpi.label} (${kpi.th}) — log`} onClose={onClose} />
      <div className="px-5 py-4">
        <div className="mb-3 text-[12px] text-[#69748a]">
          {kpi.target}. Current: <b>{kpi.value}</b> · {kpi.sub}
        </div>
        <form action={formAction} className="mb-4 flex flex-wrap items-end gap-2 rounded-[10px] bg-[#f7f9fb] p-3">
          <input type="hidden" name="key" value={keyUpper} />
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-[#69748a]">Date</span>
            <input type="date" name="date" required className={inputClass} />
          </label>
          {keyUpper === "SAFETY" && (
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-[11px] text-[#69748a]">Incident detail</span>
              <input name="detail" required className={inputClass} />
            </label>
          )}
          {keyUpper === "COST" && (
            <>
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-[11px] text-[#69748a]">Detail</span>
                <input name="detail" required className={inputClass} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-[#69748a]">Amount (฿)</span>
                <input name="amount" type="number" required className={`${inputClass} w-[110px]`} />
              </label>
            </>
          )}
          {keyUpper === "DELIVERY" && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-[#69748a]">Issue doc</span>
                <input
                  name="issueDocNo"
                  list="issueDocs"
                  required
                  className={`${inputClass} w-[150px]`}
                />
                <datalist id="issueDocs">
                  {issueDocs.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-[#69748a]">On-time?</span>
                <select name="onTime" className={inputClass}>
                  <option value="true">On-time</option>
                  <option value="false">Late</option>
                </select>
              </label>
            </>
          )}
          <button type="submit" disabled={pending} className={buttonClass("primary")}>
            + Add
          </button>
        </form>

        <div className="max-h-[260px] overflow-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="text-left text-[#9aa4b4]">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Detail</th>
                <th className="pb-2 text-right font-medium">—</th>
              </tr>
            </thead>
            <tbody>
              {(logs ?? []).map((l) => (
                <tr key={l.id} className="border-t border-[#eef1f5]">
                  <td className="font-num py-2">{fmtDateBE(new Date(l.date))}</td>
                  <td className="py-2">
                    {keyUpper === "SAFETY" && l.detail}
                    {keyUpper === "COST" && l.detail}
                    {keyUpper === "DELIVERY" && `Issue ${l.issueDocNo}`}
                  </td>
                  <td className="font-num py-2 text-right">
                    {keyUpper === "COST" && l.amount != null ? `฿${l.amount.toLocaleString()}` : ""}
                    {keyUpper === "DELIVERY" && (l.onTime ? "On-time" : "Late")}
                  </td>
                </tr>
              ))}
              {logs && logs.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-[#9aa4b4]">
                    No entries yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

function QualityModal({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<
    { date: string; doc: string; produced: number; loss: number; yieldPct: number }[] | null
  >(null);
  useEffect(() => {
    getQualityBreakdownAction().then(setRows);
  }, []);
  return (
    <Modal open onClose={onClose} width={560}>
      <ModalHeader title="Quality (คุณภาพ) — production yield" onClose={onClose} />
      <div className="max-h-[400px] overflow-auto px-5 py-4">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="text-left text-[#9aa4b4]">
              <th className="pb-2 font-medium">Date</th>
              <th className="pb-2 font-medium">Doc</th>
              <th className="pb-2 text-right font-medium">Produced</th>
              <th className="pb-2 text-right font-medium">Loss</th>
              <th className="pb-2 text-right font-medium">Yield</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.doc} className="border-t border-[#eef1f5]">
                <td className="font-num py-2">{fmtDateBE(new Date(r.date))}</td>
                <td className="font-num py-2">{r.doc}</td>
                <td className="font-num py-2 text-right">{r.produced.toLocaleString()}</td>
                <td className="font-num py-2 text-right">{r.loss.toLocaleString()}</td>
                <td className="font-num py-2 text-right font-semibold">{r.yieldPct.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function AccuracyModal({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<
    { date: string; doc: string; counted: number; matched: number; pct: number }[] | null
  >(null);
  useEffect(() => {
    getAccuracyBreakdownAction().then(setRows);
  }, []);
  return (
    <Modal open onClose={onClose} width={560}>
      <ModalHeader title="Inventory Accuracy (ความแม่นยำสต็อก) — count cycles" onClose={onClose} />
      <div className="max-h-[400px] overflow-auto px-5 py-4">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="text-left text-[#9aa4b4]">
              <th className="pb-2 font-medium">Date</th>
              <th className="pb-2 font-medium">Doc</th>
              <th className="pb-2 text-right font-medium">Counted</th>
              <th className="pb-2 text-right font-medium">Matched</th>
              <th className="pb-2 text-right font-medium">Accuracy</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.doc} className="border-t border-[#eef1f5]">
                <td className="font-num py-2">{fmtDateBE(new Date(r.date))}</td>
                <td className="font-num py-2">{r.doc}</td>
                <td className="font-num py-2 text-right">{r.counted.toLocaleString()}</td>
                <td className="font-num py-2 text-right">{r.matched.toLocaleString()}</td>
                <td className="font-num py-2 text-right font-semibold">{r.pct.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

const inputClass =
  "rounded-[7px] border border-[#d7dce4] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#3E9B6E]";
