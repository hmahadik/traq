#!/usr/bin/env python3
"""Generate every Traq icon and logo asset from one master mark.

The mark lives below as a single SVG path. It is not a trace of the source
artwork -- it is a reconstruction of it as exact geometry: six horizontal
edges on a uniform stroke/gap grid, seven edges on one shared italic slant
(dx/dy = -1/2), three tangent-continuous cubics, and corner fillets. Every
line is therefore dead straight and every join smooth at any size. Every
deliverable -- the app icons, the Windows .ico, the tray icon, the frontend
and docs logos -- is rendered from that path, so restyling the whole set is
an edit to the PALETTE block plus:

    python3 scripts/generate_icons.py

Pillow is the only dependency. No SVG rasterizer is needed: PNGs are drawn
directly with ImageDraw at 4x supersample, and the SVGs are written around
the same path string, so vector and raster output cannot drift apart.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

# --------------------------------------------------------------------------
# Palette -- edit here to restyle every asset at once.
# --------------------------------------------------------------------------

BADGE_TOP = (0x1E, 0x23, 0x2E)      # badge gradient, top-left
BADGE_BOTTOM = (0x0B, 0x0D, 0x12)   # badge gradient, bottom-right
MARK_COLOR = (0xFF, 0xFF, 0xFF)     # the mark itself

CORNER_RADIUS = 0.2225   # badge corner radius, as a fraction of icon size
MARK_WIDTH = 0.76        # mark width, as a fraction of icon size
SUPERSAMPLE = 4          # antialiasing factor for all raster output

# --------------------------------------------------------------------------
# The mark. viewBox "0 0 MARK_VB_W MARK_VB_H", filled even-odd.
# Reconstructed geometry -- regenerate, do not hand-edit.
# --------------------------------------------------------------------------

MARK_VB_W = 1000.0
MARK_VB_H = 554.27

MARK_PATH = (
    "M1000 0 L288.56 0 C278.88 0 270.03 5.47 265.7 14.13 L208.17 129.19 L786.83 129.19 C788.44 "
    "129.19 789.93 130.02 790.78 131.39 C791.63 132.76 791.7 134.47 790.98 135.91 L685.52 346.84 "
    "C665.67 386.53 617.53 425.08 562.17 425.08 L426.28 425.08 C416.6 425.08 407.76 430.55 403.43 "
    "439.21 L345.9 554.27 L541.99 554.27 C688.72 554.27 777.26 445.49 811.09 377.82 Z M656.75 "
    "212.54 L379.81 212.54 C187.14 212.54 98.53 357.2 69.86 414.55 L0 554.27 L131.94 554.27 "
    "C141.62 554.27 150.47 548.8 154.8 540.14 L250.8 348.15 C252.76 344.21 256.79 341.73 261.18 "
    "341.73 L559.14 341.73 C579.38 341.73 597.88 330.29 606.93 312.19 Z"
)

# --------------------------------------------------------------------------
# Path handling
# --------------------------------------------------------------------------

_TOKEN = re.compile(r"([MLCZ])|(-?\d*\.?\d+)")


def parse_path(d: str) -> list[list[tuple[str, list[float]]]]:
    """Split an absolute M/L/C/Z path string into subpaths."""
    subpaths: list[list[tuple[str, list[float]]]] = []
    current: list[tuple[str, list[float]]] = []
    cmd, nums = None, []
    arity = {"M": 2, "L": 2, "C": 6, "Z": 0}

    def flush() -> None:
        if cmd is None:
            return
        n = arity[cmd]
        if n == 0:
            current.append((cmd, []))
        else:
            for i in range(0, len(nums), n):
                current.append((cmd, nums[i:i + n]))

    for m in _TOKEN.finditer(d):
        letter, number = m.group(1), m.group(2)
        if letter:
            flush()
            if letter == "M" and current:
                subpaths.append(current)
                current = []
            cmd, nums = letter, []
        else:
            nums.append(float(number))
    flush()
    if current:
        subpaths.append(current)
    return subpaths


def _cubic(p0, p1, p2, p3, steps):
    """Sample a cubic bezier, excluding the start point."""
    out = []
    for i in range(1, steps + 1):
        t = i / steps
        u = 1.0 - t
        out.append((
            u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
            u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
        ))
    return out


def flatten(subpaths, scale, offset, steps=16):
    """Turn subpaths into polygons in device space."""
    sx, sy = scale
    ox, oy = offset
    to_dev = lambda x, y: (x * sx + ox, y * sy + oy)
    polys = []
    for sp in subpaths:
        pts, cur = [], None
        for cmd, c in sp:
            if cmd == "M":
                cur = to_dev(c[0], c[1])
                pts = [cur]
            elif cmd == "L":
                cur = to_dev(c[0], c[1])
                pts.append(cur)
            elif cmd == "C":
                p1, p2, p3 = to_dev(c[0], c[1]), to_dev(c[2], c[3]), to_dev(c[4], c[5])
                pts.extend(_cubic(cur, p1, p2, p3, steps))
                cur = p3
        if len(pts) >= 3:
            polys.append(pts)
    return polys


def mark_alpha(width: int, height: int) -> Image.Image:
    """Antialiased 'L' mask of the mark, drawn to fill width x height."""
    ss = SUPERSAMPLE
    w, h = width * ss, height * ss
    subpaths = parse_path(MARK_PATH)
    polys = flatten(subpaths, (w / MARK_VB_W, h / MARK_VB_H), (0, 0))

    acc = Image.new("1", (w, h), 0)
    for poly in polys:
        layer = Image.new("1", (w, h), 0)
        ImageDraw.Draw(layer).polygon(poly, fill=1)
        acc = ImageChops.logical_xor(acc, layer)   # even-odd fill
    return acc.convert("L").resize((width, height), Image.LANCZOS)


# --------------------------------------------------------------------------
# Composition
# --------------------------------------------------------------------------

def _gradient(size: int) -> Image.Image:
    """Diagonal BADGE_TOP -> BADGE_BOTTOM ramp.

    Built small and scaled up: a linear ramp survives interpolation exactly,
    and this avoids a million-pixel Python loop.
    """
    n = 64
    g = Image.new("RGB", (n, n))
    px = g.load()
    for y in range(n):
        for x in range(n):
            t = (x + y) / (2 * (n - 1))
            px[x, y] = tuple(
                round(a + (b - a) * t) for a, b in zip(BADGE_TOP, BADGE_BOTTOM)
            )
    return g.resize((size, size), Image.BICUBIC)


def _rounded_mask(size: int) -> Image.Image:
    ss = SUPERSAMPLE
    big = Image.new("L", (size * ss, size * ss), 0)
    ImageDraw.Draw(big).rounded_rectangle(
        (0, 0, size * ss - 1, size * ss - 1),
        radius=CORNER_RADIUS * size * ss,
        fill=255,
    )
    return big.resize((size, size), Image.LANCZOS)


def _mark_box(size: int):
    """Mark width, height and top-left corner for a badge of `size` px."""
    mw = max(1, round(size * MARK_WIDTH))
    mh = max(1, round(mw * MARK_VB_H / MARK_VB_W))
    return mw, mh, ((size - mw) // 2, (size - mh) // 2)


def badge(size: int) -> Image.Image:
    """The app icon: rounded-square badge with the mark centred on it."""
    icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    plate = _gradient(size).convert("RGBA")
    plate.putalpha(_rounded_mask(size))
    icon.alpha_composite(plate)

    mw, mh, pos = _mark_box(size)
    alpha = mark_alpha(mw, mh)
    fg = Image.new("RGBA", (mw, mh), MARK_COLOR + (0,))
    fg.putalpha(alpha)
    icon.alpha_composite(fg, pos)
    return icon


def tray_badge(size: int) -> Image.Image:
    """The badge for the Linux system tray, with strictly binary alpha.

    fyne.io/systray v1.12.0 converts our PNG to the StatusNotifierItem ARGB32
    pixmap with `byte(v)` on the 16-bit values from color.Color.RGBA()
    (argbForImage, systray_unix.go) -- it keeps the low byte where it wants the
    high one. For an opaque pixel that is accidentally lossless, because
    RGBA() returns c*257 and (c*257)&0xff == c; for a *partly* transparent one
    the premultiply makes the low byte arbitrary, so the colour comes out as
    bright, saturated noise. The badge is full-bleed, so its only partly
    transparent pixels are the four rounded corners -- which is exactly where
    the speckled outline appeared.

    So: threshold the alpha, and keep the badge colour underneath it rather
    than the usual transparent black, so that any host doing non-premultiplied
    filtering bleeds badge colour into the corners instead of black. The
    corners come out hard-edged at this size and the panel's own downscale
    smooths them; TRAY_SIZE is set high enough that it does so cleanly.
    """
    icon = _gradient(size).convert("RGBA")     # opaque RGB everywhere, corners included
    mw, mh, pos = _mark_box(size)
    fg = Image.new("RGBA", (mw, mh), MARK_COLOR + (0,))
    fg.putalpha(mark_alpha(mw, mh))
    icon.alpha_composite(fg, pos)

    mask = _rounded_mask(size).point(lambda v: 255 if v >= 128 else 0)
    icon.putalpha(mask)
    return icon


def bare(width: int) -> Image.Image:
    """The mark alone, MARK_COLOR on transparent, cropped to its own bounds."""
    h = max(1, round(width * MARK_VB_H / MARK_VB_W))
    img = Image.new("RGBA", (width, h), MARK_COLOR + (0,))
    img.putalpha(mark_alpha(width, h))
    return img


# --------------------------------------------------------------------------
# SVG output
# --------------------------------------------------------------------------

def _hex(rgb) -> str:
    return "#%02X%02X%02X" % rgb


def badge_svg(size: int = 512) -> str:
    """Badge as SVG, geometrically identical to badge()."""
    mw, mh, (tx, ty) = _mark_box(size)   # same rounding as badge(), so the
    k = mw / MARK_VB_W                   # vector and raster output coincide
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}" role="img" aria-label="Traq">
  <defs>
    <linearGradient id="traqBadge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{_hex(BADGE_TOP)}"/>
      <stop offset="1" stop-color="{_hex(BADGE_BOTTOM)}"/>
    </linearGradient>
  </defs>
  <rect width="{size}" height="{size}" rx="{CORNER_RADIUS * size:.1f}" fill="url(#traqBadge)"/>
  <g transform="translate({tx:.2f} {ty:.2f}) scale({k:.6f})">
    <path fill="{_hex(MARK_COLOR)}" fill-rule="evenodd" d="{MARK_PATH}"/>
  </g>
</svg>
"""


