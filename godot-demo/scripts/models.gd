extends RefCounted
## Low-poly machines built from primitive meshes, so the demo needs no imported assets.
## Each builder adds the meshes to the vehicle node and returns the parts it animates.
## Machines face +Z.

const DARK := Color("2f2d2c")
const STEEL := Color("707176")
const CREAM := Color("f3e9d3")
const TRACTOR_RED := Color("d6573d")
const COMBINE_GREEN := Color("74a94a")
const TOOL_ORANGE := Color("eaa33c")
const HEADER_YELLOW := Color("ecc55e")
const GRAIN := Color("e8c36c")

static var _mats := {}


static func mat(c: Color, rough := 0.7, metal := 0.0) -> StandardMaterial3D:
	var key := c.to_html() + "/" + str(rough) + "/" + str(metal)
	if not _mats.has(key):
		var m := StandardMaterial3D.new()
		m.albedo_color = c
		m.roughness = rough
		m.metallic = metal
		_mats[key] = m
	return _mats[key]


static func glass() -> StandardMaterial3D:
	if not _mats.has("glass"):
		var m := StandardMaterial3D.new()
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.albedo_color = Color(0.74, 0.88, 0.95, 0.4)
		m.roughness = 0.08
		m.metallic = 0.3
		_mats["glass"] = m
	return _mats["glass"]


static func lamp() -> StandardMaterial3D:
	if not _mats.has("lamp"):
		var m := StandardMaterial3D.new()
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.albedo_color = Color(1.0, 0.96, 0.8)
		_mats["lamp"] = m
	return _mats["lamp"]


static func put(parent: Node3D, mesh: Mesh, pos: Vector3, m: Material, rot := Vector3.ZERO, shadow := true) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = m
	mi.position = pos
	mi.rotation = rot
	if not shadow:
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	return mi


static func box(parent: Node3D, size: Vector3, pos: Vector3, c: Color, rot := Vector3.ZERO, shadow := true) -> MeshInstance3D:
	var b := BoxMesh.new()
	b.size = size
	return put(parent, b, pos, mat(c), rot, shadow)


## Cylinder along "x", "y" or "z"; r_top < 0 means the same radius as the bottom.
static func cyl(parent: Node3D, r: float, h: float, pos: Vector3, c: Color, axis := "y", segs := 14, r_top := -1.0) -> MeshInstance3D:
	var m := CylinderMesh.new()
	m.bottom_radius = r
	m.top_radius = r if r_top < 0.0 else r_top
	m.height = h
	m.radial_segments = segs
	m.rings = 1
	var rot := Vector3.ZERO
	if axis == "x":
		rot.z = PI / 2
	elif axis == "z":
		rot.x = PI / 2
	return put(parent, m, pos, mat(c, 0.6), rot)


## A wheel: pivot (steering) > spin (rolling) > tyre, hexagonal rim and hub.
static func wheel(parent: Node3D, pos: Vector3, r: float, w: float, rim: Color) -> Dictionary:
	var pivot := Node3D.new()
	pivot.position = pos
	parent.add_child(pivot)
	var spin := Node3D.new()
	pivot.add_child(spin)
	cyl(spin, r, w, Vector3.ZERO, DARK, "x", 18)
	cyl(spin, r * 0.6, w + 0.04, Vector3.ZERO, rim, "x", 6)
	cyl(spin, r * 0.2, w + 0.1, Vector3.ZERO, DARK, "x", 6)
	return {"pivot": pivot, "spin": spin, "r": r}


static func soft_dot() -> Texture2D:
	var g := Gradient.new()
	g.colors = PackedColorArray([Color(1, 1, 1, 1), Color(1, 1, 1, 0)])
	var t := GradientTexture2D.new()
	t.gradient = g
	t.fill = GradientTexture2D.FILL_RADIAL
	t.fill_from = Vector2(0.5, 0.5)
	t.fill_to = Vector2(0.5, 0.0)
	t.width = 64
	t.height = 64
	return t


## Dust, chaff or exhaust: soft billboards left behind in the world.
static func particles(c: Color, alpha: float, size: float, amount: int, life: float, extents: Vector3,
		dir: Vector3, vel: float, gravity: float) -> CPUParticles3D:
	var p := CPUParticles3D.new()
	p.amount = amount
	p.lifetime = life
	p.emitting = false
	p.local_coords = false
	var q := QuadMesh.new()
	q.size = Vector2(size, size)
	var m := StandardMaterial3D.new()
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.vertex_color_use_as_albedo = true
	m.albedo_texture = soft_dot()
	q.material = m
	p.mesh = q
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	p.emission_box_extents = extents
	p.direction = dir
	p.spread = 30.0
	p.initial_velocity_min = vel * 0.6
	p.initial_velocity_max = vel
	p.gravity = Vector3(0, gravity, 0)
	p.scale_amount_min = 0.6
	p.scale_amount_max = 1.2
	var grow := Curve.new()
	grow.add_point(Vector2(0, 0.4))
	grow.add_point(Vector2(1, 1.0))
	p.scale_amount_curve = grow
	var ramp := Gradient.new()
	ramp.offsets = PackedFloat32Array([0.0, 0.15, 1.0])
	ramp.colors = PackedColorArray([Color(c, 0.0), Color(c, alpha), Color(c, 0.0)])
	p.color_ramp = ramp
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return p


