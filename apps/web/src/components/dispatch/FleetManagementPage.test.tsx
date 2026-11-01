import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FleetManagementPage } from './FleetManagementPage';
import { logisticsApi } from '../../api/logistics-api';

vi.mock('../../api/logistics-api', () => ({
  logisticsApi: {
    getDrivers: vi.fn(),
    getVehicles: vi.fn(),
    createDriver: vi.fn(),
    createVehicle: vi.fn(),
  },
}));

const driver = {
  id: 'driver-1',
  name: 'Alex Driver',
  active: true,
};

const vehicle = {
  id: 'vehicle-1',
  registrationNumber: 'ABC-123',
  active: true,
};

const newDriver = {
  id: 'driver-2',
  name: 'ALT026 Test Driver',
  active: true,
};

const newVehicle = {
  id: 'vehicle-2',
  registrationNumber: 'ALT-026',
  active: true,
};

const getDrivers = vi.mocked(logisticsApi.getDrivers);
const getVehicles = vi.mocked(logisticsApi.getVehicles);
const createDriver = vi.mocked(logisticsApi.createDriver);
const createVehicle = vi.mocked(logisticsApi.createVehicle);

beforeEach(() => {
  vi.resetAllMocks();

  getDrivers.mockResolvedValue([driver]);
  getVehicles.mockResolvedValue([vehicle]);
  createDriver.mockResolvedValue(newDriver);
  createVehicle.mockResolvedValue(newVehicle);
});