def bare_svg() -> str:
    """The mark alone, inheriting the surrounding text colour."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {MARK_VB_W:.0f} {MARK_VB_H}" width="{MARK_VB_W:.0f}" height="{MARK_VB_H}" role="img" aria-label="Traq">
  <path fill="currentColor" fill-rule="evenodd" d="{MARK_PATH}"/>
</svg>
"""


# --------------------------------------------------------------------------
# Targets
# --------------------------------------------------------------------------

ROOT = Path(__file__).resolve().parent.parent

# Windows shells pick whichever of these fits; 256 is the Explorer "extra large".
ICO_SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]

# 4x a 32px panel slot, and 2x a 64px one on a HiDPI panel -- enough for the
# host's own downscale to smooth tray_badge()'s hard corners. See tray_badge().
TRAY_SIZE = 128

PNG_TARGETS = [
    ("build/appicon.png", 1024, badge),                   # Wails: source for macOS .icns
    ("build/appicon.orig.png", 1024, badge),              # preferred by scripts/build-appimage.sh
    ("internal/tray/icon.png", TRAY_SIZE, tray_badge),    # go:embed in internal/tray
    ("frontend/src/assets/logo.png", 512, badge),
    ("frontend/src/assets/logo.resized.png", 1024, badge),
    ("frontend/src/assets/images/logo-universal.png", 1024, badge),
]

