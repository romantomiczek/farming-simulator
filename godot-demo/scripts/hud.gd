extends CanvasLayer
## On-screen panels in the style of the browser game: cream cards with dark green text.

const INK := Color("23301f")
const MUTED := Color("5f6b58")
const CARD := Color(0.98, 0.96, 0.91, 0.9)

var _money: Label
var _field: Label
var _perf: Label
var _veh_name: Label
var _speed: Label
var _tank_bar: ProgressBar
var _tank_lbl: Label
var _tool: Label
var _hint_card: PanelContainer
var _hint: Label
var _toast: Label
var _toast_t := 0.0


## 12345.6 -> "12 346"
static func fmt(n: float) -> String:
	var s := str(int(roundf(absf(n))))
	var out := ""
	while s.length() > 3:
		out = " " + s.substr(s.length() - 3) + out
		s = s.substr(0, s.length() - 3)
	return ("-" if n < 0.0 else "") + s + out


func _ready() -> void:
	var root := MarginContainer.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "top", "right", "bottom"]:
		root.add_theme_constant_override("margin_" + side, 16)
	add_child(root)
	var col := VBoxContainer.new()
	root.add_child(col)

	var top := HBoxContainer.new()
	col.add_child(top)
	var tl := _card(top)
	_money = _label(tl, "", 30, INK)
	_field = _label(tl, "", 14, MUTED)
	_spacer(top)
	var tr := _card(top)
	_perf = _label(tr, "", 13, MUTED)
	_perf.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT

	var mid := Control.new()
	mid.size_flags_vertical = Control.SIZE_EXPAND_FILL
	col.add_child(mid)

	var bottom := HBoxContainer.new()
	bottom.alignment = BoxContainer.ALIGNMENT_END
	col.add_child(bottom)
	var vc := _card(bottom)
	vc.custom_minimum_size = Vector2(250, 0)
	_veh_name = _label(vc, "", 16, INK)
	_speed = _label(vc, "", 34, INK)
	_tank_lbl = _label(vc, "", 13, MUTED)
	_tank_bar = ProgressBar.new()
	_tank_bar.show_percentage = false
	_tank_bar.custom_minimum_size = Vector2(220, 10)
	_tank_bar.add_theme_stylebox_override("background", _box(Color(0.2, 0.25, 0.18, 0.15), 5, 0))
	_tank_bar.add_theme_stylebox_override("fill", _box(Color("d9a93f"), 5, 0))
	vc.add_child(_tank_bar)
	_tool = _label(vc, "", 13, MUTED)

	var centre := VBoxContainer.new()
	centre.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	centre.alignment = BoxContainer.ALIGNMENT_END
	bottom.add_child(centre)
	var hint_row := HBoxContainer.new()
	hint_row.alignment = BoxContainer.ALIGNMENT_CENTER
	centre.add_child(hint_row)
	var hc := _card(hint_row)
	_hint_card = hc.get_parent()
	_hint = _label(hc, "", 16, INK)

	var help := _card(bottom)
	for line in ["W A S D  jízda", "Mezerník  lišta / kultivátor", "F  prodat obilí na výkupu", "Tab  přepnout stroj",
			"Myš a kolečko  kamera", "R  nová úroda   Q  kvalita", "F11  celá obrazovka   Esc  konec"]:
		_label(help, line, 13, MUTED)

	_toast = Label.new()
	_toast.set_anchors_preset(Control.PRESET_CENTER_TOP)
	_toast.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_toast.add_theme_font_size_override("font_size", 18)
	_toast.add_theme_color_override("font_color", INK)
	_toast.add_theme_stylebox_override("normal", _box(CARD, 12, 14))
	_toast.modulate.a = 0.0
	add_child(_toast)
	_ignore_mouse(self)


func _process(dt: float) -> void:
	_toast_t -= dt
	_toast.modulate.a = clampf(_toast_t / 0.5, 0.0, 1.0)


func toast(text: String, secs := 3.5) -> void:
	_toast.text = text
	var w := _toast.get_combined_minimum_size().x
	_toast.offset_left = -w * 0.5
	_toast.offset_right = w * 0.5
	_toast.offset_top = 24
	_toast_t = secs


func set_money(m: float) -> void:
	_money.text = fmt(m) + " Kč"


func set_field(harvested: float, tilled: float) -> void:
	_field.text = "Pole 1 · pšenice · sklizeno %d %% · zkultivováno %d %%" % [roundi(harvested * 100.0), roundi(tilled * 100.0)]


func set_vehicle(v: Node3D) -> void:
	_veh_name.text = v.display_name
	_speed.text = "%d km/h" % roundi(absf(v.speed) * 3.6)
	var combine: bool = v.kind == "combine"
	_tank_bar.visible = combine
	if combine:
		_tank_lbl.text = "Zásobník  %s / %s l" % [fmt(v.tank), fmt(v.tank_cap)]
		_tank_bar.value = v.tank / v.tank_cap * 100.0
		_tool.text = "Žací lišta 6 m: " + ("spuštěná" if v.tool_down else "zvednutá")
	else:
		_tank_lbl.text = "Kultivátor 4,2 m"
		_tool.text = "Kultivátor: " + ("v zemi" if v.tool_down else "zvednutý")


func set_hint(text: String) -> void:
	_hint.text = text
	_hint_card.visible = text != ""


func set_perf() -> void:
	_perf.text = "%d FPS\n%d volání · %d tis. △" % [Engine.get_frames_per_second(),
		Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),
		roundi(Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME) / 1000.0)]


func _box(c: Color, radius: int, pad: int) -> StyleBoxFlat:
	var b := StyleBoxFlat.new()
	b.bg_color = c
	b.set_corner_radius_all(radius)
	b.set_content_margin_all(pad)
	return b


func _card(parent: Control) -> VBoxContainer:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", _box(CARD, 14, 14))
	p.size_flags_vertical = Control.SIZE_SHRINK_END
	parent.add_child(p)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 4)
	p.add_child(v)
	return v


func _label(parent: Control, text: String, size: int, c: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", c)
	parent.add_child(l)
	return l


func _spacer(parent: Control) -> void:
	var s := Control.new()
	s.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	parent.add_child(s)


func _ignore_mouse(n: Node) -> void:
	if n is Control:
		n.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for c in n.get_children():
		_ignore_mouse(c)
