// HABITAT: Darkfield microscopy with oil immersion, high magnification
// ORGANISM: Radiolarian — silicate skeleton with radial spines, geometric precision in organic form
// FUNCTION: z = z * sin(z) + c (produces radial, spiky forms)
// MUTATION: c = (0.2, 0.15), iter = 100, tuned for spine elongation and radial symmetry

precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

#define MAX_ITER 100
#define CONV_THRESH 0.0008
#define ESCAPE_THRESH 60.0

vec2 cmul(vec2 a, vec2 b) {
    return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

vec2 csin(vec2 z) {
    return vec2(sin(z.x) * cosh(z.y), cos(z.x) * sinh(z.y));
}

// Radiolarian generator: radial multiplication produces star-like symmetry
vec2 biomorph(vec2 z, vec2 c) {
    return cmul(z, csin(z)) + c;
}

vec3 stain(float wander, float final_arg, float iter_ratio, float radial_sym) {
    // Silicate palette: opaline glass, refractive indices, fossil mineral
    vec3 silicate = vec3(0.85, 0.90, 0.92);      // opaline silica
    vec3 spine = vec3(0.95, 0.95, 0.98);         // needle tip highlight
    vec3 pore = vec3(0.10, 0.15, 0.20);          // foraminal opening
    vec3 cytoplasm = vec3(0.20, 0.35, 0.30);   // residual protoplasm
    
    // Radial symmetry creates the spine pattern
    float spine_density = radial_sym * wander;
    
    // Central capsule: the dense core
    float capsule = (1.0 - iter_ratio) * 0.8;
    
    // Pore fields: where cytoplasm extrudes
    float pore_field = smoothstep(0.4, 0.6, iter_ratio) * (1.0 - radial_sym);
    
    vec3 col = mix(silicate, cytoplasm, capsule);
    col = mix(col, spine, spine_density * 0.7);
    col = mix(col, pore, pore_field * 0.6);
    
    // Iridescence: thin-film interference on silicate
    float irid = sin(final_arg * 12.0 + iter_ratio * 20.0) * 0.5 + 0.5;
    vec3 irid_col = vec3(0.6, 0.8, 1.0) * irid;
    col += irid_col * spine_density * 0.3;
    
    // Fossilization gradient: older = more mineral, less organic
    float fossil = smoothstep(0.7, 0.95, iter_ratio);
    vec3 mineral = vec3(0.75, 0.78, 0.72);
    col = mix(col, mineral, fossil * 0.5);
    
    return col;
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    st.x *= u_resolution.x / u_resolution.y;
    
    float zoom = 5.0;
    vec2 offset = vec2(-2.5, -2.5);
    vec2 c = (st + offset) * zoom;
    
    vec2 mouse_norm = u_mouse / u_resolution;
    vec2 mutation = vec2(0.2, 0.15);
    mutation += (mouse_norm - 0.5) * vec2(0.25, 0.25);
    
    vec2 z = c;
    
    float wander = 0.0;
    float last_z = length(z);
    float radial_accum = 0.0;
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
        if (delta < CONV_THRESH && i > 8) {
            converged = true;
            iter = i;
            break;
        }
        
        // Measure radial symmetry component
        float sym = abs(sin(arg * 6.0)); // Hexaradial baseline
        radial_accum += sym * delta;
        
        wander += delta;
        last_z = len;
        iter = i;
    }
    
    wander /= float(MAX_ITER);
    radial_accum /= (wander * float(MAX_ITER) + 0.001);
    float iter_ratio = float(iter) / float(MAX_ITER);
    float final_arg = atan(z.y, z.x);
    
    vec3 col = stain(wander, final_arg, iter_ratio, radial_accum);
    
    float alive = 1.0 - smoothstep(0.0, 0.03, wander + (converged ? 0.0 : 0.15));
    col *= alive;
    
    // Oil immersion: slight chromatic aberration at edges
    float ca = length(st - 0.5) * 0.02;
    col.r += ca;
    col.b -= ca * 0.5;
    
    // Vignette
    float vig = 1.0 - smoothstep(0.5, 1.5, length(st - 0.5));
    col *= vig;
    
    gl_FragColor = vec4(col, 1.0);
}
