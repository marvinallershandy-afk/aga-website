import { Effect, BlendFunction } from 'postprocessing'
import { Uniform } from 'three'

// ─────────────────────────────────────────────────────────────
// v16-K „Diorama": günstiger Tilt-Shift-Eindruck für die Karten-Totale.
// Die Bildmitte (Platz) bleibt scharf, oben/unten (und leicht an den
// Seiten) wird es weich — der Miniatur-Effekt, der aus dem 3D-Modell
// eine Spielkarte macht. 8 Taps, nur in den Randzonen; in der scharfen
// Mitte und bei uStrength 0 (Orte, Rundgang) ein früher Ausstieg ohne
// Zusatz-Lesezugriffe. KEINE eigene Pass: als ERSTER Effekt der
// gemergten EffectPass liest er inputBuffer = Szenenfarbe (vor Grading/
// Tonemapping), die folgenden Effekte arbeiten auf dem weichen Bild.
// ─────────────────────────────────────────────────────────────

const frag = /* glsl */ `
  uniform float uStrength;
  uniform float uCenter;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    float dy = abs(uv.y - uCenter);
    float dx = abs(uv.x - 0.5);
    float edge = smoothstep(0.16, 0.5, dy) + 0.45 * smoothstep(0.34, 0.5, dx);
    float r = min(1.0, edge) * uStrength;
    if (r < 0.03) {
      outputColor = inputColor;
      return;
    }
    // Radius relativ zur Bildhöhe (DPR-unabhängig), Seitenverhältnis-korrekt
    vec2 o = r * vec2(0.0062 * resolution.y / resolution.x, 0.0062);
    vec3 acc = inputColor.rgb * 2.0;
    acc += texture2D(inputBuffer, uv + o * vec2( 1.0,  0.0)).rgb;
    acc += texture2D(inputBuffer, uv + o * vec2(-1.0,  0.0)).rgb;
    acc += texture2D(inputBuffer, uv + o * vec2( 0.0,  1.0)).rgb;
    acc += texture2D(inputBuffer, uv + o * vec2( 0.0, -1.0)).rgb;
    acc += texture2D(inputBuffer, uv + o * vec2( 0.5,  0.5)).rgb;
    acc += texture2D(inputBuffer, uv + o * vec2(-0.5,  0.5)).rgb;
    acc += texture2D(inputBuffer, uv + o * vec2( 0.5, -0.5)).rgb;
    acc += texture2D(inputBuffer, uv + o * vec2(-0.5, -0.5)).rgb;
    vec3 c = acc / 10.0;
    // Miniatur-Look: Ränder minimal satter/dunkler (Spielkarten-Tiefe)
    c *= 1.0 - 0.1 * r;
    outputColor = vec4(c, inputColor.a);
  }
`

export class TiltEdgeEffect extends Effect {
  constructor() {
    super('SVATiltEdge', frag, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ['uStrength', new Uniform(0)],
        ['uCenter', new Uniform(0.5)],
      ]),
    })
  }

  set strength(v: number) {
    this.uniforms.get('uStrength')!.value = v
  }
}
