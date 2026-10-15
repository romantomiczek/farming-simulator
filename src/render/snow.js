/**
 * Snow cover: in winter every material given addSnow() turns white on its upward-facing surfaces
 * (ground, fields, roofs, roads, tree crowns), patchy rather than a flat sheet. The cover builds up
 * over a few game hours in winter (faster while it snows) and melts in spring. Machines get none.
 */
export const snow = { value: 0 };

const NOISE = `
float snowHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float snowNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(snowHash(i), snowHash(i + vec2(1.0, 0.0)), f.x), mix(snowHash(i + vec2(0.0, 1.0)), snowHash(i + vec2(1.0, 1.0)), f.x), f.y);
}`;

/** Adds snow to material m (keeps any shader changes it already has). */
export function addSnow(m) {
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, renderer) => {
    prev.call(m, sh, renderer);
    sh.uniforms.uSnow = snow;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSnowN;\nvarying vec3 vSnowP;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec4 sp = vec4(transformed, 1.0);
          vec3 sn = objectNormal;
          #ifdef USE_INSTANCING
            sp = instanceMatrix * sp; sn = mat3(instanceMatrix) * sn;
          #endif
          vSnowP = (modelMatrix * sp).xyz;
          vSnowN = normalize(mat3(modelMatrix) * sn);
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSnow;\nvarying vec3 vSnowN;\nvarying vec3 vSnowP;' + NOISE)
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (uSnow > 0.001) {
          float up = smoothstep(0.45, 0.85, normalize(vSnowN).y);
          float patchy = snowNoise(vSnowP.xz * 0.18) * 0.6 + snowNoise(vSnowP.xz * 1.3) * 0.4;
          // full cover leaves about a fifth bare in patches; thin cover only the highest spots
          float cover = smoothstep(0.38, 0.62, patchy + (uSnow - 0.78) * 1.3) * up;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.91, 0.95), cover);
        }`);
  };
  m.customProgramCacheKey = () => (prevKey ? prevKey.call(m) : '') + '|snow';
  m.needsUpdate = true;
  return m;
}

/** Moves the cover toward full in winter and back to none otherwise; gameHours = time passed. */
export function updSnow(gameHours, winter, snowing) {
  const rate = winter ? (snowing ? 0.35 : 0.12) : 0.25; // share of full cover per game hour
  const target = winter ? 1 : 0;
  snow.value += Math.sign(target - snow.value) * Math.min(Math.abs(target - snow.value), rate * gameHours);
}
/** Straight to the season's cover (after loading a game). */
export const snapSnow = winter => { snow.value = winter ? 1 : 0; };
