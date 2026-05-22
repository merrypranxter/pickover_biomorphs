# Pickover Biomorphs

**Mathematical organisms grown from complex iteration — rendered as microscopy specimens.**

A creative coding project implementing Clifford Pickover's biomorph algorithm as a full shader pipeline: eight taxonomically-named species, four microscopy imaging modes, four environmental substrates, a standalone WebGL viewer, and a high-resolution NumPy renderer. Forms emerge from iteration rules, not design.

---

## What Are Biomorphs?

Standard escape-time fractals (Mandelbrot, Julia sets) classify pixels by how quickly their orbit escapes to infinity. Biomorphs use a different classification:

- **Escaped** — orbit crosses the bailout radius
- **Converged** — orbit collapses to a fixed point
- **Wandering** — orbit does neither; it drifts indefinitely

Pickover's key modification: change the escape condition from circular (`|z| > R`) to **axis-aligned** (`|Re(z)| > R AND |Im(z)| > R`). Points where only one component grows large survive the test — creating axial filaments that mimic biological appendages. The result looks uncannily like microscopy imagery: insect limbs, bacterial helices, radiolarian spines, embryo cross-sections.

The **wander metric** (`Σ |‖zₙ‖ − ‖zₙ₋₁‖|`) measures total orbit activity across all iterations, driving a continuous coloring variable that reveals internal anatomy. Combined with the final argument `arg(z)`, this gives three independent color axes: depth (iter_ratio), density (wander), and angle (final_arg) — mapped to biological stain channels.

---

## Core Themes

- **Complex iteration as morphogenesis** — the same mathematical process that generates Mandelbrot fractals, constrained differently, grows organisms
- **Axis-aligned escape as anatomy** — the directional bailout creates filaments, symmetry axes, appendage pairs
- **Three-pass microscopy simulation** — environment substrate → organism render → optical post-processing
- **Parameter space as species atlas** — sliding `c` through the complex plane reveals a continuous zoo of forms; species are named landmarks
- **Color as stain chemistry** — hue encodes specimen type (chitin, membrane, silicate), not aesthetic preference

---

## Visual Motifs

- Segmented exoskeletons with bilateral symmetry (insectoid, diatom)
- Radial spines and pore fields (radiolarian, ctenophore)
- Translucent membranes with nuclei visible through phase contrast
- Gram-negative helical traces (spirochete)
- Darkfield glow — bright organism against absolute black
- Birefringent substrate with Newton rings (glass slide)
- Three-channel fluorescence composites (GFP green / RFP red / DAPI blue)
- Filaments and tendrils at high-wander orbit boundaries

---

## Shader Techniques

| Technique | Where Used |
|---|---|
| Axis-aligned escape condition `\|Re(z)\| > R AND \|Im(z)\| > R` | All species shaders |
| Wander metric (orbit activity integral) | All species shaders |
| GLSL complex arithmetic (`cmul`, `cpow`, `csin`, `cexp`, `clog`) | All species shaders |
| Julia iteration (fixed `c`, varying `z₀`) | 7 of 8 species |
| Mandelbrot iteration (fixed `z₀=0`, varying `c`) | `_spore` only |
| Biological stain palettes (Gram, H&E, Giemsa, Crystal Violet) | Species + microscopy shaders |
| Luminance-gradient edge detection | `phase_contrast.frag` |
| Three-channel false-color composite with bleed-through | `fluorescence.frag` |
| Köhler illumination + depth-of-field | `brightfield.frag` |
| Brownian scatter, thermal caustics | `saline_medium.frag` |
| Film grain + vignette | All species shaders |
| Mouse-driven `c` parameter mutation in real time | `index.html` (WebGL) |

---

## Species

Eight named morphologies, each a distinct complex function with a matched microscopy mode:

| Species | Formula | Imaging Mode | Biological Reference |
|---|---|---|---|
| `_base_insectoid` | `z^z + c` | Darkfield | Arthropod exoskeleton, segmented chitin |
| `_embryonic` | `sin(z) + c` | Phase contrast | Blastula cross-section, yolk/membrane |
| `_radiolarian` | `z·sin(z) + c` | Oil-immersion darkfield | Siliceous radiolarian, axopodial spines |
| `_hybrid_mutation` | `z^z + z^c` | Bioluminescent darkfield | Unknown class — dual exponentiation |
| `_spirochete` | `z³ + c` | Phase contrast | Gram-negative helical bacterium |
| `_diatom` | `cos(z) + c` | Brightfield | Pennate frustule, bilateral striae |
| `_ctenophore` | `exp(z) + c` | Deep-ocean darkfield | Iridescent comb-jelly, 8-fold plates |
| `_spore` | `z² + c` | Brightfield | Pickover's authentic algorithm + axis bailout |

---

## Three-Pass Rendering Architecture

```
Pass 1 (optional)   environments/   →  substrate texture (glass, saline, oil, fluorescent)
Pass 2 (required)   shaders/        →  organism render (species + stain + film grain)
Pass 3 (optional)   microscopy/     →  optical post-processing (darkfield, phase contrast, etc.)
```

All shaders use three standard uniforms:

| Uniform | Type | Description |
|---|---|---|
| `u_resolution` | `vec2` | Canvas size in pixels |
| `u_mouse` | `vec2` | Mouse position in pixels (y-up) |
| `u_time` | `float` | Elapsed time in seconds |

