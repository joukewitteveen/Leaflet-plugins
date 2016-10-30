/*
 * The terms and conditions of the Simplified BSD License apply to this source code.
 * Copyright (c) 2016, Jouke Witteveen
 */

L.Control.Distance = L.Control.extend({
	options: {
		updateWhileDragging: true,
		iconClass: 'fa fa-arrows-h',
		position: 'bottomleft',
		strings: {
			measureDistance: 'Measure distance',
			totalDistance: 'Total distance',
			clickToDraw: 'Click on the map to trace a path you want to measure',
			clickToRemove: 'Click to remove'
		}
	},

	onAdd: function (map) {
		var container = L.DomUtil.create('div', 'leaflet-control-distance leaflet-bar'),
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
		L.DomEvent.on(container, 'dblclick wheel', L.DomEvent.stopPropagation);
		L.DomEvent.on(link, 'click', L.DomEvent.stop);
		L.DomEvent.on(link, 'click', this._toggle, this);
		return container;
	},

	onRemove: function (map) {
		this._disable();
	},

	updateDistance: function () {
		if (!this._points.length) {
			this._distance.textContent = this.options.strings.clickToDraw;
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
		this._layers.addTo(this._map);
		this._layers.addLayer(this._path);
		this._map.on('click', this._addPoint, this);
		L.DomUtil.addClass(this._map.getContainer(), 'leaflet-crosshair leaflet-drag');
		L.DomUtil.addClass(this.getContainer(), 'distance-active');
		this.updateDistance();
		this._active = true;
	},

	_disable: function () {
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
		this._distance.textContent = '';
		this._active = false;
	},

	_toggle: function () {
		if (this._active) this._disable();
		else this._enable();
	},

	_addPoint: function (e) {
		if (!e.latlng) return;
		var point = L.circleMarker.draggable(e.latlng, {
			radius: 4,
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
		this.updateDistance();
	},

	_deletePoint: function (e) {
		if (e.target.moved) return;
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
		this._points[0].setStyle({ radius: 3, fillColor: 'black' });
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
	}
});

L.control.distance = function (options) {
	return new L.Control.Distance(options);
};


L.CircleMarker.Draggable = L.CircleMarker.extend({
	_dragStart: function (e) {
		this.moved = false;
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
		this.moved = true;
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
	if (this.options.tooltip && typeof this.moved === 'undefined')
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