SVG_TARGETS = [
    ("frontend/src/assets/logo.svg", lambda: badge_svg(512)),
    ("frontend/src/assets/logo-minimal.svg", bare_svg),   # inline use, inherits currentColor
    ("docs/public/logo.svg", lambda: badge_svg(512)),     # referenced by docs/.vitepress/config.ts
    ("docs/public/favicon.svg", lambda: badge_svg(512)),
    ("frontend/public/favicon.svg", lambda: badge_svg(512)),
]


def write(path: Path, blob) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(blob, str):
        path.write_text(blob, encoding="utf-8")
    else:
        blob(path)
    print(f"  {path.relative_to(ROOT)}")


def main() -> int:
    print("mark:", f"{len(parse_path(MARK_PATH))} subpaths,",
          f"badge {_hex(BADGE_TOP)}->{_hex(BADGE_BOTTOM)}, fg {_hex(MARK_COLOR)}")

    print("PNG:")
    cache: dict[tuple[str, int], Image.Image] = {}
    for rel, size, maker in PNG_TARGETS:
        img = cache.setdefault((maker.__name__, size), maker(size))
        write(ROOT / rel, lambda p, i=img: i.save(p, "PNG", optimize=True))

    print("ICO:")
    # Render every frame from the vector rather than downscaling one raster --
    # the 16 and 24px frames are visibly crisper that way.
    frames = [cache.setdefault(("badge", w), badge(w)) for w, _ in ICO_SIZES]
    write(ROOT / "build/windows/icon.ico",
          lambda p: frames[-1].save(p, "ICO", sizes=ICO_SIZES,
                                    append_images=frames[:-1]))

    print("SVG:")
    for rel, maker in SVG_TARGETS:
        write(ROOT / rel, maker())

    print("done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