describe('FleetManagementPage', () => {
  it('loads existing drivers and vehicles', async () => {
    render(<FleetManagementPage />);

    expect(await screen.findByText('Alex Driver')).toBeInTheDocument();
    expect(await screen.findByText('ABC-123')).toBeInTheDocument();

    expect(getDrivers).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(getVehicles).toHaveBeenCalledWith(expect.any(AbortSignal));

    expect(screen.getByRole('heading', { name: 'Drivers & Vehicles' })).toBeInTheDocument();
  });

  it('shows empty states when no drivers or vehicles exist', async () => {
    getDrivers.mockResolvedValue([]);
    getVehicles.mockResolvedValue([]);

    render(<FleetManagementPage />);

    expect(await screen.findByText('No drivers registered yet.')).toBeInTheDocument();
    expect(await screen.findByText('No vehicles registered yet.')).toBeInTheDocument();
  });

  it('creates a driver and refreshes the driver list', async () => {
    const user = userEvent.setup();

    getDrivers.mockResolvedValueOnce([driver]).mockResolvedValue([driver, newDriver]);

    render(<FleetManagementPage />);

    expect(await screen.findByText('Alex Driver')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Full name'), '  ALT026 Test Driver  ');

    await user.click(screen.getByRole('button', { name: 'Add driver' }));

    await waitFor(() => {
      expect(createDriver).toHaveBeenCalledWith({
        name: 'ALT026 Test Driver',
        active: true,
      });
    });

    await waitFor(() => {
      expect(getDrivers).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText('ALT026 Test Driver')).toBeInTheDocument();
    expect(screen.getByText('Driver created successfully.')).toBeInTheDocument();

    expect(screen.getByLabelText('Full name')).toHaveValue('');
  });

  it('registers a vehicle and refreshes the vehicle list', async () => {
    const user = userEvent.setup();

    getVehicles.mockResolvedValueOnce([vehicle]).mockResolvedValue([vehicle, newVehicle]);

    render(<FleetManagementPage />);

    expect(await screen.findByText('ABC-123')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Registration number'), ' ALT-026 ');

    await user.click(screen.getByRole('button', { name: 'Register vehicle' }));

    await waitFor(() => {
      expect(createVehicle).toHaveBeenCalledWith({
        registrationNumber: 'ALT-026',
        active: true,
      });
    });

    await waitFor(() => {
      expect(getVehicles).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText('ALT-026')).toBeInTheDocument();
    expect(screen.getByText('Vehicle registered successfully.')).toBeInTheDocument();

    expect(screen.getByLabelText('Registration number')).toHaveValue('');
  });

  it('rejects empty driver names and vehicle registration numbers', async () => {
    render(<FleetManagementPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Add driver' }));
    fireEvent.click(screen.getByRole('button', { name: 'Register vehicle' }));

    expect(await screen.findByText('Driver name is required.')).toBeInTheDocument();
    expect(screen.getByText('Registration number is required.')).toBeInTheDocument();

    expect(createDriver).not.toHaveBeenCalled();
    expect(createVehicle).not.toHaveBeenCalled();
  });

  it('allows creating inactive drivers and vehicles', async () => {
    const user = userEvent.setup();

    render(<FleetManagementPage />);

    await user.type(screen.getByLabelText('Full name'), 'Inactive Driver');

    const activeCheckboxes = screen.getAllByRole('checkbox', { name: 'Active' });

    await user.click(activeCheckboxes[0]);
    await user.click(screen.getByRole('button', { name: 'Add driver' }));

    await waitFor(() => {
      expect(createDriver).toHaveBeenCalledWith({
        name: 'Inactive Driver',
        active: false,
      });
    });

    await user.type(screen.getByLabelText('Registration number'), 'INACTIVE-01');

    await user.click(activeCheckboxes[1]);
    await user.click(screen.getByRole('button', { name: 'Register vehicle' }));

    await waitFor(() => {
      expect(createVehicle).toHaveBeenCalledWith({
        registrationNumber: 'INACTIVE-01',
        active: false,
      });
    });
  });

  it('shows an API error without clearing the vehicle form', async () => {
    const user = userEvent.setup();

    createVehicle.mockRejectedValue(
      new Error('A vehicle with this registration number already exists.'),
    );

    render(<FleetManagementPage />);

    await user.type(screen.getByLabelText('Registration number'), 'ABC-123');
    await user.click(screen.getByRole('button', { name: 'Register vehicle' }));

    expect(
      await screen.findByText('A vehicle with this registration number already exists.'),
    ).toBeInTheDocument();

    expect(screen.getByLabelText('Registration number')).toHaveValue('ABC-123');
    expect(getVehicles).toHaveBeenCalledTimes(1);
  });

  it('shows an API error without clearing the driver form', async () => {
    const user = userEvent.setup();

    createDriver.mockRejectedValue(new Error('Driver creation failed (500)'));

    render(<FleetManagementPage />);

    await user.type(screen.getByLabelText('Full name'), 'Test Driver');
    await user.click(screen.getByRole('button', { name: 'Add driver' }));

    expect(await screen.findByText('Driver creation failed (500)')).toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).toHaveValue('Test Driver');
  });

  it('retries loading drivers after a request failure', async () => {
    getDrivers
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce([driver]);

    render(<FleetManagementPage />);

    expect(await screen.findByText('Network unavailable')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh drivers' }));

    await waitFor(() => {
      expect(getDrivers).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText('Alex Driver')).toBeInTheDocument();
  });

  it('retries loading vehicles after a request failure', async () => {
    getVehicles
      .mockRejectedValueOnce(new Error('Vehicle service unavailable'))
      .mockResolvedValueOnce([vehicle]);

    render(<FleetManagementPage />);

    expect(await screen.findByText('Vehicle service unavailable')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh vehicles' }));

    await waitFor(() => {
      expect(getVehicles).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText('ABC-123')).toBeInTheDocument();
  });

  it('prevents duplicate driver submissions while a request is pending', async () => {
    const user = userEvent.setup();

    let resolveCreate!: (value: typeof newDriver) => void;

    createDriver.mockImplementation(
      () =>
        new Promise<typeof newDriver>((resolve) => {
          resolveCreate = resolve;
        }),
    );

    render(<FleetManagementPage />);

    await user.type(screen.getByLabelText('Full name'), 'ALT026 Test Driver');
    await user.click(screen.getByRole('button', { name: 'Add driver' }));

    expect(await screen.findByRole('button', { name: 'Creating...' })).toBeDisabled();
    expect(createDriver).toHaveBeenCalledTimes(1);

    resolveCreate(newDriver);

    expect(await screen.findByText('Driver created successfully.')).toBeInTheDocument();
  });

  it('prevents duplicate vehicle submissions while a request is pending', async () => {
    const user = userEvent.setup();

    let resolveCreate!: (value: typeof newVehicle) => void;

    createVehicle.mockImplementation(
      () =>
        new Promise<typeof newVehicle>((resolve) => {
          resolveCreate = resolve;
        }),
    );

    render(<FleetManagementPage />);

    await user.type(screen.getByLabelText('Registration number'), 'ALT-026');
    await user.click(screen.getByRole('button', { name: 'Register vehicle' }));

    expect(await screen.findByRole('button', { name: 'Registering...' })).toBeDisabled();
    expect(createVehicle).toHaveBeenCalledTimes(1);

    resolveCreate(newVehicle);

    expect(await screen.findByText('Vehicle registered successfully.')).toBeInTheDocument();
  });

  it('renders active and inactive statuses correctly', async () => {
    getDrivers.mockResolvedValue([
      driver,
      { id: 'driver-inactive', name: 'Inactive Driver', active: false },
    ]);

    getVehicles.mockResolvedValue([
      vehicle,
      { id: 'vehicle-inactive', registrationNumber: 'XYZ-999', active: false },
    ]);

    render(<FleetManagementPage />);

    const inactiveDriver = await screen.findByText('Inactive Driver');
    const inactiveVehicle = await screen.findByText('XYZ-999');

    expect(within(inactiveDriver.parentElement!).getByText('Inactive')).toBeInTheDocument();
    expect(within(inactiveVehicle.parentElement!).getByText('Inactive')).toBeInTheDocument();
  });
});
