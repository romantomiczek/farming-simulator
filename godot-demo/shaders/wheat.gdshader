// Ripe wheat as a soft stylised "carpet": a grid whose vertices stand at crop height where
// the field is ripe and drop under the ground where it has been cut. Wind gusts roll across
// the top as moving bands of light; cut edges show vertical stalks.
shader_type spatial;

uniform sampler2D state_tex : filter_linear, repeat_disable;
uniform vec2 field_size = vec2(64.0, 40.0);
uniform float crop_height = 0.95;
uniform vec3 col_top : source_color = vec3(0.93, 0.72, 0.33);
uniform vec3 col_low : source_color = vec3(0.66, 0.46, 0.2);

varying vec3 wpos;
varying float hfrac;
varying float upn;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

float height_at(vec2 p) {
	vec2 half_size = field_size * 0.5;
	if (abs(p.x) > half_size.x + 0.01 || abs(p.y) > half_size.y + 0.01) return -0.1;
	float s = textureLod(state_tex, (p + half_size) / field_size, 0.0).r;
	float ripe = 1.0 - smoothstep(0.15, 0.35, s);
	float bumps = (vnoise(p * 0.35) - 0.5) * 0.16 + (vnoise(p * 1.9) - 0.5) * 0.06;
	return mix(-0.1, crop_height + bumps, ripe);
}

float gust(vec2 p) {
	return sin(dot(p, vec2(0.11, 0.07)) - TIME * 1.3) * 0.5 + 0.5;
}

void vertex() {
	vec2 p = VERTEX.xz;
	float h = height_at(p);
	float e = 0.5;
	float hx = height_at(p + vec2(e, 0.0)) - height_at(p - vec2(e, 0.0));
	float hz = height_at(p + vec2(0.0, e)) - height_at(p - vec2(0.0, e));
	NORMAL = normalize(vec3(-hx, 2.0 * e, -hz));
	upn = NORMAL.y;
	VERTEX.y = h;
	hfrac = clamp(h / crop_height, 0.0, 1.0);
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	// the tops lean with the wind
	float g = gust(wpos.xz);
	VERTEX.x += g * 0.14 * hfrac;
	VERTEX.z += g * 0.06 * hfrac;
}

void fragment() {
	float n1 = vnoise(wpos.xz * 2.2);
	float ears = hash(floor(wpos.xz * 16.0));
	vec3 c = mix(col_low, col_top, 0.5 + 0.5 * hfrac);
	c *= 0.84 + 0.22 * n1 + 0.14 * (ears - 0.5);
	// rolling bands of light from the wind
	float top = smoothstep(0.6, 0.9, upn);
	c = mix(c * 0.92, c * 1.16 + vec3(0.04, 0.03, 0.0), gust(wpos.xz) * top);
	// cut edges: vertical stalks, darker toward the ground
	float stalks = step(0.45, fract((wpos.x + wpos.z) * 7.0 + ears * 0.6));
	vec3 wall = mix(col_low * 0.72, col_low * 1.05, stalks) * (0.55 + 0.55 * hfrac);
	c = mix(c, wall, 1.0 - top);
	ALBEDO = c;
	ROUGHNESS = 0.95;
	SPECULAR = 0.15;
}
