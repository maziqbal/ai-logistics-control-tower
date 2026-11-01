import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, Truck } from 'lucide-react';

import {
  logisticsApi,
  type DeliveryRoute,
  type Driver,
  type Vehicle,
} from '../../api/logistics-api';

type Props = {
  route: DeliveryRoute;
  onAssigned: () => void;
};

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'An unexpected error occurred.';
}

export function RouteAssignmentPanel({ route, onAssigned }: Props) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);

  // Initialize from the selected route.
  // No synchronous setState in an effect.
  const [driverId, setDriverId] = useState(route.driverId ?? '');
  const [vehicleId, setVehicleId] = useState(route.vehicleId ?? '');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      logisticsApi.getDrivers(controller.signal),
      logisticsApi.getVehicles(controller.signal),
    ])
      .then(([driverData, vehicleData]) => {
        if (controller.signal.aborted) return;

        setDrivers(driverData);
        setVehicles(vehicleData);
        setLoadError('');
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setLoadError(errorMessage(error));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [retry]);

  const isDraft = route.status === 'draft';

  const hasChanges =
    driverId !== (route.driverId ?? '') ||
    vehicleId !== (route.vehicleId ?? '');

  const driverOptions = drivers.filter(
    (driver) => driver.active || driver.id === route.driverId,
  );

  const vehicleOptions = vehicles.filter(
    (vehicle) => vehicle.active || vehicle.id === route.vehicleId,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isDraft || saving || loading || loadError || !hasChanges) {
      return;
    }

    setSaving(true);
    setSaveError('');
    setSuccess('');

    try {
      await logisticsApi.updateRouteAssignment(route.id, {
        driverId: driverId || null,
        vehicleId: vehicleId || null,
      });

      setSuccess('Route assignment updated successfully.');
      onAssigned();
    } catch (error: unknown) {
      setSaveError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <Truck size={18} className="text-teal-700" />

          <h3 className="font-bold text-[#14243b]">
            Route Assignment
          </h3>
        </div>

        <p className="mt-1 text-xs text-slate-500">
          Assign a driver and vehicle to the selected route.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        {!isDraft && (
          <p
            role="status"
            className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800"
          >
            Assignments can only be changed on draft routes.
          </p>
        )}

        {loading && (
          <p role="status" className="text-sm text-slate-500">
            Loading fleet...
          </p>
        )}

        {loadError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            <span>{loadError}</span>

            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setLoadError('');
                setRetry((value) => value + 1);
              }}
              className="font-semibold underline"
            >
              Retry
            </button>
          </div>
        )}

        <div>
          <label
            htmlFor="route-driver"
            className="mb-1.5 block text-sm font-semibold text-slate-700"
          >
            Driver
          </label>

          <select
            id="route-driver"
            value={driverId}
            onChange={(event) => {
              setDriverId(event.target.value);
              setSaveError('');
              setSuccess('');
            }}
            disabled={!isDraft || loading || !!loadError || saving}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:bg-slate-50"
          >
            <option value="">Unassigned</option>

            {driverOptions.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name}
                {!driver.active ? ' (inactive)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="route-vehicle"
            className="mb-1.5 block text-sm font-semibold text-slate-700"
          >
            Vehicle
          </label>

          <select
            id="route-vehicle"
            value={vehicleId}
            onChange={(event) => {
              setVehicleId(event.target.value);
              setSaveError('');
              setSuccess('');
            }}
            disabled={!isDraft || loading || !!loadError || saving}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:bg-slate-50"
          >
            <option value="">Unassigned</option>

            {vehicleOptions.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.registrationNumber}
                {!vehicle.active ? ' (inactive)' : ''}
              </option>
            ))}
          </select>
        </div>

        {saveError && (
          <p
            role="alert"
            className="flex items-center gap-2 text-sm text-red-700"
          >
            <AlertCircle size={16} />
            {saveError}
          </p>
        )}

        {success && (
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-teal-700"
          >
            <CheckCircle2 size={16} />
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={
            !isDraft ||
            loading ||
            !!loadError ||
            saving ||
            !hasChanges
          }
          className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving assignment...' : 'Save Assignment'}
        </button>
      </form>
    </section>
  );
}
