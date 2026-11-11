import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

import type { DeliveryStop, Parcel, RouteGeometry } from '../../api/logistics-api';

import type { SimulationSnapshot } from '../../hooks/useLiveSimulation';
import { useDeliveryStopMarkers } from './useDeliveryStopMarkers';
import { useRoadGeometry } from './useRoadGeometry';

type RouteMapProps = {
  stops: DeliveryStop[];
  parcels: Parcel[];
  geometry?: RouteGeometry | null;
  distanceMeters?: number | null;
  durationSeconds?: number | null;
  routeStatus?: 'ready' | 'insufficient_stops' | 'no_route' | null;
  geometryLoading?: boolean;
  geometryError?: string | null;
  vehicle?: SimulationSnapshot | null;
  liveConnectionStatus?: 'disconnected' | 'connecting' | 'connected';
  liveSimulationError?: string | null;
};

type Position = [longitude: number, latitude: number];

const DEFAULT_CENTER: Position = [24.9384, 60.1699];
const DEFAULT_ZOOM = 11;

const ANIMATION_DURATION_MS = 900;
const MAX_ANIMATION_DISTANCE_METERS = 100;

maplibregl.setWorkerUrl(workerUrl);

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
  return (
    Number.isFinite(lon) &&
    Number.isFinite(lat) &&
    lon >= -180 &&
    lon <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

function interpolatePosition(from: Position, to: Position, progress: number): Position {
  return [from[0] + (to[0] - from[0]) * progress, from[1] + (to[1] - from[1]) * progress];
}

function distanceBetweenMeters(from: Position, to: Position): number {
  const toRadians = Math.PI / 180;
  const latitude1 = from[1] * toRadians;
  const latitude2 = to[1] * toRadians;

  const latitudeDelta = (to[1] - from[1]) * toRadians;
  const longitudeDelta = (to[0] - from[0]) * toRadians;

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(a)));
}

