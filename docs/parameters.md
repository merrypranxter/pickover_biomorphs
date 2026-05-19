# Parameter Space Navigation

Every biomorph lives at a specific location in a high-dimensional parameter space. Moving through that space is speciation — small movements produce mutations, large movements produce entirely different organisms or extinction (no organism at all).

This document maps the parameters and their biological effects.

---

## The Mutation Parameter c

In the Julia approach (used by most shaders here), c is the **mutation parameter** — a single complex number that determines the entire morphology. The mouse maps to c:

```glsl
vec2 mutation = BASE_C + (mouse_norm - 0.5) * SENSITIVITY;
```

### The c-plane as an organism atlas

Every value of c in the complex plane corresponds to a different organism. The **Mandelbrot set** for a function f is the map of which c-values produce living organisms (bounded orbits). The boundary of this set is where the most complex organisms live.

**Key regions of the c-plane** (for z² + c):

| Region | c range | Morphology |
|--------|---------|------------|
| Interior of main cardioid | |c - 0.25| < 0.25 | Simple, symmetric, no filaments |
| Period-2 bulb | |c + 1| < 0.25 | Two-lobed organism, bilateral |
| Period-3 bulb | Near c ≈ -0.12 + 0.74i | Three-fold symmetry, three filament tips |
| Boundary (Misiurewicz points) | Fractal boundary | Maximum complexity — most biological-looking |
| Outside | |c| > 2 | No organism — orbit escapes immediately |

### Moving c: mutation effects

| Direction | Effect |
|-----------|--------|
| Increase Re(c) | Stretches along the real axis; bilateral symmetry changes |
| Increase Im(c) | Rotates the primary symmetry axis; organism tilts |
| Move toward boundary | Increases complexity: more filaments, finer structure |
| Move to center of a bulb | Simplifies toward a smooth, rounded organism |
| Cross a bifurcation boundary | Sudden morphological change — a new lobe or axis appears |

**Practical navigation**: start at the base c value. Move the mouse in small increments near the boundary of the alive region. The most interesting organisms are found where survival/escape transitions happen — on the edge, organisms have the maximum number of filaments and the finest detail.

---

## Iteration Parameters

### MAX_ITER

The maximum number of iterations before a point is considered "alive" (no escape detected).

- **Too low**: coarse, banded coloring; organisms lack interior detail
- **Too high**: slow performance; minimal visual improvement once the organism boundary is resolved
- **Sweet spot**: where the finest boundary filaments are resolved but computation is still fast

Typical values by function:

| Function | Recommended MAX_ITER |
|----------|---------------------|
| z² + c   | 80–150 |
| z³ + c   | 60–100 (escapes faster) |
| sin(z) + c | 60–100 |
| z·sin(z) + c | 100–150 (slow convergence) |
| exp(z) + c | 60–90 (very fast escape) |

**In the shaders**: the `iter_ratio` variable maps the final iteration count to [0,1]. It is a crucial coloring parameter — it encodes how long the orbit survived, which corresponds to biological "depth" (surface vs. interior structures).

### ESCAPE_THRESH

The radius at which a point is declared "escaped to infinity."

Under Pickover's axis condition, the effective escape radius is already limited by the `PICKOVER_BAILOUT` parameter. The `ESCAPE_THRESH` in the shaders is a safety net for orbits that grow large in |z| but not necessarily in both components simultaneously.

- For `z² + c`: a bound of |z| > 2 guarantees escape; `ESCAPE_THRESH = 50` is generous
- For `sin(z) + c`: sin can grow without bound on the imaginary axis; `ESCAPE_THRESH = 40–60` is appropriate
- For `exp(z) + c`: exponential growth is extremely fast; `ESCAPE_THRESH = 40` is usually sufficient

### CONV_THRESH

The convergence threshold: if `|length(zₙ) - length(zₙ₋₁)| < CONV_THRESH`, the orbit is considered settled.

This is an added stability detector not in Pickover's original algorithm. Its effects:
- **Smooths convergence zones** by catching settled orbits before MAX_ITER
- **Speeds up rendering** in interior regions
- **Affects the wander metric**: once convergence is detected, wander accumulation stops

Setting CONV_THRESH too low (< 0.0001) makes it effectively inactive. Too high (> 0.01) can incorrectly mark chaotic orbits as converged, creating incorrect interior structure.

---

## The Zoom and Viewport

### Coordinate mapping

The shaders map screen coordinates to the complex plane:

```glsl
vec2 c_pixel = (st + offset) * zoom;
```

