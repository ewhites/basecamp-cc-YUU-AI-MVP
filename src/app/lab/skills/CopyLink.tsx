"use client";

import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="row" style={{ flexWrap: "nowrap" }}>
      <input type="text" readOnly value={url} aria-label="Shareable portfolio link" onFocus={(e) => e.currentTarget.select()} style={{ flex: 1 }} data-testid="share-link" />
      <button
        type="button"
        className="btn"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
