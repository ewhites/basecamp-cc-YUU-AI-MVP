"use client";

import { useEffect, useRef, useState } from "react";
import { looksPersonal, PersonalWarning } from "./personal";

/** Character ranges of each quote found in the text, in quote order (n sets the 180ms highlight delay). */
export function findQuotes(text: string, quotes: string[]): { start: number; end: number; n: number }[] {
  const lower = text.toLowerCase();
  const found: { start: number; end: number; n: number }[] = [];
  quotes.forEach((q, n) => {
    const needle = q.trim().replace(/^[“"']+|[”"'.…]+$/g, "").toLowerCase();
    if (needle.length < 3) return;
    const start = lower.indexOf(needle);
    if (start >= 0) found.push({ start, end: start + needle.length, n });
  });
  found.sort((a, b) => a.start - b.start);
  const merged: typeof found = [];
  for (const r of found) {
    const last = merged[merged.length - 1];
    if (last && r.start < last.end) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  }
  return merged;
}

/** Text with the quoted phrases wrapped in <mark>. Used for the mirror under a textarea and for read-only text. */
export function Highlighted({ text, quotes }: { text: string; quotes: string[] }) {
  const ranges = findQuotes(text, quotes);
  const out: React.ReactNode[] = [];
  let at = 0;
  ranges.forEach((r, i) => {
    if (r.start > at) out.push(text.slice(at, r.start));
    out.push(
      <mark key={i} style={{ "--n": r.n } as React.CSSProperties}>
        {text.slice(r.start, r.end)}
      </mark>,
    );
    at = r.end;
  });
  if (at < text.length) out.push(text.slice(at));
  return <>{out}</>;
}

/** Turns true one frame after mount (and again whenever `key` changes), so a CSS transition plays. Reduced motion skips it in CSS. */
export function useArrive(key: unknown): boolean {
  const [arrived, setArrived] = useState<{ key: unknown } | null>(null);
  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setArrived({ key }));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [key]);
  return !!arrived && arrived.key === key;
}

/**
 * The write surface: a textarea on the dark slab. When the coach has quoted the student's words, a mirror
 * under the transparent textarea highlights each quoted phrase in place (--evidence), 180ms apart.
 * The personal-data line shows under it when the text looks like personal information.
 */
export function WriteField({
  id,
  label,
  value,
  onChange,
  quotes = [],
  quoteKey,
  placeholder,
  rows = 5,
  maxLength,
  disabled,
  testId,
  className = "",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** The coach's quotes from the latest attempt. */
  quotes?: string[];
  /** Changes when a new result arrives, so the highlights play again. */
  quoteKey?: unknown;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
  testId?: string;
  className?: string;
}) {
  const mirror = useRef<HTMLDivElement>(null);
  const marks = quotes.length > 0 && findQuotes(value, quotes).length > 0;
  const warnId = `${id}-personal`;
  return (
    <div className={`ln-write ${className}`.trim()}>
      <label htmlFor={id} className="ds-sr">
        {label}
      </label>
      <div className="ln-field">
        {marks && (
          <div key={String(quoteKey)} className="ln-mirror" aria-hidden ref={mirror}>
            <Highlighted text={value} quotes={quotes} />
            {"\n"}
          </div>
        )}
        <textarea
          id={id}
          className="ln-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={(e) => {
            if (mirror.current) mirror.current.scrollTop = e.currentTarget.scrollTop;
          }}
          placeholder={placeholder}
          rows={rows}
          style={{ minHeight: `calc(1.55em * ${rows})` }}
          maxLength={maxLength}
          disabled={disabled}
          spellCheck
          aria-describedby={looksPersonal(value) ? warnId : undefined}
          data-testid={testId}
        />
      </div>
      <PersonalWarning text={value} id={warnId} />
    </div>
  );
}
