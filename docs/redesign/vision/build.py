"""Builds docs/redesign/vision-board.html: one file with the fonts and the logo inside it.

Run from the repo root:  python3 docs/redesign/vision/build.py
Fonts: Latin-only web copies of Fraunces and Hanken Grotesk from the Kaleos HQ brand kit, in fonts/
(both are under the SIL Open Font License).
"""
import base64
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))


def b64(path: str) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("ascii")


CHECK = '<svg viewBox="0 0 12 12" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.2l2.3 2.3 4.7-5"/></svg>'

COACH = f"""
<div class="lamp">
  <span class="ring"><svg viewBox="0 0 36 36"><circle class="tr" cx="18" cy="18" r="15.9"/><circle class="fi" cx="18" cy="18" r="15.9" pathLength="100"/></svg>3/4</span>
  <div><h3>Coach</h3><small>3 of 4 checks met</small></div>
</div>
<ul class="checks">
  <li style="--n:1"><i class="c-dot met">{CHECK}</i><span class="q">Gives the AI a role</span><span class="w">Met</span><blockquote>"You are a senior help-desk technician"</blockquote></li>
  <li style="--n:2"><i class="c-dot met">{CHECK}</i><span class="q">Asks for one outcome</span><span class="w">Met</span><blockquote>"Summarize this ticket"</blockquote></li>
  <li style="--n:3"><i class="c-dot met">{CHECK}</i><span class="q">Says who it is for</span><span class="w">Met</span><blockquote>"for the next-shift technician"</blockquote></li>
  <li style="--n:4"><i class="c-dot miss"></i><span class="q">Asks for a format or length</span><span class="w">Missing</span><blockquote>Not found in your prompt.</blockquote></li>
</ul>
<div class="tip sq"><b>One tip</b><p>Tell the AI what shape and length you want back.</p></div>
<div class="ask sq"><span>Ask about this lesson</span><i><svg viewBox="0 0 16 16" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg></i></div>
"""


def main() -> int:
    with open(os.path.join(HERE, "board.src.html"), encoding="utf-8") as f:
        html = f.read()
    fr = b64(os.path.join(HERE, "fonts", "fraunces-latin.woff2"))
    hk = b64(os.path.join(HERE, "fonts", "hanken-latin.woff2"))
    fonts = f"""
@font-face{{font-family:"Fraunces";font-weight:100 900;font-style:normal;font-display:swap;src:url(data:font/woff2;base64,{fr}) format("woff2");}}
@font-face{{font-family:"Hanken Grotesk";font-weight:100 900;font-style:normal;font-display:swap;src:url(data:font/woff2;base64,{hk}) format("woff2");}}
"""
    logo = "data:image/png;base64," + b64(os.path.join(REPO, "public", "year-up-united.png"))
    html = html.replace("/*FONTS*/", fonts).replace("LOGO_DATA_URI", logo).replace("COACH_INNER", COACH)
    out = os.path.join(REPO, "docs", "redesign", "vision-board.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"wrote {out} ({os.path.getsize(out) // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
