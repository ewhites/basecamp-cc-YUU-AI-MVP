"use client";

import { useState } from "react";

export interface SegOption<V extends string> {
  value: V;
  label: React.ReactNode;
  disabled?: boolean;
}

/**
 * Segmented control and tabs: toggle buttons with aria-pressed, and the elastic marker behind the chosen one
 * (bounce 1.6). Needs an <Elastic> ancestor to run the marker. Controlled (value and onChange) or not (defaultValue).
 */
export function Segmented<V extends string>({
  options,
  value,
  defaultValue,
  onChange,
  label,
  className = "",
  ...rest
}: {
  options: SegOption<V>[];
  value?: V;
  defaultValue?: V;
  onChange?: (v: V) => void;
  /** Names the group for screen readers. Also keeps the marker's place across a re-render. */
  label: string;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "onChange" | "className" | "defaultValue">) {
  const [own, setOwn] = useState<V | undefined>(defaultValue ?? options[0]?.value);
  const current = value ?? own;
  return (
    <div role="group" aria-label={label} className={`ds-seg ${className}`.trim()} data-kmk={'aria-pressed="true"'} data-kmk-bounce="1.6" {...rest}>
      <span className="kmk" aria-hidden />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === current}
          disabled={o.disabled}
          onClick={() => {
            setOwn(o.value);
            onChange?.(o.value);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
