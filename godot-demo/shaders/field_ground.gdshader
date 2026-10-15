// Soil under the crop: plain soil under ripe wheat, pale stubble after the combine,
// dark crumbly soil after the cultivator. The state comes from a 0.5 m cell texture
// (0 = ripe, 0.5 = stubble, 1 = cultivated).
shader_type spatial;

uniform sampler2D state_tex : filter_linear, repeat_disable;
uniform vec2 field_size = vec2(64.0, 40.0);

varying vec3 wpos;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec2 p = wpos.xz;
	// wobble the lookup so the 0.5 m cells do not show as squares
	vec2 jitter = (vec2(vnoise(p * 1.4), vnoise(p * 1.4 + 17.0)) - 0.5) * 0.5;
	float s = texture(state_tex, (p + jitter + field_size * 0.5) / field_size).r;
	float n = vnoise(p * 2.5), fine = vnoise(p * 22.0);

	vec3 under = vec3(0.58, 0.45, 0.27) * (0.9 + 0.15 * n);
	vec3 stubble = vec3(0.87, 0.76, 0.49) * (0.88 + 0.18 * n);
	stubble = mix(stubble, stubble * 0.8, smoothstep(0.62, 0.8, fine));           // cut stalks
	vec3 tilled = vec3(0.47, 0.33, 0.22) * (0.8 + 0.3 * vnoise(p * 7.0)); // clods
	tilled = mix(tilled, tilled * 0.82, smoothstep(0.55, 0.75, fine));

	vec3 c = mix(under, stubble, smoothstep(0.2, 0.3, s));
	c = mix(c, tilled, smoothstep(0.7, 0.8, s));
	ALBEDO = c;
	ROUGHNESS = 1.0;
	SPECULAR = 0.1;
}
