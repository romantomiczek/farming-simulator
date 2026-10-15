extends Node
## Automated check: drives both machines across the field, checks harvesting, selling and
## cultivating, and saves screenshots. Runs only with `-- --autotest=<folder>`.

var main
var out_dir := ""
var fails := 0


func _ready() -> void:
	_run()


func _check(name: String, ok: bool, info := "") -> void:
	print(("OK   " if ok else "FAIL ") + name + ("  — " + info if info != "" else ""))
	if not ok:
		fails += 1


func _frames(n: int) -> void:
	for i in n:
		await get_tree().process_frame


func _shot(name: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out_dir.path_join(name + ".png"))


func _until(cond: Callable, max_frames := 3000) -> void:
	var n := 0
	while not cond.call() and n < max_frames:
		await get_tree().process_frame
		n += 1


func _place(v, pos: Vector3, heading: float) -> void:
	v.position = pos
	v.heading = heading
	v.rotation.y = heading
	v.speed = 0.0


func _run() -> void:
	main.max_dt = 0.2 # software rendering is slow; bigger steps still leave no gaps
	await _frames(15)
	await _shot("01_start")

	var c = main.combine
	var t = main.tractor
	main.set_active(c)
	_place(c, Vector3(-29, 0, 25), PI)
	c.tool_down = true
	main.cam.snap()
	main.auto_input = Vector2(1, 0)
	await _until(func(): return c.position.z < 4.0)
	await _shot("02_harvest")
	await _until(func(): return c.position.z < -25.0)
	main.auto_input = Vector2.ZERO
	var cut: int = main.field.counts[1]
	_check("kombajn sklízí", cut > 0 and c.tank > 0.0, "%d buněk, %d l v zásobníku" % [cut, c.tank])
	_check("pruh má šířku lišty", cut > 900 and cut < 1100, "%.1f m² (čekáno 6 × 40 = 240 m²)" % (cut * 0.25))

	c.tool_down = false
	_place(c, main.SELL_POS, PI)
	var m0: float = main.money
	var litres: float = c.tank
	main.sell()
	_check("prodej na výkupu", c.tank == 0.0 and main.money > m0, "%d l za %d Kč" % [litres, main.money - m0])

	main.set_active(t)
	_place(t, Vector3(-29, 0, 25), PI)
	t.tool_down = true
	main.cam.snap()
	main.auto_input = Vector2(1, 0)
	await _until(func(): return t.position.z < 0.0)
	await _shot("03_cultivate")
	await _until(func(): return t.position.z < -25.0)
	main.auto_input = Vector2.ZERO
	var tilled: int = main.field.counts[2]
	_check("traktor kultivuje strniště", tilled > 0, "%d buněk" % tilled)
	_check("kultivátor nesahá na zralou pšenici", main.field.counts[1] + tilled == cut)

	# steering: full right lock turns the machine right (heading decreases)
	_place(t, Vector3(-10, 0, 60), PI)
	t.tool_down = false
	main.auto_input = Vector2(1, 1)
	await _frames(40)
	main.auto_input = Vector2.ZERO
	_check("D zatáčí doprava", t.heading < PI - 0.05, "kurz %.2f" % t.heading)

	# collision with the barn
	_place(t, Vector3(-15, 0, 38), 0.0)
	main.auto_input = Vector2(1, 0)
	await _frames(200)
	main.auto_input = Vector2.ZERO
	_check("stodola nejde projet", t.position.z < 46.0, "z = %.1f" % t.position.z)

	# beauty shots
	_place(t, Vector3(-26, 0, -1), PI)
	t.tool_down = true
	_place(c, Vector3(-16, 0, 6), PI * 0.98)
	c.tool_down = true
	main.set_active(c)
	main.auto_input = Vector2(1, 0)
	await _frames(25)
	main.auto_input = Vector2.ZERO
	main.cam.manual_t = 1000.0
	main.cam.yaw = PI * 0.75
	main.cam.pitch = 0.32
	main.cam.dist = 17.0
	main.cam.global_position = main.cam._goal()
	await _frames(5)
	await _shot("04_closeup")
	main.cam.yaw = PI * 1.15
	main.cam.pitch = 0.62
	main.cam.dist = 75.0
	main.cam.global_position = main.cam._goal()
	await _frames(5)
	await _shot("05_overview")
	main.cam.yaw = 0.3
	main.cam.pitch = 0.3
	main.cam.dist = 40.0
	main.set_active(t)
	main.cam.target = t
	_place(t, Vector3(4, 0, 34), 0.4)
	main.cam.global_position = main.cam._goal()
	await _frames(5)
	await _shot("06_farmyard")
	print("draw calls %d, triangles %d" % [Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),
		Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME)])
	print("%s" % ("ALL OK" if fails == 0 else "%d FAILED" % fails))
	get_tree().quit(1 if fails > 0 else 0)
