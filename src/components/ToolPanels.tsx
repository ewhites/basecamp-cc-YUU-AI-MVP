"use client";

import { useId } from "react";
import { Button } from "@/design/Button";
import { Icon } from "@/design/icons";
import { TOOL_LABELS, type ToolId } from "@/lib/sandbox/tools";

/**
 * The four pretend tools as panels: spreadsheet, outbox, notes doc and memory. They sit on a dark surface
 * (the caller wraps them in .ds-slab.ln-slab), so the demos and the live build look the same.
 * Every panel says "Simulated" in plain small text. A tool the agent was not given says so.
 * Styles: src/design/areas/sandbox.css.
 */

export type DraftStatus = "waiting" | "sent" | "sent_back";

export interface DraftView {
  id: string;
  to: string;
  subject: string;
  body: string;
  status: DraftStatus;
  /** Which message the bot was answering (live build). */
  label?: string;
}

export interface Line {
  text: string;
  label?: string;
}

export interface SheetView {
  name: string;
  columns: string[];
  rows: string[][];
  /** The agent has read it. Until then the rows stay hidden. */
  read: boolean;
  /** One line under the sheet name, such as how many times it was searched. */
  note?: string;
  /** Said when the tool is given but nothing has been read. */
  idle: string;
}

const STATUS_TEXT: Record<DraftStatus, { icon: "clock" | "check" | "minus"; text: string }> = {
  waiting: { icon: "clock", text: "Waiting for approval" },
  sent: { icon: "check", text: "Sent (simulated)" },
  sent_back: { icon: "minus", text: "Sent back" },
};

/** Approve and Send back. Approve is the cream button; Send back is the outlined one (one orange button per screen). */
export function DraftControls({
  onApprove,
  onSendBack,
  canSendBack = true,
  approveTestId = "draft-approve",
  sendBackTestId = "draft-send-back",
}: {
  onApprove: () => void;
  onSendBack: () => void;
  canSendBack?: boolean;
  approveTestId?: string;
  sendBackTestId?: string;
}) {
  return (
    <div className="sb-controls">
      <Button variant="paper" onClick={onApprove} data-testid={approveTestId}>
        Approve draft
      </Button>
      {canSendBack && (
        <button type="button" className="sb-ghost" onClick={onSendBack} data-testid={sendBackTestId}>
          Send back
        </button>
      )}
    </div>
  );
}

/** One draft, as it sits in the outbox. */
export function DraftBlock({ draft, children }: { draft: Pick<DraftView, "to" | "subject" | "body">; children?: React.ReactNode }) {
  return (
    <div className="sb-draft">
      <dl className="sb-addr">
        <div>
          <dt>To</dt>
          <dd>{draft.to}</dd>
        </div>
        <div>
          <dt>Subject</dt>
          <dd>{draft.subject}</dd>
        </div>
      </dl>
      <p className="sb-body">{draft.body}</p>
      {children}
    </div>
  );
}

function Panel({ tool, granted, id, children, testId }: { tool: ToolId; granted: boolean; id: string; children: React.ReactNode; testId: string }) {
  return (
    <section className="sb-panel" data-tool={tool} data-granted={granted ? "yes" : "no"} data-testid={testId} aria-labelledby={id}>
      <header className="sb-head">
        <h3 id={id}>{TOOL_LABELS[tool]}</h3>
        <span className="sb-sim">Simulated</span>
      </header>
      {granted ? children : <p className="sb-off">Not given</p>}
    </section>
  );
}

export function ToolPanels({
  granted,
  sheet,
  notes,
  memory,
  drafts,
  onDecide,
  who = "the agent",
}: {
  granted: ToolId[];
  sheet: SheetView | null;
  notes: Line[];
  memory: Line[];
  drafts: DraftView[];
  /** The live build: Approve and Send back on each draft that is waiting. The demos put them beside the agent's steps instead. */
  onDecide?: (id: string, decision: "approve" | "send_back") => void;
  who?: string;
}) {
  const uid = useId();
  const has = (t: ToolId) => granted.includes(t);
  return (
    <div className="sb-tools" data-testid="tool-panels">
      <Panel tool="sheet" granted={has("sheet")} id={`${uid}-sheet`} testId="tool-panel-sheet">
        {sheet && sheet.read ? (
          <>
            <p className="sb-meta">{sheet.name}</p>
            <table className="sb-table">
              <thead>
                <tr>
                  {sheet.columns.map((c) => (
                    <th key={c} scope="col">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.rows.map((r) => (
                  <tr key={r[0]}>
                    {r.map((cell, i) => (
                      <td key={i} data-label={sheet.columns[i]}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {sheet.note && <p className="sb-meta">{sheet.note}</p>}
          </>
        ) : (
          <p className="sb-empty">{sheet?.idle ?? "Not read yet"}</p>
        )}
      </Panel>

      <Panel tool="outbox" granted={has("outbox")} id={`${uid}-outbox`} testId="tool-panel-outbox">
        {drafts.length ? (
          <ol className="sb-drafts">
            {drafts.map((d) => {
              const st = STATUS_TEXT[d.status];
              return (
                <li key={d.id} data-status={d.status} data-testid={`draft-${d.id}`}>
                  {d.label && <span className="sb-meta">{d.label}</span>}
                  <DraftBlock draft={d}>
                    <p className="sb-status">
                      <Icon name={st.icon} />
                      <span>{st.text}</span>
                    </p>
                    {onDecide && d.status === "waiting" && (
                      <DraftControls
                        onApprove={() => onDecide(d.id, "approve")}
                        onSendBack={() => onDecide(d.id, "send_back")}
                        approveTestId={`draft-approve-${d.id}`}
                        sendBackTestId={`draft-send-back-${d.id}`}
                      />
                    )}
                  </DraftBlock>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="sb-empty">No drafts yet</p>
        )}
      </Panel>

      <Panel tool="notes" granted={has("notes")} id={`${uid}-notes`} testId="tool-panel-notes">
        <Lines lines={notes} empty={`Nothing written by ${who}`} />
      </Panel>

      <Panel tool="memory" granted={has("memory")} id={`${uid}-memory`} testId="tool-panel-memory">
        <Lines lines={memory} empty={`Nothing remembered by ${who}`} />
      </Panel>
    </div>
  );
}

function Lines({ lines, empty }: { lines: Line[]; empty: string }) {
  if (!lines.length) return <p className="sb-empty">{empty}</p>;
  return (
    <ul className="sb-lines">
      {lines.map((l, i) => (
        <li key={i}>
          {l.label && <span className="sb-meta">{l.label}</span>}
          <span>{l.text}</span>
        </li>
      ))}
    </ul>
  );
}
