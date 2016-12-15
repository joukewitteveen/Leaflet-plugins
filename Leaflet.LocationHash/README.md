# Leaflet Fragment Identifier Support

A class that has the URL fragment identifier (hash) reflect the map view.


## Usage
Check out the [demo](https://joukewitteveen.github.io/Leaflet-plugins/Leaflet.Distance/).

Using `L.locationHash(map);` elementary support is enabled.

Using `L.locationHash(L.control.layers(...).addTo(map));`, support for
layers and overlays is added. For this to work correctly, every layer and
overlay should have the `hashCode` option set to a unique string
identifying the layer. For popup support, layers should implement an
`eachPopup` function and emit `popupnew` events when popups are added to
the layer.


## Features
The following settings will get reflected in the hash
- Zoom level and map center (either by coordinates or popup `name`)
- Selected base layer
- Selected overlays
- Opened popups (by their `name` option)


## Requirements
- Leaflet 1.0


## Options
There are no options.
