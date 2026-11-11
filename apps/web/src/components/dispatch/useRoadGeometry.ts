import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';

import type { RouteGeometry } from '../../api/logistics-api';

const ROAD_SOURCE_ID = 'delivery-road-route';
const ROAD_LAYER_ID = 'delivery-road-route-line';

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

function isValidGeometry(geometry: RouteGeometry | null | undefined): geometry is RouteGeometry {
  return (
    geometry?.type === 'LineString' &&
    Array.isArray(geometry.coordinates) &&
    geometry.coordinates.length >= 2 &&
    geometry.coordinates.every(
      (point) => Array.isArray(point) && point.length >= 2 && validPosition(point[0], point[1]),
    )
  );
}

/**
 * Maintains the OSRM road line on an existing MapLibre instance.
 */
export function useRoadGeometry(
  mapRef: RefObject<MapLibreMap | null>,
  geometry: RouteGeometry | null,
): void {
  useEffect(() => {
    const map = mapRef.current;

    if (!map || typeof map.isStyleLoaded !== 'function') {
      return;
    }

    const updateRoad = () => {
      if (!isValidGeometry(geometry)) {
        if (map.getLayer(ROAD_LAYER_ID)) {
          map.removeLayer(ROAD_LAYER_ID);
        }

        if (map.getSource(ROAD_SOURCE_ID)) {
          map.removeSource(ROAD_SOURCE_ID);
        }

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
        map.addSource(ROAD_SOURCE_ID, {
          type: 'geojson',
          data,
        });
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
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
        });
      }
    };

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
}
