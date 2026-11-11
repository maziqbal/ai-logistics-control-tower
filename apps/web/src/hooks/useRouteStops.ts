import { useEffect, useState } from 'react';

import { logisticsApi, type DeliveryStop } from '../api/logistics-api';

type StopsRequest = {
  key: string;
  status: 'success' | 'error';
  data: DeliveryStop[];
  error: string;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

/**
 * Loads route stops with the same retry keys, cancellation, and stable
 * stop ordering that previously lived in OperationsOverviewPage.
 */
export function useRouteStops(
  currentDayId: string,
  currentRouteId: string,
  operationsSuccess: boolean,
) {
  const [stopsRequest, setStopsRequest] = useState<StopsRequest | null>(null);
  const [stopsRetry, setStopsRetry] = useState(0);

  useEffect(() => {
    if (!currentRouteId || !operationsSuccess) return;

    const controller = new AbortController();

    logisticsApi
      .getStops(currentRouteId, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setStopsRequest({
            key: `${currentDayId}:${currentRouteId}:${stopsRetry}`,
            status: 'success',
            data,
            error: '',
          });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setStopsRequest({
            key: `${currentDayId}:${currentRouteId}:${stopsRetry}`,
            status: 'error',
            data: [],
            error: getErrorMessage(error),
          });
        }
      });

    return () => controller.abort();
  }, [currentDayId, currentRouteId, operationsSuccess, stopsRetry]);

  const stopsKey = `${currentDayId}:${currentRouteId}:${stopsRetry}`;
  const stopsReady = stopsRequest?.key === stopsKey;
  const stopsSuccess = stopsReady && stopsRequest?.status === 'success';
  const stops = stopsSuccess ? [...stopsRequest.data].sort((a, b) => a.sequence - b.sequence) : [];

  return { stopsRequest, stopsRetry, setStopsRetry, stopsReady, stopsSuccess, stops, stopsKey };
}
