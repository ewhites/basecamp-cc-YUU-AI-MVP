/** One line icon set: 1.5 stroke, currentColor, no fill. Paths from the vision board. */

const PATHS = {
  home: { box: 24, d: "M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" },
  learn: { box: 24, d: "M4 5.5A2.5 2.5 0 0 1 6.5 3H12v16H6.5A2.5 2.5 0 0 0 4 21.5zM20 5.5A2.5 2.5 0 0 0 17.5 3H12v16h5.5a2.5 2.5 0 0 1 2.5 2.5z" },
  skills: { box: 24, d: "M5 20V10M12 20V4M19 20v-7" },
  class: { box: 24, d: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18.5 14.2a6.5 6.5 0 0 1 3 5.8" },
  next: { box: 24, d: "M5 12h14M13 6l6 6-6 6" },
  arrow: { box: 16, d: "M3 8h10M9 4l4 4-4 4" },
  check: { box: 18, d: "M4 9.5l3.2 3.2L14 5.5" },
  minus: { box: 18, d: "M5 9h8" },
  back: { box: 18, d: "M11 4L6 9l5 5" },
  out: { box: 16, d: "M6 3H3.5v10H6M10.5 5l3 3-3 3M13.5 8H6" },
  open: { box: 16, d: "M9 3h4v4M13 3L7.5 8.5M11 9.5V13H3V5h3.5" },
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "ds-icon", label }: { name: IconName; className?: string; label?: string }) {
  const p = PATHS[name];
  return (
    <svg className={className} viewBox={`0 0 ${p.box} ${p.box}`} aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label} focusable="false">
      <path d={p.d} />
    </svg>
  );
}
