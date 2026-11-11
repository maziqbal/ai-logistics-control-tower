import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useRouteGeometry } from './useRouteGeometry';
import type { RouteGeometryResponse } from '../api/logistics-api';

const apiMocks = vi.hoisted(() => ({
  getRouteGeometry: vi.fn(),
}));

vi.mock('../api/logistics-api', () => ({
  logisticsApi: {
    getRouteGeometry: apiMocks.getRouteGeometry,
  },
}));

const ROUTE_A = 'route-1';
const ROUTE_B = 'route-2';
const KEY_A = 'day-1:route-1:0';
const KEY_B = 'day-1:route-2:0';

function makeGeometry(routeId: string): RouteGeometryResponse {
  return {
    routeId,
    status: 'ready',
    geometry: {
      type: 'LineString',
      coordinates: [
        [24.941, 60.171],
        [24.952, 60.17],
      ],
    },
    distanceMeters: 1700,
    durationSeconds: 300,
  };
}

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

describe('useRouteGeometry', () => {
  it('does not fetch geometry until route stops are ready', () => {
    const { result } = renderHook(() => useRouteGeometry(ROUTE_A, false, KEY_A));

    expect(apiMocks.getRouteGeometry).not.toHaveBeenCalled();
    expect(result.current.geometryReady).toBe(false);
    expect(result.current.geometryLoading).toBe(false);
    expect(result.current.routeGeometry).toBeNull();
  });

  it('loads OSRM geometry for the selected route', async () => {
    const geometry = makeGeometry(ROUTE_A);

    apiMocks.getRouteGeometry.mockResolvedValue(geometry);

    const { result } = renderHook(() => useRouteGeometry(ROUTE_A, true, KEY_A));

    expect(result.current.geometryLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.geometrySuccess).toBe(true);
    });

    expect(result.current.geometryReady).toBe(true);
    expect(result.current.geometryLoading).toBe(false);
    expect(result.current.routeGeometry).toEqual(geometry);
    expect(result.current.geometryError).toBeNull();

    expect(apiMocks.getRouteGeometry).toHaveBeenCalledWith(ROUTE_A, expect.any(AbortSignal));
  });

  it('reports a routing error without exposing invalid geometry', async () => {
    apiMocks.getRouteGeometry.mockRejectedValue(new Error('OSRM unavailable'));

    const { result } = renderHook(() => useRouteGeometry(ROUTE_A, true, KEY_A));

    await waitFor(() => {
      expect(result.current.geometryReady).toBe(true);
    });

    expect(result.current.geometrySuccess).toBe(false);
    expect(result.current.geometryLoading).toBe(false);
    expect(result.current.routeGeometry).toBeNull();
    expect(result.current.geometryError).toBe('OSRM unavailable');

    expect(result.current.geometryRequest?.data).toEqual({
      routeId: ROUTE_A,
      status: 'no_route',
      geometry: null,
      distanceMeters: null,
      durationSeconds: null,
    });
  });

  it('reloads geometry when the stops request key changes', async () => {
    const geometry = makeGeometry(ROUTE_A);

    apiMocks.getRouteGeometry.mockResolvedValue(geometry);

    const { result, rerender } = renderHook(({ key }) => useRouteGeometry(ROUTE_A, true, key), {
      initialProps: { key: KEY_A },
    });

    await waitFor(() => {
      expect(result.current.geometrySuccess).toBe(true);
    });

    rerender({ key: 'day-1:route-1:1' });

    expect(result.current.geometryReady).toBe(false);
    expect(result.current.geometryLoading).toBe(true);
    expect(result.current.routeGeometry).toBeNull();

    await waitFor(() => {
      expect(result.current.geometrySuccess).toBe(true);
      expect(result.current.geometryRequest?.key).toBe('day-1:route-1:1');
    });

    expect(apiMocks.getRouteGeometry).toHaveBeenCalledTimes(2);
  });

  it('aborts an active geometry request on unmount', async () => {
    const deferred = createDeferred<RouteGeometryResponse>();

    apiMocks.getRouteGeometry.mockReturnValue(deferred.promise);

    const { unmount } = renderHook(() => useRouteGeometry(ROUTE_A, true, KEY_A));

    const signal = apiMocks.getRouteGeometry.mock.calls[0][1] as AbortSignal;

    expect(signal.aborted).toBe(false);

    unmount();

    expect(signal.aborted).toBe(true);

    await act(async () => {
      deferred.resolve(makeGeometry(ROUTE_A));
      await deferred.promise;
    });
  });

  it('ignores obsolete geometry responses when switching routes', async () => {
    const oldRequest = createDeferred<RouteGeometryResponse>();
    const newRequest = createDeferred<RouteGeometryResponse>();

    apiMocks.getRouteGeometry
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);

    const { result, rerender } = renderHook(
      ({ routeId, key }) => useRouteGeometry(routeId, true, key),
      {
        initialProps: {
          routeId: ROUTE_A,
          key: KEY_A,
        },
      },
    );

    const oldSignal = apiMocks.getRouteGeometry.mock.calls[0][1] as AbortSignal;

    rerender({
      routeId: ROUTE_B,
      key: KEY_B,
    });

    expect(oldSignal.aborted).toBe(true);
    expect(result.current.geometrySuccess).toBe(false);
    expect(result.current.routeGeometry).toBeNull();

    await act(async () => {
      newRequest.resolve(makeGeometry(ROUTE_B));
      await newRequest.promise;
    });

    expect(result.current.geometrySuccess).toBe(true);
    expect(result.current.geometryRequest?.key).toBe(KEY_B);
    expect(result.current.routeGeometry?.routeId).toBe(ROUTE_B);

    // Old OSRM request finishes after the new route.
    await act(async () => {
      oldRequest.resolve(makeGeometry(ROUTE_A));
      await oldRequest.promise;
    });

    expect(result.current.geometryRequest?.key).toBe(KEY_B);
    expect(result.current.routeGeometry?.routeId).toBe(ROUTE_B);
    expect(apiMocks.getRouteGeometry).toHaveBeenCalledTimes(2);
  });
});
