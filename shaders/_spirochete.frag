// HABITAT: Phase contrast, saline medium, moderate magnification
// ORGANISM: Spirochete — helical filamentous bacterium, gram-negative, motile
// FUNCTION: z = z^3 + c (cubic Pickover biomorph — three-fold tendril symmetry)
// MUTATION: c = (-0.4, 0.6), iter = 90, tight convergence for helical fidelity
//
// The cubic iteration produces a fundamentally different topology from the quadratic:
// three primary filament directions rather than two, with finer helical sub-structure.
// In nature: Treponema, Borrelia, Leptospira — distinguished by corkscrew motility,
// reproduced here by the phase-rotation of z^3 as it orbits the imaginary axis.
// Gram-negative staining: outer membrane takes up safranin (red), not crystal violet.

precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

#define MAX_ITER 90
#define CONV_THRESH 0.0007
#define ESCAPE_THRESH 45.0

// ── Complex arithmetic ────────────────────────────────────────────────────────

vec2 cmul(vec2 a, vec2 b) {
    return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

// z^3 = z * z * z, computed via two cmul calls — exact, no log/exp
vec2 ccube(vec2 z) {
    return cmul(cmul(z, z), z);
}

// Cubic Pickover biomorph: the extra power generates a third symmetry axis
vec2 biomorph(vec2 z, vec2 c) {
    return ccube(z) + c;
}

// ── Gram-negative staining palette ────────────────────────────────────────────
// Counterstain: outer membrane → safranin (pink-red)
// Periplasm: thin gram-positive layer → faint violet bleed
// Nucleoid: DNA coil → deep blue-grey
// Outer membrane vesicles: bright amber at filament tips
vec3 stain(float wander, float final_arg, float iter_ratio, float time) {
    vec3 safranin    = vec3(0.85, 0.25, 0.28);   // gram-negative outer membrane
    vec3 periplasm   = vec3(0.70, 0.45, 0.65);   // thin peptidoglycan wall
    vec3 nucleoid    = vec3(0.18, 0.22, 0.42);   // condensed DNA territory
    vec3 flagellum   = vec3(0.92, 0.80, 0.55);   // rotating flagellar bundle
    vec3 cytoplasm   = vec3(0.88, 0.78, 0.72);   // intracellular space

    // Helical rhythm: spirochetes rotate as they translate
    float helical = sin(final_arg * 3.0 + time * 1.8 + iter_ratio * 12.0) * 0.5 + 0.5;

    // Filament body: high wander, mid iteration
    float filament = wander * smoothstep(0.2, 0.7, iter_ratio);

    // Core nucleoid: converged quickly, minimal wander
    float core = (1.0 - iter_ratio) * (1.0 - wander);

    // Flagellar tips: sparse, high iter_ratio
    float tip = smoothstep(0.75, 0.95, iter_ratio) * (1.0 - wander);

    vec3 col = cytoplasm;
    col = mix(col, safranin,  filament * 0.75);
    col = mix(col, periplasm, filament * helical * 0.5);
    col = mix(col, nucleoid,  core * 0.7);
    col = mix(col, flagellum, tip * 0.6);

    // Helical segment bands: the structural repeat of the helix
    float segment = sin(final_arg * 9.0 + time * 0.8) * 0.5 + 0.5;
    col *= 0.82 + 0.18 * segment;

    return col;
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    st.x *= u_resolution.x / u_resolution.y;

    // Viewport: moderate zoom — individual organism scale
    float zoom = 3.5 + 0.4 * sin(u_time * 0.09);
    vec2 offset = vec2(-1.8, -1.75);
    vec2 c = (st + offset) * zoom;

    // Mouse: navigate the cubic parameter space — note: small moves produce large changes
    vec2 mouse_norm = u_mouse / u_resolution;
    vec2 mutation = vec2(-0.4, 0.6);
    mutation += (mouse_norm - 0.5) * vec2(0.35, 0.25);

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
        if (delta < CONV_THRESH && i > 8) {
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

    vec3 col = stain(wander, final_arg, iter_ratio, u_time);

    // Alive mask: spirochetes have a sharp outer membrane — steeper boundary
    float alive = 1.0 - smoothstep(0.0, 0.04, wander + (converged ? 0.0 : 0.08));
    col *= alive;

    // Phase contrast halo: these are transparent organisms — boundary ring
    float halo = smoothstep(0.015, 0.06, wander) * (1.0 - smoothstep(0.25, 0.5, wander));
    col += vec3(0.65, 0.70, 0.75) * halo * 0.35;

    // Motility shimmer: slow oscillation from flagellar rotation
    float shimmer = sin(u_time * 3.5 + length(c) * 8.0) * 0.02;
    col += vec3(0.4, 0.2, 0.1) * shimmer * wander;

    // Vignette
    float vig = 1.0 - smoothstep(0.5, 1.5, length(st - 0.5));
    col *= vig;

    gl_FragColor = vec4(col, 1.0);
}
