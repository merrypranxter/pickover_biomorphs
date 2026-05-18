// Environment: Saline medium — buffered aqueous solution, phase contrast stage
// Used with: _embryonic (primary), any aquatic specimen
//
// The organism floats in a thin layer of saline between slide and cover slip.
// Light passes through liquid before and after the specimen.
// Key optical effects: subtle caustics, Brownian scattering, refractive index shimmer.
// Render before the specimen shader; blend result under organism layer.

precision highp float;

uniform vec2 u_resolution;
uniform float u_time;

// ── Medium generation ─────────────────────────────────────────────────────────

// Hash utility
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Smooth noise — base for thermal fluctuations
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

// Thermal convection: slow large-scale drift in the medium
// Creates a very gentle brightness gradient that shifts over time
float thermal_drift(vec2 uv) {
    float t = u_time * 0.05;
    float n1 = snoise(uv * 2.5 + vec2(t, t * 0.7));
    float n2 = snoise(uv * 5.0 + vec2(-t * 0.8, t * 0.3));
    return n1 * 0.6 + n2 * 0.4;
}

// Brownian scatter: sub-resolution particles in suspension
// Visible as faint, temporally-varying grain (unlike static film grain)
float brownian_scatter(vec2 uv) {
    // Three temporal layers at different drift speeds — independent particles
    float t1 = u_time * 0.4;
    float t2 = u_time * 0.27;
    float t3 = u_time * 0.61;

    float s1 = snoise(uv * 180.0 + vec2(t1, -t1 * 0.7));
    float s2 = snoise(uv * 240.0 + vec2(-t2 * 0.5, t2));
    float s3 = snoise(uv * 310.0 + vec2(t3 * 0.3, t3 * 0.9));

    return (s1 + s2 + s3) / 3.0;
}

// Caustics: refractive index micro-heterogeneities in the medium focus
// and defocus light into faint bright/dark ripples — most visible at edges
float caustics(vec2 uv) {
    float t = u_time * 0.08;
    vec2 p = uv * 8.0;

    float c1 = snoise(p + vec2(sin(t), cos(t * 0.7)));
    float c2 = snoise(p * 1.4 + vec2(cos(t * 1.1), sin(t * 0.5)));

    // Caustic lines: ridges of the noise sum
    float caustic = abs(c1 + c2 - 1.0);
    caustic = 1.0 - smoothstep(0.0, 0.25, caustic);
    return caustic;
}

// ── Medium color ──────────────────────────────────────────────────────────────
// Saline is optically near-water: very slightly blue, refractive index ~1.335
// Phase contrast setup: bright background field, grey-ish
vec3 medium_color(vec2 uv) {
    float drift = thermal_drift(uv);
    float scatter = brownian_scatter(uv);
    float caustic = caustics(uv);

    // Phase contrast background: bright grey-white, very slightly cool
    vec3 base = vec3(0.82, 0.85, 0.88);

    // Thermal modulation: gentle brightness variations
    base *= 0.95 + 0.05 * drift;

    // Brownian scatter: sub-resolution particle shimmer
    base += vec3(0.015) * scatter;

    // Caustics: faint bright filaments
    base += vec3(0.85, 0.90, 0.95) * caustic * 0.04;

    // Edge: saline drop thins out at the boundary — slight darkening
    float r = length(uv - 0.5);
    float meniscus = smoothstep(0.35, 0.50, r);
    base = mix(base, vec3(0.5, 0.55, 0.60), meniscus * 0.3);

    return clamp(base, 0.0, 1.0);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec3 col = medium_color(uv);
    gl_FragColor = vec4(col, 1.0);
}