---

## Repository Structure

```
index.html              Standalone WebGL viewer — open directly in any browser
shaders/                GLSL fragment shaders, one per species (self-contained)
  _base_insectoid.frag
  _embryonic.frag
  _radiolarian.frag
  _hybrid_mutation.frag
  _spirochete.frag
  _diatom.frag
  _ctenophore.frag
  _spore.frag
environments/           Substrate and medium shaders — first render pass
  glass_substrate.frag
  saline_medium.frag
  oil_immersion.frag
  fluorescent_medium.frag
microscopy/             Optical post-processing — final render pass
  darkfield.frag
  phase_contrast.frag
  brightfield.frag
  fluorescence.frag
species/                Taxonomic descriptions and parameter sets
  taxonomy.md
docs/                   Algorithm, parameter, coloring, and rendering documentation
  algorithm.md
  parameters.md
  coloring.md
  rendering_guide.md
python/                 NumPy offline renderer — high-res output, animation, exploration
  biomorph.py
context.manifest.json   Machine-readable context summary for RepoScripter ingestion
```

---

## Viewing & Running

### Browser (instant, no setup)

Open `index.html` directly in any browser. All eight species are preloaded.

- **Move mouse** — mutates parameter `c` in real time
- **Click** — freezes/unfreezes the organism at current `c`
- **Species buttons** — switch between the eight morphologies

### Drop-in Shader (Shadertoy / glslCanvas / Three.js)

Each `.frag` in `shaders/` is self-contained. Drop it into any fragment shader environment. See `docs/rendering_guide.md` for Shadertoy/Three.js setup, compositing pipeline, and writing new species shaders.

### Python Renderer (offline / high-res)

```bash
pip install numpy pillow
python python/biomorph.py                                    # render all 8 species
python python/biomorph.py --species radiolarian --width 3840 --height 2160
python python/biomorph.py --explore embryonic                # interactive parameter explorer (requires matplotlib)
python python/biomorph.py --mutate spirochete 120            # export 120-frame mutation animation
```

Quick preview (fast, no matplotlib required):

```bash
pip install numpy pillow && python3 python/biomorph.py --width 64 --height 64
```

---

## Documentation

| File | Contents |
|---|---|
| `docs/algorithm.md` | Pickover's escape condition, wander metric, orbit structure, fixed points, chaos |
| `docs/parameters.md` | c-plane atlas, mutation effects, iteration parameter guide, finding new species |
| `docs/coloring.md` | Color-as-anatomy: stain protocols, microscopy palette design, smoothstep coloring |
| `docs/rendering_guide.md` | Shadertoy/Three.js/glslCanvas setup, compositing pipeline, writing new species |
| `species/taxonomy.md` | Taxonomic descriptions, cross-breeding rules, hybrid parameter ranges |

---

## RepoScripter Context Notes

This repository is a **shader context pack** for RepoScripter Experimental. Key signals for blending:

- **Primary aesthetic register**: microscopy specimen imagery — darkfield glow, phase-contrast halos, stained sections
- **Mathematical identity**: axis-aligned escape condition (not circular) is the root cause of all biological form — it is the most important concept in this repository
- **Color language**: stain-named palettes (Gram violet/safranin, H&E pink/blue, Giemsa azure, GFP/RFP/DAPI). Avoid purely decorative color — hue always encodes specimen type or anatomy layer
- **Motion language**: parameter `c` mutation as morphological drift; time-based pulsing in embryonic/membrane species; no camera fly-through
- **Geometry language**: axial filaments, bilateral and radial symmetry, nested boundaries, orbit trap geometry
- **Compositing logic**: environment → organism → microscopy is the canonical pipeline; environment and microscopy layers are optional enrichments
- **Blend well with**: Clifford attractor repos, strange attractor field repos, complex dynamics repos, optical simulation repos, electron microscopy aesthetic repos
- **Avoid blending with**: clean geometric/SDF repos that carry no biological or orbital context; pure Mandelbrot sets without the axis-aligned escape modification

Machine ingestion entry points: `context.manifest.json`, `README.md`, `species/taxonomy.md`, `docs/algorithm.md`

---

## References

- Pickover, C. (1990). *Computers, Pattern, Chaos and Beauty*. St. Martin's Press.
- Pickover, C. (1994). *Chaos in Wonderland*. St. Martin's Press.
- Peitgen, H.-O., Jürgens, H., Saupe, D. (1992). *Chaos and Fractals: New Frontiers of Science*. Springer.
- Douady, A., Hubbard, J.H. (1982). Itération des polynômes quadratiques complexes. *C. R. Acad. Sci. Paris*, 294.
- Milnor, J. (2006). *Dynamics in One Complex Variable*, 3rd ed. Princeton.

---

## Future Directions

- Additional species: `_vorticella` (oscillating stalk), `_desmid` (paired semicell symmetry), `_nematode` (traveling-wave locomotion shader)
- Species shader hybrids: interpolated formula families between existing species
- 3D biomorph via ray-marched SDF driven by biomorph escape classification
- Parameter-space video: automated sweep through c-plane with species transition detection
- Reaction-diffusion overlay on wander regions for cellular texture
- Export pipeline for print-resolution stained-glass style output

---

*This is a living taxonomy. New species are discovered through parameter mutation, not designed.*
