"use client";

import { useRef, useState } from "react";

export interface Answer<V extends string> {
  value: V;
  label: React.ReactNode;
  disabled?: boolean;
}

/**
 * Large answer rows (radio buttons) with the elastic marker on the chosen one (bounce 1.6).
 * Arrow keys move and choose, as in a native radio group. Needs an <Elastic> ancestor to run the marker.
 */
export function AnswerList<V extends string>({
  options,
  value,
  defaultValue,
  onChange,
  label,
  className = "",
  ...rest
}: {
  options: Answer<V>[];
  value?: V | null;
  defaultValue?: V | null;
  onChange?: (v: V) => void;
  label: string;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "onChange" | "className" | "defaultValue">) {
  const [own, setOwn] = useState<V | null>(defaultValue ?? null);
  const current = value === undefined ? own : value;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
  const found = options.findIndex((o) => o.value === current && !o.disabled);
  const focusIndex = found >= 0 ? found : (enabled[0] ?? 0);

  function choose(i: number) {
    const o = options[i];
    if (!o || o.disabled) return;
    setOwn(o.value);
    onChange?.(o.value);
  }
  function onKey(e: React.KeyboardEvent, i: number) {
    const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"];
    if (!keys.includes(e.key) || !enabled.length) return;
    e.preventDefault();
    const at = enabled.indexOf(i);
    const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1;
    const to = enabled[(at + step + enabled.length) % enabled.length] ?? 0;
    choose(to);
    refs.current[to]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={label} className={`ds-answers ${className}`.trim()} data-kmk={'aria-checked="true"'} data-kmk-bounce="1.6" {...rest}>
      <span className="kmk" aria-hidden />
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={o.value === current}
          tabIndex={i === focusIndex ? 0 : -1}
          disabled={o.disabled}
          onClick={() => choose(i)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
