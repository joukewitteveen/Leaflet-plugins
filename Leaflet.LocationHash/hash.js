/*
 * The terms and conditions of the Simplified BSD License apply to this source code.
 * Copyright (c) 2016, Jouke Witteveen
 */

/*
 * Usage:
 *   L.locationHash(map);
 * or
 *   L.locationHash(L.control.layers(...).addTo(map));
 */

L.LocationHash = L.Class.extend({
	initialize: function (control) {
		if (control instanceof L.Map) {
			this._map = control;
			this._layers = [];
		} else {
			this._map = control._map;
			this._layers = control._layers;
		}
		var layers = this._getLayers();
		this._defaultLayers = layers.base;
		this._defaultOverlays = layers.overlays;
		this._popupsPending = [];
		this._on();
		// Fix for https://github.com/Leaflet/Leaflet/pull/5098
		this._map.on('popupclose', function (e) { e.popup.once('remove', this.updateHashMap, this); }, this);
		L.DomEvent.on(window, 'hashchange', this.hashUpdated, this);
		if (location.hash) this.hashUpdated();
	},

	// Process the fragment identifier and update the map view
	hashUpdated: function () {
		this._off();
		function split(str, sep) { return str.split(sep).filter(Boolean); }
		var state = this._parseHash(),
		    map = 'map' in state ? split(state.map, '/') : [],
		    layers = split('layers' in state ? state.layers : this._defaultLayers, ''),
		    overlays = split('overlays' in state ? state.overlays : this._defaultOverlays, ','),
		    popups = 'popups' in state ? split(state.popups, ',').map(decodeURIComponent) : [],
		    center, zoom;
		switch (map.length) {
		case 1:
			zoom = parseInt(map[0], 10);
			center = null;
			break;
		case 2:
			zoom = parseInt(map[0], 10);
			var name = decodeURIComponent(map[1]), popup = this._findPopup(name);
			center = popup ? popup._source.getLatLng() : null;
			popups.push(name);
			break;
		case 3:
			zoom = parseInt(map[0], 10);
			var lat = parseFloat(map[1]), lng = parseFloat(map[2]);
			if (!isNaN(lat) && !isNaN(lng))
				center = new L.LatLng(lat, lng);
			break;
		}

		if (center) this._map.setView(center, zoom);
		else if (!isNaN(zoom) && center !== undefined)
			this._map.setZoom(zoom, { animate: false });

		for (var i = 0, hashCode; i < this._layers.length; i++) {
			hashCode = this._layers[i].layer.options.hashCode;
			if (!hashCode) continue;
			if (L.Util.indexOf(this._layers[i].overlay ? overlays : layers, hashCode) === -1)
				this._layers[i].layer.removeFrom(this._map);
			else
				this._layers[i].layer.addTo(this._map);
		}

		this._popupsPending = [];
		for (var i = 0, popup; i < popups.length; i++) {
			popup = this._findPopup(popups[i]);
			if (popup) popup._source.openPopup();
			else this._popupsPending.push(popups[i]);
		}

		this._on();
	},

	// Update the "layers" and "overlays" components of the fragment identifier
	updateHashLayers: function () {
		var state = this._parseHash(), layers = this._getLayers();
		if (layers.base === this._defaultLayers) delete state.layers;
		else state.layers = layers.base;
		if (layers.overlays === this._defaultOverlays) delete state.overlays;
		else state.overlays = layers.overlays;
		this._setHash(state);
	},

	// Update the "map" and "popups" components of the fragment identifier
	updateHashMap: function (e) {
		var state = this._parseHash(),
		    zoom = Math.floor(this._map.getZoom()),
		    popups = [],
		    popupName = e.popup && e.popup.isOpen() && e.popup.options.name;
		if (popupName && !this._findPopup(popupName)) popupName = null;

		state.map = zoom + '/';
		if (popupName)
			state.map += encodeURIComponent(popupName);
		else {
			var center = this._map.getCenter(),
			    precision = Math.max(0, Math.ceil(Math.log(zoom) * Math.LOG2E));
			state.map += center.lat.toFixed(precision) + '/' + center.lng.toFixed(precision);
		}

		this._eachPopup(function (popup) {
			var name = popup.options.name;
			if (name && name !== popupName && popup.isOpen()) popups.push(name);
		});
		if (popups.length) state.popups = popups.map(encodeURIComponent).join(',');
		else delete state.popups;

		this._setHash(state);
	},

	_on: function () {
		for (var i = 0; i < this._layers.length; i++)
			this._layers[i].layer.on('popupnew', this._newPopup, this);
		this._map.on('baselayerchange overlayadd overlayremove popupopen popupclose',
		             this._clearPopupsPending, this)
		         .on('baselayerchange overlayadd overlayremove', this.updateHashLayers, this)
		         .on('zoomend moveend popupopen popupclose', this.updateHashMap, this);
	},

	_off: function () {
		for (var i = 0; i < this._layers.length; i++)
			this._layers[i].layer.off('popupnew', this._newPopup, this);
		this._map.off('baselayerchange overlayadd overlayremove popupopen popupclose',
		              this._clearPopupsPending, this)
		         .off('baselayerchange overlayadd overlayremove', this.updateHashLayers, this)
		         .off('zoomend moveend popupopen popupclose', this.updateHashMap, this);
	},

	_getLayers: function () {
		var layers = { base: '', overlays: '' };
		for (var i = 0, hashCode; i < this._layers.length; i++) {
			hashCode = this._layers[i].layer.options.hashCode;
			if (hashCode && this._map.hasLayer(this._layers[i].layer)) {
				if (this._layers[i].overlay) layers.overlays += ',' + hashCode;
				else layers.base += hashCode;
			}
		}
		layers.overlays = layers.overlays.slice(1);
		return layers;
	},

	_newPopup: function (e) {
		var i = L.Util.indexOf(this._popupsPending, e.popup.options.name);
		if (i === -1) return;
		this._map.panTo(e.popup._source.getLatLng());
		e.popup._source.openPopup();
		this._popupsPending.splice(i, 1);
		this.updateHashMap(e);
	},

	_findPopup: function (name) {
		var found;
		this._eachPopup(function (popup) {
			if (popup.options.name === name) found = popup;
		});
		return found;
	},

	_eachPopup: function (cb) {
		function delegate(layer) {
			if (typeof layer.eachPopup === 'function')
				layer.eachPopup(cb);
			else if (layer instanceof L.FeatureGroup)
				layer.eachLayer(delegate);
		}
		for (var i = 0; i < this._layers.length; i++) delegate(this._layers[i].layer);
	},

	_clearPopupsPending: function () {
		this._popupsPending = [];
	},

	_parseHash: function () {
		var hash = location.hash.slice(1), state = {};
		if (hash)
			for (var kv = hash.split('&').filter(Boolean), i = 0, j; i < kv.length; i++) {
				j = L.Util.indexOf(kv[i], '=');
				if (j === -1) state[kv[i]] = null;
				else state[kv[i].slice(0, j)] = kv[i].slice(j + 1);
			}
		return state;
	},

	_setHash: function (state) {
		var keys = this._stateKeysOrdered(state), hash = '';
		for (var i = 0; i < keys.length; i++) {
			hash += '&' + keys[i];
			if (typeof state[keys[i]] === 'string')
				hash += '=' + state[keys[i]];
		}
		window.history.replaceState(state, document.title, '#' + hash.slice(1));
	},

	_stateKeysOrdered: function (state) {
		var order = ['map', 'layers', 'overlays', 'popups'],
		    keys = [];
		for (var i = 0; i < order.length; i++)
			if (order[i] in state) keys.push(order[i]);
		for (var key in state)
			if (L.Util.indexOf(order, key) === -1) keys.push(key);
		return keys;
	}
});

L.locationHash = function (control) {
	return new L.LocationHash(control);
};
