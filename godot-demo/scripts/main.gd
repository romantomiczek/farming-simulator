extends Node3D
## Zlaté lány in Godot: a small demo with one wheat field, a tractor with a cultivator
## and a combine. Everything is built in code (no imported assets), so the project runs
## straight from the folder without the editor.

const World := preload("res://scripts/world.gd")
const Field := preload("res://scripts/field.gd")
const Vehicle := preload("res://scripts/vehicle.gd")
const FollowCamera := preload("res://scripts/follow_camera.gd")
const Hud := preload("res://scripts/hud.gd")

const SELL_POS := Vector3(14, 0, 43)
const SELL_R := 6.5
const PRICE := 7.2           # Kč per litre of wheat
const LITRES_PER_CELL := 1.4 # one cell is 0.5 × 0.5 m, so about 5.6 l/m²
const PLAY_RADIUS := 125.0
const QUALITY_NAMES := ["nízká", "střední", "vysoká"]

var field: Field
var tractor: Vehicle
var combine: Vehicle
var active: Vehicle
var cam: FollowCamera
var hud: Hud
var sun: DirectionalLight3D
var env: Environment
var obstacles: Array = []
var money := 250000.0
var quality := 1
var auto_input = null # Vector2(throttle, steer) while the automated test drives
var max_dt := 0.05     # longest simulated step per frame


func _ready() -> void:
	env = World.make_environment(self)
	sun = World.make_sun(self)
	World.make_terrain(self)
	obstacles = World.make_farmyard(self, SELL_POS, SELL_R)
	obstacles.append_array(World.make_trees(self))
	field = Field.new()
	add_child(field)
	combine = _spawn("combine", Vector3(-3, 0, 41), PI)
	tractor = _spawn("tractor", Vector3(5, 0, 47), PI)
	cam = FollowCamera.new()
	add_child(cam)
	hud = Hud.new()
	add_child(hud)
	set_active(combine)
	cam.snap()
	_apply_quality(false)
	hud.toast("Sklízej pšenici kombajnem, pak traktorem zkultivuj strniště.", 6.0)
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--autotest="):
			var t: Node = preload("res://scripts/autotest.gd").new()
			t.main = self
			t.out_dir = a.get_slice("=", 1)
			add_child(t)
		elif a.begins_with("--shot="):
			_shot_and_quit(a.get_slice("=", 1))


## Saves one screenshot of the field scene and quits (for tuning the look without the full test).
func _shot_and_quit(path: String) -> void:
	_place_for_shot(combine, Vector3(-16, 0, 6), PI * 0.98)
	_place_for_shot(tractor, Vector3(-26, 0, -1), PI)
	field.work_rect(Transform3D(Basis(), Vector3(-26, 0, 0)), -3.0, 3.0, -20.0, 20.0, Field.RIPE, Field.STUBBLE)
	field.work_rect(Transform3D(Basis(), Vector3(-26, 0, 0)), -2.1, 2.1, 1.0, 20.0, Field.STUBBLE, Field.TILLED)
	field.work_rect(Transform3D(Basis(), Vector3(-16, 0, 0)), -3.0, 3.0, 2.0, 20.0, Field.RIPE, Field.STUBBLE)
	combine.tool_down = true
	combine.tool_lift = 0.0
	combine.tank = 3000.0
	cam.manual_t = 1e9
	cam.yaw = PI * 0.75
	cam.pitch = 0.32
	cam.dist = 17.0
	cam.global_position = cam._goal()
	for i in 20:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(path)
	get_tree().quit()


func _place_for_shot(v: Vehicle, pos: Vector3, heading: float) -> void:
	v.position = pos
	v.heading = heading
	v.rotation.y = heading


func _spawn(kind: String, pos: Vector3, heading: float) -> Vehicle:
	var v: Vehicle = Vehicle.new()
	add_child(v)
	v.build(kind)
	v.position = pos
	v.heading = heading
	v.rotation.y = heading
	return v


func set_active(v: Vehicle) -> void:
	active = v
	cam.target = v


func _unhandled_input(e: InputEvent) -> void:
	if not (e is InputEventKey and e.pressed and not e.echo):
		return
	match e.physical_keycode:
		KEY_TAB:
			set_active(tractor if active == combine else combine)
			hud.toast(active.display_name, 1.5)
		KEY_SPACE:
			active.tool_down = not active.tool_down
		KEY_F:
			sell()
		KEY_R:
			field.reset()
			hud.toast("Pole znovu dozrálo.")
		KEY_Q:
			quality = (quality + 1) % 3
			_apply_quality(true)
		KEY_F11:
			var full := DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN
			DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if full else DisplayServer.WINDOW_MODE_FULLSCREEN)
		KEY_ESCAPE:
			get_tree().quit()


func _read_input() -> Vector2:
	if auto_input != null:
		return auto_input
	var k := func(a: Key, b: Key) -> bool: return Input.is_physical_key_pressed(a) or Input.is_physical_key_pressed(b)
	var throttle := (1.0 if k.call(KEY_W, KEY_UP) else 0.0) - (1.0 if k.call(KEY_S, KEY_DOWN) else 0.0)
	var steer := (1.0 if k.call(KEY_D, KEY_RIGHT) else 0.0) - (1.0 if k.call(KEY_A, KEY_LEFT) else 0.0)
	return Vector2(throttle, steer)


