"use client";

import { useState } from "react";

/**
 * A checkbox: a real button with role="checkbox". When ticked, the fill grows wider, then taller, then settles
 * (real width and height, never a scale), and the tick draws after. The grow only plays after a click,
 * so a box that loads ticked does not animate.
 */
export function Checkbox({
  checked,
  defaultChecked = false,
  onChange,
  children,
  disabled,
  className = "",
  ...rest
}: {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (on: boolean) => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "className" | "children">) {
  const [own, setOwn] = useState(defaultChecked);
  const [moved, setMoved] = useState(false);
  const on = checked ?? own;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      data-moved={moved ? "" : undefined}
      disabled={disabled}
      className={`ds-check ${className}`.trim()}
      onClick={() => {
        setMoved(true);
        setOwn(!on);
        onChange?.(!on);
      }}
      {...rest}
    >
      <span className="ds-box ds-sq" aria-hidden>
        <svg viewBox="0 0 16 16">
          <path d="M3.5 8.5l3 3 6-6.5" />
        </svg>
      </span>
      {children}
    </button>
  );
}
