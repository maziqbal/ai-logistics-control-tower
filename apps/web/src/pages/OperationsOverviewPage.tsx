import { useState } from 'react';
import { useLiveSimulation } from '../hooks/useLiveSimulation';
import { useDeliveryDays } from '../hooks/useDeliveryDays';
import { useOperationsData } from '../hooks/useOperationsData';
import { useRouteStops } from '../hooks/useRouteStops';
import { useRouteGeometry } from '../hooks/useRouteGeometry';
import { AlertCircle, CalendarDays, ChevronDown, ClipboardList, RefreshCw } from 'lucide-react';

import { ParcelAssignmentPanel } from '../components/dispatch/ParcelAssignmentPanel';
import { ParcelCreationPanel } from '../components/dispatch/ParcelCreationPanel';
import { RouteAssignmentPanel } from '../components/dispatch/RouteAssignmentPanel';
import { RouteMap } from '../components/dispatch/RouteMap';
import { OperationsStats } from '../components/dispatch/OperationsStats';
import { DeliveryRoutesPanel } from '../components/dispatch/DeliveryRoutesPanel';
import { RouteStopsPanel } from '../components/dispatch/RouteStopsPanel';
import { logisticsApi, type CreateParcelInput } from '../api/logistics-api';

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
  // ALT-034: Delivery-day fetching is isolated; selection stays in this page.
  const { daysRequest, daysReady, days, setDaysRetry } = useDeliveryDays();
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const currentDayId = selectedDayId === null ? (days[0]?.id ?? '') : selectedDayId;

  // ALT-034: Routes and parcels fetching now lives in a dedicated hook.
  const {
    operationsRequest,
    setOperationsRetry,
    operationsReady,
    operationsSuccess,
    routes,
    parcels,
  } = useOperationsData(currentDayId);

  const currentRouteId =
    selectedRouteId && routes.some((route) => route.id === selectedRouteId)
      ? selectedRouteId
      : (routes[0]?.id ?? '');

  // ALT-033: Subscribe to live GPS updates for the selected route.
  // The hook also retrieves the current simulation snapshot.
  const {
    snapshot: liveVehicle,
    connectionStatus: liveConnectionStatus,
    error: liveSimulationError,
  } = useLiveSimulation(operationsSuccess ? currentRouteId : '');

  // ALT-034 Step 6A: Fetch route stops in an isolated hook.
  const { stopsRequest, stopsReady, stopsSuccess, stops, setStopsRetry, stopsKey } = useRouteStops(
    currentDayId,
    currentRouteId,
    operationsSuccess,
  );

  // ALT-034 Step 6B: OSRM geometry fetching is isolated in its own hook.
  const { routeGeometry, geometryLoading, geometryError } = useRouteGeometry(
    currentRouteId,
    stopsSuccess,
    stopsKey,
  );

  const selectedDay = days.find((day) => day.id === currentDayId);

  const assignedCount = parcels.filter((parcel) => parcel.stopId !== null).length;

  const selectedRoute = routes.find((route) => route.id === currentRouteId);

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
                  {formatDate(day.serviceDate)}
                  {' · '}
                  {day.operatingArea}
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

      <OperationsStats
        routesCount={routes.length}
        parcelsCount={parcels.length}
        assignedCount={assignedCount}
        isReady={operationsSuccess}
      />

      <div className="mt-5 grid items-start gap-4 xl:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.7fr)]">
        <div className="space-y-4">
          <DeliveryRoutesPanel
            routes={routes}
            selectedRouteId={currentRouteId}
            daysReady={daysReady}
            currentDayId={currentDayId}
            operationsReady={operationsReady}
            operationsSuccess={operationsSuccess}
            onSelectRoute={(routeId) => {
              setSelectedRouteId(routeId);
              setStopsRetry(0);
            }}
          />

          {operationsSuccess && selectedRoute && (
            <RouteAssignmentPanel
              key={`${currentDayId}:${selectedRoute.id}:${selectedRoute.version}:${selectedRoute.driverId ?? ''}:${selectedRoute.vehicleId ?? ''}`}
              route={selectedRoute}
              onAssigned={() => setOperationsRetry((value) => value + 1)}
            />
          )}

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

        <div className="min-w-0 space-y-4">
          {/* Interactive map for the selected route */}
          {!operationsSuccess ? (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-bold text-[#14243b]">Route Map</h3>
              <p role="status" className="mt-3 text-sm text-slate-500">
                {operationsReady ? 'Route data unavailable.' : 'Waiting for route data...'}
              </p>
            </section>
          ) : !currentRouteId ? (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-bold text-[#14243b]">Route Map</h3>
              <p className="mt-3 text-sm text-slate-500">No route selected.</p>
            </section>
          ) : !stopsReady ? (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-bold text-[#14243b]">Route Map</h3>
              <p role="status" className="mt-3 text-sm text-slate-500">
                Loading route map...
              </p>
            </section>
          ) : !stopsSuccess ? (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-bold text-[#14243b]">Route Map</h3>
              <p className="mt-3 text-sm text-slate-500">
                Map unavailable because stops could not be loaded.
              </p>
            </section>
          ) : (
            <RouteMap
              key={`${currentDayId}:${currentRouteId}`}
              stops={stops}
              parcels={parcels}
              geometry={routeGeometry?.geometry ?? null}
              distanceMeters={routeGeometry?.distanceMeters ?? null}
              durationSeconds={routeGeometry?.durationSeconds ?? null}
              routeStatus={routeGeometry?.status ?? null}
              geometryLoading={geometryLoading}
              geometryError={geometryError}
              vehicle={liveVehicle}
              liveConnectionStatus={liveConnectionStatus}
              liveSimulationError={liveSimulationError}
            />
          )}

          <RouteStopsPanel
            operationsSuccess={operationsSuccess}
            operationsReady={operationsReady}
            currentRouteId={currentRouteId}
            stopsReady={stopsReady}
            stopsSuccess={stopsSuccess}
            stops={stops}
            parcels={parcels}
            stopsError={stopsRequest?.error ?? ''}
            onRetryStops={() => setStopsRetry((value) => value + 1)}
          />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2 text-xs text-slate-400">
        <ClipboardList size={14} />
        Dispatcher operations · Data from Logistics API
        {selectedDay && (
          <span className="ml-auto hidden sm:inline">
            {selectedDay.operatingArea}
            {' · '}
            {formatDate(selectedDay.serviceDate)}
          </span>
        )}
      </div>
    </>
  );
}
