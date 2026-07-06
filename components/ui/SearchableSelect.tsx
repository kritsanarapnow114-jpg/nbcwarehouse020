"use client";

import { useState } from "react";

export type SearchableOption = { value: string; label: string };

/**
 * A type-to-filter "+ Add line" picker — visually a dashed-border box like the
 * plain <select> it replaces, but lets you type to narrow a long product list
 * instead of scrolling a native dropdown (especially painful on mobile).
 */
export function SearchableSelect({
  options,
  onSelect,
  placeholder,
  className = "w-full rounded-[9px] border border-dashed border-[#c4ccd8] bg-[#f7f9fb] px-3 py-2 text-[13px] text-[#3a4658] outline-none focus:border-[#3E9B6E]",
}: {
  options: SearchableOption[];
  onSelect: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const q = query.trim().toLowerCase();
  const filtered = q === "" ? options : options.filter((o) => o.label.toLowerCase().includes(q));

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        placeholder={placeholder}
        className={className}
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-[9px] border border-[#d7dce4] bg-white shadow-[0_8px_24px_rgba(20,30,48,.12)]">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-[12.5px] text-[#9aa4b4]">No matches</div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(o.value);
                  setQuery("");
                  setOpen(false);
                }}
                className="block w-full truncate px-3 py-2 text-left text-[13px] text-[#3a4658] hover:bg-[#f7f9fb]"
              >
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
