# The Biomorph Algorithm

Clifford Pickover introduced biomorphs in his 1990 book *Computers, Pattern, Chaos and Beauty*. The core idea is a one-word modification to the Mandelbrot set escape condition. That one word produces organisms.

---

## The Standard Escape-Time Algorithm

For any complex function f(z, c), the escape-time algorithm iterates:

```
z₀ = 0  (or z₀ = c for the Julia family)
zₙ₊₁ = f(zₙ, c)
```

Escape condition: **exit when |z| > R** (the orbit has left the filled set)

The number of iterations before escape is used to color the pixel. Inside the filled set — points that never escape — everything is one color (traditionally black).

This produces the Mandelbrot set, Julia sets, and their relatives.

---

## The Pickover Modification

Pickover changed the escape condition from circular to axis-aligned:

```
Standard:  escape when  |z|² > R²
               i.e.     Re(z)² + Im(z)² > R²

Pickover:  escape when  |Re(z)| > R  AND  |Im(z)| > R
```

The difference is subtle but profound. Under the standard condition, the "alive" region is a disk. Under Pickover's condition, the alive region is a **cross** — a plus sign whose arms extend along the real and imaginary axes.

### Why This Is Biological

A point with large |Re(z)| but small |Im(z)| does **not** escape under Pickover's condition. It survives. The alive set extends indefinitely along the axes, producing filamentous arms — the tendrils, limbs, and spines that look like biological appendages.

Change the function:
- `z² + c`: cross-shaped body with four primary filaments
- `z³ + c`: three-fold symmetry, six filament tips
- `sin(z) + c`: smooth, lobed body — almost animal
- `z * sin(z) + c`: radial spines on a spherical core

Each function is a different genetic code. Pickover's escape condition is the thing that makes the result look alive rather than mathematical.

---

## Iteration Structure

### Starting Conditions

**Mandelbrot approach** (parameter plane):
```
z₀ = 0
c = pixel coordinate
```
Every point in the image represents a different organism — the plane is an atlas of species.

**Julia approach** (dynamical plane):
```
z₀ = pixel coordinate
c = fixed mutation parameter
```
Every point shows the orbit structure of a single organism at a specific c-value. Moving c mutates the organism continuously.

The shaders in this project use the **Julia approach**: `z₀ = c_pixel`, `mutation = mouse`. The `_spore` shader uses the Mandelbrot approach to show the full species atlas.

### The Wander Metric

The `.frag` shaders in this project extend Pickover's binary alive/dead decision with a continuous **wander metric**:

```
wander += |length(z_n) - length(z_{n-1})|
```

This accumulates the total variation in orbit radius over all iterations. High wander = the orbit is still actively changing; low wander = the orbit has settled into a cycle or attractor.

The wander metric is then used to drive color:
- **Low wander, early convergence** → core / organelle structures
- **High wander, mid-iteration** → membrane / wall structures  
- **High wander, late survival** → tendrils / filamentous extensions

This is not Pickover's original coloring — it is an extension that produces the continuous, biological-feeling color gradients in the rendered organisms.

---

## Mathematical Properties

### Fixed Points and Cycles

The iteration `z = f(z, c)` has **fixed points** where f(z, c) = z. These are the convergence attractors — where orbits near them spiral in. In the rendered organisms, convergence zones correspond to:

- **Nuclei**: fixed-point attractors (one stable center)
- **Organelles**: periodic-2 orbits (two alternating centers)
- **Vacuoles**: periodic-n cycles that appear as rings

The transition from a fixed point to a period-2 orbit to chaos is a bifurcation — visible as a morphological change when you move the mouse to shift the mutation parameter.

### The Julia/Mandelbrot Duality

For any complex function f(z, c), there is a duality:
- The **Mandelbrot set** for f is the set of c-values that produce bounded orbits from z₀ = 0
- The **filled Julia set** Jc is the set of starting points z₀ that produce bounded orbits for fixed c

The boundary of the filled Julia set is fractal exactly when c is on the boundary of the Mandelbrot set. This duality persists for biomorphs: the most complex organisms appear at c-values on the biomorph's Mandelbrot boundary.

### Dimension and Complexity

The fractal dimension of the biomorph boundary varies with the function:
- `z² + c`: Hausdorff dimension ≈ 2 at the most complex parameter values
- `z³ + c`: similar dimension, different topology (more filament tips)
- `sin(z) + c`: dimension ≤ 2, but the smooth function produces rounder boundaries

Higher-degree polynomials produce more complex boundaries but also escape faster (the escape radius shrinks with degree), requiring lower bailout values.

---

## The Role of the Bailout Value

The choice of R in the escape condition is not arbitrary:

- **Too small**: the alive region includes points that would eventually escape — you're showing a subset of the real organism
- **Too large**: the alive region shrinks (points near the boundary escape faster under the axis condition with large R) — you lose the delicate tendrils
- **Pickover's original**: R = 10, which for `z² + c` produces the characteristic biomorph shapes

For other functions:
- `z³ + c`: R = 8–12 works well
- `sin(z) + c`: R = 40–60 (sin grows slowly on the imaginary axis)
- `exp(z) + c`: R = 30–50 (exp has radically different growth rates by direction)

The CONV_THRESH parameter in the shaders is an *additional* stop condition: if the orbit has stabilized (wander per step < threshold), we mark it as converged and stop iterating. This is not part of Pickover's original algorithm — it is a performance optimization and also changes the visual result near fixed-point regions.

---

## Convergence vs. Escape

The shaders track two distinct fates for an orbit:

1. **Escape**: `|z| > ESCAPE_THRESH` — the orbit has diverged to infinity
2. **Convergence**: `|zₙ₊₁ - zₙ| < CONV_THRESH` — the orbit has settled

Points that do neither (survive MAX_ITER without escaping or converging) are the most interesting — they are on chaotic attractors, quasi-periodic orbits, or slowly wandering near the boundary of the organism. These are colored by their wander value.

This three-way classification (escaped / converged / wandering) produces the three anatomical zones in the organisms:
- Escaped → black background (darkfield) or white background (brightfield)
- Converged → cores, nuclei, dense organelles
- Wandering → living boundary structures, membranes, filaments

---

## References

- Pickover, C. (1990). *Computers, Pattern, Chaos and Beauty*. St. Martin's Press. [Chapter on biomorphs, pp. 23–31]
- Pickover, C. (1994). *Chaos in Wonderland*. St. Martin's Press.
- Peitgen, H.-O., Jürgens, H., Saupe, D. (1992). *Chaos and Fractals: New Frontiers of Science*. Springer. [Extensive treatment of Julia sets and their boundaries]
- Douady, A., Hubbard, J.H. (1982). Itération des polynômes quadratiques complexes. *C. R. Acad. Sci. Paris*, 294, 123–126. [Mathematical foundation of Mandelbrot set theory]
- Milnor, J. (2006). *Dynamics in One Complex Variable*, 3rd ed. Princeton. [Graduate-level treatment of complex iteration theory]
