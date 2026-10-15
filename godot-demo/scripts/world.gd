extends RefCounted
## Landscape around the field: sky and light, low-poly hills, the farmyard and trees.
## Builders that place solid things return collision circles as [Vector2 centre, radius].

static var _noise: FastNoiseLite


static func height(x: float, z: float) -> float:
	if _noise == null:
		_noise = FastNoiseLite.new()
		_noise.seed = 11
		_noise.frequency = 0.01
	var r := Vector2(x, (z - 10.0) * 1.15).length()
	var k := smoothstep(115.0, 180.0, r)
	return k * (6.0 + 28.0 * (_noise.get_noise_2d(x, z) * 0.5 + 0.5))


static func make_environment(root: Node3D) -> Environment:
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color(0.38, 0.6, 0.84)
	sky_mat.sky_horizon_color = Color(0.93, 0.87, 0.77)
	sky_mat.sky_curve = 0.12
	sky_mat.ground_horizon_color = Color(0.86, 0.82, 0.72)
	sky_mat.ground_bottom_color = Color(0.45, 0.52, 0.4)
	sky_mat.sun_angle_max = 25.0
	var sky := Sky.new()
	sky.sky_material = sky_mat
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.35
	env.ambient_light_sky_contribution = 0.85
	env.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	env.tonemap_exposure = 1.0
	env.glow_enabled = false
	env.glow_intensity = 0.3
	env.glow_bloom = 0.0
	env.fog_enabled = true
	env.fog_light_color = Color(0.78, 0.83, 0.86)
	env.fog_density = 0.0009
	env.fog_aerial_perspective = 0.5
	env.fog_sky_affect = 0.25
	env.adjustment_enabled = true
	env.adjustment_saturation = 1.12
	env.adjustment_contrast = 1.04
	var we := WorldEnvironment.new()
	we.environment = env
	root.add_child(we)
	return env


static func make_sun(root: Node3D) -> DirectionalLight3D:
	var sun := DirectionalLight3D.new()
	sun.rotation = Vector3(deg_to_rad(-36.0), deg_to_rad(-145.0), 0.0)
	sun.light_color = Color(1.0, 0.93, 0.8)
	sun.light_energy = 0.85
	sun.shadow_enabled = true
	sun.shadow_blur = 1.5
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	sun.directional_shadow_max_distance = 110.0
	root.add_child(sun)
	return sun


static func _grass(p: Vector3, rng: RandomNumberGenerator) -> Color:
	var n := _noise.get_noise_2d(p.x * 3.0, p.z * 3.0) * 0.5 + 0.5
	var c := Color("6f9a45").lerp(Color("88a852"), n)
	c = c.lerp(Color("5c8648"), clampf(p.y / 30.0, 0.0, 1.0))
	return c * rng.randf_range(0.96, 1.04)


static func _tri(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, col: Color) -> void:
	# Godot's front faces wind clockwise seen from above (cross product pointing down)
	if (b - a).cross(c - a).y > 0.0:
		var t := b
		b = c
		c = t
	for p in [a, b, c]:
		st.set_color(col)
		st.add_vertex(p)


static func make_terrain(root: Node3D) -> void:
	height(0, 0)
	var rng := RandomNumberGenerator.new()
	rng.seed = 3
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.set_smooth_group(-1) # flat-shaded facets for the low-poly look
	var n := 100
	var size := 460.0
	var s := size / n
	var o := -size * 0.5
	for j in n:
		for i in n:
			var x0 := o + i * s
			var z0 := o + j * s
			var a := Vector3(x0, height(x0, z0), z0)
			var b := Vector3(x0 + s, height(x0 + s, z0), z0)
			var c := Vector3(x0, height(x0, z0 + s), z0 + s)
			var d := Vector3(x0 + s, height(x0 + s, z0 + s), z0 + s)
			_tri(st, a, b, c, _grass((a + b + c) / 3.0, rng))
			_tri(st, b, d, c, _grass((b + d + c) / 3.0, rng))
	st.generate_normals()
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	var m := StandardMaterial3D.new()
	m.vertex_color_use_as_albedo = true
	m.roughness = 1.0
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(mi)


static func _plane(root: Node3D, size: Vector2, pos: Vector3, c: Color) -> void:
	var p := PlaneMesh.new()
	p.size = size
	var mi := MeshInstance3D.new()
	mi.mesh = p
	mi.material_override = _mat(c, 1.0)
	mi.position = pos
	root.add_child(mi)


