import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDeliveryDays } from './useDeliveryDays';
import type { DeliveryDay } from '../api/logistics-api';

const apiMocks = vi.hoisted(() => ({
  getDeliveryDays: vi.fn(),
}));

vi.mock('../api/logistics-api', () => ({
  logisticsApi: {
    getDeliveryDays: apiMocks.getDeliveryDays,
  },
}));

const deliveryDays = [
  {
    id: 'day-1',
    serviceDate: '2026-11-11',
    operatingArea: 'Helsinki',
  },
] as DeliveryDay[];

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

describe('useDeliveryDays', () => {
  it('loads delivery days successfully', async () => {
    apiMocks.getDeliveryDays.mockResolvedValue(deliveryDays);

    const { result } = renderHook(() => useDeliveryDays());

    expect(result.current.daysReady).toBe(false);
    expect(result.current.days).toEqual([]);

    await waitFor(() => {
      expect(result.current.daysReady).toBe(true);
    });

    expect(result.current.days).toEqual(deliveryDays);
    expect(result.current.daysRequest).toEqual({
      key: '0',
      status: 'success',
      data: deliveryDays,
      error: '',
    });

    expect(apiMocks.getDeliveryDays).toHaveBeenCalledOnce();
    expect(apiMocks.getDeliveryDays).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('exposes an API error without showing stale days', async () => {
    apiMocks.getDeliveryDays.mockRejectedValue(new Error('Delivery days unavailable'));

    const { result } = renderHook(() => useDeliveryDays());

    await waitFor(() => {
      expect(result.current.daysReady).toBe(true);
    });

    expect(result.current.days).toEqual([]);
    expect(result.current.daysRequest).toEqual({
      key: '0',
      status: 'error',
      data: [],
      error: 'Delivery days unavailable',
    });
  });

  it('retries a failed request and recovers successfully', async () => {
    apiMocks.getDeliveryDays
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValueOnce(deliveryDays);

    const { result } = renderHook(() => useDeliveryDays());

    await waitFor(() => {
      expect(result.current.daysRequest?.status).toBe('error');
    });

    act(() => {
      result.current.setDaysRetry((value) => value + 1);
    });

    // Previous request data must not be treated as current.
    expect(result.current.daysReady).toBe(false);
    expect(result.current.days).toEqual([]);

    await waitFor(() => {
      expect(result.current.daysReady).toBe(true);
      expect(result.current.daysRequest?.status).toBe('success');
    });

    expect(result.current.daysRetry).toBe(1);
    expect(result.current.daysRequest?.key).toBe('1');
    expect(result.current.days).toEqual(deliveryDays);
    expect(apiMocks.getDeliveryDays).toHaveBeenCalledTimes(2);
  });

  it('aborts the active request when unmounted', async () => {
    const deferred = createDeferred<DeliveryDay[]>();

    apiMocks.getDeliveryDays.mockReturnValue(deferred.promise);

    const { unmount } = renderHook(() => useDeliveryDays());

    const signal = apiMocks.getDeliveryDays.mock.calls[0][0] as AbortSignal;

    expect(signal.aborted).toBe(false);

    unmount();

    expect(signal.aborted).toBe(true);

    // Simulate a response arriving despite cancellation.
    await act(async () => {
      deferred.resolve(deliveryDays);
      await deferred.promise;
    });

    expect(apiMocks.getDeliveryDays).toHaveBeenCalledOnce();
  });

  it('ignores an older response after a retry starts', async () => {
    const firstRequest = createDeferred<DeliveryDay[]>();
    const secondRequest = createDeferred<DeliveryDay[]>();

    apiMocks.getDeliveryDays
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    const { result } = renderHook(() => useDeliveryDays());

    const firstSignal = apiMocks.getDeliveryDays.mock.calls[0][0] as AbortSignal;

    act(() => {
      result.current.setDaysRetry((value) => value + 1);
    });

    expect(firstSignal.aborted).toBe(true);
    expect(apiMocks.getDeliveryDays).toHaveBeenCalledTimes(2);

    const newerDays = [
      {
        id: 'day-2',
        serviceDate: '2026-11-12',
        operatingArea: 'Espoo',
      },
    ] as DeliveryDay[];

    await act(async () => {
      secondRequest.resolve(newerDays);
      await secondRequest.promise;
    });

    expect(result.current.daysReady).toBe(true);
    expect(result.current.days).toEqual(newerDays);
    expect(result.current.daysRequest?.key).toBe('1');

    // The obsolete first request resolves after the newer request.
    await act(async () => {
      firstRequest.resolve(deliveryDays);
      await firstRequest.promise;
    });

    // The older response must not overwrite the latest data.
    expect(result.current.days).toEqual(newerDays);
    expect(result.current.daysRequest?.key).toBe('1');
  });
});
