// HABITAT: Brightfield, oil immersion, high magnification — structural cross-section
// ORGANISM: Fungal spore / bacterial endospore — dormant form, layered wall
// FUNCTION: z = z^2 + c — Pickover's original iteration, with AUTHENTIC bailout
// MUTATION: c varies across the parameter plane (Mandelbrot approach: c = pixel, z₀ = 0)
//
// ── The authentic Pickover biomorph algorithm ────────────────────────────────
// This shader implements Pickover's original 1990 algorithm exactly as described
// in "Computers, Pattern, Chaos and Beauty." The key modification from the Mandelbrot
// set is the ESCAPE CONDITION:
//
//   Standard Mandelbrot:  escape if |z|² > R²   (circular boundary)
//   Pickover biomorph:    escape if |Re(z)| > R AND |Im(z)| > R   (axis-aligned)
//
// The AND condition means points where only ONE component is large survive longer —
// creating axial "stalks" extending along the real and imaginary axes. These stalks
// are the filamentous extensions that make the alive set resemble a biological organism.
//
// z₀ = 0, c = pixel coordinate (the parameter plane — every point is a different organism)
// Mouse: shifts the c-plane center — explore adjacent species in the parameter space.
//
// Staining: periodic acid-Schiff (PAS) / calcofluor — spore wall polysaccharides stain
// magenta (PAS) or blue-white (calcofluor). Interior: classical hematoxylin.

precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

#define MAX_ITER 100
#define PICKOVER_BAILOUT 10.0   // Pickover's original axis-escape threshold
#define ESCAPE_THRESH 50.0      // Standard circular escape safety net

vec2 cmul(vec2 a, vec2 b) {
    return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

// z^2 + c — Pickover's original function
vec2 biomorph(vec2 z, vec2 c) {
    return cmul(z, z) + c;
}

// ── Spore wall staining palette ───────────────────────────────────────────────
// Layer 1 (episporium): outermost — tan/gold, rough textured
// Layer 2 (exosporium): thick wall — chestnut brown, PAS-positive (magenta-red)
// Layer 3 (cortex): inner pale, lytic enzymes — faint lavender
// Core: condensed DNA, ribosomes, DPA complex — dark blue-grey (hematoxylin)
// Dormancy indicator: low metabolic activity → flat, uniform colors (no pulse)
vec3 stain(float stalk_x, float stalk_y, float iter_ratio, float escape_type) {
    vec3 episporium  = vec3(0.72, 0.60, 0.35);   // outer coat, tan-gold
    vec3 exosporium  = vec3(0.62, 0.28, 0.22);   // thick wall, PAS-positive
    vec3 cortex      = vec3(0.75, 0.70, 0.80);   // inner wall, pale lavender
    vec3 core        = vec3(0.15, 0.18, 0.38);   // condensed core, hematoxylin
    vec3 stalk_color = vec3(0.82, 0.72, 0.45);   // axial extension (Pickover stalk)

    // Stalk prominence: how much this point was carried by the axis bias
    float is_stalk = max(stalk_x, stalk_y);

    // Concentric wall layers based on iter_ratio
    float outer_wall  = smoothstep(0.5, 0.85, iter_ratio);
    float thick_wall  = smoothstep(0.25, 0.6, iter_ratio) * (1.0 - outer_wall);
    float inner_wall  = smoothstep(0.08, 0.3, iter_ratio) * (1.0 - thick_wall - outer_wall);
    float core_zone   = 1.0 - smoothstep(0.0, 0.15, iter_ratio);

    vec3 col = core;
    col = mix(col, cortex,     inner_wall);
    col = mix(col, exosporium, thick_wall);
    col = mix(col, episporium, outer_wall);
    col = mix(col, stalk_color, is_stalk * 0.6);

    // PAS staining: polysaccharide-rich wall zones glow magenta under periodic acid-Schiff
    float pas = thick_wall * 0.5;
    col = mix(col, vec3(0.90, 0.28, 0.55), pas * 0.4);

    // Annular banding: growth ring record
    float ring = sin(iter_ratio * 22.0) * 0.5 + 0.5;
    col *= 0.88 + 0.12 * ring;

    return col;
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    st.x *= u_resolution.x / u_resolution.y;

    // Pickover parameter plane: c = pixel, centered on the classic biomorph region
    // Mouse shifts the view center — navigate the organism atlas
    vec2 mouse_norm = u_mouse / u_resolution;
    vec2 center = vec2(-0.5, 0.0) + (mouse_norm - 0.5) * vec2(1.0, 0.8);

    float zoom = 2.8 + 0.15 * sin(u_time * 0.04);
    vec2 c = center + (st - vec2(0.5, 0.5)) * zoom;

    // Authentic Pickover: z starts at 0, c is the pixel
    vec2 z = vec2(0.0);

    float iter_ratio = 0.0;
    float stalk_x_accum = 0.0;   // how often |Re(z)| alone was keeping it alive
    float stalk_y_accum = 0.0;   // how often |Im(z)| alone was keeping it alive
    bool alive = false;
    int iter = 0;

    for (int i = 0; i < MAX_ITER; i++) {
        z = biomorph(z, c);

        float re_abs = abs(z.x);
        float im_abs = abs(z.y);

        // ── Pickover's authentic biomorph escape condition ──────────────────
        // Escape when BOTH components exceed the axis threshold.
        // (Points where only one is large generate the filamentous "stalks".)
        bool pickover_escape = (re_abs > PICKOVER_BAILOUT) && (im_abs > PICKOVER_BAILOUT);

        // Safety net: standard large-magnitude escape
        bool standard_escape = (re_abs * re_abs + im_abs * im_abs > ESCAPE_THRESH * ESCAPE_THRESH);

        if (pickover_escape || standard_escape) {
            iter = i;
            // Measure stalk nature: which axis was responsible for survival so far
            stalk_x_accum += float(re_abs < PICKOVER_BAILOUT && im_abs >= PICKOVER_BAILOUT);
            stalk_y_accum += float(im_abs < PICKOVER_BAILOUT && re_abs >= PICKOVER_BAILOUT);
            break;
        }

        // Accumulate stalk tendency during orbit
        if (re_abs < PICKOVER_BAILOUT * 0.5) stalk_x_accum += 0.5;
        if (im_abs < PICKOVER_BAILOUT * 0.5) stalk_y_accum += 0.5;

        alive = true;
        iter = i + 1;
    }

    iter_ratio = float(iter) / float(MAX_ITER);
    float stalk_x = stalk_x_accum / float(MAX_ITER + 1);
    float stalk_y = stalk_y_accum / float(MAX_ITER + 1);

    if (!alive && iter == MAX_ITER) alive = true;   // survived all iterations

    vec3 col = vec3(0.0);

    if (alive) {
        col = stain(stalk_x, stalk_y, iter_ratio, 0.0);

        // Brightfield background blend: spore is embedded in a warm field
        float depth = iter_ratio;
        col = mix(vec3(0.90, 0.88, 0.84), col, 0.85);

        // Oil immersion sharpness: chromatic aberration at high NA
        float ca = length(st - 0.5) * 0.025;
        col.r += ca * 0.5;
        col.b -= ca * 0.3;
    } else {
        // Background: brightfield is a warm white — the organism is the dark region
        float bg = 0.88 + 0.04 * fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        col = vec3(bg * 0.97, bg * 0.96, bg * 0.94);
    }

    // Vignette: circular field stop
    float vig = 1.0 - smoothstep(0.46, 0.52, length(st - 0.5));
    col *= vig;

    gl_FragColor = vec4(col, 1.0);
}
