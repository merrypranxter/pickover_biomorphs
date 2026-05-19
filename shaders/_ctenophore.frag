// HABITAT: Darkfield, aquatic medium — deep ocean pelagic zone
// ORGANISM: Ctenophore — gelatinous comb-jelly, iridescent locomotory comb plates
// FUNCTION: z = exp(z) + c (exponential Pickover biomorph — rapid angular variation)
// MUTATION: c = (-1.5, 0.1), iter = 80
//
// exp(z) = e^Re(z) * (cos(Im(z)), sin(Im(z)))
// The exponential function amplifies the real component dramatically while the imaginary
// component drives angular oscillation. This produces forms with strong angular banding —
// analogous to the comb plates (ctenes) that line the meridional canals of ctenophores.
// Each comb plate beats iridescently as it refracts light; here, the imaginary-axis
// oscillation of cexp() generates the characteristic rainbow stripe pattern.
//
// Palette: iridescent comb-plate interference, transparent mesoglea, bioluminescent
// edge discharge. Ctenophores are among the most visually spectacular marine organisms.
// No stain: they are nearly optically invisible in ambient light; only scattered light
// and self-bioluminescence reveal their form.

precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

#define MAX_ITER 80
#define CONV_THRESH 0.0008
#define ESCAPE_THRESH 40.0

// ── Complex arithmetic ────────────────────────────────────────────────────────

// exp(x + iy) = e^x * (cos(y) + i*sin(y))
vec2 cexp(vec2 z) {
    return exp(z.x) * vec2(cos(z.y), sin(z.y));
}

// Ctenophore generator: exponential drift with complex constant
vec2 biomorph(vec2 z, vec2 c) {
    return cexp(z) + c;
}

// ── Ctenophore palette ────────────────────────────────────────────────────────
// Mesoglea: the gelatinous body — near-transparent, very slightly blue
// Comb plates: iridescent, covering 8 meridional rows
// Bioluminescence: flashes at orbit boundaries, blue-green
// Tentacles: thin, sticky, high-wander orbit traces
vec3 stain(float wander, float final_arg, float iter_ratio, float time) {
    vec3 mesoglea      = vec3(0.08, 0.14, 0.25);   // nearly transparent body, cold blue
    vec3 biolumin      = vec3(0.10, 0.75, 0.55);   // bioluminescent discharge
    vec3 comb_base     = vec3(0.15, 0.20, 0.35);   // comb row, dark background
    vec3 tentacle      = vec3(0.55, 0.70, 0.85);   // colloblast-bearing tentacle

    // Comb plate iridescence: 8-fold along meridional canals
    // Each plate cycles through the visible spectrum as it beats
    float plate_phase = final_arg * 4.0 + time * 2.5 + iter_ratio * 8.0;
    vec3 comb_irid = 0.5 + 0.5 * vec3(
        sin(plate_phase),
        sin(plate_phase + 2.094),
        sin(plate_phase + 4.189)
    );

    // Comb row: follows the meridional canal (8-fold angular symmetry)
    float canal = pow(abs(sin(final_arg * 4.0)), 0.4);
    float comb_density = canal * smoothstep(0.3, 0.7, iter_ratio) * (1.0 - wander * 0.5);

    // Bioluminescent edge: discharged at orbit excitation zone
    float edge = smoothstep(0.04, 0.12, wander) * (1.0 - smoothstep(0.3, 0.65, wander));
    float biolumin_pulse = edge * (0.6 + 0.4 * sin(time * 4.0 + final_arg * 6.0));

    // Tentacle trails: high wander, extended orbits
    float tendril = wander * smoothstep(0.4, 0.9, iter_ratio);

    vec3 col = mesoglea;
    col = mix(col, comb_base,   comb_density * 0.5);
    col += comb_irid * comb_density * 0.7;
    col = mix(col, biolumin,   biolumin_pulse * 0.8);
    col = mix(col, tentacle,   tendril * 0.4);

    // Aboral organ: the sensory structure at the top pole — bright spot
    float aboral = exp(-pow(length(vec2(final_arg / 3.14159, iter_ratio - 0.05)) * 8.0, 2.0));
    col += vec3(0.9, 0.95, 1.0) * aboral * 0.4;

    return col;
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    st.x *= u_resolution.x / u_resolution.y;

    // Viewport: the exponential function needs careful framing — small Re values
    float zoom = 2.5 + 0.2 * sin(u_time * 0.05);
    vec2 offset = vec2(-1.25, -1.25);
    vec2 c = (st + offset) * zoom;

    // Mouse: move carefully — exp(z)+c is extremely sensitive to Re(c)
    vec2 mouse_norm = u_mouse / u_resolution;
    vec2 mutation = vec2(-1.5, 0.1);
    mutation += (mouse_norm - 0.5) * vec2(0.4, 0.3);

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
        if (delta < CONV_THRESH && i > 6) {
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

    // Alive mask: soft boundary — ctenophores have no hard wall
    float alive = 1.0 - smoothstep(0.0, 0.07, wander + (converged ? 0.0 : 0.1));
    col *= alive;

    // Darkfield: absolute black background
    // Ctenophore only visible via scattered/bioluminescent light
    float scattered = length(col) * (1.0 - alive * 0.5);
    col += vec3(0.05, 0.15, 0.30) * scattered * 0.15;

    // Vignette: deep ocean — vignetted darkfield
    float vig = 1.0 - smoothstep(0.4, 1.3, length(st - 0.5));
    col *= vig;

    // Photographic grain — long-exposure ocean darkfield
    float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    col *= 0.93 + 0.07 * grain;

    gl_FragColor = vec4(col, 1.0);
}
