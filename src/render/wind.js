/**
 * Wind sway for instanced vegetation, done in the vertex shader (no CPU cost per instance).
 * Each instance takes its phase from its world position, so gusts roll across a field as waves.
 * Only the colour pass sways; shadows stay still, which is not noticeable at this amplitude.
 */
export const wind = { time: { value: 0 }, strength: { value: 1 } };

/**
 * amp = sway in metres per metre of height above base (local y where the sway is zero, in the
 * instance's own units; the instance's y scale converts it to metres);
 * spatial = how quickly the phase changes across the world (bigger = shorter waves).
 */
export function addWind(material, { amp, base = 0, spatial = 0.12 }) {
  material.onBeforeCompile = shader => {
    shader.uniforms.windTime = wind.time;
    shader.uniforms.windStrength = wind.strength;
    // the sway is added in world space after the instance transform, so rotated instances
    // (quarter-turned crop cells, randomly turned tree crowns) all lean the same way
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float windTime;\nuniform float windStrength;')
      .replace('#include <project_vertex>', `
      vec4 mvPosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
        float wsy = length(instanceMatrix[1].xyz);
        vec2 wp = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
      #else
        float wsy = 1.0;
        vec2 wp = vec2(0.0);
      #endif
      float wph = dot(wp, vec2(0.8, 0.6)) * ${spatial.toFixed(3)};
      float gust = sin(windTime * 1.3 - wph) * 0.6 + sin(windTime * 2.3 - wph * 1.7 + 1.3) * 0.25 + 0.35;
      float wk = max(position.y - ${base.toFixed(3)}, 0.0) * wsy * ${amp.toFixed(3)} * windStrength * gust;
      mvPosition.xz += vec2(0.8, 0.6) * wk;
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;`);
  };
  material.customProgramCacheKey = () => 'wind' + amp + base + spatial;
  return material;
}

/** Per frame: rain and clouds make it gustier. */
export function updWind(dt, rain, cloud) {
  wind.strength.value += ((0.7 + cloud * 0.4 + rain * 0.9) - wind.strength.value) * Math.min(1, dt * 0.5);
  wind.time.value += dt * (0.8 + wind.strength.value * 0.5);
}
