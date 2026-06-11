precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform vec2 u_resolution;
uniform vec4 u_c;

uniform vec3 u_cameraPos;
uniform mat4 u_cameraWorldMatrix;
uniform mat4 u_cameraProjectionMatrixInverse;

uniform float u_brightness;
uniform vec3 u_hsvColor; 
uniform float u_aoPower;
uniform float u_specular;
uniform vec3 u_bgColor;
uniform float u_bgAlpha;
uniform mat4 u_rotMatrix_3D;
uniform mat4 u_rotMatrix_4D;
uniform mat4 u_rotMatrix_Combined;
uniform float u_vrScale;
uniform vec3 u_vrOffset;

#ifndef MAX_STEPS
#define MAX_STEPS 800
#endif

#ifndef MAX_ITER
#define MAX_ITER 80
#endif

vec4 qSq(vec4 q) {
    return vec4(q.x*q.x - dot(q.yzw, q.yzw), 2.0*q.x*q.yzw);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec2 iSphere(vec3 ro, vec3 rd, float r) {
    float b = dot(ro, rd);
    float c = dot(ro, ro) - r*r;
    float h = b*b - c;
    if(h < 0.0) return vec2(-1.0);
    h = sqrt(h);
    return vec2(-b-h, -b+h);
}

vec2 map4D_iter(vec4 z, int max_iter) {
    float m2 = dot(z, z);
    float dz2 = 1.0;
    float iter = 0.0;

    for(int i = 0; i < MAX_ITER; i++) {
        if (i >= max_iter) break;
        // 微分を先に更新してからzを更新する（チェーンルール順序が重要）
        dz2 *= 4.0 * max(1e-8, m2);
        if (dz2 > 1e10) dz2 = 1e10;

        z = qSq(z) + u_c;
        m2 = dot(z, z);
        if(m2 > 32.0) {
            iter = float(i) - log2(max(1.0, log2(m2) / 2.0));
            break;
        }
    }
    
    m2 = max(1e-8, m2);
    float d = 0.25 * log(m2) * (sqrt(m2) / max(1e-6, sqrt(dz2)));
    return vec2(d, iter);
}

vec2 map4D(vec4 z) {
    return map4D_iter(z, MAX_ITER);
}

vec2 map3D(vec3 p) {
    vec4 p4 = u_rotMatrix_Combined * vec4(p, 0.0);
    return map4D(p4);
}

vec2 map3D_Normal(vec3 p) {
    vec4 p4 = u_rotMatrix_Combined * vec4(p, 0.0);
    #if defined(LIMIT_NORMAL_ITER)
        return map4D_iter(p4, 8);
    #else
        return map4D(p4);
    #endif
}

vec3 calcNormal(vec3 p, float d_from_cam) {
    float e_val = max(0.0008, d_from_cam * 0.0002);

    #if defined(IS_LOW_QUALITY)
        vec3 n;
        float d = map3D_Normal(p).x;
        n.x = map3D_Normal(p + vec3(e_val, 0.0, 0.0)).x - d;
        n.y = map3D_Normal(p + vec3(0.0, e_val, 0.0)).x - d;
        n.z = map3D_Normal(p + vec3(0.0, 0.0, e_val)).x - d;
        return normalize(n + 1e-7);
    #else
        vec2 e = vec2(1.0, -1.0) * e_val;
        vec3 n = vec3(
            e.xyy * map3D_Normal(p + e.xyy).x +
            e.yyx * map3D_Normal(p + e.yyx).x +
            e.yxy * map3D_Normal(p + e.yxy).x +
            e.xxx * map3D_Normal(p + e.xxx).x
        );
        return normalize(n + 1e-7);
    #endif
}

vec3 ACESFilm(vec3 x) {
    float a = 2.51; float b = 0.03;
    float c = 2.43; float d = 0.59; float e = 0.14;
    return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}

vec4 render(vec2 offset) {
    // vUv は [-1,1] のNDC座標。offsetはサブピクセルずれ（ピクセル単位）をNDCに変換して加算
    vec2 ndc = vUv + (offset / u_resolution) * 2.0;
    vec4 target = u_cameraProjectionMatrixInverse * vec4(ndc.x, ndc.y, 1.0, 1.0);
    vec3 rayDir = (u_cameraWorldMatrix * vec4(normalize(target.xyz / target.w), 0.0)).xyz;
    vec3 rayPos = u_cameraPos;

    // 世界座標からローカル座標（フラクタルの基準空間）へ変換
    vec3 localRayPos = (rayPos - u_vrOffset) / u_vrScale;
    vec3 localRayDir = rayDir; // 方向は回転のみに依存し、スケール・平行移動の影響を受けない

    // ローカル空間での球判定（原点中心、半径2.5）
    vec2 sph = iSphere(localRayPos, localRayDir, 2.5);
    if(sph.y < 0.0) return vec4(u_bgColor * u_bgAlpha, u_bgAlpha);

    float d = 0.0;
    float iter = 0.0;
    float total_d = max(0.0, sph.x);
    localRayPos += localRayDir * total_d;
    
    vec4 rPos4D = u_rotMatrix_Combined * vec4(localRayPos, 0.0);
    vec4 rDir4D = u_rotMatrix_Combined * vec4(localRayDir, 0.0);
    bool hit = false;
    int steps_taken = 0;

    for(int i = 0; i < MAX_STEPS; i++) {
        steps_taken = i;
        vec2 res = map4D(rPos4D);
        d = res.x;
        iter = res.y;
        
        if(d < 0.001) { hit = true; break; }
        if(total_d > sph.y) break;

        #ifdef IS_EXPORTING
            float stepDist = d * 0.4;
        #else
            float stepDist = d * 0.95;
        #endif

        rPos4D += rDir4D * stepDist;
        localRayPos += localRayDir * stepDist;
        total_d += stepDist;
    }

    if(hit) {
        // 法線計算もローカル空間の座標で行う
        vec3 normal = calcNormal(localRayPos, total_d);
        
        // ライトとビュー方向の計算（ワールド空間のカメラ位置をローカル空間に変換）
        vec3 localCameraPos = (u_cameraPos - u_vrOffset) / u_vrScale;
        vec3 lightDir = normalize(localCameraPos - localRayPos + vec3(-1.0, -2.0, 2.0)); 
        vec3 viewDir = normalize(localCameraPos - localRayPos);
        vec3 halfDir = normalize(lightDir + viewDir);
        
        float diff = max(dot(lightDir, normal), 0.0);
        float spec = pow(max(dot(halfDir, normal), 0.0), u_specular);
        float shdw_mt = clamp(0.3 + 0.25 * diff + spec, 0.0, 1.0);
        
        #ifdef IS_EXPORTING
            float aoBase = 24.0;
        #else
            float aoBase = 10.0;
        #endif
        float ao = clamp(aoBase / float(max(1, steps_taken)), 0.0, 1.0);
        ao = pow(ao, u_aoPower);
        
        float colorVariation = 0.85 + 0.15 * sin(iter * 0.5);
        
        vec3 baseColor = hsv2rgb(u_hsvColor) * colorVariation;
        
        // 深度フォグの計算：ワールド空間の距離に戻して計算する
        float world_total_d = total_d * u_vrScale;
        float depth_val = max(0.0, 1.0 - world_total_d / 20.0);
        
        vec3 finalColor = baseColor * ao * depth_val * shdw_mt;
        if (u_bgAlpha > 0.5) {
            finalColor += baseColor * u_bgColor * (1.0 - ao) * 0.15;
        }
        
        finalColor = pow(finalColor, vec3(0.8));
        finalColor *= u_brightness;
        finalColor = ACESFilm(finalColor);
        return vec4(clamp(finalColor, 0.0, 1.0), 1.0);
    }
    return vec4(u_bgColor * u_bgAlpha, u_bgAlpha);
}

void main() {
    #ifdef IS_EXPORTING
        vec4 col = vec4(0.0);
        col += render(vec2(-0.25, -0.25));
        col += render(vec2( 0.25, -0.25));
        col += render(vec2(-0.25,  0.25));
        col += render(vec2( 0.25,  0.25));
        fragColor = col / 4.0;
    #else
        fragColor = render(vec2(0.0, 0.0));
    #endif
}