import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import type { DeliveryStop, Parcel, RouteGeometry } from '../../api/logistics-api';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

type RouteMapProps = {
  stops: DeliveryStop[];
  parcels: Parcel[];
  geometry?: RouteGeometry | null;
  distanceMeters?: number | null;
  durationSeconds?: number | null;
  routeStatus?: 'ready' | 'insufficient_stops' | 'no_route' | null;
  geometryLoading?: boolean;
  geometryError?: string | null;
};

const DEFAULT_CENTER: [number, number] = [24.9384, 60.1699];
maplibregl.setWorkerUrl(workerUrl);
const DEFAULT_ZOOM = 11;
const ROAD_SOURCE_ID = 'delivery-road-route';
const ROAD_LAYER_ID = 'delivery-road-route-line';

const MAP_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster' as const,
      source: 'osm',
    },
  ],
};

function validPosition(lon: number, lat: number): boolean {
  return Number.isFinite(lon) && Number.isFinite(lat) &&
    lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90;
}

function isValidGeometry(geometry: RouteGeometry | null | undefined): geometry is RouteGeometry {
  return geometry?.type === 'LineString' &&
    Array.isArray(geometry.coordinates) &&
    geometry.coordinates.length >= 2 &&
    geometry.coordinates.every((point) =>
      Array.isArray(point) && point.length >= 2 && validPosition(point[0], point[1]),
    );
}

export function RouteMap({
  stops,
  parcels,
  geometry = null,
  distanceMeters = null,
  durationSeconds = null,
  routeStatus = null,
  geometryLoading = false,
  geometryError = null,
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Keep the road overlay separate from marker lifecycle. MapLibre loads styles
  // asynchronously, so the source must be added after the style is ready.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof map.isStyleLoaded !== 'function') return;

    const updateRoad = () => {
      if (!isValidGeometry(geometry)) {
        if (map.getLayer(ROAD_LAYER_ID)) map.removeLayer(ROAD_LAYER_ID);
        if (map.getSource(ROAD_SOURCE_ID)) map.removeSource(ROAD_SOURCE_ID);
        return;
      }

      const data = {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: geometry.coordinates,
        },
      };

      const source = map.getSource(ROAD_SOURCE_ID) as GeoJSONSource | undefined;
      if (source) {
        source.setData(data);
      } else {
        map.addSource(ROAD_SOURCE_ID, { type: 'geojson', data });
      }

      if (!map.getLayer(ROAD_LAYER_ID)) {
        map.addLayer({
          id: ROAD_LAYER_ID,
          type: 'line',
          source: ROAD_SOURCE_ID,
          paint: {
            'line-color': '#0f766e',
            'line-width': 5,
            'line-opacity': 0.9,
          },
          layout: { 'line-cap': 'round', 'line-join': 'round' },
        });
      }
    };

    // Geometry often arrives AFTER the map's initial `load` event.
    // `isStyleLoaded()` may still be false while raster tiles are loading,
    // even though a map is visible. The subsequent `idle` event handles
    // that case; `once` avoids a loop from setData() triggering more events.
    if (map.isStyleLoaded()) {
      updateRoad();
    } else {
      map.once('load', updateRoad);
      map.once('idle', updateRoad);
    }

    return () => {
      map.off('load', updateRoad);
      map.off('idle', updateRoad);
    };
  }, [geometry]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markers: maplibregl.Marker[] = [];
    const validStops = stops.filter((stop) => validPosition(stop.longitude, stop.latitude));

    for (const stop of validStops) {
      const markerElement = document.createElement('div');
      markerElement.className =
        'flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-teal-600 text-xs font-bold text-white shadow-md';
      markerElement.textContent = String(stop.sequence);

      const parcelCount = parcels.filter((parcel) => parcel.stopId === stop.id).length;
      const popupContent = document.createElement('div');
      const heading = document.createElement('strong');
      heading.textContent = `Stop ${stop.sequence}`;
      const location = document.createElement('p');
      location.textContent = stop.locationKey;
      const count = document.createElement('p');
      count.textContent = `${parcelCount} parcel${parcelCount === 1 ? '' : 's'}`;
      popupContent.append(heading, location, count);

      const popup = new maplibregl.Popup({ offset: 20 }).setDOMContent(popupContent);
      const marker = new maplibregl.Marker({ element: markerElement })
        .setLngLat([stop.longitude, stop.latitude])
        .setPopup(popup)
        .addTo(map);
      markers.push(marker);
    }

    if (validStops.length === 1) {
      const stop = validStops[0];
      map.flyTo({ center: [stop.longitude, stop.latitude], zoom: 14 });
    } else if (validStops.length > 1) {
      const bounds = new maplibregl.LngLatBounds();
      for (const stop of validStops) bounds.extend([stop.longitude, stop.latitude]);
      map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
    } else {
      map.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
    }

    return () => {
      for (const marker of markers) marker.remove();
    };
  }, [stops, parcels]);

  const distanceLabel = distanceMeters === null ? null : `${(distanceMeters / 1000).toFixed(2)} km`;
  const durationLabel = durationSeconds === null ? null : `${Math.round(durationSeconds / 60)} min`;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="font-bold text-[#14243b]">Route Map</h3>
        <p className="mt-1 text-xs text-slate-500">Interactive map of delivery stops</p>
      </div>

      <div className="relative">
        <div ref={containerRef} aria-label="Delivery route map" className="h-96 w-full" />
        {stops.length === 0 && (
          <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
            No stops available for this route.
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
        <p>{stops.length} delivery stop{stops.length === 1 ? '' : 's'}</p>
        {geometryLoading && <p role="status" className="mt-1">Calculating driving route...</p>}
        {geometryError && (
          <p role="alert" className="mt-1 text-red-700">Unable to load driving route: {geometryError}</p>
        )}
        {!geometryLoading && !geometryError && routeStatus === 'insufficient_stops' && (
          <p className="mt-1">Add at least two stops to display a driving route.</p>
        )}
        {!geometryLoading && !geometryError && routeStatus === 'no_route' && (
          <p className="mt-1">No drivable route found for these stops.</p>
        )}
        {!geometryLoading && !geometryError && routeStatus === 'ready' && distanceLabel && durationLabel && (
          <p className="mt-1">Driving route: {distanceLabel} · approx. {durationLabel} (no live traffic)</p>
        )}
      </div>
    </section>
  );
}
