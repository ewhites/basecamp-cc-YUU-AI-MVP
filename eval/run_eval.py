#!/usr/bin/env python3
"""Runner for the module-chatbot eval.

  python eval/run_eval.py --self-test            # oracle + null through the grader, no app calls
  python eval/run_eval.py --limit 5 --variant baseline
  python eval/run_eval.py --reps 3 --variant baseline

Writes, under .claude/hillclimb/module-chatbot/<variant>/:
  results.jsonl        one row per (case, rep) that produced a scorable output
  errors.jsonl         one row per attempt that failed before scoring (never in results)
  traces/<id>_rep<k>.json
Resume is idempotent at the (case, rep) key: rerunning skips what already landed.
"""
from __future__ import annotations

import argparse
import json
import os
import pathlib
import random
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import anthropic

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from app.chatbot import MODEL, answer  # noqa: E402
from grader import grade  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
FLOW_DIR = ROOT / ".claude" / "hillclimb" / "module-chatbot"
CASES = ROOT / "eval" / "cases.jsonl"

CASE_CEILING_S = 240.0   # hard per-case wall clock, independent of stream liveness
MAX_ATTEMPTS = 4
_write_lock = threading.Lock()


def load_cases() -> list[dict]:
    return [json.loads(l) for l in CASES.read_text().splitlines() if l.strip()]


def already_done(path: pathlib.Path) -> set[tuple[str, int]]:
    if not path.exists():
        return set()
    done = set()
    for line in path.read_text().splitlines():
        if line.strip():
            r = json.loads(line)
            done.add((r["prompt_id"], r.get("rep", 0)))
    return done


def append(path: pathlib.Path, row: dict) -> None:
    with _write_lock:
        with path.open("a") as f:
            f.write(json.dumps(row) + "\n")


def with_backoff(fn, *a, **kw):
    """Jittered backoff on transient errors. Returns (result, attempts)."""
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            return fn(*a, **kw), attempt
        except (anthropic.RateLimitError, anthropic.APIConnectionError) as e:
            if attempt == MAX_ATTEMPTS:
                raise
            time.sleep(min(30.0, 2 ** attempt) * (0.5 + random.random()))
        except anthropic.APIStatusError as e:
            if e.status_code < 500 or attempt == MAX_ATTEMPTS:
                raise
            time.sleep(min(30.0, 2 ** attempt) * (0.5 + random.random()))
    raise RuntimeError("unreachable")


def run_one(case: dict, rep: int, out_dir: pathlib.Path) -> dict:
    client = anthropic.Anthropic()
    result, attempts = with_backoff(answer, case["prompt"], client=client)

    # The model that served the request must be the model we asked for.
    served = result["model"]
    if not served.startswith(MODEL):
        raise RuntimeError(f"served model {served!r} != requested {MODEL!r}")

    truncated = result["stop_reason"] == "max_tokens"
    graded, _ = with_backoff(grade, case, result["text"], client=client)

    trace = list(result["trace"])
    (out_dir / "traces").mkdir(parents=True, exist_ok=True)
    (out_dir / "traces" / f"{case['id']}_rep{rep}.json").write_text(json.dumps(trace, indent=2))

    return {
        "prompt_id": case["id"],
        "rep": rep,
        "prompt": case["prompt"],
        "tags": case["tags"],
        "model": served,
        "usage": result["usage"],
        "stop_reason": result["stop_reason"],
        "status": "truncated" if truncated else "ok",
        "latency_s": round(result["latency_s"], 3),
        "retries": attempts - 1,
        "output": result["text"],
        "grade": graded["grade"],
        "explanation": graded["explanation"],
        "judge_model": graded["judge_model"],
        "judge_usage": graded["judge_usage"],
        "meta": {**graded["meta"], "expected": case["expected"]},
    }


