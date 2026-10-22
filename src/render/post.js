import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { GRADE_GLSL } from './core.js';
import { setSkyAlpha } from './sky.js';

/**
 * Post-processing for the stronger presets, written for this game so it stays cheap:
 * - the scene renders into an HDR target with a depth texture (multisampled when antialiasing is on);
 * - ambient occlusion at half size straight from that depth (no extra pass over the scene): darker
 *   corners of buildings, under and between machines, at the foot of walls; blurred, faded with distance;
 * - soft bloom of the brightest things only (the sun, lamps and beacons at night) at 1/4 and 1/8 size;
 * - rays of the low sun at dawn and dusk (sky around the sun smeared towards it, 1/4 size);
 * - final pass: occlusion, a light blue haze over the middle distance, bloom and rays, then the same
 *   tone mapping (ACES) and colour grade as without post-processing. The sky dome writes alpha 0, so
 *   it keeps its own colours (it is not tone mapped).
 * Edges: either the scene target is multisampled (best, but a multisampled HDR target is costly on
 * weaker cards) or the picture gets FXAA at the end (cheap).
 */
const VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const quad = new FullScreenQuad();
const pass = (renderer, mat, target) => { quad.material = mat; renderer.setRenderTarget(target); quad.render(renderer); };

const aoMat = new THREE.ShaderMaterial({
  uniforms: { tDepth: { value: null }, uProjInv: { value: new THREE.Matrix4() }, uProjY: { value: 1 }, uAspect: { value: 1 }, uRadius: { value: 1.3 }, uStrength: { value: 2.4 } },
  defines: { SAMPLES: 10 },
  vertexShader: VS,
  fragmentShader: /* glsl */`
    uniform sampler2D tDepth; uniform mat4 uProjInv; uniform float uProjY, uAspect, uRadius, uStrength; varying vec2 vUv;
    vec3 viewPos(vec2 uv) { float d = textureLod(tDepth, uv, 0.0).r; vec4 p = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return p.xyz / p.w; }
    void main() {
      float d = textureLod(tDepth, vUv, 0.0).r;
      if (d >= 0.99999) { gl_FragColor = vec4(1.0); return; }
      vec3 P = viewPos(vUv);
      vec3 N = normalize(cross(dFdx(P), dFdy(P)));
      float noise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      float rad = min(uRadius * uProjY / -P.z * 0.5, 0.08);
      float ao = 0.0;
      for (int i = 0; i < SAMPLES; i++) {
        float t = (float(i) + noise) / float(SAMPLES), a = float(i) * 2.399963 + noise * 6.2832;
        vec3 v = viewPos(vUv + vec2(cos(a) / uAspect, sin(a)) * rad * (0.2 + 0.8 * t)) - P;
        float dist = length(v);
        ao += max(dot(N, v) / (dist + 0.001) - 0.12, 0.0) * (1.0 - smoothstep(uRadius * 0.7, uRadius * 1.6, dist));
      }
      ao = 1.0 - uStrength * ao / float(SAMPLES);
      gl_FragColor = vec4(vec3(mix(clamp(ao, 0.0, 1.0), 1.0, smoothstep(55.0, 110.0, -P.z))), 1.0);
    }`,
});
/** 4 × 4 blur that does not smear across depth edges. */
const aoBlurMat = new THREE.ShaderMaterial({
  uniforms: { tAO: { value: null }, tDepth: { value: null }, uTexel: { value: new THREE.Vector2() } },
  vertexShader: VS,
  fragmentShader: /* glsl */`
    uniform sampler2D tAO, tDepth; uniform vec2 uTexel; varying vec2 vUv;
    void main() {
      float d0 = textureLod(tDepth, vUv, 0.0).r, s = 0.0, w = 0.0;
      for (int y = -2; y < 2; y++) for (int x = -2; x < 2; x++) {
        vec2 uv = vUv + (vec2(float(x), float(y)) + 0.5) * uTexel;
        float k = 1.0 / (1.0 + abs(textureLod(tDepth, uv, 0.0).r - d0) * 4000.0);
        s += textureLod(tAO, uv, 0.0).r * k; w += k;
      }
      gl_FragColor = vec4(vec3(s / w), 1.0);
    }`,
});
const brightMat = new THREE.ShaderMaterial({
  uniforms: { tColor: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1.7 } },
  vertexShader: VS,
  fragmentShader: /* glsl */`
    uniform sampler2D tColor; uniform vec2 uTexel; uniform float uThreshold; varying vec2 vUv;
    void main() {
      vec3 c = vec3(0.0);
      for (int i = 0; i < 4; i++) c += textureLod(tColor, vUv + (vec2(float(i & 1), float(i / 2)) - 0.5) * uTexel * 2.0, 0.0).rgb;
      c *= 0.25;
      float l = max(c.r, max(c.g, c.b));
      gl_FragColor = vec4(c * smoothstep(uThreshold, uThreshold * 2.0, l), 1.0);
    }`,
});
const blurMat = new THREE.ShaderMaterial({
  uniforms: { tIn: { value: null }, uDir: { value: new THREE.Vector2() } },
  vertexShader: VS,
  fragmentShader: /* glsl */`
    uniform sampler2D tIn; uniform vec2 uDir; varying vec2 vUv;
    void main() {
      vec3 c = textureLod(tIn, vUv, 0.0).rgb * 0.227;
      c += (textureLod(tIn, vUv + uDir * 1.385, 0.0).rgb + textureLod(tIn, vUv - uDir * 1.385, 0.0).rgb) * 0.316;
      c += (textureLod(tIn, vUv + uDir * 3.231, 0.0).rgb + textureLod(tIn, vUv - uDir * 3.231, 0.0).rgb) * 0.07;
      gl_FragColor = vec4(c, 1.0);
    }`,
});
const raysMaskMat = new THREE.ShaderMaterial({
  uniforms: { tColor: { value: null }, uSun: { value: new THREE.Vector2() }, uAspect: { value: 1 } },
  vertexShader: VS,
  fragmentShader: /* glsl */`
    uniform sampler2D tColor; uniform vec2 uSun; uniform float uAspect; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tColor, vUv);
      vec2 d = (vUv - uSun) * vec2(uAspect, 1.0);
      gl_FragColor = vec4(vec3((1.0 - clamp(c.a, 0.0, 1.0)) * pow(max(0.0, 1.0 - length(d) / 0.55), 2.0)), 1.0);
    }`,
});
const raysMat = new THREE.ShaderMaterial({
  uniforms: { tIn: { value: null }, uSun: { value: new THREE.Vector2() } },
  vertexShader: VS,
  fragmentShader: /* glsl */`
    uniform sampler2D tIn; uniform vec2 uSun; varying vec2 vUv;
    void main() {
      vec2 step = (uSun - vUv) / 40.0 * 0.9, uv = vUv;
      float s = 0.0, w = 1.0;
      for (int i = 0; i < 40; i++) { s += textureLod(tIn, uv, 0.0).r * w; w *= 0.955; uv += step; }
      gl_FragColor = vec4(vec3(s / 12.0), 1.0);
    }`,
});
/** ACES filmic tone mapping as in three.js (the final pass does it itself: three only tone maps on screen). */
const ACES = /* glsl */`
  vec3 RRTAndODTFit(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
  vec3 aces(vec3 c) {
    const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
    const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
    c *= uExposure / 0.6;
    return clamp(O * RRTAndODTFit(I * c), 0.0, 1.0);
  }`;
