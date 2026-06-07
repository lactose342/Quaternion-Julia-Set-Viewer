out vec2 vUv;

void main() {
    vUv = position.xy;
    
    // 画面全体を覆うスクリーンポリゴンを出力
    gl_Position = vec4(position, 1.0);
}