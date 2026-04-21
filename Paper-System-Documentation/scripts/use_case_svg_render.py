"""Generate UML-style use case SVGs (oval boundary, teal ovals, include/extend)."""

from __future__ import annotations

import html
import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Dependency:
    primary_index: int
    secondary_index: int
    stereotype: str  # "<<include>>" or "<<extend>>"


def _esc(text: str) -> str:
    return html.escape(text, quote=True)


def _split_label(text: str, max_chars: int = 34) -> tuple[str, str | None]:
    if len(text) <= max_chars:
        return text, None
    cut = text.rfind(" ", 0, max_chars)
    if cut < max_chars // 2:
        cut = max_chars
    a, b = text[:cut].rstrip(), text[cut:].lstrip()
    if len(b) > max_chars:
        b = b[: max_chars - 1] + "…"
    return a, b


def _safe_marker_id(title: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", title.strip())[:40].strip("-").lower()
    return f"mk-{slug or 'diagram'}"


def render_figure(
    *,
    title: str,
    actor: str,
    primaries: list[str],
    secondaries: list[str],
    actor_to_primaries: list[int],
    dependencies: list[Dependency],
    width: int = 1000,
    font_primary: float = 8.5,
    font_secondary: float = 8.1,
) -> str:
    marker_id = _safe_marker_id(title)

    step_p = 44
    step_s = 42
    top_margin = 102
    bottom_margin = 95
    height = max(
        720,
        top_margin + len(primaries) * step_p + bottom_margin,
        top_margin + len(secondaries) * step_s + bottom_margin,
    )

    cx_b = width / 2 + 18
    cy_b = height / 2
    rx_b = width / 2 - 52
    ry_b = height / 2 - 38

    px, py0 = 408, top_margin
    sx, sy0 = 712, top_margin + 8

    prim_elems: list[str] = []
    prim_pos: list[tuple[float, float, float, float]] = []

    max_rx_p = 162
    for i, label in enumerate(primaries):
        cy = py0 + i * step_p
        line1, line2 = _split_label(label, 36)
        ry = 26.0 if line2 else 23.0
        rx = min(max_rx_p, max(94, 7.0 * max(len(line1), len(line2 or ""))))
        prim_pos.append((px, cy, rx, ry))
        if line2:
            tspan = (
                f'<tspan x="{px}" dy="-5">{_esc(line1)}</tspan>'
                f'<tspan x="{px}" dy="12">{_esc(line2)}</tspan>'
            )
            ty = cy
        else:
            tspan = _esc(line1)
            ty = cy
        prim_elems.append(
            f'<ellipse class="uc" cx="{px}" cy="{cy}" rx="{rx}" ry="{ry}"/>'
            f'<text class="uc-text" x="{px}" y="{ty}" font-size="{font_primary}px">{tspan}</text>'
        )

    sec_elems: list[str] = []
    sec_pos: list[tuple[float, float, float, float]] = []

    max_rx_s = 148
    for j, label in enumerate(secondaries):
        cy = sy0 + j * step_s
        line1, line2 = _split_label(label, 34)
        ry = 24.0 if line2 else 21.0
        rx = min(max_rx_s, max(86, 6.6 * max(len(line1), len(line2 or ""))))
        sec_pos.append((sx, cy, rx, ry))
        if line2:
            tspan = (
                f'<tspan x="{sx}" dy="-4">{_esc(line1)}</tspan>'
                f'<tspan x="{sx}" dy="11">{_esc(line2)}</tspan>'
            )
            ty = cy
        else:
            tspan = _esc(line1)
            ty = cy
        sec_elems.append(
            f'<ellipse class="uc" cx="{sx}" cy="{cy}" rx="{rx}" ry="{ry}"/>'
            f'<text class="uc-text" x="{sx}" y="{ty}" font-size="{font_secondary}px">{tspan}</text>'
        )

    ay = height / 2 - 42
    actor_block = f"""
  <g transform="translate(82, {ay:.0f})">
    <circle cx="0" cy="14" r="12" fill="none" stroke="#000" stroke-width="1.6"/>
    <line x1="0" y1="26" x2="0" y2="72" stroke="#000" stroke-width="1.6"/>
    <line x1="-28" y1="42" x2="28" y2="42" stroke="#000" stroke-width="1.6"/>
    <line x1="0" y1="72" x2="-22" y2="118" stroke="#000" stroke-width="1.6"/>
    <line x1="0" y1="72" x2="22" y2="118" stroke="#000" stroke-width="1.6"/>
  </g>
  <text class="actor-name" x="82" y="{ay + 152:.0f}">{_esc(actor)}</text>"""

    assoc_lines: list[str] = []
    ax, a_mid_y = 82, ay + 52
    for pi in actor_to_primaries:
        tcx, tcy, trx, _ = prim_pos[pi]
        x1, y1 = ax + 30, a_mid_y
        x2, y2 = tcx - trx, tcy
        assoc_lines.append(f'<line class="assoc" x1="{x1:.0f}" y1="{y1:.0f}" x2="{x2:.0f}" y2="{y2:.0f}"/>')

    dep_lines: list[str] = []
    for dep in dependencies:
        px_, py_, prx, _ = prim_pos[dep.primary_index]
        sx_, sy_, srx, _ = sec_pos[dep.secondary_index]
        x1, y1 = px_ + prx, py_
        x2, y2 = sx_ - srx, sy_
        mid_x = (x1 + x2) / 2
        mid_y = (y1 + y2) / 2 - 8
        stereo = _esc(dep.stereotype)
        dep_lines.append(
            f'<path class="dep" d="M {x1:.0f} {y1:.0f} L {x2:.0f} {y2:.0f}"/>'
            f'<text class="stereo" x="{mid_x:.0f}" y="{mid_y:.0f}" text-anchor="middle">{stereo}</text>'
        )

    title_w = min(380, max(210, int(len(title) * 7.8)))
    title_x = (width - title_w) / 2

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height:.0f}" viewBox="0 0 {width} {height:.0f}">
  <defs>
    <marker id="{marker_id}" markerWidth="12" markerHeight="10" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M 0 0 L 10 5 L 0 10" fill="none" stroke="#000" stroke-width="1.4"/>
    </marker>
    <style>
      .boundary {{ fill: #fff; stroke: #111; stroke-width: 2.2; }}
      .uc {{ fill: #1fa3a0; stroke: #000; stroke-width: 1.15; }}
      .uc-text {{ font-family: Consolas, 'DejaVu Sans Mono', monospace; fill: #000; text-anchor: middle; dominant-baseline: middle; }}
      .title-box {{ fill: #111; }}
      .title-text {{ font-family: Consolas, 'DejaVu Sans Mono', monospace; font-size: 12.2px; fill: #fff; font-weight: bold; }}
      .actor-name {{ font-family: Consolas, 'DejaVu Sans Mono', monospace; font-size: 11px; fill: #000; text-anchor: middle; }}
      .assoc {{ stroke: #000; stroke-width: 1.45; fill: none; }}
      .dep {{ stroke: #000; stroke-width: 1.45; fill: none; stroke-dasharray: 7 5; marker-end: url(#{marker_id}); }}
      .stereo {{ font-family: Consolas, 'DejaVu Sans Mono', monospace; font-size: 8px; fill: #111; font-style: italic; }}
    </style>
  </defs>
  <ellipse class="boundary" cx="{cx_b:.0f}" cy="{cy_b:.0f}" rx="{rx_b:.0f}" ry="{ry_b:.0f}"/>
  <rect class="title-box" x="{title_x:.0f}" y="46" width="{title_w}" height="34"/>
  <text class="title-text" x="{title_x + title_w / 2:.0f}" y="68" text-anchor="middle">{_esc(title)}</text>
  {actor_block}
  {"".join(prim_elems)}
  {"".join(sec_elems)}
  {"".join(assoc_lines)}
  {"".join(dep_lines)}
</svg>"""