const finalMat = new THREE.ShaderMaterial({
  toneMapped: false,
  uniforms: { uExposure: { value: 1 },
    tColor: { value: null }, tDepth: { value: null }, tAO: { value: null }, tB1: { value: null }, tB2: { value: null }, tRays: { value: null },
    uProjInv: { value: new THREE.Matrix4() }, uAO: { value: 0 }, uBloom: { value: 0 }, uRays: { value: 0 }, uRaysCol: { value: new THREE.Color() },
    uHaze: { value: 0 }, uHazeCol: { value: new THREE.Color() },
  },
  vertexShader: VS,
  fragmentShader: /* glsl */`
    uniform sampler2D tColor, tDepth, tAO, tB1, tB2, tRays; uniform mat4 uProjInv;
    uniform float uAO, uBloom, uRays, uHaze, uExposure; uniform vec3 uRaysCol, uHazeCol; varying vec2 vUv;
    ${ACES}
    void main() {
      vec4 c = texture2D(tColor, vUv);
      vec3 col = c.rgb;
      float solid = clamp(c.a, 0.0, 1.0); // additive sprites can push alpha past 1
      if (uAO > 0.0) col *= mix(1.0, textureLod(tAO, vUv, 0.0).r, solid);
      if (uHaze > 0.0) {
        float d = textureLod(tDepth, vUv, 0.0).r;
        vec4 p = uProjInv * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
        float dist = length(p.xyz / p.w);
        float k = (1.0 - exp(-max(dist - 40.0, 0.0) * 0.0035)) * uHaze * solid;
        float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(mix(col, vec3(l), k * 0.35), uHazeCol, k * 0.45);
      }
      if (uBloom > 0.0) col += (textureLod(tB1, vUv, 0.0).rgb * 0.6 + textureLod(tB2, vUv, 0.0).rgb) * uBloom;
      if (uRays > 0.0) col += textureLod(tRays, vUv, 0.0).r * uRaysCol * uRays;
      gl_FragColor = vec4(aces(col), 1.0);
      ${GRADE_GLSL}
      gl_FragColor.rgb = mix(col, gl_FragColor.rgb, solid);
      #ifdef TO_LDR
        gl_FragColor = sRGBTransferOETF(gl_FragColor); // into the target for FXAA, already as on screen
      #else
        #include <colorspace_fragment>
      #endif
    }`,
});
const finalLdr = finalMat.clone();
finalLdr.defines = { TO_LDR: '' };
const fxaaMat = new THREE.ShaderMaterial({ ...FXAAShader, uniforms: THREE.UniformsUtils.clone(FXAAShader.uniforms), toneMapped: false });

