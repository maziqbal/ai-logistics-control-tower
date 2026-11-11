import { useEffect, useState } from 'react';

import { logisticsApi, type RouteGeometryResponse } from '../api/logistics-api';

type GeometryRequest = {
  key: string;
  status: 'success' | 'error';
  data: RouteGeometryResponse;
  error: string;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

/**
 * Fetches OSRM road geometry for the selected route after its stops load.
 * Aborts obsolete requests and guards against stale route/refresh responses.
 */
export function useRouteGeometry(currentRouteId: string, stopsSuccess: boolean, stopsKey: string) {
  const [geometryRequest, setGeometryRequest] = useState<GeometryRequest | null>(null);

  useEffect(() => {
    if (!currentRouteId || !stopsSuccess) return;

    const controller = new AbortController();

    logisticsApi
      .getRouteGeometry(currentRouteId, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setGeometryRequest({
            key: stopsKey,
            status: 'success',
            data,
            error: '',
          });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setGeometryRequest({
            key: stopsKey,
            status: 'error',
            data: {
              routeId: currentRouteId,
              status: 'no_route',
              geometry: null,
              distanceMeters: null,
              durationSeconds: null,
            },
            error: getErrorMessage(error),
          });
        }
      });

    return () => controller.abort();
  }, [currentRouteId, stopsSuccess, stopsKey]);

  const geometryReady = geometryRequest?.key === stopsKey;
  const geometrySuccess = geometryReady && geometryRequest?.status === 'success';
  const routeGeometry = geometrySuccess ? geometryRequest.data : null;
  const geometryLoading = stopsSuccess && !geometryReady;
  const geometryError =
    geometryReady && geometryRequest?.status === 'error' ? geometryRequest.error : null;

  return {
    geometryRequest,
    geometryReady,
    geometrySuccess,
    routeGeometry,
    geometryLoading,
    geometryError,
  };
}
