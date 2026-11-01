import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from './App';
import { logisticsApi } from './api/logistics-api';

vi.mock('./api/logistics-api', () => ({
  logisticsApi: {
    getDeliveryDays: vi.fn(),
    getRoutes: vi.fn(),
    getStops: vi.fn(),
    getParcels: vi.fn(),
    assignParcelToStop: vi.fn(),
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

const unassignedParcel = {
  ...parcel,
  id: 'parcel-2',
  stopId: null,
  trackingNumber: 'ALT-DEMO-002',
  destination: 'Helsinki City Centre',
};

const getDeliveryDays = vi.mocked(logisticsApi.getDeliveryDays);
const getRoutes = vi.mocked(logisticsApi.getRoutes);
const getStops = vi.mocked(logisticsApi.getStops);
const getParcels = vi.mocked(logisticsApi.getParcels);
const assignParcelToStop = vi.mocked(logisticsApi.assignParcelToStop);

beforeEach(() => {
  vi.resetAllMocks();

  getDeliveryDays.mockResolvedValue([day]);
  getRoutes.mockResolvedValue([route]);
  getStops.mockResolvedValue([stop]);
  getParcels.mockResolvedValue([parcel]);
  assignParcelToStop.mockResolvedValue(undefined);
});

describe('Dispatcher overview', () => {
  it('refreshes parcel counts after a successful assignment', async () => {
    const user = userEvent.setup();

    // First GET returns an unassigned parcel.
    // Subsequent GET requests return the parcel assigned to the stop.
    getParcels
      .mockResolvedValueOnce([parcel, unassignedParcel])
      .mockResolvedValue([parcel, { ...unassignedParcel, stopId: stop.id }]);

    render(<App />);

    // Wait for the dashboard and assignment panel to load.
    expect(await screen.findByText('ALT-DEMO-001')).toBeInTheDocument();

    const parcelSelect = await screen.findByRole('combobox', {
      name: 'Unassigned Parcel',
    });

    const stopSelect = screen.getByRole('combobox', {
      name: 'Destination Stop',
    });

    // Verify the initial state before assignment.
    expect(screen.getByText('1 of 2 parcels assigned')).toBeInTheDocument();

    const unassignedCard = screen.getByText('Unassigned Parcels').parentElement?.parentElement;
    expect(unassignedCard).toBeTruthy();
    expect(within(unassignedCard!).getByText('1')).toBeInTheDocument();

    // Select an unassigned parcel and a stop on the selected route.
    await user.selectOptions(parcelSelect, unassignedParcel.id);
    await user.selectOptions(stopSelect, stop.id);

    await user.click(screen.getByRole('button', { name: 'Assign Parcel' }));

    // Confirm the correct PATCH parameters.
    await waitFor(() => {
      expect(assignParcelToStop).toHaveBeenCalledTimes(1);
      expect(assignParcelToStop).toHaveBeenCalledWith(day.id, unassignedParcel.id, stop.id);
    });

    // Confirm the dashboard fetched updated data.
    await waitFor(() => {
      expect(getParcels).toHaveBeenCalledTimes(2);
      expect(getStops).toHaveBeenCalledTimes(2);
    });

    // KPI counts and assignment progress reflect the updated server response.
    expect(await screen.findByText('2 of 2 parcels assigned')).toBeInTheDocument();

    const assignedCard = screen.getByText('Assigned Parcels').parentElement?.parentElement;
    expect(assignedCard).toBeTruthy();
    expect(within(assignedCard!).getByText('2')).toBeInTheDocument();

    expect(screen.getByRole('progressbar', { name: 'Parcel assignment progress' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );

    // The newly assigned parcel appears in the route stop details.
    expect(await screen.findByText('ALT-DEMO-002')).toBeInTheDocument();
  });

  it('loads the delivery day and displays route and parcel data', async () => {
    render(<App />);

    expect(await screen.findByText('ALT-DEMO-001', {}, { timeout: 5000 })).toBeInTheDocument();
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
