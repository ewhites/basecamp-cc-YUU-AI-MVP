"use client";

import { useEffect, useRef } from "react";
import { auto } from "./kmk";

/**
 * Runs the elastic marker on every [data-kmk] group inside it (segmented controls, tabs, the dock, answer lists),
 * and follows their changes. Cleans up on unmount.
 */
export function Elastic({ className, children, ...rest }: { className?: string; children: React.ReactNode } & Omit<React.HTMLAttributes<HTMLDivElement>, "className" | "children">) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    return auto(root);
  }, []);
  return (
    <div ref={ref} className={className} {...rest}>
      {children}
    </div>
  );
}
