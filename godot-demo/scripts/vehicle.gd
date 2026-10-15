extends Node3D
## A drivable machine: arcade steering on the bicycle model (no physics engine),
## plus wheel, tool, reel and grain animation. Machines face +Z; heading 0 = +Z.

const Models := preload("res://scripts/models.gd")

var kind := ""
var display_name := ""
var heading := 0.0
var speed := 0.0        # m/s, negative = reverse
var steer := 0.0        # wheel angle in radians, positive = turning right
var max_road := 11.1
var max_work := 3.3
var max_reverse := 3.0
var accel := 3.0
var wheelbase := 2.6
var steer_max := 0.6
var radius := 1.5       # collision circles: two of them, `length` apart
var length := 3.0
var tool_down := false
var tool_lift := 1.0    # 1 = raised, 0 = working
var tank := 0.0
var tank_cap := 0.0
var work_t := 0.0       # > 0 while the machine is actually working (dust, chaff)
var parts := {}


func build(k: String) -> void:
	kind = k
	if k == "tractor":
		display_name = "Traktor Brázda 140"
		max_road = 11.1
		max_work = 3.6
		accel = 3.2
		wheelbase = 2.45
		steer_max = 0.62
		radius = 1.5
		length = 2.8
		parts = Models.build_tractor(self)
	else:
		display_name = "Kombajn Klas 7"
		max_road = 6.9
		max_work = 2.8
		accel = 1.9
		wheelbase = 3.9
		steer_max = 0.55
		radius = 2.2
		length = 4.2
		tank_cap = 9000.0
		parts = Models.build_combine(self)


func forward() -> Vector3:
	return Vector3(sin(heading), 0.0, cos(heading))


func is_working() -> bool:
	return tool_down and tool_lift < 0.15 and speed > 0.1


## throttle and steer_in are -1..1 (steer_in > 0 = right).
func drive(dt: float, throttle: float, steer_in: float) -> void:
	var before := speed
	var vmax := max_work if tool_down else max_road
	if throttle > 0.0:
		if speed < 0.0:
			speed = minf(speed + accel * 3.0 * dt, 0.0)
		elif speed < vmax:
			speed = minf(speed + accel * throttle * dt, vmax)
	elif throttle < 0.0:
		if speed > 0.0:
			speed = maxf(speed - accel * 3.0 * dt, 0.0)
		elif speed > -max_reverse:
			speed = maxf(speed - accel * dt, -max_reverse)
	else:
		speed = move_toward(speed, 0.0, accel * 0.7 * dt)
	if speed > vmax:
		speed = move_toward(speed, vmax, accel * 2.0 * dt)
	var grip := lerpf(1.0, 0.45, clampf(absf(speed) / 11.0, 0.0, 1.0))
	steer = move_toward(steer, steer_in * steer_max * grip, 1.5 * dt)
	heading -= speed / wheelbase * tan(steer) * dt
	position += forward() * speed * dt
	rotation.y = heading
	_animate(dt, (speed - before) / maxf(dt, 0.001))


func _animate(dt: float, acc: float) -> void:
	for w in parts.wheels:
		w.spin.rotation.x += speed * dt / w.r
	for p in parts.steer:
		p.rotation.y = steer * parts.steer_sign
	tool_lift = move_toward(tool_lift, 0.0 if tool_down else 1.0, dt * 1.4)
	parts.tool.position.y = tool_lift * parts.lift
	if parts.has("reel") and tool_down:
		parts.reel.rotation.x -= dt * 2.4
	# the body pitches a little when speeding up or braking
	var body: Node3D = parts.body
	body.rotation.x = lerpf(body.rotation.x, clampf(-acc * 0.012, -0.035, 0.035), 1.0 - exp(-dt * 4.0))
	if parts.has("grain"):
		var f := clampf(tank / tank_cap, 0.0, 1.0)
		parts.grain.visible = f > 0.01
		parts.grain.scale.y = maxf(f, 0.01)
		parts.grain.position.y = parts.grain_base + 0.5 * f * parts.grain_h
	work_t -= dt
	parts.work_fx.emitting = work_t > 0.0
	parts.smoke.emitting = absf(speed) > 0.3
