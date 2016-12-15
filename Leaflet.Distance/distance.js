/*
 * The terms and conditions of the Simplified BSD License apply to this source code.
 * Copyright (c) 2016, Jouke Witteveen
 */

L.Control.Distance = L.Control.extend({
	options: {
		// Redraw when a track point is being dragged
		updateWhileDragging: true,

		// Size of the circle markers defining the path
		pointRadius: L.Browser.mobile && L.Browser.touch ? 10 : 4,

		// Reflect the path in the URL
		useHash: true,

		// Class name for the button on the map
		iconClass: 'fa fa-arrows-h',

		// Position of the control
		position: 'bottomleft',

		// Internationalization
		strings: {
			measureDistance: 'Measure distance',
			totalDistance: 'Total distance',
			clickToDraw: 'Click on the map to trace a path you want to measure',
			clickToRemove: 'Click to remove'
		}
	},

	onAdd: function (map) {
		var container = this._container = L.DomUtil.create('div', 'leaflet-control-distance leaflet-bar'),
		    link = L.DomUtil.create('a', 'distance-button', container);
		link.href = '#';
		link.title = this.options.strings.measureDistance;
		L.DomUtil.create('span', this.options.iconClass, link);
		this._distance = L.DomUtil.create('span', 'distance-measurement', container);
		this._layers = L.layerGroup();
		this._points = [];
		this._path = L.polyline([], {
			color: 'black',
			weight: '2',
			className: 'distance-path',
			interactive: false,
			pane: 'markerPane'
		});
		this._markers = [];
		L.DomEvent.disableClickPropagation(container)
		          .disableScrollPropagation(container)
		          .on(link, 'click', L.DomEvent.stop)
		          .on(link, 'click', this._toggle, this);
		if (this.options.useHash) {
			this._updateHash = L.Util.throttle(this._writeHash, 1000, this);
			L.DomEvent.on(window, 'hashchange', this._readHash, this);
			this._readHash();
		} else this._updateHash = function () {};
		return container;
	},

	onRemove: function (map) {
		this._disable();
	},

	// Set the correct text on the control and update the markers along the path
	updateDistance: function () {
		this._updateHash();
		if (!this._points.length) {
			this._distance.textContent = this._active ? this.options.strings.clickToDraw : '';
			return;
		}
		var latlngs = this._path.getLatLngs(),
		    distances = this._accumulatedDistances(latlngs),
		    distance = distances[distances.length - 1],
		    distanceText;
		if (distance < 1)
			distanceText = (distance * 1000).toFixed() + ' m';
		else
			distanceText = distance.toFixed(distance < 10 ? 2 : distance < 100 ? 1 : 0) + ' km';
		this._distance.textContent = this.options.strings.totalDistance + ': ' + distanceText;
		this._updateMarkers(
			distance <=  20 ?  1 :
			distance <=  50 ?  2 :
			distance <= 100 ?  5 :
			distance <= 200 ? 10 :
			distance <= 500 ? 20 :
			                  50,
			latlngs, distances
		);
	},

	_enable: function () {
		if (this.options.useHash) L.DomEvent.off(window, 'hashchange', this._readHash, this);
		this._layers.addTo(this._map);
		this._layers.addLayer(this._path);
		this._path.bringToBack();
		this._map.on('click', this._addPoint, this);
		L.DomUtil.addClass(this._map.getContainer(), 'leaflet-crosshair leaflet-drag');
		L.DomUtil.addClass(this.getContainer(), 'distance-active');
		this._active = true;
		this.updateDistance();
	},

	_disable: function () {
		if (this.options.useHash) L.DomEvent.on(window, 'hashchange', this._readHash, this);
		this._map.off('click', this._addPoint, this);
		this._layers.remove();
		L.DomUtil.removeClass(this._map.getContainer(), 'leaflet-crosshair');
		if (!this._map.options.dragging)
			L.DomUtil.removeClass(this._map.getContainer(), 'leaflet-drag');
		L.DomUtil.removeClass(this.getContainer(), 'distance-active');
		this._layers.clearLayers();
		this._points = [];
		this._path.setLatLngs([]);
		this._markers = [];
		this._active = false;
		this.updateDistance();
	},

	_toggle: function () {
		if (this._active) this._disable();
		else this._enable();
	},

	_addPoint: function (e) {
		if (!e.latlng) return;
		var point = L.circleMarker.draggable(e.latlng, {
			radius: this.options.pointRadius,
			weight: 2,
			color: 'black',
			fillColor: 'white',
			fillOpacity: 1,
			className: 'distance-point',
			tooltip: this.options.strings.clickToRemove,
			pane: 'markerPane'
		})
			.on('click', this._deletePoint, this)
			.on('click', L.DomEvent.stopPropagation)
			.on('dragend', this._updatePath, this);
		if (this.options.updateWhileDragging)
			point.on('drag', this._updatePath, this);
		this._points.push(point);
		this._layers.addLayer(point);
		this._path.addLatLng(e.latlng);
		if (e.type !== 'import') this.updateDistance();
	},

	_deletePoint: function (e) {
		if (e.target._moved) return;
		for (var i = 0; i < this._points.length; i++) {
			if (this._points[i] === e.target) {
				this._layers.removeLayer(e.target);
				this._points.splice(i, 1);
				this._updatePath();
				break;
			}
		}
	},

	_updateMarkers: function (spacing, latlngs, distances) {
		var marker, fromEnd, latlng;
		this._points[0].setStyle({
			radius: .75 * this.options.pointRadius,
			fillColor: 'black'
		});
		while (marker = this._markers.pop())
			this._layers.removeLayer(marker);
		for (var i = 1, next = spacing, j, begin, end, step; i < distances.length; i++) {
			while (distances[i] > next) {
				if (j !== i) {
					begin = this._map.latLngToLayerPoint(latlngs[i - 1]);
					end = this._map.latLngToLayerPoint(latlngs[i]);
					step = end.subtract(begin);
					j = i;
				}
				fromEnd = (distances[i] - next) / (distances[i] - distances[i - 1]);
				latlng = this._map.layerPointToLatLng(end.subtract(step.multiplyBy(fromEnd)));
				marker = L.marker.distance(latlng, {
					html: next.toFixed(),
					className: 'distance-marker'
				});
				this._markers.push(marker);
				this._layers.addLayer(marker);
				next += spacing;
			}
		}
	},

	_updatePath: function () {
		var latlngs = [];
		for (var i = 0; i < this._points.length; i++) {
			latlngs.push(this._points[i].getLatLng());
		}
		this._path.setLatLngs(latlngs);
		this.updateDistance();
	},

	_accumulatedDistances: function (latlngs) {
		var total = 0,
		    distances = [0];
		for (var i = 0, n = latlngs.length - 1; i < n; i++) {
			total += latlngs[i].distanceTo(latlngs[i + 1]) / 1000;
			distances.push(total);
		}
		return distances;
	},

	_importPath: function (hash) {
		var w = 4, res = Base64.resolution(w) - 1;
		if (!Base64.test(hash, 2 * w)) return false;
		this._points = [];
		for (var i = 0, lat, lng; i < hash.length; i += 2 * w) {
			lat = Base64.toInt(hash.substr(i, w)) / res * 180 - 90;
			lng = Base64.toInt(hash.substr(i + w, w)) / res * 360 - 180;
			this._addPoint({
				type: 'import',
				target: this,
				latlng: new L.LatLng(lat, lng)
			});
		}
		return true;
	},

	_exportPath: function () {
		var w = 4, res = Base64.resolution(w) - 1, hash = '';
		for (var i = 0, latlng; i < this._points.length; i++) {
			latlng = this._points[i].getLatLng();
			hash += Base64.fromInt(Math.round((latlng.lat + 90) / 180 * res), w)
			        + Base64.fromInt(Math.round((latlng.lng + 180) / 360 * res), w);
		}
		return hash;
	},

	_readHash: function () {
		var hash = /[#&]path=([^&]*)/.exec(location.hash);
		if (hash) if (this._importPath(hash[1])) this._enable();
	},

	_writeHash: function () {
		var hash = location.hash.replace(/[#&]path=[^&]*/, '');
		if (this._active) hash += '&path=' + this._exportPath();
		window.history.replaceState(window.history.state, document.title, '#' + hash.substr(1));
	}
});

L.control.distance = function (options) {
	return new L.Control.Distance(options);
};


L.CircleMarker.Draggable = L.CircleMarker.extend({
	_dragStart: function (e) {
		this._moved = false;
		this._map
			.on('mousemove', this._drag, this)
			.once('mouseup', this._dragEnd, this);
		this._map.dragging.disable();
		L.DomUtil.addClass(this._map.getContainer(), 'leaflet-grab');
		L.DomUtil.addClass(document.body, 'leaflet-dragging');
		this.unbindTooltip();
		this.fire('dragstart', e);
	},

	_drag: function (e) {
		this.setLatLng(e.latlng);
		this._moved = true;
		L.DomEvent.preventDefault(e);
		this.fire('drag');
	},

	_dragEnd: function (e) {
		this._map
			.off('mousemove', this._drag, this);
		L.DomUtil.removeClass(document.body, 'leaflet-dragging');
		if (this._map.options.dragging)
			this._map.dragging.enable();
		else
			L.DomUtil.removeClass(map.getContainer(), 'leaflet-grab');
		if (this.options.tooltip)
			this.bindTooltip(this.options.tooltip);
		this.fire('dragend', e);
	}
});
L.CircleMarker.Draggable.addInitHook('on', 'mousedown', L.CircleMarker.Draggable.prototype._dragStart);
L.CircleMarker.Draggable.addInitHook('once', 'mouseout', function () {
	if (this.options.tooltip && typeof this._moved === 'undefined')
		this.bindTooltip(this.options.tooltip);
});

L.circleMarker.draggable = function (latlng, options) {
	return new L.CircleMarker.Draggable (latlng, options);
}


L.Marker.Distance = L.Marker.extend({
	initialize: function (latlng, options) {
		L.Marker.prototype.initialize.call(this, latlng, {
			icon: L.divIcon(L.extend({ iconSize: null }, options)),
			keyboard: false,
			interactive: false
		});
	},

	onAdd: function (map) {
		L.Marker.prototype.onAdd.call(this, map);
		this._icon.style.zIndex = L.DomUtil.getStyle(this.getPane(), 'z-index');
	},

	_updateZIndex: function () {}
});

L.marker.distance = function (latlng, options) {
	return new L.Marker.Distance(latlng, options);
};


Base64 = (function () {
	var chars =
	//   0       8       16      24      32      40      48      56     63
	//   v       v       v       v       v       v       v       v      v
	    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789~_",
	    values = {};
	for (var i = 0; i < chars.length; i++) {
		values[chars[i]] = i;
	}
	return {
		resolution: function (w) {
			return 1 << (6 * w);
		},

		test: function (s, w) {
			if (!w) w = 1;
			return new RegExp('^(?:[' + chars + ']{' + w + '})*$').test(s);
		},

		fromInt: function (n, w) {
			var s = '';
			while (w--) {
				s = chars[n & 0x3f] + s;
				n >>>= 6;
			}
			return s;
		},

		toInt: function (s) {
			var n = 0, s = s.split('');
			for (var i = 0; i < s.length; i++)
				n = (n << 6) + values[s[i]];
			return n;
		}
	};
})();