const rt = (w, h, o = {}) => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false, ...o });
let size = { w: 0, h: 0, samples: -1 }, T = null;
function ensure(renderer, samples) {
  const v = renderer.getDrawingBufferSize(new THREE.Vector2()), w = Math.max(1, v.x | 0), h = Math.max(1, v.y | 0);
  if (T && w === size.w && h === size.h && samples === size.samples) return;
  if (T) for (const t of Object.values(T)) t.dispose();
  size = { w, h, samples };
  const main = rt(w, h, { depthBuffer: true, samples, depthTexture: new THREE.DepthTexture(w, h) });
  const h2 = [Math.ceil(w / 2), Math.ceil(h / 2)], h4 = [Math.ceil(w / 4), Math.ceil(h / 4)], h8 = [Math.ceil(w / 8), Math.ceil(h / 8)];
  T = {
    main, ao: rt(...h2, { type: THREE.UnsignedByteType }), ao2: rt(...h2, { type: THREE.UnsignedByteType }),
    b1: rt(...h4), b1b: rt(...h4), b2: rt(...h8), b2b: rt(...h8), r1: rt(...h4, { type: THREE.UnsignedByteType }), r2: rt(...h4),
    ldr: rt(w, h, { type: THREE.UnsignedByteType }),
  };
}

const _v = new THREE.Vector3(), _d = new THREE.Vector3();
/**
 * Renders scene through camera with the effects in o = { ao, bloom, rays, haze (0..1), sunDir, rayCol,
 * hazeCol, samples, fxaa }. rays = strength of the sun rays (0 = off); samples = multisampling of the
 * scene (0 = none), fxaa = smooth the edges at the end instead.
 */
