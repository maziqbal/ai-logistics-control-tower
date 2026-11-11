import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useOperationsData } from './useOperationsData';
import type { DeliveryRoute, Parcel } from '../api/logistics-api';

const apiMocks = vi.hoisted(() => ({
  getRoutes: vi.fn(),
  getParcels: vi.fn(),
}));

vi.mock('../api/logistics-api', () => ({
  logisticsApi: {
    getRoutes: apiMocks.getRoutes,
    getParcels: apiMocks.getParcels,
  },
}));

const DAY_A = 'day-1';
const DAY_B = 'day-2';

const routesA = [{ id: 'route-1', deliveryDayId: DAY_A }] as DeliveryRoute[];

const parcelsA = [{ id: 'parcel-1', deliveryDayId: DAY_A }] as Parcel[];

const routesB = [{ id: 'route-2', deliveryDayId: DAY_B }] as DeliveryRoute[];

const parcelsB = [{ id: 'parcel-2', deliveryDayId: DAY_B }] as Parcel[];

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

describe('useOperationsData', () => {
  it('does not fetch data when no delivery day is selected', () => {
    const { result } = renderHook(() => useOperationsData(''));

    expect(apiMocks.getRoutes).not.toHaveBeenCalled();
    expect(apiMocks.getParcels).not.toHaveBeenCalled();

    expect(result.current.operationsReady).toBe(false);
    expect(result.current.operationsSuccess).toBe(false);
    expect(result.current.routes).toEqual([]);
    expect(result.current.parcels).toEqual([]);
  });

  it('loads routes and parcels together for the selected day', async () => {
    apiMocks.getRoutes.mockResolvedValue(routesA);
    apiMocks.getParcels.mockResolvedValue(parcelsA);

    const { result } = renderHook(() => useOperationsData(DAY_A));

    expect(result.current.operationsReady).toBe(false);

    await waitFor(() => {
      expect(result.current.operationsSuccess).toBe(true);
    });

    expect(result.current.routes).toEqual(routesA);
    expect(result.current.parcels).toEqual(parcelsA);

    expect(result.current.operationsRequest).toEqual({
      key: 'day-1:0',
      status: 'success',
      data: {
        routes: routesA,
        parcels: parcelsA,
      },
      error: '',
    });

    expect(apiMocks.getRoutes).toHaveBeenCalledWith(DAY_A, expect.any(AbortSignal));

    expect(apiMocks.getParcels).toHaveBeenCalledWith(DAY_A, expect.any(AbortSignal));

    const routesSignal = apiMocks.getRoutes.mock.calls[0][1];
    const parcelsSignal = apiMocks.getParcels.mock.calls[0][1];

    expect(routesSignal).toBe(parcelsSignal);
  });

  it('handles a failed request without exposing partial data', async () => {
    apiMocks.getRoutes.mockResolvedValue(routesA);
    apiMocks.getParcels.mockRejectedValue(new Error('Parcel service unavailable'));

    const { result } = renderHook(() => useOperationsData(DAY_A));

    await waitFor(() => {
      expect(result.current.operationsReady).toBe(true);
    });

    expect(result.current.operationsSuccess).toBe(false);
    expect(result.current.routes).toEqual([]);
    expect(result.current.parcels).toEqual([]);

    expect(result.current.operationsRequest).toEqual({
      key: 'day-1:0',
      status: 'error',
      data: {
        routes: [],
        parcels: [],
      },
      error: 'Parcel service unavailable',
    });
  });

  it('retries after a failure and successfully reloads data', async () => {
    apiMocks.getRoutes.mockRejectedValueOnce(new Error('Temporary failure'));
    apiMocks.getRoutes.mockResolvedValueOnce(routesA);
    apiMocks.getParcels.mockResolvedValue(parcelsA);

    const { result } = renderHook(() => useOperationsData(DAY_A));

    await waitFor(() => {
      expect(result.current.operationsRequest?.status).toBe('error');
    });

    act(() => {
      result.current.setOperationsRetry((value) => value + 1);
    });

    expect(result.current.operationsReady).toBe(false);
    expect(result.current.operationsSuccess).toBe(false);
    expect(result.current.routes).toEqual([]);

    await waitFor(() => {
      expect(result.current.operationsSuccess).toBe(true);
    });

    expect(result.current.operationsRetry).toBe(1);
    expect(result.current.operationsRequest?.key).toBe('day-1:1');

    expect(result.current.routes).toEqual(routesA);
    expect(result.current.parcels).toEqual(parcelsA);

    expect(apiMocks.getRoutes).toHaveBeenCalledTimes(2);
    expect(apiMocks.getParcels).toHaveBeenCalledTimes(2);
  });

  it('aborts active requests when the component unmounts', async () => {
    const routesRequest = createDeferred<DeliveryRoute[]>();
    const parcelsRequest = createDeferred<Parcel[]>();

    apiMocks.getRoutes.mockReturnValue(routesRequest.promise);
    apiMocks.getParcels.mockReturnValue(parcelsRequest.promise);

    const { unmount } = renderHook(() => useOperationsData(DAY_A));

    const routesSignal = apiMocks.getRoutes.mock.calls[0][1] as AbortSignal;
    const parcelsSignal = apiMocks.getParcels.mock.calls[0][1] as AbortSignal;

    expect(routesSignal.aborted).toBe(false);
    expect(parcelsSignal.aborted).toBe(false);

    unmount();

    expect(routesSignal.aborted).toBe(true);
    expect(parcelsSignal.aborted).toBe(true);

    await act(async () => {
      routesRequest.resolve(routesA);
      parcelsRequest.resolve(parcelsA);

      await Promise.all([routesRequest.promise, parcelsRequest.promise]);
    });
  });

  it('ignores stale responses when switching delivery days', async () => {
    const oldRoutes = createDeferred<DeliveryRoute[]>();
    const oldParcels = createDeferred<Parcel[]>();
    const newRoutes = createDeferred<DeliveryRoute[]>();
    const newParcels = createDeferred<Parcel[]>();

    apiMocks.getRoutes
      .mockReturnValueOnce(oldRoutes.promise)
      .mockReturnValueOnce(newRoutes.promise);

    apiMocks.getParcels
      .mockReturnValueOnce(oldParcels.promise)
      .mockReturnValueOnce(newParcels.promise);

    const { result, rerender } = renderHook(
      ({ dayId }: { dayId: string }) => useOperationsData(dayId),
      {
        initialProps: { dayId: DAY_A },
      },
    );

    const oldSignal = apiMocks.getRoutes.mock.calls[0][1] as AbortSignal;

    rerender({ dayId: DAY_B });

    expect(oldSignal.aborted).toBe(true);
    expect(result.current.operationsSuccess).toBe(false);
    expect(result.current.routes).toEqual([]);
    expect(result.current.parcels).toEqual([]);

    await act(async () => {
      newRoutes.resolve(routesB);
      newParcels.resolve(parcelsB);

      await Promise.all([newRoutes.promise, newParcels.promise]);
    });

    expect(result.current.operationsSuccess).toBe(true);
    expect(result.current.operationsRequest?.key).toBe('day-2:0');
    expect(result.current.routes).toEqual(routesB);
    expect(result.current.parcels).toEqual(parcelsB);

    // Older requests complete after the selected day has changed.
    await act(async () => {
      oldRoutes.resolve(routesA);
      oldParcels.resolve(parcelsA);

      await Promise.all([oldRoutes.promise, oldParcels.promise]);
    });

    // Old data must not overwrite the new day's data.
    expect(result.current.operationsRequest?.key).toBe('day-2:0');
    expect(result.current.routes).toEqual(routesB);
    expect(result.current.parcels).toEqual(parcelsB);
  });
});
