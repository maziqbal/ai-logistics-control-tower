import { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  MapPin,
  Package,
  RefreshCw,
  Route,
  Truck,
} from 'lucide-react';

import { ParcelAssignmentPanel } from '../components/dispatch/ParcelAssignmentPanel';
import { ParcelCreationPanel } from '../components/dispatch/ParcelCreationPanel';
import {
  logisticsApi,
  type CreateParcelInput,
  type DeliveryDay,
  type DeliveryRoute,
  type DeliveryStop,
  type Parcel,
} from '../api/logistics-api';

type RequestState<T> = {
  key: string;
  status: 'success' | 'error';
  data: T;
  error: string;
};

type OperationsData = {
  routes: DeliveryRoute[];
  parcels: Parcel[];
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

function ErrorNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
    >
      <div className="flex items-center gap-2 text-sm text-red-700">
        <AlertCircle size={18} className="shrink-0" />
        <span>{message}</span>
      </div>

      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700"
      >
        <RefreshCw size={15} />
        Retry
      </button>
    </div>
  );
}

export function OperationsOverviewPage() {
  const [daysRequest, setDaysRequest] = useState<RequestState<DeliveryDay[]> | null>(null);
  const [daysRetry, setDaysRetry] = useState(0);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  const [operationsRequest, setOperationsRequest] = useState<RequestState<OperationsData> | null>(
    null,
  );
  const [operationsRetry, setOperationsRetry] = useState(0);

  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [stopsRequest, setStopsRequest] = useState<RequestState<DeliveryStop[]> | null>(null);
  const [stopsRetry, setStopsRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    logisticsApi
      .getDeliveryDays(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setDaysRequest({
            key: String(daysRetry),
            status: 'success',
            data,
            error: '',
          });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setDaysRequest({
            key: String(daysRetry),
            status: 'error',
            data: [],
            error: getErrorMessage(error),
          });
        }
      });

    return () => controller.abort();
  }, [daysRetry]);

  const daysReady = daysRequest?.key === String(daysRetry);
  const days = daysReady && daysRequest?.status === 'success' ? daysRequest.data : [];

  const currentDayId = selectedDayId === null ? (days[0]?.id ?? '') : selectedDayId;

  useEffect(() => {
    if (!currentDayId) return;

    const controller = new AbortController();

    Promise.all([
      logisticsApi.getRoutes(currentDayId, controller.signal),
      logisticsApi.getParcels(currentDayId, controller.signal),
    ])
      .then(([routes, parcels]) => {
        if (!controller.signal.aborted) {
          setOperationsRequest({
            key: `${currentDayId}:${operationsRetry}`,
            status: 'success',
            data: { routes, parcels },
            error: '',
          });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setOperationsRequest({
            key: `${currentDayId}:${operationsRetry}`,
            status: 'error',
            data: { routes: [], parcels: [] },
            error: getErrorMessage(error),
          });
        }
      });

    return () => controller.abort();
  }, [currentDayId, operationsRetry]);

  const operationsKey = `${currentDayId}:${operationsRetry}`;
  const operationsReady = operationsRequest?.key === operationsKey;
  const operationsSuccess = operationsReady && operationsRequest?.status === 'success';

  const routes = operationsSuccess ? operationsRequest.data.routes : [];
  const parcels = operationsSuccess ? operationsRequest.data.parcels : [];

  const currentRouteId =
    selectedRouteId && routes.some((route) => route.id === selectedRouteId)
      ? selectedRouteId
      : (routes[0]?.id ?? '');

  useEffect(() => {
    if (!currentRouteId || !operationsSuccess) return;

    const controller = new AbortController();

    logisticsApi
      .getStops(currentRouteId, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setStopsRequest({
            key: `${currentDayId}:${currentRouteId}:${stopsRetry}`,
            status: 'success',
            data,
            error: '',
          });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setStopsRequest({
            key: `${currentDayId}:${currentRouteId}:${stopsRetry}`,
            status: 'error',
            data: [],
            error: getErrorMessage(error),
          });
        }
      });

    return () => controller.abort();
  }, [currentDayId, currentRouteId, operationsSuccess, stopsRetry]);

  const stopsKey = `${currentDayId}:${currentRouteId}:${stopsRetry}`;
  const stopsReady = stopsRequest?.key === stopsKey;
  const stopsSuccess = stopsReady && stopsRequest?.status === 'success';

  const stops = stopsSuccess ? [...stopsRequest.data].sort((a, b) => a.sequence - b.sequence) : [];

  const selectedDay = days.find((day) => day.id === currentDayId);
  const assignedCount = parcels.filter((parcel) => parcel.stopId !== null).length;

  const assignmentPercent =
    parcels.length > 0 ? Math.round((assignedCount / parcels.length) * 100) : 0;

  const stats = [
    { label: 'Routes', value: routes.length, icon: Route },
    { label: 'Parcels', value: parcels.length, icon: Package },
    {
      label: 'Assigned Parcels',
      value: assignedCount,
      icon: CheckCircle2,
    },
    {
      label: 'Unassigned Parcels',
      value: parcels.length - assignedCount,
      icon: Activity,
    },
  ];

  const selectedRouteIndex = routes.findIndex((route) => route.id === currentRouteId);
  const selectedRouteLabel =
    selectedRouteIndex >= 0 ? `Route ${selectedRouteIndex + 1}` : 'the selected route';

  function refreshDashboard() {
    setDaysRetry((value) => value + 1);
    setOperationsRetry((value) => value + 1);
    setStopsRetry((value) => value + 1);
  }

  async function handleCreateParcel(input: CreateParcelInput): Promise<void> {
    if (!currentDayId || !operationsSuccess) {
      throw new Error('Delivery data is not ready. Please try again.');
    }

    await logisticsApi.createParcel(currentDayId, input);

    // Refresh server data so parcel counts and assignment options update.
    setOperationsRetry((value) => value + 1);
  }

  async function handleAssignParcel(parcelId: string, stopId: string): Promise<void> {
    if (!currentDayId || !currentRouteId || !operationsSuccess || !stopsSuccess) {
      throw new Error('Delivery data is not ready. Please try again.');
    }

    const parcelIsUnassigned = parcels.some(
      (parcel) => parcel.id === parcelId && parcel.stopId === null,
    );

    const stopBelongsToSelectedRoute = stops.some(
      (stop) => stop.id === stopId && stop.routeId === currentRouteId,
    );

    if (!parcelIsUnassigned) {
      throw new Error('Please select a valid unassigned parcel.');
    }

    if (!stopBelongsToSelectedRoute) {
      throw new Error('Please select a stop from the current route.');
    }

    await logisticsApi.assignParcelToStop(currentDayId, parcelId, stopId);

    // Reload server data so KPI counts and stop details reflect the assignment.
    setOperationsRetry((value) => value + 1);
    setStopsRetry((value) => value + 1);
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#14243b]">Operations Overview</h2>
          <p className="mt-1 text-sm text-slate-500">
            Routes, stops and parcel assignments at a glance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <CalendarDays
              size={16}
              className="pointer-events-none absolute top-2.5 left-3 text-slate-400"
            />

            <select
              aria-label="Select delivery day"
              value={currentDayId}
              disabled={!daysReady || daysRequest?.status === 'error'}
              onChange={(event) => {
                setSelectedDayId(event.target.value);
                setSelectedRouteId(null);
                setOperationsRetry(0);
                setStopsRetry(0);
              }}
              className="min-w-54 appearance-none rounded-lg border border-slate-200 bg-white py-2 pr-9 pl-9 text-sm text-slate-700 shadow-sm disabled:opacity-60"
            >
              {days.length === 0 && (
                <option value="">
                  {!daysReady ? 'Loading delivery days...' : 'No delivery days'}
                </option>
              )}

              {days.map((day) => (
                <option key={day.id} value={day.id}>
                  {formatDate(day.serviceDate)} · {day.operatingArea}
                </option>
              ))}
            </select>

            <ChevronDown
              size={15}
              className="pointer-events-none absolute top-2.5 right-3 text-slate-400"
            />
          </div>

          <button
            type="button"
            onClick={refreshDashboard}
            aria-label="Refresh dashboard"
            title="Refresh dashboard"
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:text-teal-700"
          >
            <RefreshCw size={17} />
          </button>
        </div>
      </div>

      <div className="mb-4 space-y-3">
        {daysReady && daysRequest?.status === 'error' && (
          <ErrorNotice
            message={`Unable to load delivery days: ${daysRequest.error}`}
            onRetry={() => setDaysRetry((value) => value + 1)}
          />
        )}

        {currentDayId && operationsReady && operationsRequest?.status === 'error' && (
          <ErrorNotice
            message={`Unable to load operations: ${operationsRequest.error}`}
            onRetry={() => setOperationsRetry((value) => value + 1)}
          />
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">{label}</span>
              <Icon size={17} className="text-teal-700" />
            </div>

            <p className="mt-3 text-3xl font-bold text-[#14243b]">
              {operationsSuccess ? value : '—'}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
        <div className="min-w-42">
          <p className="text-xs font-bold text-[#14243b]">Assignment Progress</p>
          <p className="mt-1 text-[11px] text-slate-500">
            {operationsSuccess
              ? `${assignedCount} of ${parcels.length} parcels assigned`
              : 'Waiting for assignment data'}
          </p>
        </div>

        <div
          className="h-2 min-w-30 flex-1 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-label="Parcel assignment progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={operationsSuccess ? assignmentPercent : 0}
        >
          <div
            className="h-full rounded-full bg-teal-500"
            style={{
              width: `${operationsSuccess ? assignmentPercent : 0}%`,
            }}
          />
        </div>

        <span className="text-sm font-bold text-teal-700">
          {operationsSuccess ? `${assignmentPercent}%` : '—'}
        </span>
      </div>

      <div className="mt-5 grid items-start gap-4 xl:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.7fr)]">
        <div className="space-y-4">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="font-bold text-[#14243b]">Delivery Routes</h3>
              <p className="mt-1 text-xs text-slate-500">
                {operationsSuccess ? `${routes.length} routes for selected day` : 'Route overview'}
              </p>
            </div>

            <div className="space-y-2 p-3">
              {!daysReady || (currentDayId && !operationsReady) ? (
                <p role="status" className="p-4 text-sm text-slate-500">
                  Loading routes...
                </p>
              ) : !currentDayId ? (
                <p className="p-4 text-sm text-slate-500">No delivery days available.</p>
              ) : !operationsSuccess ? (
                <p className="p-4 text-sm text-slate-500">Routes could not be loaded.</p>
              ) : routes.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">No routes for this delivery day.</p>
              ) : (
                routes.map((route, index) => (
                  <button
                    key={route.id}
                    type="button"
                    onClick={() => {
                      setSelectedRouteId(route.id);
                      setStopsRetry(0);
                    }}
                    aria-pressed={currentRouteId === route.id}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      currentRouteId === route.id
                        ? 'border-teal-400 bg-teal-50/70'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-bold text-[#14243b]">
                        <Truck size={16} className="text-teal-700" />
                        Route {index + 1}
                      </span>

                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 capitalize">
                        {route.status}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-slate-500">
                      Driver: {route.driverId ? 'Assigned' : 'Unassigned'}
                      {' · '}
                      Vehicle: {route.vehicleId ? 'Assigned' : 'Unassigned'}
                    </p>
                  </button>
                ))
              )}
            </div>
          </section>

          {currentDayId && (
            <ParcelCreationPanel
              key={currentDayId}
              disabled={!operationsSuccess}
              onCreate={handleCreateParcel}
            />
          )}

          {currentDayId && currentRouteId && (
            <ParcelAssignmentPanel
              key={`${currentDayId}:${currentRouteId}`}
              parcels={
                operationsSuccess
                  ? parcels
                  : operationsRequest?.key.startsWith(`${currentDayId}:`) &&
                      operationsRequest.status === 'success'
                    ? operationsRequest.data.parcels
                    : []
              }
              stops={
                stopsSuccess
                  ? stops
                  : stopsRequest?.key.startsWith(`${currentDayId}:${currentRouteId}:`) &&
                      stopsRequest.status === 'success'
                    ? stopsRequest.data
                    : []
              }
              routeLabel={selectedRouteLabel}
              disabled={!operationsSuccess || !stopsSuccess}
              onAssign={handleAssignParcel}
            />
          )}
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="font-bold text-[#14243b]">Route Stops & Parcels</h3>
            <p className="mt-1 text-xs text-slate-500">Stops displayed in delivery sequence</p>
          </div>

          <div className="space-y-3 p-4">
            {!operationsSuccess ? (
              <p className="text-sm text-slate-500">
                {operationsReady ? 'Route details unavailable.' : 'Waiting for route data...'}
              </p>
            ) : !currentRouteId ? (
              <p className="text-sm text-slate-500">No route selected.</p>
            ) : !stopsReady ? (
              <p role="status" className="text-sm text-slate-500">
                Loading stops...
              </p>
            ) : !stopsSuccess ? (
              <ErrorNotice
                message={`Unable to load stops: ${stopsRequest.error}`}
                onRetry={() => setStopsRetry((value) => value + 1)}
              />
            ) : stops.length === 0 ? (
              <p className="text-sm text-slate-500">No stops have been added to this route.</p>
            ) : (
              stops.map((stop) => {
                const stopParcels = parcels.filter((parcel) => parcel.stopId === stop.id);

                return (
                  <div key={stop.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-bold text-teal-700">
                        {stop.sequence}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#14243b]">{stop.locationKey}</p>
                        <p className="mt-1 text-xs text-slate-500">{stopParcels.length} parcels</p>
                      </div>

                      <MapPin size={16} className="shrink-0 text-slate-400" />
                    </div>

                    {stopParcels.length > 0 && (
                      <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                        {stopParcels.map((parcel) => (
                          <div
                            key={parcel.id}
                            className="flex items-start gap-2 rounded-lg bg-slate-50 p-3"
                          >
                            <Package size={15} className="mt-0.5 shrink-0 text-teal-700" />

                            <div>
                              <p className="text-xs font-bold text-[#14243b]">
                                {parcel.trackingNumber}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">{parcel.destination}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <div className="mt-5 flex items-center gap-2 text-xs text-slate-400">
        <ClipboardList size={14} />
        Dispatcher operations · Data from Logistics API
        {selectedDay && (
          <span className="ml-auto hidden sm:inline">
            {selectedDay.operatingArea} · {formatDate(selectedDay.serviceDate)}
          </span>
        )}
      </div>
    </>
  );
}
