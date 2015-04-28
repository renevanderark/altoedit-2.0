var altoedit = (function(me) {
	var canvas, overlay, ctx, alto, input,
		altoStrings = {},
		currentResize = false,
		altoStringDiv, altoLineDiv,
		rects = {},
		params = {}, 
		resizeDelay = -1,
		repaintDelay = -1,
		mode = "default",
		state = false,
		lastCursorPos = {x: 0, y: 0},
		movement = {x: 0, y: 0},
		wheelMode = "scroll",
		handlers = {
			"default": {
				mousedown: function(e) {
					if(currentResize) {
						mode = "resize";
						input.hide();
					} else {
						mode = "default";
					}
				},
				mouseup: function(e) {
					if(mode === "resize") { mode = "default"; input.show(); }

					var stringRect;
					if(state === "down" && (movement.x !== 0 || movement.y !== 0)) {
						canvas.trigger('paint');
						if(input.position().top + input.height() < $(window).height()) {
							input.focus();
						}
					} else if(stringRect = me.findAltoStringAt(e.clientX, e.clientY)) {
						me.showInput(stringRect);
					}
				},
				mouseout: function(e) {
					if(mode === "resize") { mode = "default"; }
				},
				mousemove: function(e) {
					if(state === "down") {
						canvas.trigger('moveBy', [movement, false]);
					} else {
						me.showAltoStringAt(e.clientX, e.clientY);
					}
					me.adaptCursorStyle(e.clientX, e.clientY);
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
				},
				dblclick: function(e) {
					if(rects["focusRect"] && rects["focusRect"].textLine &&
						me.overAltoNode(e.clientX, e.clientY, rects["focusRect"].textLine) &&
						!withinRealBounds(e.clientX, e.clientY, rects["focusRect"])) {
						me.addAltoStringAt(getRealPos(e.clientX, e.clientY), rects["focusRect"].textLine);
					}
				}
			}
		};

	handlers.resize = $.extend({}, handlers.default, {
		mousemove: function(e) {
			if(!currentResize) { mode = "default"; return }
			var realMov =  parseInt(movement[currentResize.movName] / params.s, 10),
				propVal = currentResize.rect[currentResize.dimName] + realMov,
				altoDiv = currentResize.rectType === "textLineRect" ? altoLineDiv :  altoStringDiv;
			me.updateDimension(currentResize.propName, propVal, currentResize.rect);
			if(currentResize.dimName === 'x') {
				propVal = currentResize.rect.w - realMov;
				if(propVal > 0) {
					me.updateDimension("WIDTH", propVal, currentResize.rect);
				}
			} else if (currentResize.dimName === 'y') {
				propVal = currentResize.rect.h - realMov;
				if(propVal > 0) {
					me.updateDimension("HEIGHT", propVal, currentResize.rect);
				}
			}

			me.showAltoNode($(alto).find("[ID=" + currentResize.rect.id +"]").get(0), altoDiv);
		}
	});
	me.ctrlDown = false;
	me.shiftDown = true;

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

	function mapAltoString(altoString, altoLine, prev, next) {
		var rect = {
			x: parseInt(altoString.getAttribute("HPOS"),10),
			y: parseInt(altoString.getAttribute("VPOS"),10),
			w: parseInt(altoString.getAttribute("WIDTH"),10),
			h: parseInt(altoString.getAttribute("HEIGHT"),10),
			id: altoString.getAttribute("ID"),
			content: altoString.getAttribute("CONTENT"),
			next: next,
			prev: prev,
			textLine: altoLine
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
		return rect;
	}

	function initAltoNodes() {
		var result = alto.getElementsByTagName("String");
		for(var i = 0; i < result.length; i++) {
			var altoLine = $(result[i]).parents("TextLine")[0];
			mapAltoString(result[i], altoLine, 
				result[i-1] ? result[i - 1].getAttribute("ID") : false,
				result[i+1] ? result[i + 1].getAttribute("ID") : false);
		}
	}

	function getRealPos(x, y) {
		return {
			x: parseInt(x / params.s + (params.x / params.s), 10),
			y: parseInt(y / params.s + (params.y / params.s), 10)
		};
	}

	function rectFromAltoNode(node) {
		return {
			x: parseInt(node.getAttribute("HPOS"),10),
			y: parseInt(node.getAttribute("VPOS"),10),
			w: parseInt(node.getAttribute("WIDTH"),10),
			h: parseInt(node.getAttribute("HEIGHT"),10),
			id: node.getAttribute("ID")
		};
	}

	function withinBounds(pos, rect) {
		return pos.x >= rect.x && pos.y >= rect.y && pos.x <= rect.x + rect.w && pos.y <= rect.y + rect.h;
	}

	function withinRealBounds(x, y, rect) {
		return withinBounds(getRealPos(x, y), rect);
	}

	me.setCanvas = function (c, o) {
		canvas = c;
		overlay = o;
		return me;
	};

	me.init = function(id, altoDoc, inp, asDiv, alDiv) {
		alto = altoDoc;
		altoStringDiv = asDiv;
		altoLineDiv = alDiv;
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
			.attr("height", $(window).height() - $("#buttons").height() - altoStringDiv.height() - altoLineDiv.height())
			.attr("width", $(window).width())
			.trigger("recalibrate");
		return me;
	};

	me.setWheelMode = function(md) {
		wheelMode = md;
	};

	me.adaptCursorStyle = function(x,y) {
		var realPos = getRealPos(x, y), 
			ids = ["focusRect", "textLineRect"], t = l = false, i;

		overlay.removeClass("resiz-ns").removeClass("resiz-ew");
		currentResize = false;
		for(i in ids) {
			var id = ids[i];
			if(!rects[id]) { continue; }
			if((realPos.x >= rects[id].x && realPos.x <= rects[id].x + rects[id].w) && (
				(t = realPos.y >= rects[id].y - 2  && realPos.y <= rects[id].y + 2) ||
				(realPos.y >= rects[id].y + rects[id].h - 2  && realPos.y <= rects[id].y + rects[id].h + 2))) {
				overlay.addClass("resiz-ns");
				currentResize = {
					rect: rects[id],
					rectType: id,
					dimName: t ? "y" : "h", 
					propName: t ? "VPOS" : "HEIGHT",
					movName : "y"
				};
				break;
			} else if((realPos.y >= rects[id].y && realPos.y <= rects[id].y + rects[id].h) && (
				(l = realPos.x >= rects[id].x - 2  && realPos.x <= rects[id].x + 2) ||
				(realPos.x >= rects[id].x + rects[id].w - 2  && realPos.x <= rects[id].x + rects[id].w + 2))) {
				overlay.addClass("resiz-ew");
				currentResize = {
					rect: rects[id],
					rectType: id,
					dimName: l ? "x" : "w", 
					propName: l ? "HPOS" : "WIDTH",
					movName: "x"
				};
				break;
			}
		}
	};

	me.onchange = function(p, cx) {
		params = p;
		me.paintOverlay();
	};

	me.overAltoNode = function(x, y, node) {
		var realPos = getRealPos(x, y),
			rect = rectFromAltoNode(node);
		return withinBounds(realPos, rect);
	};

	me.findAltoStringAt = function(x, y) {
		var realPos = getRealPos(x, y);
		var atMap = {
			x: parseInt(Math.floor(realPos.x / 100), 10),
			y: parseInt(Math.floor(realPos.y / 100), 10)
		};
		if(!(altoStrings[atMap.x] && altoStrings[atMap.x][atMap.y])) { return; }

		for(var i in altoStrings[atMap.x][atMap.y]) {
			var rect = altoStrings[atMap.x][atMap.y][i];
			if(withinBounds(realPos, rect)) {
				return rect;
			}
		}
		return false;
	};

	me.showAltoStringAt = function(x, y) {
		var rect;
		if(!(rect = me.findAltoStringAt(x, y))) { return; }
		me.addRect(rect, "stringRect", "rgba(255,0,0,0.4)", "rgba(0,0,255,0.1");
		me.paintOverlay();
	};

	me.addAltoStringAt = function(realPos, textLine) {
		var siblings = $(textLine).find("String").toArray(),
			altoString = alto.createElementNS(alto.documentElement.getAttribute("xmlns"), "String"),
			spNode = alto.createElementNS(alto.documentElement.getAttribute("xmlns"), "SP"), 
			addIndex = 0, i, leftOf = false, rightOf = false, prev, next, newRect;
		if(siblings.length === 0) { 
			alert("Kan geen <String> toevoegen aan lege <TextLine>");
			return;
		}
		for(i = 0; i < siblings.length; i++) {
			var curIndex = parseInt(siblings[i].getAttribute("ID").replace(/^.+-/, ""));
			if(addIndex < curIndex) { addIndex = curIndex; }
			if((!leftOf || realPos.x - parseInt(leftOf.getAttribute("HPOS")) >
				realPos.x - parseInt(siblings[i].getAttribute("HPOS"))) &&
				realPos.x - parseInt(siblings[i].getAttribute("HPOS")) > 0) {
				leftOf = siblings[i];
			}
		}

		if(!leftOf) { rightOf = siblings[0]; }

		altoString.setAttribute("ID", (leftOf || rightOf).getAttribute("ID").replace(/-[0-9]+$/, "") + "-" + (addIndex + 1));
		altoString.setAttribute("HPOS", realPos.x - 15)
		altoString.setAttribute("VPOS", textLine.getAttribute("VPOS"))
		altoString.setAttribute("HEIGHT", textLine.getAttribute("HEIGHT"))
		altoString.setAttribute("WIDTH", 30)
		altoString.setAttribute("WC", 1)
		altoString.setAttribute("CC", "")
		altoString.setAttribute("CONTENT", "");

		spNode.setAttribute("ID", (leftOf || rightOf).getAttribute("ID").replace(/-[0-9]+$/, "").replace("ST", "SP") + "-" + (addIndex + 1));
		spNode.setAttribute("VPOS", textLine.getAttribute("VPOS"))
		spNode.setAttribute("HEIGHT", textLine.getAttribute("HEIGHT"))

		if(leftOf) {
			prev = altoStrings["idmap"][leftOf.getAttribute("ID")];
			next = altoStrings["idmap"][prev.next];

			spNode.setAttribute("HPOS", parseInt(leftOf.getAttribute("HPOS")) + parseInt(leftOf.getAttribute("WIDTH")));
			spNode.setAttribute("WIDTH", 
				parseInt(altoString.getAttribute("HPOS")) - parseInt(spNode.getAttribute("HPOS")) > 0 ? 
				parseInt(altoString.getAttribute("HPOS")) - parseInt(spNode.getAttribute("HPOS")) : 0);

			$(leftOf).after(spNode);
			$(spNode).after(altoString);
		} else {
			next = altoStrings["idmap"][rightOf.getAttribute("ID")];
			prev = altoStrings["idmap"][next.prev];

			spNode.setAttribute("HPOS", parseInt(altoString.getAttribute("HPOS")) + parseInt(altoString.getAttribute("WIDTH")));
			spNode.setAttribute("WIDTH", 
				parseInt(rightOf.getAttribute("HPOS")) - parseInt(spNode.getAttribute("HPOS")) > 0 ? 
				parseInt(rightOf.getAttribute("HPOS")) - parseInt(spNode.getAttribute("HPOS")) : 0);

			$(rightOf).before(spNode);
			$(spNode).before(altoString);
		}
		newRect = mapAltoString(altoString, textLine, prev.id, next.id);
		prev.next = newRect.id;
		next.prev = newRect.id;
		me.showInput(newRect);
	};

	me.addTextLineRect = function(textLine) {
		var rect = rectFromAltoNode(textLine);
		me.addRect(rect, "textLineRect", "rgba(0,255,255, 0.8", "rgba(0,0,0,0)");
		me.showAltoNode(textLine, altoLineDiv);
		me.paintOverlay();
	};

	me.addRect = function(rect, id, stroke, fill) {
		if(id === "stringRect" && rects["focusRect"] && rects["focusRect"].id === rect.id) { 
			delete(rects["stringRect"]);
			return;
		}
		rects[id] = $.extend(rect, {stroke: stroke, fill: fill});
		me.paintOverlay();
	};

	me.showInput = function(rect) {
		me.addRect(rect, "focusRect", "blue", "rgba(128,128,255,0.1)");
		me.addTextLineRect(rect.textLine);
		me.repositionInput();
		input
			.val(rect.content)
			.attr("data-id", rect.id)
			.attr("data-last-val", rect.content)
			.show()
			.focus();
		me.paintOverlay();
		me.showAltoNode($(alto).find("[ID=" + rect.id +"]").get(0), altoStringDiv);
	};

	me.showAltoNode = function(node, div) {
		div.find("*").hide();
		div.find("input").val("");
		for(var i in node.attributes) {
			if(node.attributes[i].nodeValue) {
				div.find("input[name='" + node.attributes[i].name + "']")
					.val(node.attributes[i].nodeValue)
					.attr("data-last-val", node.attributes[i].nodeValue)
					.show().prev().show();
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
		me.showAltoNode(stringNode.get(0), altoStringDiv);
	};
	me.save = function() {
		$.ajax("save.php", {
			method: "POST",
			data: (new XMLSerializer()).serializeToString(alto),
			success: function() { alert("Opgeslagen");},
			error: function() { alert("niet opgeslagen"); }
		});
	};
	me.updateDimension = function(propName, propVal, rect) {
		var stringNode = $(alto).find("[ID='" + rect.id + "']");
		stringNode.attr(propName, propVal);
		switch(propName) {
			case "HPOS":
				rect.x = parseInt(propVal, 10);
				break;
			case "VPOS":
				rect.y = parseInt(propVal, 10);
				break;
			case "WIDTH":
				rect.w = parseInt(propVal, 10);
				break;
			case "HEIGHT":
				rect.h = parseInt(propVal, 10);
				break;
		}
		me.paintOverlay();
	};

	me.addNumberHandlers = function(inp, rectType) {
		$(inp).on("keyup", function(e) {
			if($(this).val() !== $(this).attr("data-last-val")) {
				$(this).trigger("change");
			}
			$(this).attr("data-last-val", $(this).val());
		}).on("keydown", function(e) {
			if(e.keyCode === 40) {
				this.value = parseInt(this.value, 10) - (me.shiftDown ? 5 : 1);
				$(this).trigger("change");
				return e.preventDefault();
			} else if(e.keyCode === 38) {
				this.value = parseInt(this.value, 10) + (me.shiftDown ? 5 : 1);
				$(this).trigger("change");
				return e.preventDefault();
			}
		}).on("focus", function() {
			this.setSelectionRange(0, this.value.length);
		}).on("change", function() {
			if(!this.value.match(/^[0-9]+$/)) {
				this.value = $(this).attr("data-last-val");
				this.setSelectionRange(0, this.value.length);
			} else {
				me.updateDimension(this.name, this.value, rects[rectType]);
			}
		});
	};
 
	me.initViewer = function() {
		input.on("keydown", function(e) {
			if(e.keyCode === 9 && rects["focusRect"]) {
				if($(this).val() !== $(this).attr("data-last-val")) {
					$(this).trigger("change");
				}
				var next = me.shiftDown ? rects["focusRect"].prev : rects["focusRect"].next;
				if(next && altoStrings["idmap"][next]) {
					me.showInput(altoStrings["idmap"][next]);
				}
				return e.preventDefault();
			}
		}).on("keyup", function(e) {
			if($(this).val() !== $(this).attr("data-last-val")) {
				$(this).trigger("change");
			}
			$(this).attr("data-last-val", $(this).val());
		}).on("change", function(e) {
			rects["focusRect"].content = $(this).val();
			me.setAltoContent($(alto).find("[ID=" + $(this).attr("data-id") +"]"), $(this).val(), 
					rects["focusRect"].prev, rects["focusRect"].next);
		});

		
		altoStringDiv.find("input.number").each(function(i, inp) {
			me.addNumberHandlers(inp, "focusRect");
		});

		altoLineDiv.find("input.number").each(function(i, inp) {
			me.addNumberHandlers(inp, "textLineRect");
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
			.on("mouseout", function(e) {
				handlers[mode].mouseout(e);
			})
			.on("mousewheel", function(e, which) {
				handlers[mode].mousewheel(e, which);
			})
			.on("dblclick", function(e) {
				handlers[mode].dblclick(e);
			});
		ctx = overlay.get(0).getContext('2d');
		$(window).on("mouseup", function(e) { state = "up"; });
	}

	return me;
})(altoedit || {});
