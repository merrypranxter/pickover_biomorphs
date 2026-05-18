# pickover_biomorphs

A creative coding project exploring Pickover biomorphs — mathematical organisms that emerge from complex function iteration, discovered by Clifford Pickover in the early 1990s.

## What Are Biomorphs?

Unlike escape-time fractals (Mandelbrot, Julia), biomorphs track *convergence behavior* rather than escape velocity. Points that neither explode to infinity nor collapse to a fixed point wander through the complex plane, tracing organic trajectories that produce insectoid, embryonic, and alien forms.

The classic generator: `z = z^z + c`

## Project Structure

```
index.html        # Standalone WebGL viewer — open in any browser, no server needed
shaders/          # GLSL fragment shaders — one per species
species/          # Parameter sets and taxonomy for different morphologies
environments/     # Substrate and medium shaders (glass slide, saline)
microscopy/       # Post-processing: darkfield, phase contrast, stains
```

## Running

**Quickest path:** open `index.html` directly in a browser. All four species are loaded; move the mouse to mutate the parameter `c`, click to freeze.

Each `.frag` shader is also self-contained — drop it into any fragment shader environment (Shadertoy, The Book of Shaders editor, local Three.js/GLSL canvas setup). Required uniforms:

| Uniform | Type | Description |
|---|---|---|
| `u_resolution` | `vec2` | Canvas size in pixels |
| `u_mouse` | `vec2` | Mouse position in pixels (y-up) |
| `u_time` | `float` | Elapsed time in seconds |

## Species

- [x] `_base_insectoid` — `z^z + c`, chitinous exoskeleton, darkfield
- [x] `_embryonic` — `sin(z) + c`, translucent membrane, phase contrast
- [x] `_radiolarian` — `z * sin(z) + c`, silicate spines, oil-immersion darkfield
- [x] `_hybrid_mutation` — `z^z + z^c`, unknown morphology, bioluminescent

## Environments

Background and medium shaders, composited under the specimen layer:

- `glass_substrate.frag` — borosilicate slide with birefringence, Newton rings, dust
- `saline_medium.frag` — aqueous phase-contrast medium with Brownian scatter and caustics

## Microscopy Post-Processing

Apply as a second render pass over the raw organism output:

- `darkfield.frag` — scattered-light glow against absolute black; also contains `gram_stain()` and `oil_immersion()` utilities
- `phase_contrast.frag` — bright-field background, halo at boundaries, interior shadow; edge detection via luminance gradient

## References

- Pickover, C. (1990). *Computers, Pattern, Chaos and Beauty*. St. Martin's Press.
- Pickover, C. (1994). *Chaos in Wonderland*. St. Martin's Press.

---

*This is a living taxonomy. New species are discovered through parameter mutation, not designed.*
