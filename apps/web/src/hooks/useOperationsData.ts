import { useEffect, useState } from 'react';

import { logisticsApi, type DeliveryRoute, type Parcel } from '../api/logistics-api';

type OperationsData = {
  routes: DeliveryRoute[];
  parcels: Parcel[];
};

type OperationsRequest = {
  key: string;
  status: 'success' | 'error';
  data: OperationsData;
  error: string;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

/**
 * Loads routes and parcels together for a delivery day.
 * Keeps retry-key guarding and aborts obsolete requests on day changes.
 */
export function useOperationsData(currentDayId: string) {
  const [operationsRequest, setOperationsRequest] = useState<OperationsRequest | null>(null);
  const [operationsRetry, setOperationsRetry] = useState(0);

  useEffect(() => {
    if (!currentDayId) return;

    const controller = new AbortController();

    Promise.all([
      logisticsApi.getRoutes(currentDayId, controller.signal),
      logisticsApi.getParcels(currentDayId, controller.signal),
    ])
      .then(([routes, parcels]) => {
        if (!controller.signal.aborted) {
          setOperationsRequest({
            key: `${currentDayId}:${operationsRetry}`,
            status: 'success',
            data: { routes, parcels },
            error: '',
          });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setOperationsRequest({
            key: `${currentDayId}:${operationsRetry}`,
            status: 'error',
            data: { routes: [], parcels: [] },
            error: getErrorMessage(error),
          });
        }
      });

    return () => controller.abort();
  }, [currentDayId, operationsRetry]);

  const operationsKey = `${currentDayId}:${operationsRetry}`;
  const operationsReady = operationsRequest?.key === operationsKey;
  const operationsSuccess = operationsReady && operationsRequest?.status === 'success';
  const routes = operationsSuccess ? operationsRequest.data.routes : [];
  const parcels = operationsSuccess ? operationsRequest.data.parcels : [];

  return {
    operationsRequest,
    operationsRetry,
    setOperationsRetry,
    operationsReady,
    operationsSuccess,
    routes,
    parcels,
  };
}