export function renderPost(renderer, scene, camera, o) {
  ensure(renderer, o.samples);
  const { main } = T, W = size.w, H = size.h;
  renderer.setRenderTarget(main);
  setSkyAlpha(0);
  renderer.render(scene, camera);
  setSkyAlpha(1);
  const depth = main.depthTexture;
  if (o.ao) {
    aoMat.uniforms.tDepth.value = depth; aoMat.uniforms.uProjInv.value.copy(camera.projectionMatrixInverse);
    aoMat.uniforms.uProjY.value = camera.projectionMatrix.elements[5]; aoMat.uniforms.uAspect.value = W / H;
    pass(renderer, aoMat, T.ao);
    aoBlurMat.uniforms.tAO.value = T.ao.texture; aoBlurMat.uniforms.tDepth.value = depth; aoBlurMat.uniforms.uTexel.value.set(1 / T.ao.width, 1 / T.ao.height);
    pass(renderer, aoBlurMat, T.ao2);
  }
  if (o.bloom) {
    brightMat.uniforms.tColor.value = main.texture; brightMat.uniforms.uTexel.value.set(1 / W, 1 / H);
    pass(renderer, brightMat, T.b1);
    const blur = (src, tmp, sx, sy) => {
      blurMat.uniforms.tIn.value = src.texture; blurMat.uniforms.uDir.value.set(sx / src.width, 0); pass(renderer, blurMat, tmp);
      blurMat.uniforms.tIn.value = tmp.texture; blurMat.uniforms.uDir.value.set(0, sy / src.height); pass(renderer, blurMat, src);
    };
    blur(T.b1, T.b1b, 1, 1);
    blurMat.uniforms.tIn.value = T.b1.texture; blurMat.uniforms.uDir.value.set(0.5 / T.b2.width, 0.5 / T.b2.height); pass(renderer, blurMat, T.b2);
    blur(T.b2, T.b2b, 1.5, 1.5);
  }
  let rays = 0;
  if (o.rays > 0.01) {
    // the sun on screen: rays only when it is in front of the camera and not far off the edges
    camera.getWorldDirection(_d);
    _v.copy(camera.position).addScaledVector(o.sunDir, 300).project(camera);
    const sx = (_v.x + 1) / 2, sy = (_v.y + 1) / 2, front = _d.dot(o.sunDir);
    if (front > 0.1 && sx > -0.4 && sx < 1.4 && sy > -0.4 && sy < 1.4) {
      rays = o.rays * Math.min(1, (front - 0.1) * 3);
      raysMaskMat.uniforms.tColor.value = main.texture; raysMaskMat.uniforms.uSun.value.set(sx, sy); raysMaskMat.uniforms.uAspect.value = W / H;
      pass(renderer, raysMaskMat, T.r1);
      raysMat.uniforms.tIn.value = T.r1.texture; raysMat.uniforms.uSun.value.set(sx, sy);
      pass(renderer, raysMat, T.r2);
    }
  }
  const fin = o.fxaa ? finalLdr : finalMat, f = fin.uniforms;
  f.uExposure.value = renderer.toneMappingExposure;
  f.tColor.value = main.texture; f.tDepth.value = depth; f.tAO.value = T.ao2.texture; f.tB1.value = T.b1.texture; f.tB2.value = T.b2.texture; f.tRays.value = T.r2.texture;
  f.uProjInv.value.copy(camera.projectionMatrixInverse);
  f.uAO.value = o.ao ? 1 : 0; f.uBloom.value = o.bloom ? 0.35 : 0; f.uRays.value = rays; f.uRaysCol.value.copy(o.rayCol);
  f.uHaze.value = o.haze || 0; f.uHazeCol.value.copy(o.hazeCol);
  if (!o.fxaa) { pass(renderer, finalMat, null); return; }
  pass(renderer, finalLdr, T.ldr);
  fxaaMat.uniforms.tDiffuse.value = T.ldr.texture; fxaaMat.uniforms.resolution.value.set(1 / W, 1 / H);
  pass(renderer, fxaaMat, null);
}
