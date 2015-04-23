var altoedit = (function(me) {
	var canvas, overlay, ctx, alto, input,
		altoStrings = {},
		rects = {},
		params = {}, 
		resizeDelay = -1,
		repaintDelay = -1,
		mode = "default",
		state = false,
		lastCursorPos = {x: 0, y: 0},
		movement = {x: 0, y: 0},
		wheelMode = "zoom",
		handlers = {
			"default": {
				mousedown: function(e) {
				},
				mouseup: function(e) {
					if(state === "down" && (movement.x !== 0 || movement.y !== 0)) {
						canvas.trigger('paint');
						if(input.position().top + input.height() < $(window).height()) {
							input.focus();
						}
					} else if(rects["stringRect"]) {
						me.showInput(rects["stringRect"]);
					}
				},
				mousemove: function(e) {
					if(state === "down") {
						canvas.trigger('moveBy', [movement, false]);
					} else {
						me.showAltoStringAt(e.clientX, e.clientY);
					}
				},
				mousewheel: function(e, which) {
					if (which === 0) { return; }
					which = which > 0 ? 1: -1;
					repaintDelay = 40;
					switch(wheelMode) {
						case "zoom":
							canvas.trigger('scaleBy', [1 + (0.1 * which), false]);
							break;
						case "scroll":
							canvas.trigger('moveBy', [{x: 0, y: 30 * which}, false]);
							break;
					}
				}
			}
		};

	function eventPoll() {
		if(resizeDelay > 0) { resizeDelay--;  }
		if(resizeDelay === 0) {
			me.resizeToFull();
			resizeDelay = -1;
		}
		if(repaintDelay > 0) { repaintDelay--; }
		if(repaintDelay === 0) {
			canvas.trigger("paint");
			repaintDelay = -1;
		}
		setTimeout(eventPoll, 20);
	}

	function initAltoNodes() {
		var result = alto.getElementsByTagName("String");
		for(var i = 0; i < result.length; i++) {
			var rect = {
				x: parseInt(result[i].getAttribute("HPOS"),10),
				y: parseInt(result[i].getAttribute("VPOS"),10),
				w: parseInt(result[i].getAttribute("WIDTH"),10),
				h: parseInt(result[i].getAttribute("HEIGHT"),10),
				id: result[i].getAttribute("ID"),
				content: result[i].getAttribute("CONTENT"),
				next: result[i+1] ? result[i+1].getAttribute("ID") : false,
				prev: result[i-1] ? result[i-1].getAttribute("ID") : false
			};
			var xKeyMin = parseInt(Math.floor(rect.x / 100),10),
				yKeyMin = parseInt(Math.floor(rect.y / 100),10),
				xKeyMax = parseInt(Math.ceil((rect.x + rect.w) / 100),10),
				yKeyMax = parseInt(Math.ceil((rect.y + rect.h) / 100),10);
			for(var xKey = xKeyMin; xKey <= xKeyMax; xKey++) {
				for(var yKey = yKeyMin; yKey <= yKeyMax; yKey++) {
					altoStrings[xKey] = altoStrings[xKey] || {};
					altoStrings[xKey][yKey] = altoStrings[xKey][yKey] || [];
					altoStrings[xKey][yKey].push(rect);
				}
			}
			altoStrings["idmap"] = altoStrings["idmap"] || {};
			altoStrings["idmap"][rect.id] = rect;
		}
	}

	me.setCanvas = function (c, o) {
		canvas = c;
		overlay = o;
		return me;
	};

	me.init = function(id, altoDoc, inp) {
		alto = altoDoc;
		input = inp;
		initAltoNodes();
		params.id = id + ":image";
		me.resizeToFull().initViewer();
		$(window).on("resize", function() { resizeDelay = 40; });
		eventPoll();
		return me;
	};

	me.resizeToFull = function() {
		$("canvas")
			.attr("height", $(window).height() - $("#alto-string").height())
			.attr("width", $(window).width())
			.trigger("recalibrate");
		return me;
	};
	me.toggleWheelMode = function() {
		wheelMode = wheelMode === 'zoom' ? 'scroll' : 'zoom';
	};

	me.onchange = function(p, cx) {
		params = p;
		me.paintOverlay();
	};

	me.showAltoStringAt = function(x, y) {
		var realPos = {
			x: parseInt(x / params.s + (params.x / params.s), 10),
			y: parseInt(y / params.s + (params.y / params.s), 10)
		};
		var atMap = {
			x: parseInt(Math.floor(realPos.x / 100), 10),
			y: parseInt(Math.floor(realPos.y / 100), 10)
		};
		if(!(altoStrings[atMap.x] && altoStrings[atMap.x][atMap.y])) { return; }
		for(var i in altoStrings[atMap.x][atMap.y]) {
			var rect = altoStrings[atMap.x][atMap.y][i];
			if(realPos.x >= rect.x && realPos.y >= rect.y && realPos.x <= rect.x + rect.w && realPos.y <= rect.y + rect.h) {
				me.addRect(rect, "stringRect", "red", "rgba(0,0,255,0.1"); 
				break;
			}
		}
		me.paintOverlay();
	};

	me.addRect = function(rect, id, stroke, fill) {
		rects[id] = $.extend(rect, {stroke: stroke, fill: fill});
		me.paintOverlay();
	};
	me.showInput = function(rect) {
		me.addRect(rect, "focusRect", "blue", "rgba(128,128,255,0.1)");
		me.repositionInput();
		input
			.val(rect.content)
			.attr("data-id", rect.id)
			.show()
			.focus();
		me.paintOverlay();
		me.showStringNode($(alto).find("[ID=" + rect.id +"]").get(0));
	};

	me.showStringNode = function(node) {
		$("#alto-string input").val("");
		for(var i in node.attributes) {
			if(node.attributes[i].nodeValue) {
				$("#alto-string input[name='" + node.attributes[i].name + "']")
					.val(node.attributes[i].nodeValue);
			}
		}
	};

	me.repositionInput = function() {
		if(!rects["focusRect"]) { return; }
		input
			.css({
				top: parseInt(rects["focusRect"].y * params.s - params.y, 10) +  parseInt(rects["focusRect"].h * params.s, 10) + 2, 
				left: parseInt(rects["focusRect"].x * params.s - params.x, 10),
				width: parseInt(rects["focusRect"].w * params.s, 10)
			});
	};

	me.paintOverlay = function() {
		ctx.clearRect(0, 0, overlay.width(), overlay.height());
		for(var id in rects) {
			ctx.beginPath();
			ctx.strokeStyle = rects[id].stroke || "red";
			ctx.fillStyle = rects[id].fill || "red";

			var rect = {
				x: parseInt(rects[id].x * params.s - params.x, 10),
				y: parseInt(rects[id].y * params.s - params.y, 10),
				w: parseInt(rects[id].w * params.s, 10),
				h: parseInt(rects[id].h * params.s, 10),
			};
			ctx.rect(rect.x, rect.y, rect.w, rect.h);
			ctx.fill();
			ctx.stroke();
			ctx.closePath();
		}
		me.repositionInput();
	};

	me.setAltoContent = function(stringNode, value, prevId, nextId) {
		var subsContent = stringNode.attr("SUBS_CONTENT"), 
			subsType = stringNode.attr("SUBS_TYPE"),
			content = stringNode.attr("CONTENT");

		if(subsContent && subsType) {
			subsContent = subsContent.replace(content, value);
			if(subsType === 'HypPart1') {
				$(alto).find("[ID=" + nextId +"]").attr("SUBS_CONTENT", subsContent);
			} else {
				$(alto).find("[ID=" + prevId +"]").attr("SUBS_CONTENT", subsContent);
			}
			stringNode.attr("SUBS_CONTENT", subsContent);
		}
		stringNode.attr("CONTENT", value);
		stringNode.attr("WC", "1.0")
		stringNode.attr("CC", Array(value.length + 1).join("0"));
		me.showStringNode(stringNode.get(0));
	};
	me.save = function() {
		$.ajax("save.php", {
			method: "POST",
			data: (new XMLSerializer()).serializeToString(alto),
			success: function() { alert("Opgeslagen");},
			error: function() { alert("niet opgeslagen"); }
		});
	};
	me.initViewer = function() {
		input.on("keydown", function(e) {
			if(e.keyCode === 16) {
				$(this).attr("data-shift-down", "true");
			} else if(e.keyCode === 9 && rects["focusRect"]) {
				$(this).trigger("change");
				var next = $(this).is("[data-shift-down]") ? rects["focusRect"].prev : rects["focusRect"].next;
				if(next && altoStrings["idmap"][next]) {
					me.showInput(altoStrings["idmap"][next]);
				}
				return e.preventDefault();
			}
		}).on("keyup", function(e) {
			if(e.keyCode === 16) {
				$(this).removeAttr("data-shift-down");
			}
			$(this).trigger("change");
		}).on("change", function(e) {
			rects["focusRect"].content = $(this).val();
			me.setAltoContent($(alto).find("[ID=" + $(this).attr("data-id") +"]"), $(this).val(), 
					rects["focusRect"].prev, rects["focusRect"].next);
		});
		canvas
			.imageViewerClient("http://imageviewer.kb.nl/ImagingService/imagingService", {
				params: params,
				previewScale: 0.4,
				onchange: me.onchange
			});

		overlay
			.on("mousedown", function(e) {
				movement = {x: 0, y: 0};
				state = "down"; handlers[mode].mousedown(e);
				lastCursorPos = {x: e.clientX, y: e.clientY};
			})
			.on("mousemove", function(e) { 
				movement = {x: e.clientX - lastCursorPos.x, y: e.clientY - lastCursorPos.y};
				handlers[mode].mousemove(e);
				lastCursorPos = {x: e.clientX, y: e.clientY};
			})
			.on("mouseup", function(e) {
				handlers[mode].mouseup(e);
				state = "up";
			})
			.on("mousewheel", function(e, which) {
				handlers[mode].mousewheel(e, which);
			});
		ctx = overlay.get(0).getContext('2d');
	}

	return me;
})(altoedit || {});
