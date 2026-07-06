import { Effect, BlendFunction } from 'postprocessing'
import { Uniform } from 'three'

// ─────────────────────────────────────────────────────────────
// SVA-Film-Look (v5 Kino-Ebene): EIN durchgängiger Grading-Pass
// für die ganze Außenwelt — kühle Nacht-Schatten, warme Licht-
// quellen, sanfte S-Kurve, leicht entsättigte Mitten. Im Party-
// raum blendet uWarmth (0→1, folgt der Durchfahrt) auf den
// wärmeren Schwester-Look um. Ein Fullscreen-Pass, kein LUT-
// Textur-Fetch — budget-schonend.
// ─────────────────────────────────────────────────────────────

const frag = /* glsl */ `
  uniform float uWarmth;
  uniform float uStrength;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 c = inputColor.rgb;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));

    // sanfte S-Kurve (Loop 1: 0.42→0.34 — Hero war zu dunkel).
    // Loop 2: NUR auf den [0,1]-Anteil — das Smoothstep-Polynom kippt
    // bei HDR-Werten (>1, vor dem Bloom/ToneMapping) ins Negative und
    // erzeugte Cyan/Magenta-Ringe im Tür-Glow. HDR-Überschuss bleibt
    // linear erhalten.
    vec3 cl = clamp(c, 0.0, 1.0);
    vec3 s = cl * cl * (3.0 - 2.0 * cl) + max(c - 1.0, vec3(0.0));
    c = mix(c, s, 0.34 * uStrength);

    // Split-Toning: Schatten kühl (draußen) bzw. warm (Partyraum),
    // Lichter immer Richtung Flutlicht-Bernstein
    float sh = 1.0 - smoothstep(0.0, 0.45, l);
    float hi = smoothstep(0.55, 1.0, l);
    vec3 shadowTint = mix(vec3(0.93, 0.99, 1.10), vec3(1.07, 0.98, 0.90), uWarmth);
    vec3 hiTint = mix(vec3(1.05, 1.00, 0.93), vec3(1.09, 0.99, 0.88), uWarmth);
    c *= mix(vec3(1.0), shadowTint, sh * 0.48 * uStrength);
    c *= mix(vec3(1.0), hiTint, hi * 0.5 * uStrength);

    // Mitten leicht entsättigen (Film-Gefühl, kein Comic-Grün)
    float mid = smoothstep(0.12, 0.4, l) * (1.0 - smoothstep(0.6, 0.9, l));
    c = mix(c, vec3(l), mid * 0.14 * uStrength);

    outputColor = vec4(c, inputColor.a);
  }
`

export class GradeEffect extends Effect {
  constructor() {
    super('SVAGrade', frag, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ['uWarmth', new Uniform(0)],
        ['uStrength', new Uniform(1)],
      ]),
    })
  }

  set warmth(v: number) {
    this.uniforms.get('uWarmth')!.value = v
  }
}
