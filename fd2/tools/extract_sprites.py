"""
Extract character portrait icons from FDICON.B24 and battle tiles from FDSHAP.DAT.

Outputs:
  public/sprites/icons/icon_{idx:04d}.png   - 24x24 portrait icons (1680 total)
  public/sprites/icons/portrait_{id:03d}_{frame}.png - per-portrait frames
  public/sprites/tiles/ch{n}_tile_{t:03d}.png - 24x24 battle terrain tiles

Usage:
  python tools/extract_sprites.py          # extract everything
  python tools/extract_sprites.py --icons  # only icons
  python tools/extract_sprites.py --tiles  # only tiles
  python tools/extract_sprites.py --info   # print file stats only

Requires: Pillow (pip install pillow) or will fall back to PPM output.
"""
import struct
import sys
import os
from pathlib import Path

GAME_DIR = Path(__file__).resolve().parents[1] / ".." / "炎龙骑士团合集" / "FlamedragonCollection" / "Games" / "GAME" / "fd2"
OUT_DIR   = Path(__file__).resolve().parents[1] / "public" / "sprites"

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False
    print("Pillow not installed — writing PPM files. Run: pip install pillow")

# ── RLE decoder (from fd2-anatomy / src/gfx/blitspr.c) ──────────────────────

def rle_decode(src: bytes, max_pixels: int) -> bytes:
    """Decode header-less RLE 4-op command stream."""
    buf = bytearray(max_pixels)
    mask = bytearray(max_pixels)
    i = dst = 0
    n = len(src)
    while dst < max_pixels and i < n:
        cmd = src[i]; i += 1
        length = (cmd & 0x3F) + 1
        op = cmd & 0xC0
        if op == 0x00:         # RLE fill
            if i >= n: break
            b = src[i]; i += 1
            hi = min(dst + length, max_pixels)
            for p in range(dst, hi): buf[p] = b; mask[p] = 1
            dst += length
        elif op == 0x40:       # stretched fill
            if i >= n: break
            b = src[i]; i += 1
            for _ in range(length):
                p = dst + 1
                if p < max_pixels: buf[p] = b; mask[p] = 1
                dst += 2
        elif op == 0x80:       # literal copy
            for _ in range(length):
                if dst >= max_pixels or i >= n: break
                buf[dst] = src[i]; mask[dst] = 1
                i += 1; dst += 1
        else:                  # skip (transparent)
            dst += length
    return bytes(buf), bytes(mask)

# ── Palette from FDOTHER.DAT resource #0 (768-byte 6-bit VGA) ───────────────

def load_palette(fdother_path: Path):
    raw = fdother_path.read_bytes()
    # LLLLLL format: offsets start directly at byte 6 (no count field).
    # offset[idx] is at byte 6 + idx*4.
    start = struct.unpack_from('<I', raw, 6)[0]   # offset[0]
    end   = struct.unpack_from('<I', raw, 10)[0]  # offset[1]
    pal768 = raw[start:end]
    # 6-bit VGA DAC -> 8-bit RGB
    pal = []
    for i in range(256):
        if i * 3 + 2 < len(pal768):
            r, g, b = pal768[i*3], pal768[i*3+1], pal768[i*3+2]
        else:
            r = g = b = 0
        pal.append(((r << 2) | (r >> 4), (g << 2) | (g >> 4), (b << 2) | (b >> 4)))
    return pal

# ── FDICON.B24: 1680 × 24×24 portrait icons ──────────────────────────────────

def extract_icons(pal, out_dir: Path, info_only=False):
    path = GAME_DIR / "FDICON.B24"
    raw = path.read_bytes()
    w = struct.unpack_from('<H', raw, 0)[0]
    h = struct.unpack_from('<H', raw, 2)[0]
    count = struct.unpack_from('<H', raw, 4)[0]
    # Read count+1 offsets (sentinel at end)
    offsets = list(struct.unpack_from(f'<{count+1}I', raw, 6))

    print(f"FDICON.B24: {w}x{h} icons, count={count}, payload starts at 0x{offsets[0]:X}")
    if info_only:
        return

    icon_dir = out_dir / "icons"
    icon_dir.mkdir(parents=True, exist_ok=True)

    # Also build a spritesheet (20 columns × 84 rows = 1680 icons)
    sheet_cols = 20
    sheet_rows = (count + sheet_cols - 1) // sheet_cols
    if HAS_PIL:
        sheet = Image.new("RGBA", (sheet_cols * w, sheet_rows * h), (0, 0, 0, 0))

    for idx in range(count):
        start = offsets[idx]
        end   = offsets[idx + 1]
        pixels, mask = rle_decode(raw[start:end], w * h)

        if HAS_PIL:
            img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            rgba = []
            for p in range(w * h):
                if mask[p]:
                    r, g, b = pal[pixels[p]]
                    rgba.append((r, g, b, 255))
                else:
                    rgba.append((0, 0, 0, 0))
            img.putdata(rgba)
            img.save(icon_dir / f"icon_{idx:04d}.png")
            # Place in spritesheet
            col = idx % sheet_cols
            row = idx // sheet_cols
            sheet.paste(img, (col * w, row * h))
        else:
            # Write PPM
            ppm = bytearray()
            for p in range(w * h):
                if mask[p]:
                    r, g, b = pal[pixels[p]]
                else:
                    r = g = b = 0
                ppm += bytes([r, g, b])
            out_path = icon_dir / f"icon_{idx:04d}.ppm"
            with open(out_path, 'wb') as f:
                f.write(f"P6\n{w} {h}\n255\n".encode())
                f.write(bytes(ppm))

        if idx % 100 == 0:
            print(f"  icons: {idx}/{count} ...", end='\r')

    if HAS_PIL:
        sheet_path = out_dir / "icons_sheet.png"
        sheet.save(sheet_path)
        print(f"\nSaved spritesheet: {sheet_path}  ({sheet_cols*w}x{sheet_rows*h})")
    print(f"Extracted {count} icons to {icon_dir}")

    # Also write portrait manifest (portrait_id -> icon range)
    # 140 portraits x 12 frames
    manifest = {}
    for pid in range(140):
        manifest[pid] = [f"icon_{pid*12 + f:04d}.png" for f in range(12)]
    import json
    mpath = out_dir / "portrait_manifest.json"
    mpath.write_text(json.dumps(manifest, indent=2))
    print(f"Portrait manifest: {mpath}")

