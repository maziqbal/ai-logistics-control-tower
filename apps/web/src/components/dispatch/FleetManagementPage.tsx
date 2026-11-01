import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, RefreshCw, Truck, Users } from 'lucide-react';

import {
  logisticsApi,
  type CreateDriverInput,
  type CreateVehicleInput,
  type Driver,
  type Vehicle,
} from '../../api/logistics-api';

type LoadState<T> = {
  status: 'loading' | 'success' | 'error';
  data: T[];
  error: string;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

function StatusLabel({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

export function FleetManagementPage() {
  const [drivers, setDrivers] = useState<LoadState<Driver>>({
    status: 'loading',
    data: [],
    error: '',
  });
  const [vehicles, setVehicles] = useState<LoadState<Vehicle>>({
    status: 'loading',
    data: [],
    error: '',
  });

  const [driversRetry, setDriversRetry] = useState(0);
  const [vehiclesRetry, setVehiclesRetry] = useState(0);

  const [driverName, setDriverName] = useState('');
  const [driverActive, setDriverActive] = useState(true);
  const [vehicleRegistration, setVehicleRegistration] = useState('');
  const [vehicleActive, setVehicleActive] = useState(true);

  const [creatingDriver, setCreatingDriver] = useState(false);
  const [creatingVehicle, setCreatingVehicle] = useState(false);
  const [driverFeedback, setDriverFeedback] = useState('');
  const [vehicleFeedback, setVehicleFeedback] = useState('');
  const [driverError, setDriverError] = useState('');
  const [vehicleError, setVehicleError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    logisticsApi
      .getDrivers(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setDrivers({ status: 'success', data, error: '' });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setDrivers({
            status: 'error',
            data: [],
            error: errorMessage(error),
          });
        }
      });

    return () => controller.abort();
  }, [driversRetry]);

  useEffect(() => {
    const controller = new AbortController();

    logisticsApi
      .getVehicles(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setVehicles({ status: 'success', data, error: '' });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setVehicles({
            status: 'error',
            data: [],
            error: errorMessage(error),
          });
        }
      });

    return () => controller.abort();
  }, [vehiclesRetry]);

  async function handleCreateDriver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creatingDriver) return;

    const name = driverName.trim();

    setDriverError('');
    setDriverFeedback('');

    if (!name) {
      setDriverError('Driver name is required.');
      return;
    }

    const input: CreateDriverInput = { name, active: driverActive };

    setCreatingDriver(true);

    try {
      await logisticsApi.createDriver(input);
      setDriverName('');
      setDriverActive(true);
      setDriverFeedback('Driver created successfully.');
      setDriversRetry((value) => value + 1);
    } catch (error) {
      setDriverError(errorMessage(error));
    } finally {
      setCreatingDriver(false);
    }
  }

  async function handleCreateVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creatingVehicle) return;

    const registrationNumber = vehicleRegistration.trim();

    setVehicleError('');
    setVehicleFeedback('');

    if (!registrationNumber) {
      setVehicleError('Registration number is required.');
      return;
    }

    const input: CreateVehicleInput = {
      registrationNumber,
      active: vehicleActive,
    };

    setCreatingVehicle(true);

    try {
      await logisticsApi.createVehicle(input);
      setVehicleRegistration('');
      setVehicleActive(true);
      setVehicleFeedback('Vehicle registered successfully.');
      setVehiclesRetry((value) => value + 1);
    } catch (error) {
      setVehicleError(errorMessage(error));
    } finally {
      setCreatingVehicle(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-[#14243b]">Drivers & Vehicles</h2>
        <p className="mt-1 text-sm text-slate-500">
          Manage the drivers and vehicles available for delivery operations.
        </p>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <Users size={19} className="text-teal-700" />
              <h3 className="font-bold text-[#14243b]">Drivers</h3>
            </div>
            <button
              type="button"
              aria-label="Refresh drivers"
              onClick={() => setDriversRetry((value) => value + 1)}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:text-teal-700"
            >
              <RefreshCw size={15} />
            </button>
          </div>

          <div className="space-y-4 p-5">
            {drivers.status === 'loading' && (
              <p role="status" className="text-sm text-slate-500">
                Loading drivers...
              </p>
            )}

            {drivers.status === 'error' && (
              <p role="alert" className="flex items-center gap-2 text-sm text-red-700">
                <AlertCircle size={16} />
                {drivers.error}
              </p>
            )}

            {drivers.status === 'success' && (
              <div className="space-y-2">
                {drivers.data.length === 0 ? (
                  <p className="text-sm text-slate-500">No drivers registered yet.</p>
                ) : (
                  drivers.data.map((driver) => (
                    <div
                      key={driver.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-3"
                    >
                      <span className="text-sm font-medium text-[#14243b]">{driver.name}</span>
                      <StatusLabel active={driver.active} />
                    </div>
                  ))
                )}
              </div>
            )}

            <form
              onSubmit={handleCreateDriver}
              className="space-y-3 border-t border-slate-100 pt-4"
            >
              <h4 className="text-sm font-semibold text-[#14243b]">Add a driver</h4>

              <label htmlFor="driver-name" className="block text-xs font-medium text-slate-600">
                Full name
              </label>
              <input
                id="driver-name"
                value={driverName}
                onChange={(event) => setDriverName(event.target.value)}
                placeholder="Alex Driver"
                disabled={creatingDriver}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500 disabled:opacity-60"
              />

              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={driverActive}
                  onChange={(event) => setDriverActive(event.target.checked)}
                  disabled={creatingDriver}
                />
                Active
              </label>

              {driverError && (
                <p role="alert" className="text-sm text-red-700">
                  {driverError}
                </p>
              )}
              {driverFeedback && (
                <p role="status" className="text-sm text-emerald-700">
                  {driverFeedback}
                </p>
              )}

              <button
                type="submit"
                disabled={creatingDriver}
                className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {creatingDriver ? 'Creating...' : 'Add driver'}
              </button>
            </form>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <Truck size={19} className="text-teal-700" />
              <h3 className="font-bold text-[#14243b]">Vehicles</h3>
            </div>
            <button
              type="button"
              aria-label="Refresh vehicles"
              onClick={() => setVehiclesRetry((value) => value + 1)}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:text-teal-700"
            >
              <RefreshCw size={15} />
            </button>
          </div>

          <div className="space-y-4 p-5">
            {vehicles.status === 'loading' && (
              <p role="status" className="text-sm text-slate-500">
                Loading vehicles...
              </p>
            )}

            {vehicles.status === 'error' && (
              <p role="alert" className="flex items-center gap-2 text-sm text-red-700">
                <AlertCircle size={16} />
                {vehicles.error}
              </p>
            )}

            {vehicles.status === 'success' && (
              <div className="space-y-2">
                {vehicles.data.length === 0 ? (
                  <p className="text-sm text-slate-500">No vehicles registered yet.</p>
                ) : (
                  vehicles.data.map((vehicle) => (
                    <div
                      key={vehicle.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-3"
                    >
                      <span className="text-sm font-medium text-[#14243b]">
                        {vehicle.registrationNumber}
                      </span>
                      <StatusLabel active={vehicle.active} />
                    </div>
                  ))
                )}
              </div>
            )}

            <form
              onSubmit={handleCreateVehicle}
              className="space-y-3 border-t border-slate-100 pt-4"
            >
              <h4 className="text-sm font-semibold text-[#14243b]">Register a vehicle</h4>

              <label
                htmlFor="vehicle-registration"
                className="block text-xs font-medium text-slate-600"
              >
                Registration number
              </label>
              <input
                id="vehicle-registration"
                value={vehicleRegistration}
                onChange={(event) => setVehicleRegistration(event.target.value)}
                placeholder="ABC-123"
                disabled={creatingVehicle}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500 disabled:opacity-60"
              />

              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={vehicleActive}
                  onChange={(event) => setVehicleActive(event.target.checked)}
                  disabled={creatingVehicle}
                />
                Active
              </label>

              {vehicleError && (
                <p role="alert" className="text-sm text-red-700">
                  {vehicleError}
                </p>
              )}
              {vehicleFeedback && (
                <p role="status" className="text-sm text-emerald-700">
                  {vehicleFeedback}
                </p>
              )}

              <button
                type="submit"
                disabled={creatingVehicle}
                className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {creatingVehicle ? 'Registering...' : 'Register vehicle'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
