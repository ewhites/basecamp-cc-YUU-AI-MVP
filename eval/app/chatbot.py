"""
Entry point the module-chatbot eval measures: the REAL app's "Ask the coach" box.

answer() POSTs the student's question to the running Next.js app at
http://localhost:3000/api/coach/ask, which calls askCoach() in src/lib/coach/qa.ts (the same
code the in-app box uses: personal-info scrub, distress tripwire, then Claude). So this eval
grades the prompt, model and rules students actually get, not a stand-in.

Start the app first (`npm run dev`, with ANTHROPIC_API_KEY in .env.local). The route only
answers in development and only with the header `x-lab-eval: 1`.

Keep the return shape: the runner depends on it, and on `model` / `usage` / `stop_reason`
coming back from the response rather than from config.
"""
from __future__ import annotations

import json
import os
import pathlib
import re
import time
import urllib.error
import urllib.request
from typing import Any

import anthropic
import httpx

CORPUS_DIR = pathlib.Path(__file__).resolve().parent.parent / "corpus"
APP_URL = os.environ.get("LAB_APP_URL", "http://localhost:3000").rstrip("/")
ENDPOINT = f"{APP_URL}/api/coach/ask"
# Must match QA_MODEL in src/lib/models.ts. The runner checks the served model starts with this.
MODEL = "claude-haiku-5-5"
TIMEOUT_S = 120

SECTION_RE = re.compile(r"^## (M\d{2}-S\d+) — (.+)$", re.M)


def load_corpus() -> tuple[str, set[str]]:
    """Return the full corpus text and the set of valid citation keys (the grader needs both)."""
    parts, keys = [], set()
    for path in sorted(CORPUS_DIR.glob("*.md")):
        text = path.read_text()
        parts.append(text)
        keys.update(m.group(1) for m in SECTION_RE.finditer(text))
    return "\n\n".join(parts), keys


CORPUS_TEXT, VALID_SECTIONS = load_corpus()


def _retryable(message: str) -> anthropic.APIConnectionError:
    """An error the runner's with_backoff() retries (rate limits, Claude briefly down)."""
    return anthropic.APIConnectionError(message=message, request=httpx.Request("POST", ENDPOINT))


def answer(prompt: str, client: anthropic.Anthropic | None = None) -> dict[str, Any]:
    """Run one student question through the app's coach. Returns the row the runner needs.

    `client` is accepted for compatibility with the runner and is not used: the app makes the call.
    """
    del client
    body = json.dumps({"question": prompt}).encode()
    req = urllib.request.Request(
        ENDPOINT,
        data=body,
        method="POST",
        headers={"content-type": "application/json", "x-lab-eval": "1"},
    )
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as res:
            data = json.loads(res.read())
    except urllib.error.HTTPError as e:
        try:
            detail = json.loads(e.read())
        except Exception:  # noqa: BLE001 - any unreadable body
            detail = {}
        msg = f"app returned HTTP {e.code}: {detail.get('error', e.reason)}"
        if e.code == 404:
            raise RuntimeError(f"{msg}. Is the app running in development mode (npm run dev)?") from None
        if e.code in (429, 503) and detail.get("retryable", e.code == 429):
            raise _retryable(msg) from None
        raise RuntimeError(msg) from None
    except urllib.error.URLError as e:
        raise RuntimeError(f"could not reach the app at {ENDPOINT} ({e.reason}). Start it with `npm run dev`.") from None
    latency_s = time.perf_counter() - started

    text = data.get("text", "")
    return {
        "text": text,
        "model": data.get("model", ""),
        "usage": data.get("usage") or {},
        "stop_reason": data.get("stop_reason"),
        "latency_s": latency_s,
        "trace": [
            {"role": "system", "content": f"(app system prompt: src/lib/coach/qa.ts, served via {ENDPOINT})"},
            {"role": "user", "content": prompt},
            {"role": "assistant", "content": text},
        ],
    }


def cited_sections(text: str) -> list[str]:
    return sorted(set(re.findall(r"\[(M\d{2}-S\d+)\]", text)))