function createVehicleMarkerElement(): HTMLDivElement {
  const element = document.createElement('div');

  element.className =
    'flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-[#17263d] text-xl text-white shadow-lg';

  element.textContent = '🚚';
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', 'Live delivery vehicle');

  return element;
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
  vehicle = null,
  liveConnectionStatus = 'disconnected',
  liveSimulationError = null,
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  const vehicleMarkerRef = useRef<maplibregl.Marker | null>(null);
  const displayedPositionRef = useRef<Position | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const stopAnimation = () => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

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
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      vehicleMarkerRef.current?.remove();
      vehicleMarkerRef.current = null;
      displayedPositionRef.current = null;

      map.remove();
      mapRef.current = null;
    };
  }, []);

  // OSRM road geometry overlay is managed by a dedicated hook.
  useRoadGeometry(mapRef, geometry);

  // Delivery-stop markers and map framing use an existing hook.
  useDeliveryStopMarkers(mapRef, stops, parcels);

  // Smooth vehicle movement between incoming GPS positions.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!vehicle || !validPosition(vehicle.longitude, vehicle.latitude)) {
      stopAnimation();

      vehicleMarkerRef.current?.remove();
      vehicleMarkerRef.current = null;
      displayedPositionRef.current = null;
      return;
    }

    const destination: Position = [vehicle.longitude, vehicle.latitude];

    if (!vehicleMarkerRef.current) {
      const markerElement = createVehicleMarkerElement();

      vehicleMarkerRef.current = new maplibregl.Marker({
        element: markerElement,
        anchor: 'center',
      })
        .setLngLat(destination)
        .addTo(map);

      displayedPositionRef.current = destination;
      return;
    }

    stopAnimation();

    const startPosition = displayedPositionRef.current;

    const moveImmediately = () => {
      vehicleMarkerRef.current?.setLngLat(destination);
      displayedPositionRef.current = destination;
    };

    if (!startPosition) {
      moveImmediately();
      return;
    }

    const distance = distanceBetweenMeters(startPosition, destination);

    // Non-running simulations and large jumps snap immediately.
    if (
      vehicle.status !== 'running' ||
      distance > MAX_ANIMATION_DISTANCE_METERS ||
      distance < 0.01 ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      moveImmediately();
      return;
    }

    let startTime: number | null = null;

    const animate = (timestamp: number) => {
      if (startTime === null) {
        startTime = timestamp;
      }

      const elapsed = timestamp - startTime;

      const progress = Math.min(1, Math.max(0, elapsed / ANIMATION_DURATION_MS));

      const easedProgress = 1 - (1 - progress) ** 2;

      const position = interpolatePosition(startPosition, destination, easedProgress);

      vehicleMarkerRef.current?.setLngLat(position);
      displayedPositionRef.current = position;

      if (progress < 1) {
        animationFrameRef.current = window.requestAnimationFrame(animate);
      } else {
        animationFrameRef.current = null;
        displayedPositionRef.current = destination;
      }
    };

    animationFrameRef.current = window.requestAnimationFrame(animate);
  }, [vehicle]);

  const distanceLabel = distanceMeters === null ? null : `${(distanceMeters / 1000).toFixed(2)} km`;

  const durationLabel = durationSeconds === null ? null : `${Math.round(durationSeconds / 60)} min`;

  const vehicleProgress = vehicle === null ? 0 : Math.max(0, Math.min(100, vehicle.progress * 100));

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-[#14243b]">Route Map</h3>

            <p className="mt-1 text-xs text-slate-500">
              Interactive map of delivery stops and live vehicle tracking
            </p>
          </div>

          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              liveConnectionStatus === 'connected'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {liveConnectionStatus === 'connected'
              ? 'GPS Connected'
              : liveConnectionStatus === 'connecting'
                ? 'GPS Connecting'
                : 'GPS Disconnected'}
          </span>
        </div>
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
        <p>
          {stops.length} delivery stop
          {stops.length === 1 ? '' : 's'}
        </p>

        {geometryLoading && (
          <p role="status" className="mt-1">
            Calculating driving route...
          </p>
        )}

        {geometryError && (
          <p role="alert" className="mt-1 text-red-700">
            Unable to load driving route: {geometryError}
          </p>
        )}

        {!geometryLoading && !geometryError && routeStatus === 'insufficient_stops' && (
          <p className="mt-1">Add at least two stops to display a driving route.</p>
        )}

        {!geometryLoading && !geometryError && routeStatus === 'no_route' && (
          <p className="mt-1">No drivable route found for these stops.</p>
        )}

        {!geometryLoading &&
          !geometryError &&
          routeStatus === 'ready' &&
          distanceLabel &&
          durationLabel && (
            <p className="mt-1">
              Driving route: {distanceLabel} · approx. {durationLabel} (no live traffic)
            </p>
          )}

        {liveSimulationError && (
          <p role="alert" className="mt-2 text-red-700">
            Live GPS: {liveSimulationError}
          </p>
        )}

        {vehicle ? (
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-[#14243b]">Live Vehicle</span>

              <span className="rounded-full bg-teal-50 px-2 py-1 font-medium capitalize text-teal-700">
                {vehicle.status}
              </span>
            </div>

            <p>
              Distance traveled: {(vehicle.distanceTraveledMeters / 1000).toFixed(2)}
              {' km · '}
              Progress: {vehicleProgress.toFixed(1)}%
            </p>

            <div
              role="progressbar"
              aria-label="Vehicle route progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(vehicleProgress)}
              className="h-2 overflow-hidden rounded-full bg-slate-100"
            >
              <div
                className="h-full rounded-full bg-teal-600"
                style={{
                  width: `${vehicleProgress}%`,
                }}
              />
            </div>

            <p>
              Speed: {(vehicle.speedMetersPerSecond * 3.6).toFixed(1)}
              {' km/h'}
            </p>
          </div>
        ) : (
          <p className="mt-3 border-t border-slate-100 pt-3">
            No active GPS simulation for this route.
          </p>
        )}
      </div>
    </section>
  );
}
