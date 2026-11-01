import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import App from './App';
import { logisticsApi } from './api/logistics-api';

vi.mock('./api/logistics-api', () => ({
  logisticsApi: {
    getDeliveryDays: vi.fn(),
    getRoutes: vi.fn(),
    getStops: vi.fn(),
    getParcels: vi.fn(),
  },
}));

const day = {
  id: 'day-1',
  serviceDate: '2026-11-02',
  operatingArea: 'Helsinki',
};

const route = {
  id: 'route-1',
  deliveryDayId: day.id,
  driverId: 'driver-1',
  vehicleId: 'vehicle-1',
  status: 'draft',
  version: 1,
};

const stop = {
  id: 'stop-1',
  routeId: route.id,
  deliveryDayId: day.id,
  sequence: 1,
  locationKey: 'Helsinki Central Railway Station',
};

const parcel = {
  id: 'parcel-1',
  deliveryDayId: day.id,
  stopId: stop.id,
  trackingNumber: 'ALT-DEMO-001',
  destination: 'Helsinki Central Railway Station',
  locationKey: 'Helsinki Central Railway Station',
};

const getDeliveryDays = vi.mocked(logisticsApi.getDeliveryDays);
const getRoutes = vi.mocked(logisticsApi.getRoutes);
const getStops = vi.mocked(logisticsApi.getStops);
const getParcels = vi.mocked(logisticsApi.getParcels);

beforeEach(() => {
  vi.resetAllMocks();

  getDeliveryDays.mockResolvedValue([day]);
  getRoutes.mockResolvedValue([route]);
  getStops.mockResolvedValue([stop]);
  getParcels.mockResolvedValue([parcel]);
});

describe('Dispatcher overview', () => {
  it('loads the delivery day and displays route and parcel data', async () => {
    render(<App />);

    expect(await screen.findByText('ALT-DEMO-001')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Select delivery day' })).toHaveValue(day.id);

    expect(screen.getByText('Route 1')).toBeInTheDocument();
    expect(screen.getByText('Assigned Parcels')).toBeInTheDocument();

    expect(getRoutes).toHaveBeenCalledWith(day.id, expect.any(AbortSignal));
    expect(getParcels).toHaveBeenCalledWith(day.id, expect.any(AbortSignal));
    expect(getStops).toHaveBeenCalledWith(route.id, expect.any(AbortSignal));
  });

  it('shows an empty state when there are no routes', async () => {
    getRoutes.mockResolvedValue([]);
    getParcels.mockResolvedValue([]);

    render(<App />);

    expect(await screen.findByText('No routes for this delivery day.')).toBeInTheDocument();

    expect(screen.getByText('No route selected.')).toBeInTheDocument();
  });

  it('shows an error and retries when delivery days fail to load', async () => {
    getDeliveryDays
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce([day]);

    render(<App />);

    expect(
      await screen.findByText(/Unable to load delivery days: Network unavailable/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(getDeliveryDays).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText('ALT-DEMO-001')).toBeInTheDocument();
  });

  it('does not display stale route data when switching delivery days', async () => {
    const secondDay = {
      id: 'day-2',
      serviceDate: '2026-11-03',
      operatingArea: 'Espoo',
    };

    getDeliveryDays.mockResolvedValue([day, secondDay]);
    getRoutes.mockImplementation(async (dayId) => (dayId === day.id ? [route] : []));
    getParcels.mockImplementation(async (dayId) => (dayId === day.id ? [parcel] : []));

    render(<App />);

    expect(await screen.findByText('ALT-DEMO-001')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Select delivery day' }), {
      target: { value: secondDay.id },
    });

    expect(screen.queryByText('ALT-DEMO-001')).not.toBeInTheDocument();

    expect(await screen.findByText('No routes for this delivery day.')).toBeInTheDocument();
  });
});
