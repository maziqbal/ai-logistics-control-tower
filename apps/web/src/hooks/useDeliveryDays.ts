import { useEffect, useState } from 'react';

import { logisticsApi, type DeliveryDay } from '../api/logistics-api';

type DaysRequest = {
  key: string;
  status: 'success' | 'error';
  data: DeliveryDay[];
  error: string;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

/**
 * Loads delivery days while preserving retry keys and aborting obsolete requests.
 * Selection remains owned by OperationsOverviewPage.
 */
export function useDeliveryDays() {
  const [daysRequest, setDaysRequest] = useState<DaysRequest | null>(null);
  const [daysRetry, setDaysRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    logisticsApi
      .getDeliveryDays(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setDaysRequest({
            key: String(daysRetry),
            status: 'success',
            data,
            error: '',
          });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setDaysRequest({
            key: String(daysRetry),
            status: 'error',
            data: [],
            error: getErrorMessage(error),
          });
        }
      });

    return () => controller.abort();
  }, [daysRetry]);

  const daysReady = daysRequest?.key === String(daysRetry);
  const days = daysReady && daysRequest?.status === 'success' ? daysRequest.data : [];

  return { daysRequest, daysRetry, setDaysRetry, daysReady, days };
}