static func _mat(c: Color, rough := 0.85, metal := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	m.metallic = metal
	return m


static func _mesh(root: Node3D, mesh: Mesh, pos: Vector3, c: Color, rot := Vector3.ZERO, rough := 0.85, metal := 0.0) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = _mat(c, rough, metal)
	mi.position = pos
	mi.rotation = rot
	root.add_child(mi)
	return mi


static func _box(root: Node3D, size: Vector3, pos: Vector3, c: Color, rot := Vector3.ZERO) -> MeshInstance3D:
	var b := BoxMesh.new()
	b.size = size
	return _mesh(root, b, pos, c, rot)


## Building with a pitched roof; the ridge runs along X.
static func _house(root: Node3D, pos: Vector3, size: Vector3, wall: Color, roof: Color, rise: float) -> void:
	_box(root, size, pos + Vector3(0, size.y * 0.5, 0), wall)
	var gable := PrismMesh.new()
	gable.size = Vector3(size.z, rise, size.x)
	_mesh(root, gable, pos + Vector3(0, size.y + rise * 0.5, 0), wall, Vector3(0, PI / 2, 0))
	var half := size.z * 0.5
	var ang := atan2(rise, half)
	var slope := Vector2(half, rise).length() + 0.6
	for s in [-1.0, 1.0]:
		_box(root, Vector3(size.x + 1.0, 0.25, slope), pos + Vector3(0, size.y + rise * 0.5 + 0.15, s * half * 0.5),
			roof, Vector3(ang * s, 0, 0))


static func make_farmyard(root: Node3D, sell_pos: Vector3, sell_r: float) -> Array:
	var gravel := Color("a8987a")
	_plane(root, Vector2(72, 32), Vector3(-8, 0.03, 51), gravel)
	_plane(root, Vector2(6, 16), Vector3(0, 0.03, 28), gravel)
	_plane(root, Vector2(6, 120), Vector3(-46, 0.03, 40), gravel)

	# barn with a big door facing the field
	_house(root, Vector3(-15, 0, 53), Vector3(16, 6, 11), Color("b9473a"), Color("59616f"), 4.0)
	_box(root, Vector3(5.0, 4.6, 0.25), Vector3(-15, 2.3, 47.4), Color("8a372b"))
	for x in [-17.6, -12.4]:
		_box(root, Vector3(0.3, 4.9, 0.3), Vector3(x, 2.45, 47.3), Color("f1e7d2"))
	_box(root, Vector3(5.5, 0.3, 0.3), Vector3(-15, 4.75, 47.3), Color("f1e7d2"))

	# farmhouse
	_house(root, Vector3(-33, 0, 44), Vector3(9, 4.5, 7), Color("f2eadb"), Color("c4573f"), 3.0)
	_box(root, Vector3(1.2, 2.2, 0.2), Vector3(-33, 1.1, 40.45), Color("6b4b33"))
	for x in [-36.0, -30.0]:
		_box(root, Vector3(1.2, 1.1, 0.15), Vector3(x, 2.6, 40.45), Color("8fb3c9"))

	# grain silos and the selling point
	for x in [11.0, 17.0]:
		var c := CylinderMesh.new()
		c.top_radius = 2.6
		c.bottom_radius = 2.6
		c.height = 12.0
		c.radial_segments = 20
		_mesh(root, c, Vector3(x, 6.0, 57.0), Color("cdd6da"), Vector3.ZERO, 0.45, 0.35)
		var cone := CylinderMesh.new()
		cone.top_radius = 0.2
		cone.bottom_radius = 2.8
		cone.height = 2.0
		cone.radial_segments = 20
		_mesh(root, cone, Vector3(x, 13.0, 57.0), Color("8c98a3"), Vector3.ZERO, 0.45, 0.35)
	_box(root, Vector3(2.0, 9.0, 2.0), Vector3(14, 4.5, 53.5), Color("9aa6ae"))
	var ring := TorusMesh.new()
	ring.inner_radius = sell_r - 0.35
	ring.outer_radius = sell_r
	ring.rings = 48
	var ring_mi := _mesh(root, ring, sell_pos + Vector3(0, 0.05, 0), Color("f4c84a"))
	ring_mi.scale = Vector3(1, 0.08, 1)
	ring_mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var sign := Label3D.new()
	sign.text = "VÝKUP OBILÍ"
	sign.font_size = 72
	sign.pixel_size = 0.014
	sign.outline_size = 18
	sign.modulate = Color("fff6dc")
	sign.outline_modulate = Color("3a3226")
	sign.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	sign.position = sell_pos + Vector3(0, 5.5, 3.0)
	root.add_child(sign)

	# round straw bales by the barn
	var bale := CylinderMesh.new()
	bale.top_radius = 0.8
	bale.bottom_radius = 0.8
	bale.height = 1.2
	bale.radial_segments = 16
	for p in [Vector3(-3, 0.8, 60), Vector3(-1.6, 0.8, 60), Vector3(-0.2, 0.8, 60), Vector3(-2.3, 2.15, 60)]:
		_mesh(root, bale, p, Color("dcc272"), Vector3(0, 0, PI / 2))

	# wooden fence along the yard
	var post := BoxMesh.new()
	post.size = Vector3(0.15, 1.1, 0.15)
	for k in 14:
		_mesh(root, post, Vector3(-42 + k * 3.0, 0.55, 35.5), Color("8a6a4a"))
	_box(root, Vector3(39.2, 0.12, 0.08), Vector3(-22.5, 0.85, 35.5), Color("9a7a58"))
	_box(root, Vector3(39.2, 0.12, 0.08), Vector3(-22.5, 0.45, 35.5), Color("9a7a58"))

	return [
		[Vector2(-19.5, 53), 5.6], [Vector2(-15, 53), 5.6], [Vector2(-10.5, 53), 5.6],
		[Vector2(-33, 44), 5.5], [Vector2(11, 57), 2.9], [Vector2(17, 57), 2.9], [Vector2(14, 53.5), 1.5],
		[Vector2(-1.6, 60), 2.2],
	]


static func _blocked(p: Vector2) -> bool:
	if absf(p.x) < 40.0 and absf(p.y) < 28.0:
		return true # field and its headlands
	if p.x > -50.0 and p.x < 34.0 and p.y > 26.0 and p.y < 72.0:
		return true # farmyard
	if absf(p.x + 46.0) < 6.0:
		return true # road
	return p.length() < 36.0


static func _multi(root: Node3D, mesh: Mesh, xforms: Array, colors: Array) -> void:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = mesh
	mm.instance_count = xforms.size()
	for i in xforms.size():
		mm.set_instance_transform(i, xforms[i])
		mm.set_instance_color(i, colors[i])
	var m := StandardMaterial3D.new()
	m.vertex_color_use_as_albedo = true
	m.roughness = 0.9
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	mi.material_override = m
	root.add_child(mi)


static func make_trees(root: Node3D) -> Array:
	height(0, 0) # makes sure the noise exists
	var rng := RandomNumberGenerator.new()
	rng.seed = 5
	var leaf := [Color("6fa34b"), Color("84b250"), Color("5e9446"), Color("9dbe57"), Color("78a84e")]
	var autumn := [Color("d8a548"), Color("cf7f3e")]
	var pine := [Color("4f7f4a"), Color("5b8a4f"), Color("466f45")]
	var trunk_x := []
	var trunk_c := []
	var crown_x := []
	var crown_c := []
	var cone_x := []
	var cone_c := []
	var obstacles := []
	var spots := []
	var tries := 0
	while spots.size() < 260 and tries < 20000:
		tries += 1
		var p := Vector2(rng.randf_range(-210, 210), rng.randf_range(-200, 220))
		if _blocked(p):
			continue
		# woods in clumps, the odd lone tree in the meadows
		if _noise.get_noise_2d(p.x * 1.7, p.y * 1.7) < 0.05 and rng.randf() > 0.12:
			continue
		spots.append([p, rng.randf_range(0.8, 1.35), rng.randf() < 0.3])
	for x in range(-36, 37, 3):
		spots.append([Vector2(x + rng.randf_range(-0.8, 0.8), -27.5 + rng.randf_range(-0.6, 0.6)), rng.randf_range(0.45, 0.65), false])
	for s in spots:
		var p: Vector2 = s[0]
		var k: float = s[1]
		var y := height(p.x, p.y) - 0.1
		var base := Vector3(p.x, y, p.y)
		var yaw := Basis(Vector3.UP, rng.randf() * TAU)
		trunk_x.append(Transform3D(yaw.scaled(Vector3(k, k, k)), base + Vector3(0, 1.2 * k, 0)))
		trunk_c.append(Color("7a5a40"))
		if s[2]:
			cone_x.append(Transform3D(yaw.scaled(Vector3(k, k, k)), base + Vector3(0, 4.2 * k, 0)))
			cone_c.append(pine[rng.randi() % pine.size()])
		else:
			var col: Color = autumn[rng.randi() % autumn.size()] if rng.randf() < 0.1 else leaf[rng.randi() % leaf.size()]
			crown_x.append(Transform3D(Basis().scaled(Vector3(1.7, 1.5, 1.7) * k), base + Vector3(0, 3.5 * k, 0)))
			crown_c.append(col)
			crown_x.append(Transform3D(Basis().scaled(Vector3(1.15, 1.05, 1.15) * k), base + Vector3(0.75, 2.8, 0.5) * k))
			crown_c.append(col.darkened(0.06))
		if p.length() < 150.0:
			obstacles.append([p, 0.9 * k])
	var trunk := CylinderMesh.new()
	trunk.top_radius = 0.17
	trunk.bottom_radius = 0.27
	trunk.height = 2.4
	trunk.radial_segments = 6
	trunk.rings = 1
	var crown := SphereMesh.new()
	crown.radius = 1.0
	crown.height = 2.0
	crown.radial_segments = 9
	crown.rings = 5
	var cone := CylinderMesh.new()
	cone.top_radius = 0.0
	cone.bottom_radius = 1.7
	cone.height = 5.6
	cone.radial_segments = 7
	cone.rings = 1
	_multi(root, trunk, trunk_x, trunk_c)
	_multi(root, crown, crown_x, crown_c)
	_multi(root, cone, cone_x, cone_c)
	return obstacles
