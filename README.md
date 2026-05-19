# pickover_biomorphs

A creative coding project exploring Pickover biomorphs — mathematical organisms that emerge from complex function iteration, discovered by Clifford Pickover in the early 1990s.

## What Are Biomorphs?

Unlike escape-time fractals (Mandelbrot, Julia), biomorphs track *convergence behavior* rather than escape velocity. Points that neither explode to infinity nor collapse to a fixed point wander through the complex plane, tracing organic trajectories that produce insectoid, embryonic, and alien forms.

Pickover's key insight: change the escape condition from circular (`|z| > R`) to axis-aligned (`|Re(z)| > R AND |Im(z)| > R`). Points where only one component is large survive longer — creating axial filaments that look like biological appendages.

## Project Structure

```
index.html        # Standalone WebGL viewer — open in any browser, no server needed
shaders/          # GLSL fragment shaders — one per species
species/          # Parameter sets and taxonomy for different morphologies
environments/     # Substrate and medium shaders (glass slide, saline, oil, fluorescence)
microscopy/       # Post-processing: darkfield, phase contrast, fluorescence, brightfield
docs/             # Algorithm documentation, parameter guide, coloring science
python/           # NumPy biomorph renderer for high-resolution offline rendering
```

## Running

**Quickest path:** open `index.html` directly in a browser. All eight species are loaded; move the mouse to mutate the parameter `c`, click to freeze.

Each `.frag` shader is also self-contained — drop it into any fragment shader environment (Shadertoy, The Book of Shaders editor, local Three.js/GLSL canvas setup). Required uniforms:

| Uniform | Type | Description |
|---|---|---|
| `u_resolution` | `vec2` | Canvas size in pixels |
| `u_mouse` | `vec2` | Mouse position in pixels (y-up) |
| `u_time` | `float` | Elapsed time in seconds |

See `docs/rendering_guide.md` for setup instructions for Shadertoy, Three.js, and glslCanvas.

## Species

- [x] `_base_insectoid` — `z^z + c`, chitinous exoskeleton, darkfield
- [x] `_embryonic` — `sin(z) + c`, translucent membrane, phase contrast
- [x] `_radiolarian` — `z * sin(z) + c`, silicate spines, oil-immersion darkfield
- [x] `_hybrid_mutation` — `z^z + z^c`, unknown morphology, bioluminescent
- [x] `_spirochete` — `z^3 + c`, gram-negative helical bacterium, phase contrast
- [x] `_diatom` — `cos(z) + c`, pennate frustule, bilateral symmetry, brightfield
- [x] `_ctenophore` — `exp(z) + c`, iridescent comb-jelly, deep ocean darkfield
- [x] `_spore` — `z^2 + c`, authentic Pickover algorithm + axis bailout, brightfield

## Environments

Background and medium shaders, composited under the specimen layer:

- `glass_substrate.frag` — borosilicate slide with birefringence, Newton rings, dust
- `saline_medium.frag` — aqueous phase-contrast medium with Brownian scatter and caustics
- `oil_immersion.frag` — high-NA immersion oil with micro-inclusions, thermal shimmer, meniscus fringe
- `fluorescent_medium.frag` — dark epifluorescence background with autofluorescence, CCD noise, photobleaching

## Microscopy Post-Processing

Apply as a second render pass over the raw organism output:

- `darkfield.frag` — scattered-light glow against absolute black; also contains `gram_stain()` and `oil_immersion()` utilities
- `phase_contrast.frag` — bright-field background, halo at boundaries, interior shadow; edge detection via luminance gradient
- `fluorescence.frag` — three-channel (GFP/RFP/DAPI) false-color composite with bleed-through, photobleaching, CCD shot noise
- `brightfield.frag` — Köhler illumination with depth-of-field softening; `giemsa_stain()`, `wright_stain()`, `crystal_violet()` utilities

## Documentation

- `docs/algorithm.md` — the biomorph algorithm: Pickover's original escape condition, wander metric, orbit structure, mathematical properties
- `docs/parameters.md` — navigating parameter space: c-plane atlas, mutation effects, iteration parameters
- `docs/coloring.md` — color as anatomy: biological staining palettes, microscopy imaging modes, palette design process
- `docs/rendering_guide.md` — setup for Shadertoy/Three.js/glslCanvas, compositing pipeline, writing new species, debugging

## Python Renderer

`python/biomorph.py` implements all eight species as a NumPy renderer for high-resolution offline rendering, parameter space exploration, and animation export.

```bash
pip install numpy pillow
python python/biomorph.py                              # render all species
python python/biomorph.py --species radiolarian --width 3840 --height 2160
python python/biomorph.py --explore embryonic          # interactive explorer (requires matplotlib)
python python/biomorph.py --mutate spirochete 120      # 120-frame mutation animation
```

## References

- Pickover, C. (1990). *Computers, Pattern, Chaos and Beauty*. St. Martin's Press.
- Pickover, C. (1994). *Chaos in Wonderland*. St. Martin's Press.
- Peitgen, H.-O., Jürgens, H., Saupe, D. (1992). *Chaos and Fractals: New Frontiers of Science*. Springer.
- Douady, A., Hubbard, J.H. (1982). Itération des polynômes quadratiques complexes. *C. R. Acad. Sci. Paris*, 294.
- Milnor, J. (2006). *Dynamics in One Complex Variable*, 3rd ed. Princeton.

---

*This is a living taxonomy. New species are discovered through parameter mutation, not designed.*
