# Rendering Guide

This guide covers how to use the shaders in different environments, the compositing pipeline, and how to write new species shaders.

---

## Quick Start

### Browser (no server required)

Open `index.html` directly. All species are pre-loaded; the viewer handles WebGL setup, shader compilation, and the render loop. Move the mouse to mutate the active species; click anywhere (not a button) to freeze.

Supported in all modern browsers with WebGL 1.0: Chrome, Firefox, Safari, Edge.

### Shadertoy

Each `.frag` file in `shaders/` is self-contained GLSL that runs as a Shadertoy fragment shader. To use:

1. Open [shadertoy.com/new](https://www.shadertoy.com/new)
2. Delete the default `mainImage` function
3. Paste the shader contents
4. **Rename** the entry point: change `void main()` to `void mainImage(out vec4 fragColor, in vec2 fragCoord)` and replace:
   - `gl_FragCoord.xy` → `fragCoord`
   - `gl_FragColor` → `fragColor`
   - `u_resolution` → `iResolution.xy`
   - `u_mouse` → `iMouse.xy`
   - `u_time` → `iTime`

The environment and microscopy shaders require a second pass (`Buffer A`) with the biomorph output passed as `u_biomorph` (Shadertoy: `iChannel0`).

### Three.js / WebGL setup

```javascript
import * as THREE from 'three';

const renderer = new THREE.WebGLRenderer();
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
camera.position.z = 1;

const geometry = new THREE.PlaneGeometry(2, 2);
const material = new THREE.ShaderMaterial({
  uniforms: {
    u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    u_mouse:      { value: new THREE.Vector2(0.5, 0.5) },
    u_time:       { value: 0.0 }
  },
  fragmentShader: /* paste shader source here */,
  vertexShader: `void main() { gl_Position = vec4(position, 1.0); }`
});

const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

function animate(t) {
  requestAnimationFrame(animate);
  material.uniforms.u_time.value = t / 1000.0;
  renderer.render(scene, camera);
}
animate(0);
```

### The Book of Shaders editor (glslCanvas)

The shaders run directly in [editor.thebookofshaders.com](https://editor.thebookofshaders.com/). The uniform names are different:

| This repo | The Book of Shaders |
|-----------|---------------------|
| `u_resolution` | `u_resolution` (same) |
| `u_mouse` | `u_mouse` (same) |
| `u_time` | `u_time` (same) |

No changes needed — the naming was chosen to match glslCanvas conventions.

---

## The Compositing Pipeline

A full specimen render uses up to three passes:

```
Pass 1: Environment  →  background.rgba
Pass 2: Biomorph     →  organism.rgba
Pass 3: Microscopy   →  final.rgba = post_process(organism, background)
```

In the standalone `index.html`, only Pass 2 is active (the biomorph shaders contain their own darkfield/phase-contrast output). For multi-pass compositing, use the following setup.

### Pass 1: Environment (optional)

Render the environment shader to a framebuffer. The result is the microscope substrate/medium without any organism.

Available environments:
- `glass_substrate.frag` → warm glass slide for darkfield/brightfield
- `saline_medium.frag` → bright-grey phase contrast medium
- `oil_immersion.frag` → oil drop for high-NA brightfield
- `fluorescent_medium.frag` → dark background for epifluorescence

### Pass 2: Biomorph

Render the species shader. Output is the organism color directly — the environment is NOT composited here. The biomorph shader outputs colors based on the organism's stain and imaging modality.

Available species: `_base_insectoid`, `_embryonic`, `_radiolarian`, `_hybrid_mutation`, `_spirochete`, `_diatom`, `_ctenophore`, `_spore`

### Pass 3: Microscopy post-processing

Take the biomorph output as a texture (`u_biomorph`) and run the post-processing shader. This applies the optical effects of the imaging modality.

Available post-processors:
- `darkfield.frag` → scattered-light darkfield with Gram stain + oil immersion utilities
- `phase_contrast.frag` → edge-detection based phase halo + annular ring artifact
- `fluorescence.frag` → three-channel fluorescence with bleed-through + photobleaching
- `brightfield.frag` → Köhler illumination with Giemsa/Wright/crystal violet stains

### Compositing the result

A simple composition:

```glsl
// In the final compositing pass:
vec4 bg   = texture2D(u_background, uv);
vec4 org  = texture2D(u_organism,   uv);
vec4 post = texture2D(u_processed,  uv);

// Darkfield: organism over black background
vec3 final = bg.rgb * (1.0 - org.a) + post.rgb * org.a;

// Or: additive blend for darkfield (organism emits light)
vec3 final = bg.rgb + post.rgb;
```

---

## Writing a New Species Shader

Every species shader follows the same structure. Here is the annotated template:

```glsl
// HABITAT:  Which imaging modality and environment this organism lives in
// ORGANISM: Common name and morphological description
// FUNCTION: The mathematical generator function
// MUTATION: Signature c value and iteration parameters
//
// Biological and mathematical narrative: what makes this organism interesting,
// what real organisms it resembles, what makes the function choice appropriate.

precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

#define MAX_ITER    80           // Iteration depth — see docs/parameters.md
#define CONV_THRESH 0.001        // Convergence detection threshold
#define ESCAPE_THRESH 50.0       // Circular escape safety net

// ── Complex arithmetic ────────────────────────────────────────────────────────
// Include only the functions needed by this generator.
// All functions are named c<mathfunction>: cmul, csin, ccos, cexp, cpow, clog

vec2 cmul(vec2 a, vec2 b) {
    return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

// ── Generator function ────────────────────────────────────────────────────────
// This is the organism's genetic code. One function, one organism.
// Always named biomorph(vec2 z, vec2 c) for consistency.
vec2 biomorph(vec2 z, vec2 c) {
    // Your function here. Examples:
    // return cmul(z, z) + c;           // z² + c
    // return csin(z) + c;              // sin(z) + c
    // return cmul(cmul(z, z), z) + c;  // z³ + c
}

// ── Staining palette ──────────────────────────────────────────────────────────
// Takes the three primary coloring variables and returns an RGB color.
// Named stain() for consistency. Match a real biological staining protocol.
// See docs/coloring.md for guidance on choosing palettes.
vec3 stain(float wander, float final_arg, float iter_ratio) {
    // Define your anatomical zone colors:
    // vec3 core     = vec3(...);
    // vec3 membrane = vec3(...);
    // vec3 appendage = vec3(...);

    // Map variables to zones with smoothstep:
    // float wall = smoothstep(0.3, 0.7, iter_ratio) * (1.0 - wander);
    // float tendril = wander * smoothstep(0.2, 0.6, iter_ratio);

    // Mix colors:
    // vec3 col = mix(core, membrane, wall);
    // col = mix(col, appendage, tendril * 0.7);

    // Add angular periodicity (segments, ribs, spines):
    // float segment = sin(final_arg * N) * 0.5 + 0.5;
    // col *= 0.8 + 0.2 * segment;

    return col;
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    st.x *= u_resolution.x / u_resolution.y;

    // ── Viewport ──────────────────────────────────────────────────────────────
    // Define zoom and offset to frame the organism
    float zoom = 4.0;
    vec2 offset = vec2(-2.0, -2.0);
    vec2 c = (st + offset) * zoom;

    // ── Mutation ──────────────────────────────────────────────────────────────
    // Mouse maps to the mutation parameter. Define base c and sensitivity.
    vec2 mouse_norm = u_mouse / u_resolution;
    vec2 mutation = vec2(BASE_C_RE, BASE_C_IM);
    mutation += (mouse_norm - 0.5) * vec2(RE_SENSITIVITY, IM_SENSITIVITY);

    // ── Orbit iteration ───────────────────────────────────────────────────────
    vec2 z = c;
    float wander = 0.0;
    float last_z = length(z);
    bool converged = false;
    int iter = 0;

    for (int i = 0; i < MAX_ITER; i++) {
        z = biomorph(z, mutation);
        float len = length(z);

        if (len > ESCAPE_THRESH) {
            iter = i;
            break;
        }

        float delta = abs(len - last_z);
        if (delta < CONV_THRESH && i > MIN_ITER_BEFORE_CONVERGENCE) {
            converged = true;
            iter = i;
            break;
        }

        wander += delta;
        last_z = len;
        iter = i;
    }

    wander /= float(MAX_ITER);
    float iter_ratio = float(iter) / float(MAX_ITER);
    float final_arg  = atan(z.y, z.x);

    // ── Color mapping ─────────────────────────────────────────────────────────
    vec3 col = stain(wander, final_arg, iter_ratio);

    // Alive mask: controls the sharpness of the organism boundary
    float alive = 1.0 - smoothstep(0.0, 0.05, wander + (converged ? 0.0 : 0.1));
    col *= alive;

    // ── Microscopy effects ────────────────────────────────────────────────────
    // Add the characteristic optical effect of the habitat:
    // Darkfield:      col *= alive;  (organism on black)
    // Phase contrast: add halo, subtract interior shadow
    // Brightfield:    mix with white background

    // ── Standard finishing ────────────────────────────────────────────────────
    float vig = 1.0 - smoothstep(0.5, 1.5, length(st - 0.5));
    col *= vig;

    // Optional: film grain
    // float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    // col *= 0.95 + 0.05 * grain;

    gl_FragColor = vec4(col, 1.0);
}
```

### Naming conventions

- Shader files: `_<species_name>.frag` (underscore prefix, snake_case)
- Species names should be biological: organism class, not a description of the math
- Register new species in `species/taxonomy.md`
- If the species uses a new imaging modality, add a post-processing shader to `microscopy/`
- If the species lives in a new environment, add the environment shader to `environments/`

---

## Debugging Shaders

### Common issues

**Organism is invisible (all black)**
- Check the alive mask: if `ESCAPE_THRESH` is too small, everything escapes immediately
- Print `wander` as a color channel to see the orbit distribution
- Try increasing `MAX_ITER` — the organism may need more iterations to form

**Organism is all one color (no structure)**
- The convergence is happening too fast — reduce `CONV_THRESH`
- Or wander is uniformly near zero — your ESCAPE_THRESH may be too large, letting everything converge
- Print `iter_ratio` as a grayscale to verify the iteration depth distribution

**Black or white artifacts at field edges**
- Vignette smoothstep edges are too sharp — widen the smoothstep range
- Check that `st.x` is aspect-ratio corrected before the viewport mapping

**NaN/Inf producing strange colors**
- `cpow(z, w)` with z near zero will produce NaN — guard with the `length(z) < 1e-7` check
- `clog(0)` is undefined — always guard log operations
- `csin(z)` and `ccos(z)` involve `cosh` and `sinh` which grow without bound for large Im(z) — set ESCAPE_THRESH before this overflow occurs

**Performance: shader is slow**
- Reduce `MAX_ITER`
- Remove the convergence check (saves a branch per iteration at the cost of visual quality in core regions)
- For `cpow`, use integer power if the exponent is constant (cmul chains are faster than exp/log)

### Visual debugging utilities

```glsl
// Visualize the wander distribution
// gl_FragColor = vec4(wander, wander, wander, 1.0);

// Visualize iter_ratio
// gl_FragColor = vec4(iter_ratio, iter_ratio, iter_ratio, 1.0);

// Visualize final_arg (angular identity, mapped to hue)
// float h = final_arg / 6.28318 + 0.5;
// gl_FragColor = vec4(h, 1.0 - h, abs(h - 0.5) * 2.0, 1.0);

// Visualize convergence vs. escape
// gl_FragColor = vec4(float(converged), float(!converged) * (1.0 - iter_ratio), 0.0, 1.0);
```

---

## Adding a New Species to the Viewer

To add a species to `index.html`, two changes are needed:

**1. Add the button** in the `#ui` div:
```html
<button data-key="myspecies">_my_species</button>
```

**2. Add the shader** in the `SHADERS` object (inline the .frag source, removing the file-level comments):
```javascript
SHADERS.myspecies = `
precision highp float;
// ... full shader source ...
`;
```

The viewer will automatically compile the shader on first selection and cache it. The shader must use the standard uniform names: `u_resolution`, `u_mouse`, `u_time`.

---

## Exporting Frames

The WebGL viewer can export a frame by reading back from the canvas:

```javascript
// Add to the viewer after a render frame:
canvas.toBlob(blob => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'biomorph.png';
  a.click();
}, 'image/png');
```

For high-resolution exports, use the Python renderer (`python/biomorph.py`) which is not limited to screen resolution.
