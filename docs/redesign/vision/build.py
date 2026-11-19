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


def main() -> int:
    with open(os.path.join(HERE, "board.src.html"), encoding="utf-8") as f:
        html = f.read()
    fr = b64(os.path.join(HERE, "fonts", "fraunces-latin.woff2"))
    hk = b64(os.path.join(HERE, "fonts", "hanken-latin.woff2"))
    fonts = f"""
@font-face{{font-family:"Fraunces";font-weight:100 900;font-style:normal;font-display:swap;src:url(data:font/woff2;base64,{fr}) format("woff2");}}
@font-face{{font-family:"Hanken Grotesk";font-weight:100 900;font-style:normal;font-display:swap;src:url(data:font/woff2;base64,{hk}) format("woff2");}}
"""
    with open(os.path.join(HERE, "kmk.js"), encoding="utf-8") as f:
        kmk = f.read()
    logo = "data:image/png;base64," + b64(os.path.join(REPO, "public", "year-up-united.png"))
    html = html.replace("/*FONTS*/", fonts).replace("LOGO_DATA_URI", logo).replace("/*KMK*/", kmk)
    out = os.path.join(REPO, "docs", "redesign", "vision-board.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"wrote {out} ({os.path.getsize(out) // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
