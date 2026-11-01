import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { logisticsApi } from '../../api/logistics-api';
import { RouteAssignmentPanel } from './RouteAssignmentPanel';

vi.mock('../../api/logistics-api', () => ({
  logisticsApi: {
    getDrivers: vi.fn(),
    getVehicles: vi.fn(),
    updateRouteAssignment: vi.fn(),
  },
}));

const route = {
  id: 'route-1',
  deliveryDayId: 'day-1',
  driverId: null,
  vehicleId: null,
  status: 'draft',
  version: 1,
};

const drivers = [
  { id: 'driver-1', name: 'Driver One', active: true },
  { id: 'driver-2', name: 'Driver Two', active: true },
];

const vehicles = [
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
];

const getDrivers = vi.mocked(logisticsApi.getDrivers);
const getVehicles = vi.mocked(logisticsApi.getVehicles);
const updateRouteAssignment = vi.mocked(logisticsApi.updateRouteAssignment);

beforeEach(() => {
  vi.resetAllMocks();

  getDrivers.mockResolvedValue(drivers);
  getVehicles.mockResolvedValue(vehicles);

  updateRouteAssignment.mockImplementation(async (_routeId, input) => ({
    ...route,
    driverId: input.driverId ?? null,
    vehicleId: input.vehicleId ?? null,
    version: 2,
  }));
});

describe('RouteAssignmentPanel', () => {
  it('assigns a driver and vehicle to a draft route', async () => {
    const user = userEvent.setup();
    const onAssigned = vi.fn();

    render(<RouteAssignmentPanel route={route} onAssigned={onAssigned} />);

    const driverSelect = await screen.findByLabelText('Driver');
    const vehicleSelect = screen.getByLabelText('Vehicle');

    await user.selectOptions(driverSelect, 'driver-1');
    await user.selectOptions(vehicleSelect, 'vehicle-1');

    await user.click(
      screen.getByRole('button', {
        name: 'Save Assignment',
      }),
    );

    await waitFor(() => {
      expect(updateRouteAssignment).toHaveBeenCalledWith(route.id, {
        driverId: 'driver-1',
        vehicleId: 'vehicle-1',
      });
    });

    expect(onAssigned).toHaveBeenCalledTimes(1);
  });

  it('clears an existing driver and vehicle assignment', async () => {
    const user = userEvent.setup();
    const onAssigned = vi.fn();

    render(
      <RouteAssignmentPanel
        route={{
          ...route,
          driverId: 'driver-1',
          vehicleId: 'vehicle-1',
        }}
        onAssigned={onAssigned}
      />,
    );

    const driverSelect = await screen.findByLabelText('Driver');
    const vehicleSelect = screen.getByLabelText('Vehicle');

    await user.selectOptions(driverSelect, '');
    await user.selectOptions(vehicleSelect, '');

    await user.click(
      screen.getByRole('button', {
        name: 'Save Assignment',
      }),
    );

    await waitFor(() => {
      expect(updateRouteAssignment).toHaveBeenCalledWith(route.id, {
        driverId: null,
        vehicleId: null,
      });
    });

    expect(onAssigned).toHaveBeenCalledTimes(1);
  });

  it('shows an error when the backend rejects an assignment', async () => {
    const user = userEvent.setup();
    const onAssigned = vi.fn();

    updateRouteAssignment.mockRejectedValueOnce(new Error('Assignment conflict'));

    render(<RouteAssignmentPanel route={route} onAssigned={onAssigned} />);

    const driverSelect = await screen.findByLabelText('Driver');

    await user.selectOptions(driverSelect, 'driver-1');

    await user.click(
      screen.getByRole('button', {
        name: 'Save Assignment',
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Assignment conflict');

    expect(onAssigned).not.toHaveBeenCalled();
  });

  it('prevents editing a non-draft route', async () => {
    render(
      <RouteAssignmentPanel
        route={{
          ...route,
          status: 'in_progress',
        }}
        onAssigned={vi.fn()}
      />,
    );

    expect(await screen.findByLabelText('Driver')).toBeDisabled();

    expect(screen.getByLabelText('Vehicle')).toBeDisabled();

    expect(
      screen.getByRole('button', {
        name: 'Save Assignment',
      }),
    ).toBeDisabled();

    expect(
      screen.getByText('Assignments can only be changed on draft routes.'),
    ).toBeInTheDocument();

    expect(updateRouteAssignment).not.toHaveBeenCalled();
  });

  it('disables saving when no changes were made', async () => {
    render(<RouteAssignmentPanel route={route} onAssigned={vi.fn()} />);

    expect(await screen.findByLabelText('Driver')).toBeInTheDocument();

    expect(
      screen.getByRole('button', {
        name: 'Save Assignment',
      }),
    ).toBeDisabled();
  });
});
