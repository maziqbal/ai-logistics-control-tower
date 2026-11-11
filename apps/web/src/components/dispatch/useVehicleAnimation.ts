import { useEffect } from 'react';
import type { RefObject } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';

import type { SimulationSnapshot } from '../../hooks/useLiveSimulation';

type Position = [longitude: number, latitude: number];

type VehicleAnimationRefs = {
  markerRef: RefObject<maplibregl.Marker | null>;
  positionRef: RefObject<Position | null>;
  frameRef: RefObject<number | null>;
};

const ANIMATION_DURATION_MS = 900;
const MAX_ANIMATION_DISTANCE_METERS = 100;

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

/**
 * Updates the live vehicle marker using incoming GPS snapshots.
 *
 * Map creation and final resource cleanup remain owned by RouteMap.
 * This preserves the existing MapLibre lifecycle during ALT-034.
 */
export function useVehicleAnimation(
  mapRef: RefObject<MapLibreMap | null>,
  vehicle: SimulationSnapshot | null,
  refs: VehicleAnimationRefs,
): void {
  const { markerRef, positionRef, frameRef } = refs;

  useEffect(() => {
    const map = mapRef.current;

    if (!map) return;

    const stopAnimation = () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };

    if (!vehicle || !validPosition(vehicle.longitude, vehicle.latitude)) {
      stopAnimation();

      markerRef.current?.remove();
      markerRef.current = null;
      positionRef.current = null;
      return;
    }

    const destination: Position = [vehicle.longitude, vehicle.latitude];

    if (!markerRef.current) {
      const markerElement = createVehicleMarkerElement();

      markerRef.current = new maplibregl.Marker({
        element: markerElement,
        anchor: 'center',
      })
        .setLngLat(destination)
        .addTo(map);

      positionRef.current = destination;
      return;
    }

    stopAnimation();

    const startPosition = positionRef.current;

    const moveImmediately = () => {
      markerRef.current?.setLngLat(destination);
      positionRef.current = destination;
    };

    if (!startPosition) {
      moveImmediately();
      return;
    }

    const distance = distanceBetweenMeters(startPosition, destination);

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

      markerRef.current?.setLngLat(position);
      positionRef.current = position;

      if (progress < 1) {
        frameRef.current = window.requestAnimationFrame(animate);
      } else {
        frameRef.current = null;
        positionRef.current = destination;
      }
    };

    frameRef.current = window.requestAnimationFrame(animate);
  }, [mapRef, vehicle, markerRef, positionRef, frameRef]);
}
