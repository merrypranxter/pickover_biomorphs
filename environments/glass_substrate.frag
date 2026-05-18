// Environment: Glass substrate — borosilicate microscope slide, transmitted white light
// Used with: _base_insectoid, _radiolarian (darkfield mode)
//
// This is the "floor" of the optical system. Light passes through:
//   condenser → specimen → objective
// The glass introduces a faint birefringence pattern and edge newton rings.
// Render before the specimen shader; blend result under organism layer.

precision highp float;

uniform vec2 u_resolution;
uniform float u_time;

// ── Substrate generation ──────────────────────────────────────────────────────

// Birefringence: polarized-light fringes in stressed borosilicate glass
// Appear as faint rainbow bands, strongest near slide edges
float birefringence(vec2 uv) {
    // Stress increases toward edges
    vec2 centered = uv - 0.5;
    float edge_proximity = 1.0 - smoothstep(0.3, 0.5, max(abs(centered.x), abs(centered.y)));

    // Interference fringes from retardation
    float retardation = edge_proximity * 3.14159 * 4.0;
    return sin(retardation) * 0.5 + 0.5;
}

// Newton rings: concentric interference fringes from cover-slip contact
// Concentrated near a random "contact point" — shifts slowly with time
float newton_rings(vec2 uv) {
    // Contact point drifts as the slide warms
    float drift = u_time * 0.002;
    vec2 contact = vec2(0.48 + 0.04 * sin(drift * 1.3), 0.51 + 0.03 * cos(drift));

    float r = length(uv - contact) * 18.0;  // ring spacing depends on gap
    return pow(sin(r * r * 0.4) * 0.5 + 0.5, 3.0);
}

// Dust and scratches: high-frequency, static, sparse
float substrate_noise(vec2 uv) {
    // Very fine grain — below diffraction limit in practice, but visible under oil
    vec2 p = uv * 380.0;
    float n = fract(sin(dot(floor(p), vec2(127.1, 311.7))) * 43758.5453);
    return step(0.997, n);   // sparse bright specks
}

// ── Glass substrate color ────────────────────────────────────────────────────
// Base: near-neutral, very slightly warm (soda-lime glass tint)
// Birefringence adds the faintest pastel fringe
vec3 glass_color(vec2 uv) {
    float bfr = birefringence(uv);
    float rings = newton_rings(uv);
    float dust = substrate_noise(uv);

    // Base glass transmission: near-white, faintly warm
    vec3 base = vec3(0.96, 0.95, 0.93);

    // Birefringence tints: compensating hues (red-cyan pair, or yellow-blue)
    vec3 bfr_tint = mix(vec3(0.90, 0.95, 1.00), vec3(1.00, 0.93, 0.85), bfr);
    vec3 col = base * bfr_tint;

    // Newton rings: iridescent interference, low opacity
    vec3 ring_irid = vec3(
        0.5 + 0.5 * sin(rings * 6.28),
        0.5 + 0.5 * sin(rings * 6.28 + 2.09),
        0.5 + 0.5 * sin(rings * 6.28 + 4.19)
    );
    col = mix(col, ring_irid, rings * 0.07);

    // Dust: bright specular specks
    col += vec3(1.0) * dust * 0.6;

    // Vignette: slide mount obscures field edges
    float vig = 1.0 - smoothstep(0.42, 0.50, length(uv - 0.5));
    col *= vig;

    return clamp(col, 0.0, 1.0);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec3 col = glass_color(uv);
    gl_FragColor = vec4(col, 1.0);
}
