extends Node3D
## One 64 × 40 m wheat field split into 0.5 m cells (ripe, stubble or cultivated).
## The state lives in a small texture that two shaders read: the soil and the wheat "carpet".

const SIZE := Vector2(64.0, 40.0)
const CELL := 0.5
const NX := 128
const NZ := 80
enum { RIPE, STUBBLE, TILLED }
const ENCODED := [0.0, 0.5, 1.0]

var state := PackedByteArray()
var counts := [NX * NZ, 0, 0]
var _img: Image
var _tex: ImageTexture
var _dirty := false


func _ready() -> void:
	state.resize(NX * NZ)
	state.fill(RIPE)
	_img = Image.create(NX, NZ, false, Image.FORMAT_R8)
	_img.fill(Color(0, 0, 0))
	_tex = ImageTexture.create_from_image(_img)
	_build()


func _process(_dt: float) -> void:
	if _dirty:
		_tex.update(_img)
		_dirty = false


## The whole field is ripe again.
func reset() -> void:
	state.fill(RIPE)
	_img.fill(Color(0, 0, 0))
	counts = [NX * NZ, 0, 0]
	_dirty = true


## Turns cells in state `from` into state `to` when their centre lies inside the rectangle
## x0..x1 (across) × z0..z1 (along), given in the machine's local coordinates.
## Returns how many cells changed.
func work_rect(xf: Transform3D, x0: float, x1: float, z0: float, z1: float, from: int, to: int) -> int:
	var mn := Vector2(INF, INF)
	var mx := Vector2(-INF, -INF)
	for c in [Vector3(x0, 0, z0), Vector3(x1, 0, z0), Vector3(x0, 0, z1), Vector3(x1, 0, z1)]:
		var w: Vector3 = xf * c
		mn = Vector2(minf(mn.x, w.x), minf(mn.y, w.z))
		mx = Vector2(maxf(mx.x, w.x), maxf(mx.y, w.z))
	var i0 := maxi(0, floori((mn.x + SIZE.x * 0.5) / CELL))
	var i1 := mini(NX - 1, floori((mx.x + SIZE.x * 0.5) / CELL))
	var j0 := maxi(0, floori((mn.y + SIZE.y * 0.5) / CELL))
	var j1 := mini(NZ - 1, floori((mx.y + SIZE.y * 0.5) / CELL))
	if i0 > i1 or j0 > j1:
		return 0
	var inv := xf.affine_inverse()
	var n := 0
	for j in range(j0, j1 + 1):
		for i in range(i0, i1 + 1):
			var k := j * NX + i
			if state[k] != from:
				continue
			var l := inv * Vector3((i + 0.5) * CELL - SIZE.x * 0.5, 0.0, (j + 0.5) * CELL - SIZE.y * 0.5)
			if l.x < x0 or l.x > x1 or l.z < z0 or l.z > z1:
				continue
			state[k] = to
			_img.set_pixel(i, j, Color(ENCODED[to], 0, 0))
			n += 1
	if n > 0:
		counts[from] -= n
		counts[to] += n
		_dirty = true
	return n


func _build() -> void:
	# grass verge around the field
	var verge := MeshInstance3D.new()
	var vm := PlaneMesh.new()
	vm.size = SIZE + Vector2(4, 4)
	verge.mesh = vm
	var verge_mat := StandardMaterial3D.new()
	verge_mat.albedo_color = Color("62893f")
	verge_mat.roughness = 1.0
	verge.material_override = verge_mat
	verge.position.y = 0.02
	add_child(verge)

	var ground := MeshInstance3D.new()
	var gm := PlaneMesh.new()
	gm.size = SIZE
	ground.mesh = gm
	var gmat := ShaderMaterial.new()
	gmat.shader = preload("res://shaders/field_ground.gdshader")
	gmat.set_shader_parameter("state_tex", _tex)
	gmat.set_shader_parameter("field_size", SIZE)
	ground.material_override = gmat
	ground.position.y = 0.04
	add_child(ground)

	# one extra cell all round so the crop slopes down at the field edge
	var crop := MeshInstance3D.new()
	var cm := PlaneMesh.new()
	cm.size = SIZE + Vector2(CELL * 2.0, CELL * 2.0)
	cm.subdivide_width = NX + 1
	cm.subdivide_depth = NZ + 1
	crop.mesh = cm
	var wmat := ShaderMaterial.new()
	wmat.shader = preload("res://shaders/wheat.gdshader")
	wmat.set_shader_parameter("state_tex", _tex)
	wmat.set_shader_parameter("field_size", SIZE)
	crop.material_override = wmat
	crop.extra_cull_margin = 2.0
	crop.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	crop.position.y = 0.04
	add_child(crop)
