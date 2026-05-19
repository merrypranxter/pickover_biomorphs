// Environment: Immersion oil — high-refractive-index optical medium
// Used with: _radiolarian (oil immersion darkfield), _spore (high-NA brightfield)
//
// Immersion oil (n ≈ 1.515) fills the gap between the objective front lens and the
// cover slip, eliminating the refractive index discontinuity at the glass–air interface.
// This increases numerical aperture to its maximum value (NA = n · sin α ≤ 1.515).
//
// Optical effects of the oil itself:
//   - Very slight yellowish cast (most oils are amber under intense illumination)
//   - Microscopic inclusions and air micro-bubbles introduce bright specular speckles
//   - At the oil/cover-slip boundary, Newton rings form over debris
//   - Edge of the oil drop: a meniscus creates a chromatic fringe (CA)
// Render before the specimen shader; blend result under organism layer.

precision highp float;

uniform vec2 u_resolution;
uniform float u_time;

// ── Utility ───────────────────────────────────────────────────────────────────

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float snoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
    );
}

// ── Oil medium generation ─────────────────────────────────────────────────────

// Micro-inclusions: small particulate matter trapped in the oil drop
// Appears as bright specular points under intense illumination
float micro_inclusions(vec2 uv) {
    vec2 p = uv * 420.0;
    float n = hash(floor(p));
    float density = step(0.993, n);    // very sparse
    // Each inclusion has a tiny specular highlight
    vec2 local = fract(p) - 0.5;
    float spot = exp(-dot(local, local) * 120.0);
    return density * spot;
}

// Air micro-bubbles: slightly larger, ring-like (hollow)
// Very rare — appear only when oil was not degassed before use
float micro_bubbles(vec2 uv) {
    vec2 p = uv * 85.0;
    float n = hash(floor(p));
    float density = step(0.9985, n);   // extremely sparse
    vec2 local = fract(p) - 0.5;
    float r = length(local);
    // Ring shape: bright at circumference, dark center
    float ring = exp(-pow((r - 0.35) / 0.08, 2.0)) - exp(-pow(r / 0.15, 2.0)) * 0.3;
    return density * max(ring, 0.0);
}

// Oil meniscus at field edge: the drop boundary refracts strongly
// Creates a chromatic fringe (lateral chromatic aberration) at the perimeter
vec3 meniscus_fringe(vec2 uv) {
    float r = length(uv - 0.5);
    // Meniscus region: near the edge of the oil drop
    float edge = smoothstep(0.42, 0.52, r) * (1.0 - smoothstep(0.50, 0.56, r));
    // Chromatic fringe: lateral CA — red and blue shift in opposite directions
    vec3 fringe = vec3(
        edge * 0.08 * sin(r * 80.0),
        edge * 0.03,
        edge * 0.08 * sin(r * 80.0 + 3.14159)
    );
    return fringe;
}

// Slow thermal circulation in the oil — slight refractive index gradient
// Creates very gentle brightness waves that drift over seconds
float thermal_shimmer(vec2 uv) {
    float t = u_time * 0.018;
    float n = snoise(uv * 3.0 + vec2(t, -t * 0.6))
            + snoise(uv * 6.5 + vec2(-t * 0.4, t * 0.9)) * 0.5;
    return n / 1.5;
}

// ── Oil color ─────────────────────────────────────────────────────────────────
// Base: very slightly amber — high-quality immersion oil is nearly water-clear
// but warm light source + amber glass produces a faint golden background
vec3 oil_color(vec2 uv) {
    float shimmer = thermal_shimmer(uv);
    float incl    = micro_inclusions(uv);
    float bubbles = micro_bubbles(uv);
    vec3  fringe  = meniscus_fringe(uv);

    // Base transmission: near-white, very faintly amber
    vec3 base = vec3(0.965, 0.955, 0.940);

    // Thermal variation: refractive index gradient → brightness modulation
    base *= 0.97 + 0.03 * shimmer;

    // Micro-inclusions: warm white specular specks
    base += vec3(1.0, 0.97, 0.92) * incl * 0.8;

    // Micro-bubbles: bright ring, slightly cooler
    base += vec3(0.85, 0.90, 0.95) * bubbles * 0.6;

    // Meniscus chromatic fringe at the field edge
    base += fringe;

    // Vignette: oil drop is circular; outside = coverslip edge (much darker)
    float r = length(uv - 0.5);
    float field = smoothstep(0.52, 0.48, r);    // sharp inside the oil drop
    base = mix(vec3(0.10, 0.08, 0.06), base, field);

    return clamp(base, 0.0, 1.0);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec3 col = oil_color(uv);
    gl_FragColor = vec4(col, 1.0);
}