static func cab(body: Node3D, size: Vector3, pos: Vector3, frame: Color, roof: Color) -> void:
	put(body, _box_mesh(size), pos, glass(), Vector3.ZERO, false)
	for sx in [-1.0, 1.0]:
		for sz in [-1.0, 1.0]:
			box(body, Vector3(0.08, size.y, 0.08), pos + Vector3(sx * size.x * 0.5, 0, sz * size.z * 0.5), frame, Vector3.ZERO, false)
	box(body, Vector3(size.x + 0.2, 0.14, size.z + 0.25), pos + Vector3(0, size.y * 0.5 + 0.07, 0), roof)


static func _box_mesh(size: Vector3) -> BoxMesh:
	var b := BoxMesh.new()
	b.size = size
	return b


static func build_tractor(v: Node3D) -> Dictionary:
	var body := Node3D.new()
	v.add_child(body)
	box(body, Vector3(0.8, 0.45, 3.4), Vector3(0, 0.75, 0.3), DARK)
	box(body, Vector3(1.0, 0.85, 1.9), Vector3(0, 1.3, 1.15), TRACTOR_RED)
	box(body, Vector3(0.9, 0.7, 0.08), Vector3(0, 1.25, 2.12), Color("4a4644"), Vector3.ZERO, false)
	for s in [-1.0, 1.0]:
		put(body, _box_mesh(Vector3(0.2, 0.12, 0.06)), Vector3(0.3 * s, 1.5, 2.16), lamp(), Vector3.ZERO, false)
	box(body, Vector3(0.95, 0.35, 0.35), Vector3(0, 0.78, 2.25), DARK)
	box(body, Vector3(1.5, 0.4, 1.6), Vector3(0, 1.55, -0.6), TRACTOR_RED)
	cab(body, Vector3(1.4, 1.15, 1.45), Vector3(0, 2.33, -0.6), TRACTOR_RED, CREAM)
	for s in [-1.0, 1.0]:
		box(body, Vector3(0.62, 0.1, 1.75), Vector3(1.0 * s, 1.86, -0.85), TRACTOR_RED)
	cyl(body, 0.06, 1.3, Vector3(0.36, 2.3, 1.7), DARK, "y", 8)
	box(body, Vector3(0.6, 0.25, 0.45), Vector3(0, 0.85, -1.85), DARK)

	var wheels := []
	var steer := []
	for s in [-1.0, 1.0]:
		wheels.append(wheel(v, Vector3(1.02 * s, 0.9, -0.85), 0.9, 0.55, CREAM))
		var front := wheel(v, Vector3(0.84 * s, 0.56, 1.6), 0.56, 0.38, CREAM)
		wheels.append(front)
		steer.append(front.pivot)

	# cultivator on the three-point hitch
	var tool := Node3D.new()
	tool.position = Vector3(0, 0, -2.55)
	v.add_child(tool)
	box(tool, Vector3(0.14, 0.5, 0.7), Vector3(0, 0.95, 0.3), TOOL_ORANGE)
	box(tool, Vector3(4.2, 0.14, 0.14), Vector3(0, 0.75, 0.0), TOOL_ORANGE)
	box(tool, Vector3(4.2, 0.14, 0.14), Vector3(0, 0.75, -0.7), TOOL_ORANGE)
	for k in 8:
		var x := -1.85 + k * (3.7 / 7.0)
		box(tool, Vector3(0.07, 0.62, 0.1), Vector3(x, 0.42, 0.0 if k % 2 == 0 else -0.7), STEEL, Vector3(0.25, 0, 0), false)
	for s in [-1.0, 1.0]:
		box(tool, Vector3(0.1, 0.1, 0.8), Vector3(1.9 * s, 0.5, -1.05), TOOL_ORANGE, Vector3(-0.5, 0, 0))
	cyl(tool, 0.22, 4.1, Vector3(0, 0.25, -1.4), DARK, "x", 10)
	var dust := particles(Color("b79b74"), 0.55, 1.6, 70, 2.4, Vector3(2.0, 0.1, 0.3), Vector3(0, 0.6, -1), 1.6, 0.25)
	dust.position = Vector3(0, 0.3, -1.4)
	tool.add_child(dust)

	var smoke := particles(Color("6d6a66"), 0.35, 0.5, 24, 1.4, Vector3(0.05, 0.05, 0.05), Vector3(0, 1, 0), 1.6, 0.4)
	smoke.position = Vector3(0.36, 3.0, 1.7)
	body.add_child(smoke)
	return {"body": body, "wheels": wheels, "steer": steer, "steer_sign": -1.0,
		"tool": tool, "lift": 0.55, "work_fx": dust, "smoke": smoke}