The `zoom` and `offset` parameters define which region of the complex plane is visible. This is equivalent to choosing which part of the organism atlas you're looking at.

### Biological interpretation

- **Zoom out**: see the entire organism and its nearest relatives in the atlas
- **Zoom in**: reveal finer structure — the fractal boundary of the organism
- **Slow time-varying zoom**: simulates a microscope being adjusted — the organism breathes as the scale changes

### Resolution independence

The GLSL shaders are resolution-independent — each pixel is computed analytically from its complex coordinate. There is no pixelation or interpolation artifact at any zoom level.

---

## The Wander Metric as Parameter

The wander metric (see `docs/algorithm.md`) accumulates radial variation in the orbit:

```glsl
wander += |length(z_n) - length(z_{n-1})|
wander /= float(MAX_ITER);  // normalize to [0,1)
```

Wander is not a single parameter you set — it is a **derived quantity** that emerges from the orbit. But it has strong visual effects as the coloring driver:

| Wander value | Biological zone |
|-------------|-----------------|
| ≈ 0.0 | Dead (escaped) OR deeply converged core |
| 0.01–0.05 | Living boundary: shell, membrane, cuticle |
| 0.05–0.15 | Active zone: tendril, appendage, spine |
| > 0.15 | High-wander fringe: most complex boundary structures |

The `alive` mask in the shaders uses wander to create a smooth organism edge:

```glsl
float alive = 1.0 - smoothstep(0.0, WANDER_WIDTH, wander + (converged ? 0.0 : DEAD_OFFSET));
```

Adjusting `WANDER_WIDTH` (the second argument of smoothstep) changes the sharpness of the organism boundary. Small values → sharp, hard-edged organisms. Large values → diffuse, jellyfish-like boundaries.

---

## Function Parameters

### Choosing a generator function

The generator function is the most fundamental parameter — the organism's "genus":

| Function | Biological archetype | Symmetry |
|----------|---------------------|----------|
| `z² + c` | Universal biomorph — all forms | 2-fold (bilateral) |
| `z³ + c` | Spirochetes, helicoids | 3-fold (triangular) |
| `z⁴ + c` | 4-fold symmetric organisms | 4-fold (square) |
| `sin(z) + c` | Embryos, soft-bodied organisms | Lobe-based |
| `cos(z) + c` | Diatoms, bilateral organisms | Bilateral mirror |
| `z·sin(z) + c` | Radiolarians, heliozoans | Radial spines |
| `exp(z) + c` | Comb-jellies, exponential forms | Angular bands |
| `z^z + c` | Insectoids, complex segmented | Variable (self-referential) |

### Mixing functions

Hybrid functions are created by linear combination:

```
f(z, c) = α · f₁(z, c) + (1-α) · f₂(z, c)
```

At `α = 0.5`, you are midway between two species. The transition is not always smooth — there are bifurcation points where the hybrid suddenly changes morphology. These discontinuities are biologically analogous to Hox gene mutations: a small parameter change causes a body-plan change rather than a gradual morph.

See `_hybrid_mutation.frag` for an example (`z^z + z^c`) and `species/taxonomy.md` for the hybrid rules.

---

## Finding New Species

### Systematic exploration

1. **Fix the function, explore c**: raster-scan a grid of c-values. Each is a different organism. The boundary of the Mandelbrot set for the function is where the most complex organisms live.

2. **Fix c, change function**: keep a specific c-value and swap the generator function. This is equivalent to speciation — same "environment" (c), different "genetics" (function).

3. **Vary both simultaneously**: move in the joint (c, f) space. This produces hybrids and mutations.

### Signs of an interesting organism

- The organism has **recognizable structure** — visible concentric zones, filaments, spines
- The boundary is **complex but not fuzzy** — sharp enough to see anatomy
- The wander metric produces **distinct zones** at different values (not uniformly high or low)
- The parameter is **near a bifurcation** — nearby organisms look radically different

### Extinction

Not every c-value produces an organism. If the orbit escapes on the first iteration for almost all starting points, the parameter is "outside the Mandelbrot set" — no organism exists there. The transition from alive/complex to empty/dead happens at the Mandelbrot boundary.

---

## The Python Explorer

For systematic parameter space exploration at high resolution, see `python/biomorph.py`. It implements the same algorithm as the GLSL shaders but in NumPy, allowing:

- Full-parameter-space scans (render every c value in a grid)
- High-resolution single-organism renders
- Animated parameter mutations exported as image sequences
- Statistical analysis of wander distributions across the parameter plane