func _process(delta: float) -> void:
	var dt := minf(delta, max_dt)
	var input := _read_input()
	for v: Vehicle in [combine, tractor]:
		var i := input if v == active else Vector2.ZERO
		v.drive(dt, i.x, i.y)
		_collide(v)
	_work()
	cam.follow(dt)
	hud.set_money(money)
	var total := float(Field.NX * Field.NZ)
	hud.set_field(1.0 - field.counts[Field.RIPE] / total, field.counts[Field.TILLED] / total)
	hud.set_vehicle(active)
	hud.set_hint(_hint())
	hud.set_perf()


func _work() -> void:
	if combine.is_working() and combine.tank < combine.tank_cap:
		var n := field.work_rect(combine.global_transform, -3.0, 3.0, 3.6, 4.9, Field.RIPE, Field.STUBBLE)
		if n > 0:
			combine.tank = minf(combine.tank + n * LITRES_PER_CELL, combine.tank_cap)
			combine.work_t = 0.4
			if combine.tank >= combine.tank_cap:
				hud.toast("Zásobník je plný. Odvez obilí na výkup u sil.")
	if tractor.is_working():
		if field.work_rect(tractor.global_transform, -2.1, 2.1, -3.9, -2.5, Field.STUBBLE, Field.TILLED) > 0:
			tractor.work_t = 0.4


func sell() -> void:
	if active != combine:
		hud.toast("Obilí se prodává z kombajnu na výkupu u sil.")
	elif combine.tank < 1.0:
		hud.toast("Zásobník je prázdný.")
	elif not _near_sell():
		hud.toast("Zajeď kombajnem do žlutého kruhu u sil.")
	else:
		var pay := combine.tank * PRICE
		money += pay
		hud.toast("Prodáno %s l pšenice za %s Kč" % [Hud.fmt(combine.tank), Hud.fmt(pay)])
		combine.tank = 0.0


func _near_sell() -> bool:
	return Vector2(combine.position.x - SELL_POS.x, combine.position.z - SELL_POS.z).length() < SELL_R


func _in_field(v: Vehicle) -> bool:
	return absf(v.position.x) < Field.SIZE.x * 0.5 + 2.0 and absf(v.position.z) < Field.SIZE.y * 0.5 + 2.0


func _hint() -> String:
	var v := active
	if v == combine:
		if combine.tank > 0.0 and _near_sell():
			return "F  prodat %s l pšenice za %s Kč" % [Hud.fmt(combine.tank), Hud.fmt(combine.tank * PRICE)]
		if combine.tank >= combine.tank_cap:
			return "Zásobník je plný. Jeď na výkup ke žlutému kruhu u sil."
		if not v.tool_down and _in_field(v):
			return "Mezerník  spustit žací lištu"
	else:
		if not v.tool_down and _in_field(v):
			return "Mezerník  spustit kultivátor"
		if v.tool_down and _in_field(v) and field.counts[Field.STUBBLE] == 0:
			return "Kultivátor zpracuje jen strniště. Nejdřív sklízej kombajnem (Tab)."
	if v.tool_down and not _in_field(v) and v.speed > 0.5:
		return "Na cestě zvedni nářadí mezerníkem, pojedeš rychleji."
	return ""


## Keeps machines out of buildings, trees and each other (two circles per machine).
func _collide(v: Vehicle) -> void:
	var circles := obstacles.duplicate()
	var other := tractor if v == combine else combine
	for k in [-0.5, 0.5]:
		var f: Vector3 = other.forward() * other.length * k
		circles.append([Vector2(other.position.x + f.x, other.position.z + f.z), other.radius])
	for k in [-0.5, 0.5]:
		var f: Vector3 = v.forward() * v.length * k
		var p := Vector2(v.position.x + f.x, v.position.z + f.z)
		for o in circles:
			var d: Vector2 = p - o[0]
			var dist := d.length()
			var min_d: float = v.radius + o[1]
			if dist < min_d and dist > 0.001:
				var push := d / dist * (min_d - dist)
				v.position.x += push.x
				v.position.z += push.y
				p += push
				v.speed *= 0.85
	var c := Vector2(v.position.x, v.position.z - 10.0)
	if c.length() > PLAY_RADIUS:
		c = c.normalized() * PLAY_RADIUS
		v.position.x = c.x
		v.position.z = c.y + 10.0
		v.speed *= 0.5


func _apply_quality(announce: bool) -> void:
	var vp := get_viewport()
	sun.shadow_enabled = quality > 0
	env.glow_enabled = quality > 0
	vp.msaa_3d = [Viewport.MSAA_DISABLED, Viewport.MSAA_2X, Viewport.MSAA_4X][quality]
	RenderingServer.directional_shadow_atlas_set_size([1024, 2048, 4096][quality], true)
	sun.directional_shadow_max_distance = [60.0, 110.0, 160.0][quality]
	if announce:
		hud.toast("Kvalita grafiky: " + QUALITY_NAMES[quality], 2.0)
