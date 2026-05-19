"""
biomorph.py — Pickover biomorph renderer in NumPy

Renders any of the biomorph species from this repository at arbitrary resolution,
with the same algorithms as the GLSL shaders. All species use the Julia approach
(z₀ = pixel, mutation = fixed parameter) except the spore, which uses the
Mandelbrot approach (z₀ = 0, c = pixel) with Pickover's original axis bailout.

Requirements:
    numpy, Pillow (PIL)
    pip install numpy pillow

Optional (for interactive exploration):
    matplotlib
    pip install matplotlib

Usage:
    python biomorph.py                          # render all species, save PNGs
    python biomorph.py --species spore          # render one species
    python biomorph.py --species radiolarian --width 1920 --height 1080
    python biomorph.py --explore insectoid      # interactive matplotlib explorer
    python biomorph.py --mutate embryonic 60    # animate 60 frames of mutation

Species: insectoid, embryonic, radiolarian, hybrid, spirochete, diatom, ctenophore, spore
"""

import argparse
import math
import sys
import time
from pathlib import Path
from typing import Optional, Tuple

import numpy as np

try:
    from PIL import Image
except ImportError:
    print("Pillow is required: pip install pillow", file=sys.stderr)
    sys.exit(1)


# ── Complex arithmetic (vectorized) ──────────────────────────────────────────

