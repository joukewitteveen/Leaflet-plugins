# Leaflet Distance Measurement

A control for measuring distance along a path.


## Usage
Check out the [demo](https://joukewitteveen.github.io/Leaflet-plugins/Leaflet.Distance/).


## Features
- Adaptive distance indicators along the measurement path
- Deletable and moveable points
- Translation friendly


## Requirements
- Leaflet 1.0
- Font Awesome (or any other means of providing an icon)


## Options
- `updateWhileDragging` (Boolean):
  If set to true, the path will be updated continuously while a point is being
  dragged. This may be demanding of the CPU. Defaults to `true`.
- `iconClass` (String):
  The class given to the span representing the control icon. Provision of the
  actual icon is left to CSS. Defaults to `fa fa-arrows-h`.
- `position` (String):
  Inherited from the control class. Determines where to put the control. When
  the control is added to the map directly before the default scale control, it
  is placed next to it. Defaults to `bottomleft`.
- `strings` (Object): The text used by the control, open for translation.
  Defaults to
```
{
	measureDistance: 'Measure distance',
	totalDistance: 'Total distance',
	clickToDraw: 'Click on the map to trace a path you want to measure',
	clickToRemove: 'Click to remove'
}
```
