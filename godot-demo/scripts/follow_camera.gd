extends Camera3D
## Third-person camera that swings in behind the machine.
## Drag with the mouse to look around, wheel to zoom.

var target: Node3D
var yaw := 0.0
var pitch := 0.42
var dist := 22.0
var manual_t := 0.0 # seconds left before the camera swings back behind the machine


func _ready() -> void:
	fov = 55.0
	near = 0.2
	far = 900.0
	current = true


func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventMouseMotion and (e.button_mask & (MOUSE_BUTTON_MASK_LEFT | MOUSE_BUTTON_MASK_RIGHT)) != 0:
		yaw -= e.relative.x * 0.006
		pitch = clampf(pitch + e.relative.y * 0.004, 0.1, 1.35)
		manual_t = 2.5
	elif e is InputEventMouseButton and e.pressed:
		if e.button_index == MOUSE_BUTTON_WHEEL_UP:
			dist = maxf(9.0, dist * 0.9)
		elif e.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			dist = minf(80.0, dist * 1.1)


func _focus() -> Vector3:
	return target.global_position + Vector3(0, 2.0, 0)


func _goal() -> Vector3:
	return _focus() + Vector3(-sin(yaw) * cos(pitch), sin(pitch), -cos(yaw) * cos(pitch)) * dist


func snap() -> void:
	yaw = target.heading
	global_position = _goal()
	look_at(_focus())


func follow(dt: float) -> void:
	manual_t -= dt
	if manual_t <= 0.0 and target.speed > 0.6:
		yaw = lerp_angle(yaw, target.heading, 1.0 - exp(-dt * 1.2))
	global_position = global_position.lerp(_goal(), 1.0 - exp(-dt * 6.0))
	look_at(_focus())
