import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useRouteStops } from './useRouteStops';
import type { DeliveryStop } from '../api/logistics-api';

const apiMocks = vi.hoisted(() => ({
  getStops: vi.fn(),
}));

vi.mock('../api/logistics-api', () => ({
  logisticsApi: {
    getStops: apiMocks.getStops,
  },
}));

const DAY_ID = 'day-1';
const ROUTE_A = 'route-1';
const ROUTE_B = 'route-2';

function makeStop(id: string, routeId: string, sequence: number): DeliveryStop {
  return {
    id,
    routeId,
    deliveryDayId: DAY_ID,
    sequence,
    locationKey: `Location ${sequence}`,
    status: 'pending',
    longitude: 24.94,
    latitude: 60.17,
  };
}

const stopsA = [
  makeStop('stop-3', ROUTE_A, 3),
  makeStop('stop-1', ROUTE_A, 1),
  makeStop('stop-2', ROUTE_A, 2),
];

const stopsB = [makeStop('stop-4', ROUTE_B, 1)];

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useRouteStops', () => {
  it('does not fetch when the route or operations data is unavailable', () => {
    const { result, rerender } = renderHook(
      ({ routeId, ready }) => useRouteStops(DAY_ID, routeId, ready),
      {
        initialProps: {
          routeId: '',
          ready: true,
        },
      },
    );

    expect(apiMocks.getStops).not.toHaveBeenCalled();
    expect(result.current.stopsSuccess).toBe(false);
    expect(result.current.stops).toEqual([]);

    rerender({
      routeId: ROUTE_A,
      ready: false,
    });

    expect(apiMocks.getStops).not.toHaveBeenCalled();
    expect(result.current.stopsSuccess).toBe(false);
  });

  it('loads stops and sorts them by delivery sequence', async () => {
    apiMocks.getStops.mockResolvedValue(stopsA);

    const { result } = renderHook(() => useRouteStops(DAY_ID, ROUTE_A, true));

    expect(result.current.stopsReady).toBe(false);

    await waitFor(() => {
      expect(result.current.stopsSuccess).toBe(true);
    });

    expect(result.current.stopsKey).toBe('day-1:route-1:0');

    expect(result.current.stops.map((stop) => stop.sequence)).toEqual([1, 2, 3]);

    // Sorting must not mutate the API response.
    expect(stopsA.map((stop) => stop.sequence)).toEqual([3, 1, 2]);

    expect(apiMocks.getStops).toHaveBeenCalledWith(ROUTE_A, expect.any(AbortSignal));
  });

  it('reports an API error without displaying stops', async () => {
    apiMocks.getStops.mockRejectedValue(new Error('Stops unavailable'));

    const { result } = renderHook(() => useRouteStops(DAY_ID, ROUTE_A, true));

    await waitFor(() => {
      expect(result.current.stopsReady).toBe(true);
    });

    expect(result.current.stopsSuccess).toBe(false);
    expect(result.current.stops).toEqual([]);

    expect(result.current.stopsRequest).toEqual({
      key: 'day-1:route-1:0',
      status: 'error',
      data: [],
      error: 'Stops unavailable',
    });
  });

  it('retries a failed request and loads the new stops', async () => {
    apiMocks.getStops
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValueOnce(stopsA);

    const { result } = renderHook(() => useRouteStops(DAY_ID, ROUTE_A, true));

    await waitFor(() => {
      expect(result.current.stopsRequest?.status).toBe('error');
    });

    act(() => {
      result.current.setStopsRetry((value) => value + 1);
    });

    expect(result.current.stopsReady).toBe(false);
    expect(result.current.stopsSuccess).toBe(false);
    expect(result.current.stops).toEqual([]);

    await waitFor(() => {
      expect(result.current.stopsSuccess).toBe(true);
    });

    expect(result.current.stopsRetry).toBe(1);
    expect(result.current.stopsKey).toBe('day-1:route-1:1');
    expect(result.current.stops.map((stop) => stop.sequence)).toEqual([1, 2, 3]);

    expect(apiMocks.getStops).toHaveBeenCalledTimes(2);
  });

  it('aborts an outstanding request on unmount', async () => {
    const deferred = createDeferred<DeliveryStop[]>();

    apiMocks.getStops.mockReturnValue(deferred.promise);

    const { unmount } = renderHook(() => useRouteStops(DAY_ID, ROUTE_A, true));

    const signal = apiMocks.getStops.mock.calls[0][1] as AbortSignal;

    expect(signal.aborted).toBe(false);

    unmount();

    expect(signal.aborted).toBe(true);

    // Simulate a response arriving after cancellation.
    await act(async () => {
      deferred.resolve(stopsA);
      await deferred.promise;
    });
  });

  it('ignores stale responses after switching routes', async () => {
    const oldRequest = createDeferred<DeliveryStop[]>();
    const newRequest = createDeferred<DeliveryStop[]>();

    apiMocks.getStops
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);

    const { result, rerender } = renderHook(({ routeId }) => useRouteStops(DAY_ID, routeId, true), {
      initialProps: {
        routeId: ROUTE_A,
      },
    });

    const oldSignal = apiMocks.getStops.mock.calls[0][1] as AbortSignal;

    rerender({ routeId: ROUTE_B });

    expect(oldSignal.aborted).toBe(true);
    expect(result.current.stopsSuccess).toBe(false);
    expect(result.current.stops).toEqual([]);

    await act(async () => {
      newRequest.resolve(stopsB);
      await newRequest.promise;
    });

    expect(result.current.stopsSuccess).toBe(true);
    expect(result.current.stopsKey).toBe('day-1:route-2:0');
    expect(result.current.stops).toEqual(stopsB);

    // The old request resolves after the new route has loaded.
    await act(async () => {
      oldRequest.resolve(stopsA);
      await oldRequest.promise;
    });

    expect(result.current.stopsKey).toBe('day-1:route-2:0');
    expect(result.current.stops).toEqual(stopsB);
    expect(apiMocks.getStops).toHaveBeenCalledTimes(2);
  });
});