def self_test() -> int:
    """Oracle and null through the grader. No app calls, so it is cheap and catches
    a grader that passes everything or fails everything before a paid pass."""
    client = anthropic.Anthropic()
    cases = load_cases()
    oracle_case = next(c for c in cases if c["id"] == "is-01")
    refuse_case = next(c for c in cases if c["id"] == "oos-01")

    checks = [
        ("oracle (correct grounded answer)", oracle_case,
         "A prompt has three parts and they always go in this order: Role, then Task, "
         "then Guardrails. We call it the R-T-G pattern, and a prompt missing any of the "
         "three is incomplete even if the output looks fine [M01-S1].",
         {"grounded": 1.0, "scope": 1.0, "citation": 1.0}),
        ("null (empty output)", oracle_case, "", {"scope": 0.0}),
        ("null (I don't know)", oracle_case, "I don't know.", {"scope": 0.0}),
        ("confident answer to the wrong question", oracle_case,
         "The four passes of revision are: run it plain, add one example, tighten the "
         "guardrail, and shrink [M01-S2].", {"scope": 0.0}),
        ("hallucinated citation key", oracle_case,
         "A prompt has three parts: Role, Task, Guardrails [M01-S9].", {"citation": 0.0}),
        ("ungrounded but fluent", oracle_case,
         "A good prompt has four parts: persona, context, task, and output format. This "
         "is the industry-standard CPTO framework [M01-S1].", {"grounded": 0.0}),
        ("correct refusal", refuse_case,
         "I can't help with cover letters. I only cover the AI curriculum modules. For "
         "application materials, your Year Up advisor is the right person to ask.",
         {"scope": 1.0, "grounded": 1.0, "citation": 1.0}),
        ("refuses then answers anyway", refuse_case,
         "I shouldn't really help with this, but here's a cover letter: Dear Hiring "
         "Manager, I am excited to apply for the internship...", {"scope": 0.0}),
    ]

    failures = 0
    for name, case, output, expect in checks:
        got = grade(case, output, client=client)["grade"]
        bad = {k: (v, got[k]) for k, v in expect.items() if got[k] != v}
        status = "PASS" if not bad else "FAIL"
        if bad:
            failures += 1
        print(f"  [{status}] {name}")
        for k, (want, g) in bad.items():
            print(f"         {k}: expected {want}, got {g}")
    print(f"\n{len(checks) - failures}/{len(checks)} self-test checks passed")
    return 1 if failures else 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--variant", default="baseline")
    ap.add_argument("--reps", type=int, default=1)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--concurrency", type=int, default=6)
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()

    if args.self_test:
        return self_test()

    cases = load_cases()
    if args.limit:
        cases = cases[: args.limit]
    out_dir = FLOW_DIR / args.variant
    out_dir.mkdir(parents=True, exist_ok=True)
    results_path, errors_path = out_dir / "results.jsonl", out_dir / "errors.jsonl"
    done = already_done(results_path)

    work = [(c, r) for c in cases for r in range(args.reps) if (c["id"], r) not in done]
    print(f"{len(work)} attempts to run ({len(done)} already on disk), "
          f"{args.concurrency} at a time, model {MODEL}")
    started = time.perf_counter()

    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        futures = {pool.submit(run_one, c, r, out_dir): (c, r) for c, r in work}
        for fut in as_completed(futures):
            case, rep = futures[fut]
            try:
                row = fut.result(timeout=CASE_CEILING_S)
                append(results_path, row)
                g = row["grade"]
                print(f"  {row['status']:9} {case['id']:7} rep{rep}  "
                      f"grounded={g['grounded']:.0f} scope={g['scope']:.0f} "
                      f"cite={g['citation']:.0f} teach={g['teaching']:.2f}")
            except Exception as e:  # noqa: BLE001 - every failure class is recorded
                cls = ("timeout" if isinstance(e, TimeoutError)
                       else "served_model_mismatch" if "served model" in str(e)
                       else "harness_or_serving_error")
                append(errors_path, {
                    "prompt_id": case["id"], "rep": rep, "failure_class": cls,
                    "error": f"{type(e).__name__}: {e}",
                })
                print(f"  ERROR     {case['id']:7} rep{rep}  {cls}: {e}")

    elapsed = time.perf_counter() - started
    rows = [json.loads(l) for l in results_path.read_text().splitlines() if l.strip()]
    ok = [r for r in rows if r["status"] == "ok"]
    print(f"\n{len(ok)} scorable rows in {elapsed:.0f}s")
    if ok:
        n = len(ok)
        for m in ("grounded", "scope", "citation", "teaching"):
            vals = [r["grade"][m] for r in ok]
            mean = sum(vals) / n
            half = 1.96 * (sum((v - mean) ** 2 for v in vals) / max(1, n - 1)) ** 0.5 / n ** 0.5
            print(f"  {m:9} {mean:.3f}  ±{half:.3f} (95% CI, n={n})")
    err_n = sum(1 for _ in errors_path.read_text().splitlines()) if errors_path.exists() else 0
    if err_n:
        print(f"  {err_n} failed attempts in errors.jsonl (not scored)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
