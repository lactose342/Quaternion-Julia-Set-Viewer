precision highp float;

uniform vec2 u_resolution;
uniform vec4 u_c;
uniform int u_maxIter;
uniform int u_maxSteps;
uniform vec3 u_cameraPos;
uniform mat4 u_cameraWorldMatrix;
uniform mat4 u_cameraProjectionMatrixInverse;

uniform float u_brightness;
// uniform float u_hue; // 削除: JS側で計算して u_tintColor として渡す
// uniform float u_saturation; // 削除: 同上
uniform vec3 u_tintColor; // 追加: 事前計算されたベースカラー

uniform float u_aoPower;
uniform float u_specular;
uniform vec3 u_bgColor;
uniform float u_bgAlpha;
uniform mat4 u_rotMatrix_3D;
uniform mat4 u_rotMatrix_4D;

vec4 qSq(vec4 q) {
    return vec4(q.x*q.x - dot(q.yzw, q.yzw), 2.0*q.x*q.yzw);
}

vec2 iSphere(vec3 ro, vec3 rd, float r) {
    float b = dot(ro, rd);
    float c = dot(ro, ro) - r*r;
    float h = b*b - c;
    if(h < 0.0) return vec2(-1.0);
    h = sqrt(h);
    return vec2(-b-h, -b+h);
}

vec2 map4D(vec4 z) {
    float m2 = dot(z, z);
    float dz2 = 1.0;
    float iter = 0.0;
    
    for(int i = 0; i < 200; i++) {
        if(i >= u_maxIter) break;
        
        dz2 *= 4.0 * m2;
        if (dz2 > 1e10) dz2 = 1e10; // ★追加：無限大発散による黒抜け対策
        
        z = qSq(z) + u_c;
        m2 = dot(z, z);
        if(m2 > 32.0) {
            iter = float(i) - log2(max(1.0, log2(m2) / 2.0));
            break;
        }
    }
    float d = 0.25 * log(m2) * sqrt(m2 / dz2);
    return vec2(d, iter);
}

vec2 map3D(vec3 p) {
    vec4 p4 = u_rotMatrix_4D * vec4((u_rotMatrix_3D * vec4(p, 1.0)).xyz, 0.0);
    return map4D(p4);
}

vec3 calcNormal(vec3 p, float d_from_cam) {
    float e_val = max(0.0005, d_from_cam * 0.0002);
    vec2 e = vec2(1.0, -1.0) * e_val;
    return normalize(
        e.xyy * map3D(p + e.xyy).x +
        e.yyx * map3D(p + e.yyx).x +
        e.yxy * map3D(p + e.yxy).x +
        e.xxx * map3D(p + e.xxx).x
    );
}

vec3 ACESFilm(vec3 x) {
    float a = 2.51; float b = 0.03; float c = 2.43; float d = 0.59; float e = 0.14;
    return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}

vec4 render(vec2 fragCoord) {
    vec2 ndc = (fragCoord / u_resolution.xy) * 2.0 - 1.0;
    vec4 target = u_cameraProjectionMatrixInverse * vec4(ndc.x, ndc.y, 1.0, 1.0);
    vec3 rayDir = (u_cameraWorldMatrix * vec4(normalize(target.xyz / target.w), 0.0)).xyz;
    vec3 rayPos = u_cameraPos;

    vec2 sph = iSphere(rayPos, rayDir, 2.5);
    if(sph.y < 0.0) return vec4(u_bgColor, u_bgAlpha);

    float d = 0.0;
    float iter = 0.0;
    float total_d = max(0.0, sph.x);
    rayPos += rayDir * total_d;

    vec4 rPos4D = u_rotMatrix_4D * vec4((u_rotMatrix_3D * vec4(rayPos, 1.0)).xyz, 0.0);
    vec4 rDir4D = u_rotMatrix_4D * vec4((u_rotMatrix_3D * vec4(rayDir, 0.0)).xyz, 0.0);

    bool hit = false;
    int steps_taken = 0;

    for(int i = 0; i < 8000; i++) {
        if(i >= u_maxSteps) break;
        steps_taken = i;

        vec2 res = map4D(rPos4D);
        d = res.x;
        iter = res.y;
        
        if(d < 0.001) { hit = true; break; }
        if(total_d > sph.y) break;
        
        float stepDist = d * 0.95;
        rPos4D += rDir4D * stepDist; // 4D上のレイを進める
        rayPos += rayDir * stepDist; // オリジナルの3Dレイも進める（法線・ライティング計算用）
        total_d += stepDist;
    }

    if(hit) {
        vec3 normal = calcNormal(rayPos, total_d);
        vec3 lightDir = normalize(u_cameraPos - rayPos + vec3(-1.0, -2.0, 2.0));
        vec3 viewDir = normalize(u_cameraPos - rayPos);
        vec3 halfDir = normalize(lightDir + viewDir);
        
        float diff = max(dot(lightDir, normal), 0.0);
        float spec = pow(max(dot(halfDir, normal), 0.0), u_specular);
        float shdw_mt = clamp(0.3 + 0.25 * diff + spec, 0.0, 1.0);
        float ao = clamp(10.0 / float(max(1, steps_taken)), 0.0, 1.0);
        ao = pow(ao, u_aoPower);
        
        // JSから受け取った tintColor をそのまま使用
        float colorVariation = 0.85 + 0.15 * sin(iter * 0.5);
        vec3 baseColor = u_tintColor * colorVariation;
        
        float depth_val = max(0.0, 1.0 - total_d / 20.0);
        vec3 finalColor = baseColor * ao * depth_val * shdw_mt;
        
        if (u_bgAlpha > 0.5) {
            finalColor += u_bgColor * (1.0 - ao) * 0.15;
        }
        
        finalColor = pow(finalColor, vec3(0.8));
        finalColor *= u_brightness;
        finalColor = ACESFilm(finalColor);
        return vec4(clamp(finalColor, 0.0, 1.0), 1.0);
    }
    return vec4(u_bgColor, u_bgAlpha);
}

void main() {
    #ifdef ENABLE_AA
        vec4 col = vec4(0.0);
        col += render(gl_FragCoord.xy + vec2(-0.25, -0.25));
        col += render(gl_FragCoord.xy + vec2( 0.25, -0.25));
        col += render(gl_FragCoord.xy + vec2(-0.25,  0.25));
        col += render(gl_FragCoord.xy + vec2( 0.25,  0.25));
        gl_FragColor = col / 4.0;
    #else
        gl_FragColor = render(gl_FragCoord.xy);
    #endif
}