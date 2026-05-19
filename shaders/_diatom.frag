// HABITAT: Brightfield transmitted light, glass substrate, moderate magnification
// ORGANISM: Pennate diatom — bilateral symmetry, siliceous frustule with raphe and striae
// FUNCTION: z = cos(z) + c (cosine Pickover biomorph — bilateral symmetry emerges from even function)
// MUTATION: c = (0.7, 0.2), iter = 70
//
// The cosine generator is fundamentally different from sine: cos is an even function,
// cos(-z) = cos(z), which induces bilateral (mirror) symmetry in the resulting organism.
// Pennate diatoms — Navicula, Pinnularia, Nitzschia — are the biological archetype:
// two identical valves joined at a girdle, striae (ribs) running perpendicular to the raphe.
// The frustule (silica wall) produces strong interference colors under transmitted light.
//
// Staining: no classical stain. Silica autofluoresces; chloroplasts appear gold-brown.
// Under brightfield: golden-brown chloroplast, pale blue silicate cell wall.

precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

#define MAX_ITER 70
#define CONV_THRESH 0.0006
#define ESCAPE_THRESH 50.0

// ── Complex arithmetic ────────────────────────────────────────────────────────

// cos(x+iy) = cos(x)cosh(y) - i*sin(x)sinh(y)
vec2 ccos(vec2 z) {
    return vec2(cos(z.x) * cosh(z.y), -sin(z.x) * sinh(z.y));
}

// Pennate diatom generator: bilateral symmetry via cosine
vec2 biomorph(vec2 z, vec2 c) {
    return ccos(z) + c;
}

// ── Diatom palette ────────────────────────────────────────────────────────────
// Frustule (silica shell): pale blue-grey, iridescent interference color
// Chloroplast: golden-brown, the signature of chrysophyte algae
// Raphe: narrow slit in the frustule, darker, slightly greenish
// Striae: radial ribs in the frustule, bright highlight on valve face
// Protoplast: the living cell contents, warm amber
vec3 stain(float wander, float final_arg, float iter_ratio, float bilateral) {
    vec3 frustule    = vec3(0.78, 0.84, 0.90);   // silicate shell — pale blue
    vec3 chloroplast = vec3(0.72, 0.58, 0.18);   // photosynthetic organelle
    vec3 raphe       = vec3(0.35, 0.42, 0.38);   // the slit — darker, greenish
    vec3 stria       = vec3(0.92, 0.94, 0.96);   // rib highlight — bright
    vec3 protoplast  = vec3(0.85, 0.70, 0.30);   // living contents — amber

    // Bilateral symmetry indicator: how close to the mirror axis
    float axial = 1.0 - abs(sin(final_arg));   // high at Re/Im axes

    // Frustule body: mid iteration, low-to-mid wander
    float shell = smoothstep(0.3, 0.75, iter_ratio) * (1.0 - wander * 0.5);

    // Chloroplast: converged interior
    float chloro = (1.0 - iter_ratio) * (1.0 - wander) * 0.9;

    // Raphe slit: along the symmetry axis, narrow
    float raphe_band = exp(-pow(axial * 12.0 - 6.0, 2.0) * 0.5);
    raphe_band *= smoothstep(0.2, 0.6, iter_ratio);

    // Striae: periodic ribs across the valve face
    float striae = pow(sin(final_arg * 16.0) * 0.5 + 0.5, 4.0);
    striae *= shell;

    vec3 col = protoplast;
    col = mix(col, frustule,    shell * bilateral * 0.8);
    col = mix(col, chloroplast, chloro);
    col = mix(col, raphe,       raphe_band * 0.5);
    col += stria * striae * 0.25;

    // Interference color from frustule thickness (thin-film, slow shift)
    float thin_film = sin(iter_ratio * 18.0 + final_arg * 4.0 + u_time * 0.05) * 0.5 + 0.5;
    vec3 irid = vec3(
        0.5 + 0.5 * sin(thin_film * 6.28),
        0.5 + 0.5 * sin(thin_film * 6.28 + 2.09),
        0.5 + 0.5 * sin(thin_film * 6.28 + 4.19)
    );
    col = mix(col, irid, shell * 0.12);

    return col;
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    st.x *= u_resolution.x / u_resolution.y;

    // Viewport: tight zoom — single cell field of view
    float zoom = 4.0 + 0.3 * sin(u_time * 0.06);
    vec2 offset = vec2(-2.0, -2.0);
    vec2 c = (st + offset) * zoom;

    // Mouse: navigate the frustule parameter space
    vec2 mouse_norm = u_mouse / u_resolution;
    vec2 mutation = vec2(0.7, 0.2);
    mutation += (mouse_norm - 0.5) * vec2(0.3, 0.25);

    vec2 z = c;

    float wander = 0.0;
    float last_z = length(z);
    float bilateral_accum = 0.0;
    bool converged = false;
    int iter = 0;

    for (int i = 0; i < MAX_ITER; i++) {
        z = biomorph(z, mutation);
        float len = length(z);
        float arg = atan(z.y, z.x);

        if (len > ESCAPE_THRESH) {
            iter = i;
            break;
        }

        float delta = abs(len - last_z);
        if (delta < CONV_THRESH && i > 6) {
            converged = true;
            iter = i;
            break;
        }

        // Bilateral symmetry accumulation: even-fold symmetry indicator
        float bilateral = abs(cos(arg * 2.0));  // high on both mirror axes
        bilateral_accum += bilateral * delta;

        wander += delta;
        last_z = len;
        iter = i;
    }

    wander /= float(MAX_ITER);
    bilateral_accum /= (wander * float(MAX_ITER) + 0.001);
    float iter_ratio = float(iter) / float(MAX_ITER);
    float final_arg  = atan(z.y, z.x);

    vec3 col = stain(wander, final_arg, iter_ratio, bilateral_accum);

    // Alive mask: diatoms have a rigid frustule — crisp boundary
    float alive = 1.0 - smoothstep(0.0, 0.04, wander + (converged ? 0.0 : 0.1));
    col *= alive;

    // Brightfield: light background, organism is darker/colored relative to field
    // Mix organism over a warm-white background
    vec3 bg = vec3(0.92, 0.93, 0.90);
    col = mix(bg, col, alive);

    // Vignette: circular field stop
    float vig = 1.0 - smoothstep(0.47, 0.52, length(st - 0.5));
    col *= vig;

    // Subtle film grain — brightfield shows less grain than darkfield
    float grain = fract(sin(dot(gl_FragCoord.xy, vec2(19.311, 57.2183))) * 35721.4512);
    col *= 0.97 + 0.03 * grain;

    gl_FragColor = vec4(col, 1.0);
}
