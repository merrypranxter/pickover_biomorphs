// HABITAT: Unknown — no matching microscopy protocol yet established
// ORGANISM: Hybrid mutation — an undiscovered class, morphology unpredictable
// FUNCTION: z = z^z + z^c  (dual self-exponentiation; c acts as variable exponent, not additive constant)
// MUTATION: c = (0.4, 0.25), iter = 120, unstable bailout — form resists classification

// This organism does not behave like its parents. The first term (z^z) drives the insectoid
// skeleton; the second (z^c) folds it through a c-dependent warp, producing neither the
// segmented arthropod nor the radiolarian spine — something between them, and something else.
// Color palette is bioluminescent: no known stain protocol, self-luminous under darkness.

precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

#define MAX_ITER 120
#define CONV_THRESH 0.0006
#define ESCAPE_THRESH 55.0

// ── Complex arithmetic ───────────────────────────────────────────────────────

vec2 cmul(vec2 a, vec2 b) {
    return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

vec2 clog(vec2 z) {
    return vec2(log(length(z)), atan(z.y, z.x));
}

vec2 cexp(vec2 z) {
    return exp(z.x) * vec2(cos(z.y), sin(z.y));
}

// z^w = exp(w * log(z))
vec2 cpow(vec2 z, vec2 w) {
    if (length(z) < 1e-7) return vec2(0.0);
    return cexp(cmul(w, clog(z)));
}

// ── Hybrid generator: z = z^z + z^c ──────────────────────────────────────────
// Two self-similar exponential towers: the first collapses on itself,
// the second is steered by c — their interference produces the hybrid form.
vec2 biomorph(vec2 z, vec2 c) {
    return cpow(z, z) + cpow(z, c);
}

// ── Bioluminescent palette ────────────────────────────────────────────────────
// No known stain: organism appears self-luminous under darkfield.
// Colors derived from deep-sea bioluminescence and radiographic anomaly.
vec3 stain(float wander, float final_arg, float iter_ratio, float time) {
    // Abyssal bioluminescence: cold blue-green emission
    vec3 luciferin   = vec3(0.05, 0.55, 0.80);   // primary emission, deep teal
    vec3 photoprotein = vec3(0.10, 0.85, 0.65);   // secondary flash, cyan-green
    vec3 void_black  = vec3(0.00, 0.00, 0.03);    // background — absolute dark
    vec3 corona      = vec3(0.60, 0.15, 0.80);    // ultraviolet corona, unreachable shell
    vec3 amber_ghost = vec3(0.80, 0.55, 0.10);    // parent insectoid memory, faint

    // Slow pulse: the organism breathes
    float pulse = 0.5 + 0.5 * sin(time * 1.3 + final_arg * 4.0);

    // Orbit density: how much the trajectory accumulated
    float density = smoothstep(0.0, 0.15, wander);

    // Core glow: orbits that converged quickly are the nucleus
    float nucleus = (1.0 - iter_ratio) * (1.0 - wander);

    // Shell: long-surviving, high-wander orbits — the outer membrane
    float shell = smoothstep(0.5, 0.9, iter_ratio) * wander;

    // Insectoid ghost: residual parent morphology bleeds through at low wander
    float ghost = (1.0 - wander) * smoothstep(0.3, 0.6, iter_ratio);

    vec3 col = void_black;
    col = mix(col, luciferin,    density * 0.9);
    col = mix(col, photoprotein, nucleus * pulse);
    col = mix(col, corona,       shell * 0.6);
    col = mix(col, amber_ghost,  ghost * 0.25);

    // Fringe interference: thin-film-like banding along final argument
    float fringe = 0.5 + 0.5 * sin(final_arg * 14.0 + iter_ratio * 30.0);
    col += luciferin * fringe * density * 0.2;

    return col;
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    st.x *= u_resolution.x / u_resolution.y;

    // Viewport: slightly zoomed out — the hybrid needs room to unfold
    float zoom = 4.5 + 0.3 * sin(u_time * 0.07);
    vec2 offset = vec2(-2.25, -2.25);
    vec2 c = (st + offset) * zoom;

    // Mouse: steer the exponent c — small movements create large morphological shifts
    vec2 mouse_norm = u_mouse / u_resolution;
    vec2 mutation = vec2(0.4, 0.25);
    mutation += (mouse_norm - 0.5) * vec2(0.5, 0.35);

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
        if (delta < CONV_THRESH && i > 12) {
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
    float final_arg = atan(z.y, z.x);

    vec3 col = stain(wander, final_arg, iter_ratio, u_time);

    // Alive mask: hybrid has a softer boundary than its parents — intentionally blurred
    float alive = 1.0 - smoothstep(0.0, 0.08, wander + (converged ? 0.0 : 0.12));
    col *= alive;

    // Vignette: the microscope field edge fades to absolute dark
    float vig = 1.0 - smoothstep(0.45, 1.4, length(st - 0.5));
    col *= vig;

    // Film grain: photographic emulsion artifact
    float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    col *= 0.96 + 0.04 * grain;

    gl_FragColor = vec4(col, 1.0);
}
