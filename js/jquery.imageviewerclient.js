/*
* jquery-imageviewerclient.js: interactive client for the imageviewer service of the KB
* For details see: http://opendatachallenge.kbresearch.nl/
* Copyright (C) 2011 R. van der Ark, Koninklijke Bibliotheek - National Library of the Netherlands
*
* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU General Public License as published by
* the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
* GNU General Public License for more details.
*
* You should have received a copy of the GNU General Public License
* along with this program. If not, see <http://www.gnu.org/licenses/>.
*/

/*global window, history, jQuery*/
(function ($) {
	/**
	 * Builds a client for the KB imageviewer service
	 * where options.href contains a :page part to be replaced.
	 * @class imageViewerClient
	 * @member jQuery.fn
	 * @param {String} serviceUrl the base url of the service
	 * @param {Object} opts
	 * @returns {jQuery} the element as an interactive image canvas
	 */
	$.fn.imageViewerClient = function (serviceUrl, opts) {
		var _self = this,
			popup = null,
			previewImage = null,
			canvasImage = null,
			spinner = null,
			storedWidth = 0,
			slider = opts.slider,
			minimap = opts.minimap,
			minimapOptions = opts.minimapOptions,
			words = opts.params.words || null,
			coords = opts.params.coords || null,
			userCallback = opts.userCallback || null,
			previewScale = opts.previewScale || 0.2,
			maxScale = opts.maxScale || 4.0,
			minScale = opts.minScale || 0.01,
			fullImageDims = null,
			sliding = false,
			initialZoom = opts.initialZoom || "scaleToFullWidth",
			canvas2DContext = _self.get(0).getContext('2d'),
			previewParams = $.extend({}, opts.params),  // Used to retrieve preview image (blurry thing)
			params = $.extend({}, opts.params), // Used to retrieve the canvas image
			storedCenter = null,
			_overlaysDrawn = [];


		$(_self).attr("width", _self.width());
		$(_self).attr("height", _self.height());
		canvas2DContext.width = _self.width();
		canvas2DContext.height = _self.height();

		if (opts.legacy) {
			$.extend(previewParams, {
				zoom: previewScale
			});
			if (opts.params.format && opts.params.format === "SGD") {
				$.extend(previewParams, {s: 2.083});
			}
		} else {
			$.extend(previewParams, {
				s: previewScale
			});
		}

		$.extend(params, {
			r: 0,
			s: 1.0,
			x: 0,
			y: 0,
			w: _self.width(),
			h: _self.height()
		});

		if (opts.spinner) {
			spinner = $("<img>").attr("src", opts.spinner).addClass("spinner");
			_self.before(spinner);
		}

		function normalize(orig) {
			var p = $.extend(true, {}, orig);
			if (opts.legacy) {
				p.zoom = p.s;
				delete (p.s);
				if (p.x) {
					p.x /= p.zoom;
				}
				if (p.y) {
					p.y /= p.zoom;
				}
				if (p.w) {
					p.w /= p.zoom;
				}
				if (p.h) {
					p.h /= p.zoom;
				}
				if (p.format && p.format === "SGD") {
					p.s = 2.083;
				}
			}
			if (p.x) {
				p.x = parseInt(p.x, 10);
			}
			if (p.y) {
				p.y = parseInt(p.y, 10);
			}
			if (p.w) {
				p.w = parseInt(p.w, 10);
			}
			if (p.h) {
				p.h = parseInt(p.h, 10);
			}
			return p;
		}

		function repositionMinimap() {
			if (minimap) {
				minimap.trigger("repositionViewerZone", {
					x: params.x / params.s,
					y: params.y / params.s,
					w: params.w / params.s,
					h: params.h / params.s
				});
			}
		}


		function initMinimap() {
			if (minimap && minimapOptions) {
				var minimapScale = minimap.width() / fullImageDims.w,
					p = {
						r: params.r,
						s: minimapScale,
						id: params.id,
						useresolver: params.useresolver === "false" ? false : true
					},
					img = serviceUrl + "?" + new Date().getTime() + "&" + $.param(normalize(p));

				minimap.html("");
				minimap.minimap(minimapScale, fullImageDims.h * minimapScale,
					$.extend(minimapOptions, {image: img}));
				setTimeout(repositionMinimap, 200);
			}
		}


		function onImageError() {
			if (spinner) { spinner.hide(); }
			if (opts.onImageError) { opts.onImageError(); return; }

			var errorMessage = $("<div>"),
				tryAgain = $("<a>")
					.attr("href", window.location.href.replace(/#.*$/, ''))
					.html(opts.tryAgainMessage || "Opnieuw proberen");
			if ($.browser.msie) {
				tryAgain.click(function () { history.go(0); });
			}
			errorMessage.html(opts.errorMessage ||
					"Er is iets fout gegaan bij het ophalen van de afbeelding. ");
			errorMessage.append(tryAgain);
			if (_self.prop("tagName").toLowerCase() === 'canvas') {
				$(_self.parents()[0]).prepend(errorMessage);
			} else {
				_self.append(errorMessage);
			}
		}

		function onCanvasImageLoad(image) {
			canvas2DContext.clearRect(0, 0, canvas2DContext.width, canvas2DContext.height);
			var x = 0;
			if (image.width < canvas2DContext.width) {
				x += Math.floor((canvas2DContext.width - image.width) / 2);
			}
			storedWidth = image.width;
			canvas2DContext.drawImage(image, x, 0);
		}

		function onPreviewImageLoad(image, callback) {
			if (!fullImageDims) {
				fullImageDims = {
					w: image.width / previewScale,
					h: image.height / previewScale
				};
				var trans = image.width / _self.width();

				if (spinner) {
					spinner.hide();
				}
				canvas2DContext.clearRect(0, 0, canvas2DContext.width, canvas2DContext.height);

				if (minimap) { initMinimap(); }
				if (slider) { slider.slider("enable"); }
				if (callback) { callback(true); }
				if (userCallback) {
					userCallback();
				} else {
					canvas2DContext.drawImage(image, 0, 0, _self.width(), parseInt(image.height / trans, 10));
				}
				$(image).off("load");
			}

			recalculateMinScale();
			if (slider) {
				slider.slider({
					min: Math.floor(minScale * 100)
				});
			}
		}

		// de minimale zoom factor is ingesteld op de waarde waarbij de 
		// afbeelding in het geheel getoond kan worden.
		// de initiele waarden van de variable minScale en object slider 
		// worden dus opnieuw herschreven.
		function recalculateMinScale() {
			if (params.r === 0 || params.r === 180) {
				minScale = opts.minScale || _self.height() / fullImageDims.h;
			} else {
				minScale = opts.minScale || _self.width() / fullImageDims.w;
			}
		}

		function loadPreviewImage(callback) {
			if (spinner) {
				spinner.show();
			}
			previewImage = $("<img>")
				.error(onImageError)
				.on("load", function () {
					onPreviewImageLoad(this, callback);
				})
				.attr("src", serviceUrl + "?" + new Date().getTime() + "&" + $.param(previewParams));
		}

		function loadCanvas() {
			if (canvasImage) {
				canvasImage.remove();
			}
			canvasImage = $("<img>")
				.error(onImageError)
				.on("load", function () { onCanvasImageLoad(this); });
			canvasImage[0].src = serviceUrl + "?" +
				new Date().getTime() + "&" + $.param(normalize(params));

			if (opts.onpaint) {
				opts.onpaint(normalize(params));
			}
		}

		function setRealCanvasPosition(x, y) {
			if (fullImageDims) {
				params.x = x + _self.width() > (fullImageDims.w * params.s) ?
						(fullImageDims.w * params.s) - _self.width() : x;
				params.y = y + _self.height() > (fullImageDims.h * params.s) ?
						(fullImageDims.h * params.s) - _self.height() : y;
			}
			params.x = params.x < 0 ? 0 : params.x;
			params.y = params.y < 0 ? 0 : params.y;
			repositionMinimap();
		}

		function getCenteredX() {
			var x = 0;
			if (storedWidth < canvas2DContext.width) {
				x += Math.floor((canvas2DContext.width - storedWidth) / 2);
			}
			return x;
		}

		function centerParams(orig) {
			var p = $.extend(true, {}, orig),
				diff;

			if (fullImageDims.w * orig.s < _self.width() - 1) {
				diff = _self.width() - fullImageDims.w * orig.s;
				p.x -= diff / 2;
			}
			return p;
		}

		function scaleCanvas(commit) {
			if (fullImageDims) {
				setRealCanvasPosition(params.x, params.y);
				if (previewImage) {
					canvas2DContext.clearRect(0, 0, canvas2DContext.width, canvas2DContext.height);
					var p = centerParams(params);
					canvas2DContext.drawImage(previewImage.get(0), -p.x, -params.y,
						parseInt(fullImageDims.w * params.s, 10), parseInt(fullImageDims.h * params.s, 10));
				}

				if (slider) {
					slider.slider("value", Math.ceil(params.s * 100));
				}

				if (commit) {
					loadCanvas();
				}
				if (opts.onzoom) {
					opts.onzoom(params.s);
				}
				if (opts.onchange) {
					opts.onchange(normalize(centerParams(params)));
				}
			}
		}

		function rotateCanvas() {
			fullImageDims = null;
			previewParams.r = params.r;
			loadPreviewImage(scaleCanvas);
		}

		function storeCanvasCenter(center) {
			var top = _self.offset().top - $(window).scrollTop(),
				left = _self.offset().left,
				x = center && center.x ? center.x : _self.width() / 2 + left,
				y = center && center.y ? center.y : _self.height() / 2 + top;

			storedCenter = {
				x: (params.x + (x || _self.width() / 2) - left) / params.s,
				y: (params.y + (y || _self.height() / 2) - top) / params.s
			};
		}

		function moveToStoredCenter(commit) {
			if (storedCenter && storedCenter.x && storedCenter.y) {
				var x = (storedCenter.x * params.s) - (_self.width() / 2),
					y = (storedCenter.y * params.s) - (_self.height() / 2);
				setRealCanvasPosition(x, y);
				scaleCanvas(commit);
			}
		}

		function setHighlights(set) {
			if (set && params.words) { return; } // nothing changed
			if (!set && !params.words) { return; } // nothing changed

			if (set && words && coords) {
				params.words = words;
				params.coords = coords;
				previewParams.words = words;
				previewParams.coords = coords;
			} else {
				delete (params.words);
				delete (params.coords);
				delete (previewParams.words);
				delete (previewParams.coords);
			}
			if (previewImage) {
				previewImage.attr("src",
					serviceUrl + "?" + new Date().getTime() + "&" + $.param(previewParams));
				loadCanvas();
			}
		}

		this.bind("setHighlights", function (e, set) {
			setHighlights(set);
		});

		this.bind("recalibrate", function (e) {
			params.w = $(this).width();
			params.h = $(this).height();
			canvas2DContext.height = params.h;
			canvas2DContext.width = params.w;
			recalculateMinScale();
			scaleCanvas(true);
		});


		this.bind("moveTo", function (e, dims, commit, rescale) {
			if (rescale) {
				dims.x *= params.s;
				dims.y *= params.s;
			}
			var x = dims.x,
				y = dims.y;

			setRealCanvasPosition(x, y);
			scaleCanvas(commit);
		});

		this.bind("moveBy", function (e, dims, commit, rescale) {
			if (rescale) {
				dims.x *= params.s;
				dims.y *= params.s;
			}
			var x = params.x - dims.x,
				y = params.y - dims.y;

			setRealCanvasPosition(x, y);
			scaleCanvas(commit);
		});

		this.bind("scaleBy", function (e, factor, commit, center, scalingTo, options) {
			var opts = options || {};
			storeCanvasCenter(center);
			if (scalingTo) {
				params.s = factor;
			} else {
				params.s *= factor;
			}

			if (params.s > maxScale) {
				params.s = maxScale;
			}

			if (params.s < minScale) {
				params.s = minScale;
			}

			moveToStoredCenter(commit);
			if (opts.callback) { opts.callback(params.s); }
		});

		this.bind("rotateBy", function (e, factor) {
			params.r += factor;
			if (params.r < 0) {
				params.r = 270;
			} else if (params.r > 270) {
				params.r = 0;
			}
			rotateCanvas();
		});

		this.bind("scaleToFullWidth", function (e) {
			if (fullImageDims && fullImageDims.w) {
				params.x = 0;
				params.s = (_self.width()) / fullImageDims.w;
				scaleCanvas(true);
			}
		});

		this.bind("paint", function (e) {
			scaleCanvas(true);
		});

		this.bind("scaleToFullHeight", function (e) {
			if (fullImageDims && fullImageDims.h) {
				params.y = 0;
				params.s = _self.height() / fullImageDims.h;
				scaleCanvas(true);
			}
		});


		this.bind("redraw", function (e) {
			if (canvasImage.length > 0 && canvasImage.get(0).complete) {
				canvas2DContext.drawImage(canvasImage.get(0), getCenteredX(), 0);
			} else if (previewImage.length > 0 && previewImage.get(0).complete) {
				canvas2DContext.drawImage(previewImage.get(0), -params.x, -params.y,
					parseInt(fullImageDims.w * params.s, 10), parseInt(fullImageDims.h * params.s, 10));
			} // else nothing to redraw 
		});

		this.bind("drawRect", function (e, c1, c2) {
			_self.trigger("redraw");
			canvas2DContext.beginPath();
			if (getCenteredX() > c1.x) {
				c1.x = getCenteredX() + 1;
			}
			if (getCenteredX() > c2.x) {
				c2.x = getCenteredX() + 1;
			}
			if (canvasImage[0].height < c1.y) {
				c1.y = canvasImage[0].height;
			}
			if (canvasImage[0].height < c2.y) {
				c2.y = canvasImage[0].height;
			}
			if (getCenteredX() + canvasImage[0].width < c1.x) {
				c1.x = getCenteredX() + canvasImage[0].width;
			}
			if (getCenteredX() + canvasImage[0].width < c2.x) {
				c2.x = getCenteredX() + canvasImage[0].width;
			}

			canvas2DContext.rect(c1.x, c1.y, c2.x - c1.x, c2.y - c1.y);
			canvas2DContext.lineWidth = opts.boxWidth || 1;
			canvas2DContext.strokeStyle = opts.boxStroke || "red";
			canvas2DContext.fillStyle = opts.boxFill || "rgba(128,128,255,0.1)";
			canvas2DContext.fill();
			canvas2DContext.stroke();
			canvas2DContext.closePath();
		});

		this.bind("addOverlays", function (e, data) {
			if (!data.zones || data.zones.length === 0 ||
					$.inArray(data.id, _overlaysDrawn) > -1) { return; }

			var i;

			canvas2DContext.beginPath();
			canvas2DContext.fillStyle = opts.overlayFill || "rgba(255,255,0,0.1)";
			for (i = 0; i < data.zones.length; i++) {
				if (!data.zones[i].x) { break; }

				canvas2DContext.rect(
					parseInt(data.zones[i].x * parseFloat(params.s), 10) - params.x + getCenteredX(),
					parseInt(data.zones[i].y * parseFloat(params.s), 10) - params.y,
					parseInt(data.zones[i].w * parseFloat(params.s), 10),
					parseInt(data.zones[i].h * parseFloat(params.s), 10)
				);
			}
			canvas2DContext.fill();
			canvas2DContext.closePath();
			_overlaysDrawn.push(data.id);
		});

		this.bind("dropOverlays", function (e, data) {
			if (!canvasImage || !canvasImage.get(0)) {
				return;
			}
			if (canvasImage.get(0).complete) {
				_self.trigger("redraw");
			} else {
				canvasImage.on("load", function () {
					_self.trigger("redraw");
				});
			}
			_overlaysDrawn.splice(_overlaysDrawn.indexOf(data.id), 1);
		});

		this.bind("save", function (e, scriptPath, fullImage) {
			var p = $.extend(true, {}, params);
			if (fullImage) {
				delete (p.w);
				delete (p.h);
				delete (p.x);
				delete (p.y);
			}
			if (popup) {
				popup.close();
			}
			popup = window.open(scriptPath + "?" + new Date().getTime() + "&" + $.param(normalize(p)));
			return false;
		});

		this.bind("clip", function (e, cc1, cc2) {
			if (opts.onClip) {
				var p = $.extend(true, {}, params);
				p.x = ((cc1.x < cc2.x ? cc1.x : cc2.x)) + p.x - getCenteredX();
				p.y = ((cc1.y < cc2.y ? cc1.y : cc2.y)) + p.y;
				p.w = ((cc1.x < cc2.x ? cc2.x - cc1.x : cc1.x - cc2.x));
				p.h = ((cc1.y < cc2.y ? cc2.y - cc1.y : cc1.y - cc2.y));
				opts.onClip(serviceUrl + "?" + $.param(normalize(p)), normalize(p));
			}

		});

		function _init() {
			loadPreviewImage(function () {
				_self.trigger(initialZoom);
			});
		}

		if (slider) {
			slider.slider({
				max: Math.ceil(maxScale * 100),
				min: Math.ceil(minScale * 100),
				slide: function (e, x) {
					var newScale = x.value / 100.0;
					_self.trigger("scaleBy", [newScale, false, null, true]);
					scaleCanvas(false);
					sliding = true;
					$(this).attr("title", x.value + "%");
				},
				change: function (e, x) {
					if (sliding) {
						loadCanvas();
						sliding = false;
					}
					$(this).attr("title", x.value + "%");
				},
				orientation: "vertical"
			});
		}

		if (opts.highlightsOff) {
			setHighlights(false);
		}

		_init();

		return this;
	};

}(jQuery));


(function ($) {
	$.fn.imageViewerHandlers = function (opts) {
		var lastCursorPos = {x: 0, y: 0},
			storedPos = {x: 0, y: 0},
			dragging = false,
			clipping = false,
			deferDelay = null,
			deferring = false,
			_self = this,
			_availableStates = ["default", "clipping"],
			_state = "default",
			_scrollLock = false;

		function getBox() {
			return {
				y0: $(_self).offset().top - $(window).scrollTop(),
				x0: $(_self).offset().left,
				y1: $(_self).offset().top + $(this).height() - $(window).scrollTop(),
				x1: $(_self).offset().left + $(this).width()
			};
		}

		function deferCommit() {
			var diff = deferDelay - new Date().getTime();
			if (new Date().getTime() < deferDelay) {
				setTimeout(deferCommit, 1);
			} else {
				deferring = false;
				_self.trigger('paint');
			}
		}

		if (opts && opts.mousewheel) {
			this.mousewheel(function (e, which) {
				e.preventDefault();
				if (_scrollLock) {
					if (which < 0) {
						$(this).trigger('moveBy', [{x: 0, y: -30}, false]);
					} else if (which > 0) {
						$(this).trigger('moveBy', [{x: 0, y: 30}, false]);
					}
				} else {
					if (which < 0) {
						$(this).trigger('scaleBy', [0.9, false]);
					} else if (which > 0) {
						$(this).trigger('scaleBy', [1.1, false]);
					}
				}
				deferDelay = new Date().getTime() + 800;
				if (!deferring) {
					deferring = true;
					deferCommit();
				}

				return false;
			});
		}

		this.on("setScrollLock", function (e, lock) {
			_scrollLock = lock;
		});

		this.on("setState", function (e, state) {
			if ($.inArray(state, _availableStates) > -1) {
				_state = state;
				if (_state === 'clipping') {
					$(this).css({cursor: "crosshair"});
				} else {
					$(this).attr("style", "");
				}
			} else {
				_state = "default";
			}
		});

		this.on("mousedown", function (e) {
			if ($(this).hasClass("touchactive")) {
				e.preventDefault();
				e.stopPropagation();
				return false;
			}
			e.preventDefault();
			lastCursorPos = {x: e.clientX, y: e.clientY};

			if (_state === "default") {
				$(this).addClass("dragging-cursor");
				dragging = true;
			} else if (_state === "clipping") {
				clipping = true;
				var box = getBox();
				storedPos = {x: e.clientX - box.x0, y: e.clientY - box.y0};
			}
		}).on("mousemove", function (e) {
			if ($(this).hasClass("touchactive")) {
				e.preventDefault();
				e.stopPropagation();
				return false;
			}

			var movement = {x: e.clientX - lastCursorPos.x, y: e.clientY - lastCursorPos.y},
				box;
			if (dragging) {
				e.preventDefault();
				$(this).trigger('moveBy', [movement, false]);
			} else if (clipping && (movement.x !== 0 || movement.y !== 0)) {
				box = getBox();
				$(this).trigger('drawRect', [storedPos, {x: e.clientX - box.x0, y: e.clientY - box.y0}]);
			}
			lastCursorPos = {x: e.clientX, y: e.clientY};
		}).on("mouseup", function (e) {
			if ($(this).hasClass("touchactive")) {
				e.preventDefault();
				e.stopPropagation();
				return false;
			}
			var movement, box;
			if (dragging) {
				e.preventDefault();
				movement = {x: e.clientX - lastCursorPos.x, y: e.clientY - lastCursorPos.y};
				$(this).trigger('moveBy', [movement, true]);
			} else if (clipping) {
				box = getBox();
				$(this).trigger('clip', [storedPos, {x: e.clientX - box.x0, y: e.clientY - box.y0}]);
			}
			$(this).removeClass("dragging-cursor");
			clipping = false;
			dragging = false;
		}).on("mouseout", function (e) {
			if ($(this).hasClass("touchactive")) {
				e.preventDefault();
				e.stopPropagation();
				return false;
			}
			var box = getBox(),
				movement;
			if (e.clientX < box.x0 || e.clientX > box.x1 || e.clientY < box.y0 || e.clientY > box.y1) {
				e.preventDefault();
				if (dragging) {
					movement = {x: e.clientX - lastCursorPos.x, y: e.clientY - lastCursorPos.y};
					$(this).trigger('moveBy', [movement, true]);
					dragging = false;
					$(this).removeClass("dragging-cursor");
				}
			}
		}).on("click", function (e) {
			if ($(this).hasClass("touchactive")) {
				e.preventDefault();
				e.stopPropagation();
				return false;
			}
		}).on();

		return this;
	};

}(jQuery));

(function ($) {
	$.fn.imageviewerTouchHandlers = function (opts) {
		var _self = this,
			_availableStates = ["default", "clipping"],
			_state = "default",
			lastPos = false,
			touchmap = {
				startPos: false,
				positions: [],
				tapStart: 0,
				lastTap: 0,
				pinchDelta: 0,
				pinchDistance: 0
			};

		function getBox() {
			return {
				y0: $(_self).offset().top - $(window).scrollTop(),
				x0: $(_self).offset().left,
				y1: $(_self).offset().top + $(this).height() - $(window).scrollTop(),
				x1: $(_self).offset().left + $(this).width()
			};
		}

		this.on("setState", function (e, state) {
			if ($.inArray(state, _availableStates) > -1) {
				_state = state;
			} else {
				_state = "default";
			}
		});


		$(this).on("touchstart", function (e) {
			var touches = e.originalEvent.touches,
				box;
			if (touches.length === 1) {
				touchmap.tapStart = new Date().getTime();
				box = getBox();
				touchmap.startPos = {x: touches[0].pageX  - box.x0, y: touches[0].pageY - box.y0};
			}
			$(this).addClass("touchactive");
			e.preventDefault();
			e.stopPropagation();
			return false;
		});

		$(this).on("touchend", function (e) {
			var touches = e.originalEvent.touches,
				box;
			$(this).trigger('moveBy', [{x: 0, y: 0}, true]);
			lastPos = false;
			if (new Date().getTime() - touchmap.lastTap < 400) {
				if (opts.ondoubletap) {
					opts.ondoubletap();
				}
				touchmap.lastTap = 0;
			} else if (new Date().getTime() - touchmap.tapStart < 200) {
				touchmap.lastTap = new Date().getTime();
				touchmap.tapStart = 0;
			}
			if (touches.length === 0) {
				$(this).removeClass("touchactive");
			}

			if (_state === 'clipping' && touchmap.startPos) {
				box = getBox();
				$(this).trigger('clip', [touchmap.startPos, {
					x: touchmap.positions[0].x - box.x0,
					y: touchmap.positions[0].y - box.y0
				}]);
			}

			touchmap.startPos = false;
			e.preventDefault();
			e.stopPropagation();
			return false;
		});

		$(this).on("touchmove", function (e) {
			e.preventDefault();
			var touches = e.originalEvent.touches,
				i,
				cur,
				oldD,
				sHeur,
				movement,
				box;

			for (i = 0; i < touches.length; i++) {
				cur = {x: touches[i].pageX, y: touches[i].pageY};
				touchmap.positions[i] = cur;
			}

			if (_state === 'default') {
				if (touches.length === 2) {
					oldD = touchmap.pinchDistance;
					touchmap.pinchDistance = parseInt(Math.sqrt(
						(
							(touchmap.positions[0].x - touchmap.positions[1].x) *
							(touchmap.positions[0].x - touchmap.positions[1].x)
						) + (
							(touchmap.positions[0].y - touchmap.positions[1].y) *
							(touchmap.positions[0].y - touchmap.positions[1].y)
						)
					), 10);
					touchmap.pinchDelta = oldD - touchmap.pinchDistance;
					if (touchmap.pinchDelta < 20 && touchmap.pinchDelta > -20) {
						sHeur = 1.0 - (touchmap.pinchDelta * 0.01);
						$(this).trigger('scaleBy', [sHeur, false]);
					}
				} else if (touches.length === 1) {
					if (lastPos !== false) {
						movement = {
							x: touchmap.positions[0].x - lastPos.x,
							y: touchmap.positions[0].y - lastPos.y
						};
						$(this).trigger('moveBy', [movement, false]);
					}
					lastPos = {x: touchmap.positions[0].x, y: touchmap.positions[0].y};
				}
			} else if (_state === 'clipping' && touchmap.startPos) {
				box = getBox();
				$(this).trigger('drawRect', [touchmap.startPos, {
					x: touchmap.positions[0].x - box.x0,
					y: touchmap.positions[0].y - box.y0
				}]);
			}
			e.preventDefault();
			e.stopPropagation();
			return false;
		});
		return this;
	};
}(jQuery));


(function ($) {

	$.fn.minimap = function (scale, height, options) {
		var opts = options || {},
			_self = this,
			viewerLayer = $("<canvas>")
				.attr("width", $(this).width())
				.attr("height", $(this).height()),
			dragging,
			pos;

		_self.css({height: height});

		if (opts.onload) {
			opts.onload($(this).height());
		}

		if (opts.image) {
			_self.css({
				backgroundImage: "url(" + opts.image + ")"
			});
		}

		this.append(viewerLayer);
		this.bind("repositionViewerZone", function (e, box) {
			var y = box.y * scale,
				x = box.x * scale,
				w = box.w * scale -
					(box.x * scale + box.w * scale > _self.width() ?
								box.x * scale + box.w * scale - _self.width() : 0),
				h = box.h * scale -
					(box.y * scale + box.h * scale > _self.height() ?
								box.y * scale + box.h * scale - _self.height() : 0),
				ctx = viewerLayer[0].getContext('2d');

			ctx.clearRect(0, 0, viewerLayer[0].width, viewerLayer[0].height);
			ctx.beginPath();
			ctx.strokeStyle = (opts.color || "black");
			ctx.rect(x, y, w, h);
			ctx.stroke();
		});

		function moveBy(movement) {
			return {x: -movement.x / scale, y: -movement.y / scale};
		}


		if (opts.interactive && opts.canvas) {
			dragging = false;
			pos = {x: 0, y: 0};

			viewerLayer.on("mousedown", function (e) {
				e.preventDefault();
				dragging = true;
				pos = {x: e.pageX, y: e.pageY};

				if (opts.ondown) {
					opts.ondown({
						x: (pos.x - $(this).offset().left - 5) / scale,
						y: (pos.y - $(this).offset().top - 5) / scale
					});
				}
			});

			viewerLayer.on("mouseup", function (e) {
				dragging = false;
				var movement = {x: e.pageX - pos.x, y: e.pageY - pos.y},
					canvasMovement = moveBy(movement);
				if (opts.onup) {
					opts.onup(canvasMovement);
				}
			});

			viewerLayer.on("mouseout", function (e) {
				if (dragging) {
					dragging = false;
					var movement = {x: e.pageX - pos.x, y: e.pageY - pos.y},
						canvasMovement = moveBy(movement);
					if (opts.onup) {
						opts.onup(canvasMovement);
					}
				}
			});

			viewerLayer.on("mousemove", function (e) {
				if (dragging) {
					var movement = {x: e.pageX - pos.x, y: e.pageY - pos.y},
						canvasMovement = moveBy(movement);
					pos = {x: e.pageX, y: e.pageY};
					if (opts.onmove) {
						opts.onmove(canvasMovement);
					}
				}
			});

		}

		return this;
	};
}(jQuery));