static func build_combine(v: Node3D) -> Dictionary:
	var body := Node3D.new()
	v.add_child(body)
	box(body, Vector3(2.0, 0.7, 5.6), Vector3(0, 0.95, -0.6), DARK)
	box(body, Vector3(2.5, 2.0, 5.2), Vector3(0, 2.15, -0.8), COMBINE_GREEN)
	box(body, Vector3(2.52, 0.18, 5.22), Vector3(0, 2.6, -0.8), CREAM)
	box(body, Vector3(2.2, 0.6, 1.5), Vector3(0, 3.45, -2.6), COMBINE_GREEN)
	box(body, Vector3(1.4, 0.9, 2.0), Vector3(0, 1.35, 2.35), Color("6f9a49"), Vector3(0.32, 0, 0))
	cab(body, Vector3(1.7, 1.3, 1.45), Vector3(0, 3.8, 1.05), COMBINE_GREEN, CREAM)
	for s in [-1.0, 1.0]:
		put(body, _box_mesh(Vector3(0.22, 0.12, 0.06)), Vector3(0.55 * s, 4.4, 1.83), lamp(), Vector3.ZERO, false)
	# open-topped grain tank with the heap inside
	var tank_c := Color("9cc66c")
	box(body, Vector3(2.3, 1.0, 0.08), Vector3(0, 3.65, 0.3), tank_c)
	box(body, Vector3(2.3, 1.0, 0.08), Vector3(0, 3.65, -2.0), tank_c)
	for s in [-1.0, 1.0]:
		box(body, Vector3(0.08, 1.0, 2.3), Vector3(1.15 * s, 3.65, -0.85), tank_c)
	var grain := box(body, Vector3(2.2, 1.0, 2.2), Vector3(0, 3.2, -0.85), GRAIN, Vector3.ZERO, false)
	grain.visible = false
	cyl(body, 0.17, 4.6, Vector3(-1.3, 4.0, -1.5), CREAM, "z", 10)
	box(body, Vector3(0.06, 1.8, 0.4), Vector3(1.3, 2.0, 1.4), DARK, Vector3.ZERO, false)
	cyl(body, 0.08, 1.0, Vector3(0.7, 4.1, -2.9), DARK, "y", 8)

	var wheels := []
	var steer := []
	for s in [-1.0, 1.0]:
		wheels.append(wheel(v, Vector3(1.55 * s, 1.0, 1.0), 1.0, 0.75, CREAM))
		var rear := wheel(v, Vector3(1.2 * s, 0.6, -2.9), 0.6, 0.45, CREAM)
		wheels.append(rear)
		steer.append(rear.pivot)

	# 6 m grain header with a turning reel
	var header := Node3D.new()
	header.position = Vector3(0, 0, 3.9)
	v.add_child(header)
	box(header, Vector3(6.0, 0.9, 0.3), Vector3(0, 0.7, -0.45), HEADER_YELLOW)
	box(header, Vector3(6.0, 0.12, 1.3), Vector3(0, 0.25, 0.15), STEEL)
	box(header, Vector3(6.0, 0.08, 0.12), Vector3(0, 0.22, 0.85), Color("c9c9c9"))
	for s in [-1.0, 1.0]:
		box(header, Vector3(0.12, 0.65, 1.5), Vector3(3.0 * s, 0.5, 0.1), HEADER_YELLOW)
		box(header, Vector3(0.08, 0.08, 1.3), Vector3(2.85 * s, 1.2, -0.15), HEADER_YELLOW, Vector3(0.35, 0, 0))
	cyl(header, 0.25, 5.7, Vector3(0, 0.5, -0.05), Color("c9a84a"), "x", 10)
	var reel := Node3D.new()
	reel.position = Vector3(0, 1.3, 0.35)
	header.add_child(reel)
	cyl(reel, 0.06, 5.8, Vector3.ZERO, DARK, "x", 6)
	for k in 5:
		var a := k * TAU / 5.0
		box(reel, Vector3(5.7, 0.05, 0.1), Vector3(0, sin(a) * 0.55, cos(a) * 0.55), CREAM, Vector3(-a, 0, 0), false)

	var chaff := particles(Color("e6d28f"), 0.8, 0.45, 90, 1.8, Vector3(0.9, 0.2, 0.1), Vector3(0, 0.25, -1), 3.2, -1.4)
	chaff.position = Vector3(0, 1.4, -3.5)
	body.add_child(chaff)
	var smoke := particles(Color("6d6a66"), 0.35, 0.6, 24, 1.5, Vector3(0.05, 0.05, 0.05), Vector3(0, 1, 0), 1.6, 0.4)
	smoke.position = Vector3(0.7, 4.7, -2.9)
	body.add_child(smoke)
	return {"body": body, "wheels": wheels, "steer": steer, "steer_sign": 1.0,
		"tool": header, "lift": 0.9, "reel": reel, "grain": grain, "grain_base": 3.15, "grain_h": 1.0,
		"work_fx": chaff, "smoke": smoke}