def cmul(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Complex multiply: a * b, each as (..., 2) arrays [Re, Im]."""
    return np.stack([
        a[..., 0] * b[..., 0] - a[..., 1] * b[..., 1],
        a[..., 0] * b[..., 1] + a[..., 1] * b[..., 0],
    ], axis=-1)


def cabs(z: np.ndarray) -> np.ndarray:
    """Complex modulus: |z|."""
    return np.sqrt(z[..., 0] ** 2 + z[..., 1] ** 2)


def carg(z: np.ndarray) -> np.ndarray:
    """Complex argument: atan2(Im, Re) ∈ [-π, π]."""
    return np.arctan2(z[..., 1], z[..., 0])


def cexp(z: np.ndarray) -> np.ndarray:
    """Complex exponential: exp(x + iy) = e^x * (cos(y), sin(y))."""
    ex = np.exp(z[..., 0])
    return np.stack([ex * np.cos(z[..., 1]), ex * np.sin(z[..., 1])], axis=-1)


def clog(z: np.ndarray) -> np.ndarray:
    """Complex logarithm: log(z) = (log|z|, arg(z))."""
    return np.stack([np.log(np.maximum(cabs(z), 1e-10)), carg(z)], axis=-1)


def cpow(z: np.ndarray, w: np.ndarray) -> np.ndarray:
    """Complex power: z^w = exp(w * log(z))."""
    r = cabs(z)
    safe = r > 1e-7
    # Guard against log(0): set z to tiny value where r is too small
    z_safe = z.copy()
    z_safe[~safe] = 1e-7
    return cexp(cmul(w, clog(z_safe))) * safe[..., np.newaxis]


def csin(z: np.ndarray) -> np.ndarray:
    """Complex sine: sin(x + iy) = sin(x)cosh(y) + i*cos(x)sinh(y)."""
    return np.stack([
        np.sin(z[..., 0]) * np.cosh(z[..., 1]),
        np.cos(z[..., 0]) * np.sinh(z[..., 1]),
    ], axis=-1)


def ccos(z: np.ndarray) -> np.ndarray:
    """Complex cosine: cos(x + iy) = cos(x)cosh(y) - i*sin(x)sinh(y)."""
    return np.stack([
        np.cos(z[..., 0]) * np.cosh(z[..., 1]),
        -np.sin(z[..., 0]) * np.sinh(z[..., 1]),
    ], axis=-1)


# ── Generator functions ───────────────────────────────────────────────────────

def gen_insectoid(z, mut):
    """z^z + c — self-exponentiation, produces segmented insect-like forms."""
    return cpow(z, z) + mut


def gen_embryonic(z, mut):
    """sin(z) + c — soft, lobed, embryonic forms."""
    return csin(z) + mut


def gen_radiolarian(z, mut):
    """z*sin(z) + c — radial spines on a central capsule."""
    return cmul(z, csin(z)) + mut


def gen_hybrid(z, mut):
    """z^z + z^c — dual self-exponentiation, bioluminescent unknown class."""
    return cpow(z, z) + cpow(z, mut)


def gen_spirochete(z, mut):
    """z^3 + c — cubic, three-fold symmetry, helical bacterium."""
    z2 = cmul(z, z)
    return cmul(z2, z) + mut


def gen_diatom(z, mut):
    """cos(z) + c — bilateral symmetry, pennate diatom frustule."""
    return ccos(z) + mut


def gen_ctenophore(z, mut):
    """exp(z) + c — exponential comb-jelly, iridescent comb plates."""
    return cexp(z) + mut


def gen_spore(z, c):
    """z^2 + c — Pickover's original iteration (used with Mandelbrot approach)."""
    return cmul(z, z) + c


# ── Species registry ──────────────────────────────────────────────────────────

SPECIES = {
    "insectoid": {
        "fn": gen_insectoid,
        "base_c": (0.5, 0.1),
        "max_iter": 80,
        "escape": 50.0,
        "conv": 0.001,
        "zoom": 3.0,
        "offset": (-2.0, -1.5),
        "mode": "julia",
    },
    "embryonic": {
        "fn": gen_embryonic,
        "base_c": (0.3, 0.4),
        "max_iter": 60,
        "escape": 40.0,
        "conv": 0.0005,
        "zoom": 4.0,
        "offset": (-2.0, -2.0),
        "mode": "julia",
    },
    "radiolarian": {
        "fn": gen_radiolarian,
        "base_c": (0.2, 0.15),
        "max_iter": 100,
        "escape": 60.0,
        "conv": 0.0008,
        "zoom": 5.0,
        "offset": (-2.5, -2.5),
        "mode": "julia",
    },
    "hybrid": {
        "fn": gen_hybrid,
        "base_c": (0.4, 0.25),
        "max_iter": 120,
        "escape": 55.0,
        "conv": 0.0006,
        "zoom": 4.5,
        "offset": (-2.25, -2.25),
        "mode": "julia",
    },
    "spirochete": {
        "fn": gen_spirochete,
        "base_c": (-0.4, 0.6),
        "max_iter": 90,
        "escape": 45.0,
        "conv": 0.0007,
        "zoom": 3.5,
        "offset": (-1.8, -1.75),
        "mode": "julia",
    },
    "diatom": {
        "fn": gen_diatom,
        "base_c": (0.7, 0.2),
        "max_iter": 70,
        "escape": 50.0,
        "conv": 0.0006,
        "zoom": 4.0,
        "offset": (-2.0, -2.0),
        "mode": "julia",
    },
    "ctenophore": {
        "fn": gen_ctenophore,
        "base_c": (-1.5, 0.1),
        "max_iter": 80,
        "escape": 40.0,
        "conv": 0.0008,
        "zoom": 2.5,
        "offset": (-1.25, -1.25),
        "mode": "julia",
    },
    "spore": {
        "fn": gen_spore,
        "base_c": (-0.5, 0.0),   # view center (Mandelbrot approach: c = pixel)
        "max_iter": 100,
        "escape": 50.0,
        "pickover_bailout": 10.0,  # Pickover's axis-aligned escape threshold
        "conv": None,              # No convergence check in Mandelbrot mode
        "zoom": 2.8,
        "offset": None,            # Offset determined by base_c in Mandelbrot mode
        "mode": "mandelbrot",
    },
}


# ── Orbit computation ─────────────────────────────────────────────────────────

def compute_orbits_julia(
    c_grid: np.ndarray,
    mutation: np.ndarray,
    fn,
    max_iter: int,
    escape_thresh: float,
    conv_thresh: float,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Julia approach: z₀ = c_grid, iterate z = fn(z, mutation).

    Returns:
        wander     (H, W) — normalized total radial variation
        iter_ratio (H, W) — normalized survival iteration count
        final_arg  (H, W) — atan2(z_final) in radians
        converged  (H, W) bool — did the orbit converge?
    """
    shape = c_grid.shape[:2]
    z = c_grid.copy()
    mut = np.broadcast_to(mutation, z.shape).copy()

    wander = np.zeros(shape, dtype=np.float64)
    iter_out = np.full(shape, max_iter - 1, dtype=np.int32)
    last_len = cabs(z)
    converged = np.zeros(shape, dtype=bool)
    active = np.ones(shape, dtype=bool)  # pixels still iterating

    for i in range(max_iter):
        if not np.any(active):
            break

        z_new = fn(z, mut)
        # Clamp to avoid inf propagation poisoning neighbors
        z_new = np.where(np.isfinite(z_new), z_new, np.zeros_like(z_new))

        length = cabs(z_new)

        # Escape detection
        escaped = active & (length > escape_thresh)
        iter_out[escaped] = i
        active[escaped] = False

        # Convergence detection
        if conv_thresh is not None and i > 5:
            delta = np.abs(length - last_len)
            conv = active & (delta < conv_thresh)
            converged[conv] = True
            iter_out[conv] = i
            active[conv] = False

        # Wander accumulation (only for still-active pixels)
        if i > 0:
            delta = np.abs(length - last_len)
            wander[active] += delta[active]

        z[active] = z_new[active]
        last_len = length

    final_arg = carg(z)
    wander = wander / float(max_iter)
    iter_ratio = iter_out.astype(np.float64) / float(max_iter)

    return wander, iter_ratio, final_arg, converged


def compute_orbits_mandelbrot_spore(
    c_grid: np.ndarray,
    max_iter: int,
    escape_thresh: float,
    pickover_bailout: float,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Mandelbrot approach with Pickover's authentic axis-aligned escape condition.
    z₀ = 0, iterate z = z² + c.

    Escape condition: |Re(z)| > pickover_bailout AND |Im(z)| > pickover_bailout

    Returns:
        alive      (H, W) bool — survived all iterations
        iter_ratio (H, W) — normalized survival count
        stalk_x    (H, W) — how often |Re| alone was keeping point alive
        stalk_y    (H, W) — how often |Im| alone was keeping point alive
    """
    shape = c_grid.shape[:2]
    z = np.zeros_like(c_grid)

    alive = np.ones(shape, dtype=bool)
    iter_out = np.zeros(shape, dtype=np.int32)
    stalk_x = np.zeros(shape, dtype=np.float64)
    stalk_y = np.zeros(shape, dtype=np.float64)

    for i in range(max_iter):
        if not np.any(alive):
            break

        z_new = gen_spore(z, c_grid)
        z_new = np.where(np.isfinite(z_new), z_new, np.full_like(z_new, 1e9))

        re_abs = np.abs(z_new[..., 0])
        im_abs = np.abs(z_new[..., 1])
        mag2 = re_abs ** 2 + im_abs ** 2

        # Pickover axis escape: BOTH components must exceed the bailout
        pickover_escape = alive & (re_abs > pickover_bailout) & (im_abs > pickover_bailout)
        # Standard circular safety net
        std_escape = alive & (mag2 > escape_thresh ** 2)

        escaped = pickover_escape | std_escape
        iter_out[escaped] = i
        alive[escaped] = False

        # Track stalk accumulation while alive
        only_re_small = alive & (re_abs < pickover_bailout * 0.5)
        only_im_small = alive & (im_abs < pickover_bailout * 0.5)
        stalk_x[only_re_small] += 0.5
        stalk_y[only_im_small] += 0.5

        z[alive] = z_new[alive]
        iter_out[alive] = i + 1

    # Points surviving all iterations are alive
    alive_final = iter_out >= max_iter - 1

    iter_ratio = iter_out.astype(np.float64) / float(max_iter)
    stalk_x = stalk_x / float(max_iter)
    stalk_y = stalk_y / float(max_iter)

    return alive_final, iter_ratio, stalk_x, stalk_y


# ── Color mapping ─────────────────────────────────────────────────────────────

def smoothstep(lo: float, hi: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - lo) / (hi - lo), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def mix(a, b, t):
    return a * (1.0 - t) + b * t


def color_insectoid(wander, iter_ratio, final_arg):
    chitin      = np.array([0.18, 0.14, 0.08])
    membrane    = np.array([0.92, 0.85, 0.72])
    haemolymph  = np.array([0.55, 0.12, 0.08])
    nucleoplasm = np.array([0.25, 0.35, 0.20])

    cuticle = smoothstep(0.3, 0.7, iter_ratio) * (1.0 - wander)
    tendril = wander * smoothstep(0.2, 0.6, iter_ratio) * (1.0 - smoothstep(0.7, 0.9, iter_ratio))
    core    = (1.0 - iter_ratio) * (1.0 - wander)

    col = mix(membrane, chitin, cuticle[..., None])
    col = mix(col, haemolymph, tendril[..., None] * 0.7)
    col = mix(col, nucleoplasm, core[..., None] * 0.5)

    segment = np.sin(final_arg * 6.0) * 0.5 + 0.5
    col *= (0.8 + 0.2 * segment)[..., None]
    return col


def color_embryonic(wander, iter_ratio, final_arg):
    yolk      = np.array([0.95, 0.78, 0.25])
    cytoplasm = np.array([0.88, 0.92, 0.85])
    nucleus   = np.array([0.65, 0.25, 0.35])
    membrane  = np.array([0.72, 0.82, 0.88])

    yolk_density  = (1.0 - iter_ratio) * (1.0 - wander)
    membrane_int  = wander * smoothstep(0.3, 0.8, iter_ratio)

    col = mix(cytoplasm, yolk, yolk_density[..., None] * 0.8)
    col = mix(col, nucleus, yolk_density[..., None] * 0.4)
    col = mix(col, membrane, membrane_int[..., None] * 0.5)
    return col


def color_radiolarian(wander, iter_ratio, final_arg):
    silicate  = np.array([0.85, 0.90, 0.92])
    spine     = np.array([0.95, 0.95, 0.98])
    pore      = np.array([0.10, 0.15, 0.20])
    cytoplasm = np.array([0.20, 0.35, 0.30])

    capsule    = (1.0 - iter_ratio) * 0.8
    pore_field = smoothstep(0.4, 0.6, iter_ratio) * (1.0 - wander * 0.5)
    spine_d    = wander * smoothstep(0.2, 0.7, iter_ratio)

    col = mix(silicate, cytoplasm, capsule[..., None])
    col = mix(col, spine, spine_d[..., None] * 0.7)
    col = mix(col, pore,  pore_field[..., None] * 0.6)

    irid = np.sin(final_arg * 12.0 + iter_ratio * 20.0) * 0.5 + 0.5
    col += np.array([0.6, 0.8, 1.0]) * (irid * spine_d)[..., None] * 0.3
    return col


def color_hybrid(wander, iter_ratio, final_arg):
    luciferin    = np.array([0.05, 0.55, 0.80])
    photoprotein = np.array([0.10, 0.85, 0.65])
    void_black   = np.array([0.00, 0.00, 0.03])
    corona       = np.array([0.60, 0.15, 0.80])
    amber_ghost  = np.array([0.80, 0.55, 0.10])

    density = smoothstep(0.0, 0.15, wander)
    nucleus = (1.0 - iter_ratio) * (1.0 - wander)
    shell   = smoothstep(0.5, 0.9, iter_ratio) * wander
    ghost   = (1.0 - wander) * smoothstep(0.3, 0.6, iter_ratio)

    col = np.broadcast_to(void_black, wander.shape + (3,)).copy()
    col = mix(col, luciferin,    density[..., None] * 0.9)
    col = mix(col, photoprotein, nucleus[..., None])
    col = mix(col, corona,       shell[..., None] * 0.6)
    col = mix(col, amber_ghost,  ghost[..., None] * 0.25)
    return col


def color_spirochete(wander, iter_ratio, final_arg):
    safranin  = np.array([0.85, 0.25, 0.28])
    nucleoid  = np.array([0.18, 0.22, 0.42])
    flagellum = np.array([0.92, 0.80, 0.55])
    cytoplasm = np.array([0.88, 0.78, 0.72])

    filament = wander * smoothstep(0.2, 0.7, iter_ratio)
    core     = (1.0 - iter_ratio) * (1.0 - wander)
    tip      = smoothstep(0.75, 0.95, iter_ratio) * (1.0 - wander)

    col = np.broadcast_to(cytoplasm, wander.shape + (3,)).copy()
    col = mix(col, safranin,  filament[..., None] * 0.75)
    col = mix(col, nucleoid,  core[..., None] * 0.7)
    col = mix(col, flagellum, tip[..., None] * 0.6)

    segment = np.sin(final_arg * 9.0) * 0.5 + 0.5
    col *= (0.82 + 0.18 * segment)[..., None]
    return col


def color_diatom(wander, iter_ratio, final_arg):
    frustule    = np.array([0.78, 0.84, 0.90])
    chloroplast = np.array([0.72, 0.58, 0.18])
    protoplast  = np.array([0.85, 0.70, 0.30])

    shell  = smoothstep(0.3, 0.75, iter_ratio) * (1.0 - wander * 0.5)
    chloro = (1.0 - iter_ratio) * (1.0 - wander) * 0.9

    col = np.broadcast_to(protoplast, wander.shape + (3,)).copy()
    col = mix(col, frustule,    shell[..., None] * 0.8)
    col = mix(col, chloroplast, chloro[..., None])

    striae = np.power(np.abs(np.sin(final_arg * 16.0)), 4.0)
    col += np.array([0.92, 0.94, 0.96]) * (striae * shell)[..., None] * 0.25
    return col


def color_ctenophore(wander, iter_ratio, final_arg):
    mesoglea = np.array([0.08, 0.14, 0.25])
    biolumin = np.array([0.10, 0.75, 0.55])
    tentacle = np.array([0.55, 0.70, 0.85])

    plate_phase = final_arg * 4.0 + iter_ratio * 8.0
    comb_irid = 0.5 + 0.5 * np.stack([
        np.sin(plate_phase),
        np.sin(plate_phase + 2.094),
        np.sin(plate_phase + 4.189),
    ], axis=-1)

    canal        = np.power(np.abs(np.sin(final_arg * 4.0)), 0.4)
    comb_density = canal * smoothstep(0.3, 0.7, iter_ratio) * (1.0 - wander * 0.5)
    edge         = smoothstep(0.04, 0.12, wander) * (1.0 - smoothstep(0.3, 0.65, wander))
    tendril      = wander * smoothstep(0.4, 0.9, iter_ratio)

    col = np.broadcast_to(mesoglea, wander.shape + (3,)).copy()
    col += comb_irid * comb_density[..., None] * 0.7
    col = mix(col, biolumin, edge[..., None] * 0.8)
    col = mix(col, tentacle, tendril[..., None] * 0.4)
    return col


def color_spore(alive, iter_ratio, stalk_x, stalk_y):
    episporium = np.array([0.72, 0.60, 0.35])
    exosporium = np.array([0.62, 0.28, 0.22])
    cortex     = np.array([0.75, 0.70, 0.80])
    core       = np.array([0.15, 0.18, 0.38])
    stalk_col  = np.array([0.82, 0.72, 0.45])
    bg         = np.array([0.90, 0.88, 0.84])

    stalk = np.maximum(stalk_x, stalk_y)
    outer = smoothstep(0.5, 0.85, iter_ratio)
    thick = smoothstep(0.25, 0.6, iter_ratio) * (1.0 - outer)
    inner = smoothstep(0.08, 0.3, iter_ratio) * (1.0 - thick - outer)
    core_z = 1.0 - smoothstep(0.0, 0.15, iter_ratio)

    col = np.broadcast_to(core, iter_ratio.shape + (3,)).copy()
    col = mix(col, cortex,     inner[..., None])
    col = mix(col, exosporium, thick[..., None])
    col = mix(col, episporium, outer[..., None])
    col = mix(col, stalk_col,  stalk[..., None] * 0.6)

    # PAS stain on thick wall
    pas = np.array([0.90, 0.28, 0.55])
    col = mix(col, pas, (thick * 0.4)[..., None])

    # Mix organism over warm white background
    alive_mask = alive[..., None].astype(float)
    col = mix(bg, col * 0.85 + bg * 0.15, alive_mask)
    return col


COLOR_FNS = {
    "insectoid":  color_insectoid,
    "embryonic":  color_embryonic,
    "radiolarian": color_radiolarian,
    "hybrid":     color_hybrid,
    "spirochete": color_spirochete,
    "diatom":     color_diatom,
    "ctenophore": color_ctenophore,
    "spore":      color_spore,   # different signature — handled separately
}


# ── Rendering ─────────────────────────────────────────────────────────────────

def build_grid(width: int, height: int, zoom: float, offset: Tuple[float, float]) -> np.ndarray:
    """Build the complex plane coordinate grid for the Julia approach."""
    aspect = width / height
    xs = (np.linspace(0, 1, width) * aspect + offset[0]) * zoom
    ys = (np.linspace(0, 1, height) + offset[1]) * zoom
    xx, yy = np.meshgrid(xs, ys)
    return np.stack([xx, yy], axis=-1)   # (H, W, 2)


def build_grid_mandelbrot(
    width: int, height: int, zoom: float, center: Tuple[float, float]
) -> np.ndarray:
    """Build the complex plane coordinate grid for the Mandelbrot approach."""
    aspect = width / height
    xs = (np.linspace(-0.5, 0.5, width) * aspect * zoom) + center[0]
    ys = (np.linspace(-0.5, 0.5, height) * zoom) + center[1]
    xx, yy = np.meshgrid(xs, np.flipud(ys))
    return np.stack([xx, yy], axis=-1)


def render_species(
    species_name: str,
    width: int = 1024,
    height: int = 768,
    mutation: Optional[Tuple[float, float]] = None,
) -> np.ndarray:
    """
    Render a species and return an RGB image array (H, W, 3) in [0, 1].

    Parameters
    ----------
    species_name : str
        One of the keys in SPECIES.
    width, height : int
        Output resolution.
    mutation : (float, float) or None
        Override the default mutation parameter c. If None, uses base_c.
    """
    spec = SPECIES[species_name]
    fn = spec["fn"]
    max_iter = spec["max_iter"]
    escape = spec["escape"]
    conv = spec.get("conv")
    mode = spec["mode"]

    if mutation is None:
        mut_re, mut_im = spec["base_c"]
    else:
        mut_re, mut_im = mutation

    if mode == "mandelbrot":
        # Spore: Pickover's authentic algorithm
        center = (mut_re, mut_im)
        grid = build_grid_mandelbrot(width, height, spec["zoom"], center)
        bailout = spec.get("pickover_bailout", 10.0)

        t0 = time.perf_counter()
        alive, iter_ratio, stalk_x, stalk_y = compute_orbits_mandelbrot_spore(
            grid, max_iter, escape, bailout
        )
        elapsed = time.perf_counter() - t0
        print(f"  orbit computation: {elapsed:.2f}s")

        col = color_spore(alive, iter_ratio, stalk_x, stalk_y)

    else:
        # Julia approach
        grid = build_grid(width, height, spec["zoom"], spec["offset"])
        mut = np.array([mut_re, mut_im])

        t0 = time.perf_counter()
        wander, iter_ratio, final_arg, converged = compute_orbits_julia(
            grid, mut, fn, max_iter, escape, conv
        )
        elapsed = time.perf_counter() - t0
        print(f"  orbit computation: {elapsed:.2f}s")

        color_fn = COLOR_FNS[species_name]
        col = color_fn(wander, iter_ratio, final_arg)

        # Apply alive mask
        alive_mask = 1.0 - smoothstep(0.0, 0.05, wander + np.where(converged, 0.0, 0.1))
        col = col * alive_mask[..., None]

    # Vignette
    ys_n = np.linspace(0, 1, height)
    xs_n = np.linspace(0, 1, width)
    xx_n, yy_n = np.meshgrid(xs_n, ys_n)
    r = np.sqrt((xx_n - 0.5) ** 2 + (yy_n - 0.5) ** 2)
    vig = 1.0 - smoothstep(0.5, 1.5, r)
    col = col * vig[..., None]

    return np.clip(col, 0.0, 1.0)


def save_png(arr: np.ndarray, path) -> None:
    """Save a (H, W, 3) float array in [0, 1] as a PNG."""
    img = Image.fromarray((arr * 255).astype(np.uint8), mode="RGB")
    img.save(path)
    print(f"  saved: {path}")


# ── Interactive explorer (requires matplotlib) ────────────────────────────────

def explore(species_name: str, width: int = 512, height: int = 512) -> None:
    """Interactive matplotlib explorer: click to set mutation parameter."""
    try:
        import matplotlib.pyplot as plt
        import matplotlib.patches as mpatches
    except ImportError:
        print("matplotlib is required for explore mode: pip install matplotlib", file=sys.stderr)
        return

    spec = SPECIES[species_name]
    mut_re, mut_im = spec["base_c"]

    fig, axes = plt.subplots(1, 2, figsize=(14, 6))
    fig.suptitle(f"_{species_name} explorer", fontsize=12, fontfamily="monospace")

    # Left: parameter space (Mandelbrot-like map)
    print(f"Computing parameter map for {species_name}...")
    param_grid = build_grid_mandelbrot(width // 2, height // 2, spec["zoom"] * 0.8,
                                        spec["base_c"])
    fn = spec["fn"]
    mut = np.array([mut_re, mut_im])

    # Quick low-res parameter scan
    wander_map, iter_map, arg_map, _ = compute_orbits_julia(
        param_grid, np.zeros(2), fn, max_iter=40,
        escape_thresh=spec["escape"], conv_thresh=spec.get("conv", 0.001)
    )
    param_preview = np.clip(
        np.stack([wander_map * 3, iter_map, arg_map / (2 * math.pi) + 0.5], axis=-1),
        0, 1
    )
    axes[0].imshow(param_preview, origin="lower", aspect="auto")
    axes[0].set_title("parameter space (click to mutate)", fontsize=9, fontfamily="monospace")
    axes[0].axis("off")
    marker = axes[0].plot([width // 4], [height // 4], "w+", markersize=10)[0]

    # Right: current organism
    print(f"Rendering {species_name} at c=({mut_re:.3f}, {mut_im:.3f})...")
    arr = render_species(species_name, width, height)
    im = axes[1].imshow(arr, origin="lower", aspect="auto")
    axes[1].set_title(f"c = ({mut_re:.4f}, {mut_im:.4f})", fontsize=9, fontfamily="monospace")
    axes[1].axis("off")

    plt.tight_layout()

    def on_click(event):
        nonlocal mut_re, mut_im
        if event.inaxes != axes[0]:
            return
        # Map click to mutation parameter
        px = int(np.clip(event.xdata, 0, width // 2 - 1))
        py = int(np.clip(event.ydata, 0, height // 2 - 1))
        new_c = param_grid[py, px]
        mut_re, mut_im = float(new_c[0]), float(new_c[1])

        print(f"Mutating to c=({mut_re:.4f}, {mut_im:.4f})...")
        new_arr = render_species(species_name, width, height, (mut_re, mut_im))
        im.set_data(new_arr)
        axes[1].set_title(f"c = ({mut_re:.4f}, {mut_im:.4f})", fontsize=9, fontfamily="monospace")
        marker.set_xdata([px])
        marker.set_ydata([py])
        fig.canvas.draw()

    fig.canvas.mpl_connect("button_press_event", on_click)
    plt.show()


# ── Animation export ──────────────────────────────────────────────────────────

def mutate_animation(
    species_name: str,
    n_frames: int = 60,
    width: int = 512,
    height: int = 512,
    output_dir: str = ".",
) -> None:
    """
    Render N frames of a smooth mutation path through parameter space.
    Frames saved as PNG sequence for ffmpeg or Photoshop to assemble.

    The path orbits the base_c value in a small ellipse — guaranteed to stay
    near the organism without crossing into empty parameter space.
    """
    spec = SPECIES[species_name]
    base_re, base_im = spec["base_c"]
    out_path = Path(output_dir)
    out_path.mkdir(exist_ok=True)

    # Mutation orbit: small ellipse around base_c
    radius_re = 0.08
    radius_im = 0.05

    print(f"Rendering {n_frames} frames for {species_name}...")
    for i in range(n_frames):
        t = 2 * math.pi * i / n_frames
        c = (base_re + radius_re * math.cos(t), base_im + radius_im * math.sin(t))
        arr = render_species(species_name, width, height, c)
        fname = out_path / f"{species_name}_{i:04d}.png"
        save_png(arr, fname)
        print(f"  frame {i+1}/{n_frames}", end="\r")

    print(f"\nDone. {n_frames} frames in {out_path}/")
    print(f"Assemble with: ffmpeg -framerate 24 -i {species_name}_%04d.png -c:v libx264 -pix_fmt yuv420p {species_name}.mp4")


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Pickover biomorph renderer",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--species", "-s", default="all",
                        help="Species to render: " + ", ".join(SPECIES) + ", or 'all'")
    parser.add_argument("--width",  "-W", type=int, default=1024)
    parser.add_argument("--height", "-H", type=int, default=768)
    parser.add_argument("--output", "-o", default=".",
                        help="Output directory for PNG files")
    parser.add_argument("--explore", "-e", metavar="SPECIES",
                        help="Launch interactive matplotlib explorer for a species")
    parser.add_argument("--mutate",  "-m", nargs=2, metavar=("SPECIES", "FRAMES"),
                        help="Export mutation animation: --mutate embryonic 60")
    parser.add_argument("--mutation", nargs=2, type=float, metavar=("RE", "IM"),
                        help="Override mutation parameter c (Re Im)")

    args = parser.parse_args()

    if args.explore:
        explore(args.explore, args.width, args.height)
        return

    if args.mutate:
        species_name, n_frames = args.mutate[0], int(args.mutate[1])
        if species_name not in SPECIES:
            print(f"Unknown species: {species_name}", file=sys.stderr)
            sys.exit(1)
        mutate_animation(species_name, n_frames, args.width, args.height, args.output)
        return

    mutation = tuple(args.mutation) if args.mutation else None
    out_dir = Path(args.output)
    out_dir.mkdir(exist_ok=True)

    species_to_render = list(SPECIES.keys()) if args.species == "all" else [args.species]
    for name in species_to_render:
        if name not in SPECIES:
            print(f"Unknown species: {name}", file=sys.stderr)
            continue
        print(f"Rendering {name} at {args.width}×{args.height}...")
        t0 = time.perf_counter()
        arr = render_species(name, args.width, args.height, mutation)
        elapsed = time.perf_counter() - t0
        save_png(arr, out_dir / f"{name}.png")
        print(f"  total: {elapsed:.2f}s")


if __name__ == "__main__":
    main()
