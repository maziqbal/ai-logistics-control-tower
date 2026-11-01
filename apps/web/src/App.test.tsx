import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from './App';
import { logisticsApi } from './api/logistics-api';

vi.mock('./components/dispatch/RouteMap', () => ({
  RouteMap: () => <div data-testid="route-map-mock">Mock route map</div>,
}));

vi.mock('./api/logistics-api', () => ({
  logisticsApi: {
    getDeliveryDays: vi.fn(),
    getRoutes: vi.fn(),
    getStops: vi.fn(),
    getParcels: vi.fn(),
    createParcel: vi.fn(),
    assignParcelToStop: vi.fn(),
    getDrivers: vi.fn(),
    getVehicles: vi.fn(),
    createDriver: vi.fn(),
    createVehicle: vi.fn(),
    updateRouteAssignment: vi.fn(),
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
  status: 'pending' as const,
  longitude: 24.941,
  latitude: 60.171,
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

const createdParcel = {
  id: 'parcel-3',
  deliveryDayId: day.id,
  stopId: null,
  trackingNumber: 'PKG-HEL-0003',
  destination: 'Mannerheimintie 20, Helsinki',
  locationKey: 'helsinki-location-003',
};

const getDeliveryDays = vi.mocked(logisticsApi.getDeliveryDays);
const getRoutes = vi.mocked(logisticsApi.getRoutes);
const getStops = vi.mocked(logisticsApi.getStops);
const getParcels = vi.mocked(logisticsApi.getParcels);
const createParcel = vi.mocked(logisticsApi.createParcel);
const assignParcelToStop = vi.mocked(logisticsApi.assignParcelToStop);
const getDrivers = vi.mocked(logisticsApi.getDrivers);
const getVehicles = vi.mocked(logisticsApi.getVehicles);

beforeEach(() => {
  vi.resetAllMocks();

  getDeliveryDays.mockResolvedValue([day]);
  getRoutes.mockResolvedValue([route]);
  getStops.mockResolvedValue([stop]);
  getParcels.mockResolvedValue([parcel]);

  createParcel.mockResolvedValue(createdParcel);
  assignParcelToStop.mockResolvedValue(undefined);

  getDrivers.mockResolvedValue([
    { id: 'driver-1', name: 'Driver One', active: true },
    { id: 'driver-2', name: 'Driver Two', active: true },
  ]);

  getVehicles.mockResolvedValue([
    {
      id: 'vehicle-1',
      registrationNumber: 'ALT-001',
      active: true,
    },
    {
      id: 'vehicle-2',
      registrationNumber: 'ALT-002',
      active: true,
    },
  ]);
});

describe('Dispatcher overview', () => {
  it('refreshes parcel counts and assignment options after creating a parcel', async () => {
    const user = userEvent.setup();

    getParcels.mockResolvedValueOnce([parcel]).mockResolvedValue([parcel, createdParcel]);

    render(<App />);

    expect(await screen.findByText('ALT-DEMO-001')).toBeInTheDocument();
    expect(screen.getByText('1 of 1 parcels assigned')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Tracking Number'), 'PKG-HEL-0003');
    await user.type(screen.getByLabelText('Destination'), 'Mannerheimintie 20, Helsinki');
    await user.type(screen.getByLabelText('Location Key'), 'helsinki-location-003');
    await user.type(screen.getByLabelText('Longitude'), '24.9384');
    await user.type(screen.getByLabelText('Latitude'), '60.1699');

    await user.click(screen.getByRole('button', { name: 'Create Parcel' }));

    await waitFor(() => {
      expect(createParcel).toHaveBeenCalledTimes(1);
      expect(createParcel).toHaveBeenCalledWith(day.id, {
        trackingNumber: 'PKG-HEL-0003',
        destination: 'Mannerheimintie 20, Helsinki',
        locationKey: 'helsinki-location-003',
        longitude: 24.9384,
        latitude: 60.1699,
      });
    });

    await waitFor(() => {
      expect(getParcels).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText('1 of 2 parcels assigned')).toBeInTheDocument();

    const parcelCard = screen
      .getAllByText('Parcels')
      .find((element) => element.classList.contains('font-semibold'))?.parentElement?.parentElement;

    expect(parcelCard).toBeTruthy();
    expect(within(parcelCard!).getByText('2')).toBeInTheDocument();

    const unassignedCard = screen.getByText('Unassigned Parcels').parentElement?.parentElement;

    expect(unassignedCard).toBeTruthy();
    expect(within(unassignedCard!).getByText('1')).toBeInTheDocument();

    expect(
      screen.getByRole('progressbar', {
        name: 'Parcel assignment progress',
      }),
    ).toHaveAttribute('aria-valuenow', '50');

    const parcelSelect = screen.getByRole('combobox', {
      name: 'Unassigned Parcel',
    });

    expect(
      within(parcelSelect).getByRole('option', {
        name: /PKG-HEL-0003/,
      }),
    ).toHaveValue(createdParcel.id);

    expect(screen.getByText('Parcel created successfully.')).toBeInTheDocument();
    expect(screen.getByText('ALT-DEMO-001')).toBeInTheDocument();
  });

  it('refreshes parcel counts after a successful assignment', async () => {
    const user = userEvent.setup();

    getParcels
      .mockResolvedValueOnce([parcel, unassignedParcel])
      .mockResolvedValue([parcel, { ...unassignedParcel, stopId: stop.id }]);

    render(<App />);

    expect(await screen.findByText('ALT-DEMO-001')).toBeInTheDocument();

    const parcelSelect = await screen.findByRole('combobox', {
      name: 'Unassigned Parcel',
    });

    const stopSelect = screen.getByRole('combobox', {
      name: 'Destination Stop',
    });

    expect(screen.getByText('1 of 2 parcels assigned')).toBeInTheDocument();

    const unassignedCard = screen.getByText('Unassigned Parcels').parentElement?.parentElement;

    expect(unassignedCard).toBeTruthy();
    expect(within(unassignedCard!).getByText('1')).toBeInTheDocument();

    await user.selectOptions(parcelSelect, unassignedParcel.id);
    await user.selectOptions(stopSelect, stop.id);

    await user.click(screen.getByRole('button', { name: 'Assign Parcel' }));

    await waitFor(() => {
      expect(assignParcelToStop).toHaveBeenCalledTimes(1);
      expect(assignParcelToStop).toHaveBeenCalledWith(day.id, unassignedParcel.id, stop.id);
    });

    await waitFor(() => {
      expect(getParcels).toHaveBeenCalledTimes(2);
      expect(getStops).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText('2 of 2 parcels assigned')).toBeInTheDocument();

    const assignedCard = screen.getByText('Assigned Parcels').parentElement?.parentElement;

    expect(assignedCard).toBeTruthy();
    expect(within(assignedCard!).getByText('2')).toBeInTheDocument();

    expect(
      screen.getByRole('progressbar', {
        name: 'Parcel assignment progress',
      }),
    ).toHaveAttribute('aria-valuenow', '100');

    expect(await screen.findByText('ALT-DEMO-002')).toBeInTheDocument();
  });

  it('loads the delivery day and displays route and parcel data', async () => {
    render(<App />);

    expect(await screen.findByText('ALT-DEMO-001', {}, { timeout: 5000 })).toBeInTheDocument();

    expect(
      screen.getByRole('combobox', {
        name: 'Select delivery day',
      }),
    ).toHaveValue(day.id);

    expect(screen.getByText('Route 1')).toBeInTheDocument();
    expect(screen.getByText('Assigned Parcels')).toBeInTheDocument();

    expect(getRoutes).toHaveBeenCalledWith(day.id, expect.any(AbortSignal));

    expect(getParcels).toHaveBeenCalledWith(day.id, expect.any(AbortSignal));

    expect(getStops).toHaveBeenCalledWith(route.id, expect.any(AbortSignal));

    expect(screen.getByTestId('route-map-mock')).toBeInTheDocument();
  });

  it('shows an empty state when there are no routes', async () => {
    getRoutes.mockResolvedValue([]);
    getParcels.mockResolvedValue([]);

    render(<App />);

    expect(await screen.findByText('No routes for this delivery day.')).toBeInTheDocument();

    expect(screen.getAllByText('No route selected.')).toHaveLength(2);
    expect(screen.queryByTestId('route-map-mock')).not.toBeInTheDocument();
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

    fireEvent.change(
      screen.getByRole('combobox', {
        name: 'Select delivery day',
      }),
      {
        target: { value: secondDay.id },
      },
    );

    expect(screen.queryByText('ALT-DEMO-001')).not.toBeInTheDocument();

    expect(await screen.findByText('No routes for this delivery day.')).toBeInTheDocument();

    expect(screen.queryByTestId('route-map-mock')).not.toBeInTheDocument();
  });
});
