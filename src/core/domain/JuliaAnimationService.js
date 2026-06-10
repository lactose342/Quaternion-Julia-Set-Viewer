/**
 * 4次元ジュリア集合のアニメーション軌道および位相計算を担うドメインサービス
 * （状態を持たず、入力に対して計算結果のみを返す純粋関数群）
 */
export class JuliaAnimationService {
  
  /**
   * 現在のパラメータと位相から、アニメーション適用後の変数Cを計算する
   */
  static calculateAnimatedC(params, phases, outVec, ampLimit) {
    const frac = params.fractal;
    const anim = params.animation;
    const mAmp = anim.amp;
    const getAmp = (base, ratio) => Math.min(mAmp * ratio, ampLimit - Math.abs(base));

    outVec.cx = frac.cx + (Math.sin(phases.x + anim.px) - Math.sin(anim.px)) * getAmp(frac.cx, anim.ax);
    outVec.cy = frac.cy + (Math.sin(phases.y + anim.py) - Math.sin(anim.py)) * getAmp(frac.cy, anim.ay);
    outVec.cz = frac.cz + (Math.sin(phases.z + anim.pz) - Math.sin(anim.pz)) * getAmp(frac.cz, anim.az);
    outVec.cw = frac.cw + (Math.sin(phases.w + anim.pw) - Math.sin(anim.pw)) * getAmp(frac.cw, anim.aw);
  }

  /**
   * 経過時間(delta)に基づいて、新しい位相を計算する
   */
  static calculateNextPhases(currentPhases, animParams, delta) {
    return {
      x: currentPhases.x + delta * (animParams.speed * animParams.sx),
      y: currentPhases.y + delta * (animParams.speed * animParams.sy),
      z: currentPhases.z + delta * (animParams.speed * animParams.sz),
      w: currentPhases.w + delta * (animParams.speed * animParams.sw),
    };
  }
}