#!/bin/sh
# Claude Code PreToolUse hook (Bash). Blocks:
#   1. `git add` of an env file (any arg whose basename is .env or .env.*, except .env.example)
#   2. `git commit` while an env file is already staged
# Exit code 2 tells Claude Code to block the call and show the message.
exec python3 -c '
import json, os, re, shlex, subprocess, sys

cmd = json.load(sys.stdin).get("tool_input", {}).get("command", "")

def is_env(path):
    b = os.path.basename(path)
    return (b == ".env" or b.startswith(".env.")) and b != ".env.example"

# Split into shell segments on && || ; | and newlines, then inspect each git invocation.
for seg in re.split(r"&&|\|\||;|\||\n", cmd):
    try:
        words = shlex.split(seg)
    except ValueError:
        continue
    if len(words) >= 2 and words[0] == "git" and words[1] == "add":
        bad = [w for w in words[2:] if not w.startswith("-") and is_env(w)]
        if bad:
            print("Blocked: never stage env files (" + ", ".join(bad) + "). Secrets stay in .env.local.", file=sys.stderr)
            sys.exit(2)
    if len(words) >= 2 and words[0] == "git" and words[1] == "commit":
        out = subprocess.run(["git", "diff", "--cached", "--name-only"], capture_output=True, text=True).stdout.split()
        staged = [f for f in out if is_env(f)]
        if staged:
            print("Blocked: an env file is staged for commit: " + ", ".join(staged), file=sys.stderr)
            sys.exit(2)
sys.exit(0)
'
