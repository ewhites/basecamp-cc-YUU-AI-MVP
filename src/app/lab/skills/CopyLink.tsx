"use client";

import { useState } from "react";
import { buttonClass } from "@/design/Button";
import { Icon } from "@/design/icons";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="st-copy">
      <input type="text" readOnly value={url} aria-label="Shareable skills link" onFocus={(e) => e.currentTarget.select()} data-testid="share-link" />
      <button
        type="button"
        className={buttonClass({ variant: "secondary" })}
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
        <Icon name={copied ? "check" : "copy"} />
        {copied ? "Copied" : "Copy link"}
      </button>
      <span className="ds-sr" role="status">
        {copied ? "Link copied" : ""}
      </span>
    </div>
  );
}
