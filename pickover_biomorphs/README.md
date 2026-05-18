# pickover_biomorphs

A creative coding project exploring Pickover biomorphs — mathematical organisms that emerge from complex function iteration, discovered by Clifford Pickover in the early 1990s.

## What Are Biomorphs?

Unlike escape-time fractals (Mandelbrot, Julia), biomorphs track *convergence behavior* rather than escape velocity. Points that neither explode to infinity nor collapse to a fixed point wander through the complex plane, tracing organic trajectories that produce insectoid, embryonic, and alien forms.

The classic generator: `z = z^z + c`

## Project Structure

```
shaders/          # GLSL fragment shaders — one per species
species/          # Parameter sets for different morphologies
environments/     # Lighting and substrate configurations
microscopy/       # Post-processing: darkfield, phase contrast, stains
```

## Running

Shaders are written for WebGL/Three.js. Each shader is self-contained — drop it into any fragment shader environment (Shadertoy, The Book of Shaders editor, local Three.js setup).

## Current Species

- [ ] _base_insectoid — `z^z + c`, chitinous exoskeleton
- [ ] _embryonic — `sin(z) + c`, translucent membrane
- [ ] _radiolarian — `z * sin(z) + c`, silicate spines
- [ ] _hybrid_mutation — `z^z + z^c`, unknown morphology

## References

- Pickover, C. (1990). *Computers, Pattern, Chaos and Beauty*. St. Martin's Press.
- Pickover, C. (1994). *Chaos in Wonderland*. St. Martin's Press.

---

*This is a living taxonomy. New species are discovered through parameter mutation, not designed.*