# ── FDSHAP.DAT: battle terrain tiles ─────────────────────────────────────────

def read_llllll_entry(raw: bytes, idx: int) -> bytes:
    # Offsets begin at byte 6; offset[idx] is at byte 6 + idx*4
    start = struct.unpack_from('<I', raw, 6 + idx * 4)[0]
    end   = struct.unpack_from('<I', raw, 6 + (idx + 1) * 4)[0]
    return raw[start:end]

def extract_tiles(pal, out_dir: Path, info_only=False, chapters=(0, 1, 2)):
    path = GAME_DIR / "FDSHAP.DAT"
    raw = path.read_bytes()
    count = struct.unpack_from('<I', raw, 6)[0]
    print(f"FDSHAP.DAT: {count} entries")
    if info_only:
        return

    tile_dir = out_dir / "tiles"
    tile_dir.mkdir(parents=True, exist_ok=True)

    # Chapter N: FDSHAP[N*2] = tile sheet, FDSHAP[N*2+1] = attr table
    for ch in chapters:
        shap_idx = ch * 2
        entry = read_llllll_entry(raw, shap_idx)
        tw = struct.unpack_from('<H', entry, 0)[0]
        th = struct.unpack_from('<H', entry, 2)[0]
        tile_count = struct.unpack_from('<H', entry, 4)[0]
        # Read tile offsets (relative to entry start)
        tile_offsets = list(struct.unpack_from(f'<{tile_count}I', entry, 6))
        # Sentinel = entry length
        tile_offsets.append(len(entry))

        ch_dir = tile_dir / f"ch{ch+1}"
        ch_dir.mkdir(exist_ok=True)

        if HAS_PIL:
            sheet_cols = 16
            sheet_rows = (tile_count + sheet_cols - 1) // sheet_cols
            sheet = Image.new("RGBA", (sheet_cols * tw, sheet_rows * th), (0, 0, 0, 0))

        for t in range(tile_count):
            ts = tile_offsets[t]
            te = tile_offsets[t + 1]
            pixels, mask = rle_decode(entry[ts:te], tw * th)

            if HAS_PIL:
                img = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
                rgba = []
                for p in range(tw * th):
                    if mask[p]:
                        r, g, b = pal[pixels[p]]
                        rgba.append((r, g, b, 255))
                    else:
                        rgba.append((0, 0, 0, 0))
                img.putdata(rgba)
                img.save(ch_dir / f"tile_{t:03d}.png")
                col = t % sheet_cols
                row = t // sheet_cols
                sheet.paste(img, (col * tw, row * th))

        if HAS_PIL:
            sp = tile_dir / f"ch{ch+1}_sheet.png"
            sheet.save(sp)
            print(f"  Ch{ch+1}: {tile_count} tiles -> {sp}")

    print(f"Tiles saved to {tile_dir}")

# ── Main ─────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    do_icons = '--icons' in sys.argv or '--icons' not in sys.argv and '--tiles' not in sys.argv
    do_tiles = '--tiles' in sys.argv or '--icons' not in sys.argv and '--tiles' not in sys.argv
    info_only = '--info' in sys.argv

    fdother = GAME_DIR / "FDOTHER.DAT"
    print(f"Loading palette from {fdother}...")
    pal = load_palette(fdother)
    print(f"Palette loaded ({len(pal)} colors)")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    if do_icons:
        extract_icons(pal, OUT_DIR, info_only=info_only)
    if do_tiles:
        extract_tiles(pal, OUT_DIR, info_only=info_only, chapters=(0, 1, 2))

    print("Done.")
