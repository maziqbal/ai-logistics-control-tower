import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import type { DeliveryStop, Parcel } from '../../api/logistics-api';

type RouteMapProps = {
  stops: DeliveryStop[];
  parcels: Parcel[];
};

const DEFAULT_CENTER: [number, number] = [24.9384, 60.1699];
const DEFAULT_ZOOM = 11;

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

export function RouteMap({ stops, parcels }: RouteMapProps) {
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

    map.addControl(
      new maplibregl.NavigationControl(),
      'top-right',
    );

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) return;

    const markers: maplibregl.Marker[] = [];

    const validStops = stops.filter(
      (stop) =>
        Number.isFinite(stop.longitude) &&
        Number.isFinite(stop.latitude) &&
        stop.longitude >= -180 &&
        stop.longitude <= 180 &&
        stop.latitude >= -90 &&
        stop.latitude <= 90,
    );

    for (const stop of validStops) {
      const markerElement = document.createElement('div');

      markerElement.className =
        'flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-teal-600 text-xs font-bold text-white shadow-md';

      markerElement.textContent = String(stop.sequence);

      const parcelCount = parcels.filter(
        (parcel) => parcel.stopId === stop.id,
      ).length;

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
  }, [stops, parcels]);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="font-bold text-[#14243b]">
          Route Map
        </h3>

        <p className="mt-1 text-xs text-slate-500">
          Interactive map of delivery stops
        </p>
      </div>

      <div className="relative">
        <div
          ref={containerRef}
          aria-label="Delivery route map"
          className="h-96 w-full"
        />

        {stops.length === 0 && (
          <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
            No stops available for this route.
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
        {stops.length} delivery stop{stops.length === 1 ? '' : 's'}
      </div>
    </section>
  );
}
