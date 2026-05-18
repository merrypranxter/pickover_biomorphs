// HABITAT: Phase contrast microscopy, saline medium, cool white light
// ORGANISM: Embryonic form — soft, translucent, barely held together by surface tension
// FUNCTION: z = sin(z) + c (softer generator, produces aquatic/embryonic forms)
// MUTATION: c = (0.3, 0.4), iter = 60, low convergence threshold for membrane integrity

precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

#define MAX_ITER 60
#define CONV_THRESH 0.0005
#define ESCAPE_THRESH 40.0

vec2 csin(vec2 z) {
    return vec2(sin(z.x) * cosh(z.y), cos(z.x) * sinh(z.y));
}

vec2 cmul(vec2 a, vec2 b) {
    return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

// Embryonic generator: softer, more yielding
vec2 biomorph(vec2 z, vec2 c) {
    return csin(z) + c;
}

vec3 stain(float wander, float final_arg, float iter_ratio, float time) {
    // Embryonic palette: yolk, cytoplasm, vitelline membrane
    vec3 yolk = vec3(0.95, 0.78, 0.25);         // lipid droplets
    vec3 cytoplasm = vec3(0.88, 0.92, 0.85);    // translucent jelly
    vec3 nucleus = vec3(0.65, 0.25, 0.35);    // genetic material
    vec3 membrane = vec3(0.72, 0.82, 0.88);    // vitelline boundary
    
    // Pulsation: embryonic heartbeat
    float pulse = sin(time * 2.0 + final_arg * 3.0) * 0.5 + 0.5;
    
    // Yolk accumulation: converged core
    float yolk_density = (1.0 - iter_ratio) * (1.0 - wander);
    
    // Membrane integrity: high wander, sustained
    float membrane_int = wander * smoothstep(0.3, 0.8, iter_ratio);
    
    // Cytoplasm: the living medium
    float cyto = smoothstep(0.1, 0.6, iter_ratio) * (1.0 - yolk_density);
    
    vec3 col = mix(cytoplasm, yolk, yolk_density * 0.8);
    col = mix(col, nucleus, yolk_density * 0.4 * pulse);
    col = mix(col, membrane, membrane_int * 0.5);
    
    // Surface tension shimmer
    float tension = sin(final_arg * 8.0 + time) * 0.5 + 0.5;
    col += membrane * tension * membrane_int * 0.3;
    
    return col;
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    st.x *= u_resolution.x / u_resolution.y;
    
    float zoom = 4.0;
    vec2 offset = vec2(-2.0, -2.0);
    vec2 c = (st + offset) * zoom;
    
    vec2 mouse_norm = u_mouse / u_resolution;
    vec2 mutation = vec2(0.3, 0.4);
    mutation += (mouse_norm - 0.5) * vec2(0.3, 0.3);
    
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
        if (delta < CONV_THRESH && i > 5) {
            converged = true;
            iter = i;
            break;
        }
        
        wander += abs(len - last_z);
        last_z = len;
        iter = i;
    }
    
    wander /= float(MAX_ITER);
    float iter_ratio = float(iter) / float(MAX_ITER);
    float final_arg = atan(z.y, z.x);
    
    vec3 col = stain(wander, final_arg, iter_ratio, u_time);
    
    float alive = 1.0 - smoothstep(0.0, 0.05, wander + (converged ? 0.0 : 0.1));
    col *= alive;
    
    // Phase contrast halo: the signature of transparent specimens
    float halo = smoothstep(0.02, 0.08, wander) * (1.0 - smoothstep(0.3, 0.6, wander));
    col += vec3(0.6, 0.65, 0.7) * halo * 0.4;
    
    // Vignette
    float vig = 1.0 - smoothstep(0.5, 1.5, length(st - 0.5));
    col *= vig;
    
    gl_FragColor = vec4(col, 1.0);
}
