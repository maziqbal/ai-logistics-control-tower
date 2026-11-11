import { useEffect } from 'react';
import type { RefObject } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';

import type { DeliveryStop, Parcel } from '../../api/logistics-api';

type Position = [longitude: number, latitude: number];

const DEFAULT_CENTER: Position = [24.9384, 60.1699];
const DEFAULT_ZOOM = 11;

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

/** Owns numbered delivery stop markers, popups, map framing, and cleanup. */
export function useDeliveryStopMarkers(
  mapRef: RefObject<MapLibreMap | null>,
  stops: DeliveryStop[],
  parcels: Parcel[],
): void {
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

      const popup = new maplibregl.Popup({
        offset: 20,
      }).setDOMContent(popupContent);

      const marker = new maplibregl.Marker({
        element: markerElement,
      })
        .setLngLat([stop.longitude, stop.latitude])
        .setPopup(popup)
        .addTo(map);

      markers.push(marker);
    }

    if (validStops.length === 1) {
      const stop = validStops[0];

      map.flyTo({
        center: [stop.longitude, stop.latitude],
        zoom: 14,
      });
    } else if (validStops.length > 1) {
      const bounds = new maplibregl.LngLatBounds();

      for (const stop of validStops) {
        bounds.extend([stop.longitude, stop.latitude]);
      }

      map.fitBounds(bounds, {
        padding: 60,
        maxZoom: 14,
      });
    } else {
      map.flyTo({
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
      });
    }

    return () => {
      for (const marker of markers) {
        marker.remove();
      }
    };
  }, [mapRef, stops, parcels]);
}
