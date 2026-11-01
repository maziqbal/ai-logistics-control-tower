import { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Boxes,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  Map,
  Menu,
  Package,
  RefreshCw,
  Route,
  Truck,
  X,
} from 'lucide-react';

import {
  logisticsApi,
  type DeliveryDay,
  type DeliveryRoute,
  type DeliveryStop,
  type Parcel,
} from './api/logistics-api';

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

type SidebarProps = {
  activePage: string;
  onNavigate: (page: string) => void;
  onClose: () => void;
};

const navigation = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Delivery Days', icon: CalendarDays },
  { label: 'Routes', icon: Route },
  { label: 'Live Tracking', icon: Map },
  { label: 'Drivers', icon: Truck },
  { label: 'Parcels', icon: Package },
];

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

function Sidebar({ activePage, onNavigate, onClose }: SidebarProps) {
  return (
    <aside className="flex h-full w-64 flex-col bg-navy-950 text-slate-300">
      <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white">
          <Boxes size={23} />
        </div>
        <div>
          <div className="text-sm font-bold tracking-wide text-white">
            CONTROL TOWER
          </div>
          <div className="text-[11px] text-slate-400">
            Logistics Intelligence
          </div>
        </div>
        <button
          type="button"
          className="ml-auto lg:hidden"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <X size={20} />
        </button>
      </div>

      <div className="px-4 pt-7">
        <p className="mb-3 px-3 text-[10px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
          Workspace
        </p>

        <nav className="space-y-1" aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon }) => {
            const active = activePage === label;

            return (
              <button
                key={label}
                type="button"
                onClick={() => onNavigate(label)}
                aria-current={active ? 'page' : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors ${
                  active
                    ? 'bg-brand-500/15 font-medium text-teal-300'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon size={18} />
                <span className="flex-1">{label}</span>
                {active && <ChevronRight size={15} />}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto border-t border-white/10 p-5">
        <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
            CT
          </div>
          <div>
            <div className="text-xs font-semibold text-white">Dispatcher</div>
            <div className="text-[11px] text-slate-400">
              Operations workspace
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function ErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4"
    >
      <div className="flex items-center gap-3 text-sm text-red-700">
        <AlertCircle size={19} className="shrink-0" />
        <span>{message}</span>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
      >
        <RefreshCw size={15} />
        Retry
      </button>
    </div>
  );
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePage, setActivePage] = useState('Overview');

  const [daysRequest, setDaysRequest] = useState<RequestState<DeliveryDay[]> | null>(null);
  const [daysRetry, setDaysRetry] = useState(0);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  const [operationsRequest, setOperationsRequest] =
    useState<RequestState<OperationsData> | null>(null);
  const [operationsRetry, setOperationsRetry] = useState(0);

  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [stopsRequest, setStopsRequest] =
    useState<RequestState<DeliveryStop[]> | null>(null);
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
  const days = daysReady && daysRequest?.status === 'success'
    ? daysRequest.data
    : [];

  const currentDayId =
    selectedDayId === null ? (days[0]?.id ?? '') : selectedDayId;

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
  const operationsSuccess =
    operationsReady && operationsRequest?.status === 'success';

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
  const stops = stopsSuccess ? stopsRequest.data : [];

  const selectedDay = days.find((day) => day.id === currentDayId);
  const assignedCount = parcels.filter((parcel) => parcel.stopId !== null).length;

  const stats = [
    { label: 'Routes', value: routes.length, icon: Route },
    { label: 'Parcels', value: parcels.length, icon: Package },
    { label: 'Assigned Parcels', value: assignedCount, icon: Boxes },
    {
      label: 'Unassigned Parcels',
      value: parcels.length - assignedCount,
      icon: Activity,
    },
  ];

  function handleNavigate(page: string) {
    setActivePage(page);
    setSidebarOpen(false);
  }

  return (
    <div className="flex min-h-screen bg-workspace">
      <div className="sticky top-0 hidden h-screen shrink-0 lg:block">
        <Sidebar
          activePage={activePage}
          onNavigate={handleNavigate}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/60"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation overlay"
          />
          <div className="relative h-full">
            <Sidebar
              activePage={activePage}
              onNavigate={handleNavigate}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200 bg-white px-5 lg:px-9">
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="rounded-lg p-2 lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={22} />
            </button>

            <div>
              <p className="text-xs text-slate-400">
                Operations / {activePage}
              </p>
              <h1 className="mt-1 text-lg font-bold text-navy-950">
                {activePage}
              </h1>
            </div>
          </div>

          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">
            CT
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 lg:px-9">
          {activePage === 'Overview' ? (
            <>
              <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-navy-950">
                    Operations Overview
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Delivery routes, stops and parcel assignments.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <CalendarDays
                      size={17}
                      className="pointer-events-none absolute top-3 left-3 text-slate-400"
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
                      className="min-w-56 appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pr-9 pl-10 text-sm text-slate-700 shadow-sm disabled:opacity-60"
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
                      size={16}
                      className="pointer-events-none absolute top-3 right-3 text-slate-400"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setDaysRetry((value) => value + 1);
                      setOperationsRetry((value) => value + 1);
                      setStopsRetry((value) => value + 1);
                    }}
                    aria-label="Refresh dashboard"
                    title="Refresh dashboard"
                    className="rounded-lg border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm hover:bg-slate-50"
                  >
                    <RefreshCw size={18} />
                  </button>
                </div>
              </div>

              <div className="mb-6 space-y-3">
                {daysReady && daysRequest?.status === 'error' && (
                  <ErrorNotice
                    message={`Unable to load delivery days: ${daysRequest.error}`}
                    onRetry={() => setDaysRetry((value) => value + 1)}
                  />
                )}

                {currentDayId &&
                  operationsReady &&
                  operationsRequest?.status === 'error' && (
                    <ErrorNotice
                      message={`Unable to load operations: ${operationsRequest.error}`}
                      onRetry={() => setOperationsRetry((value) => value + 1)}
                    />
                  )}
              </div>

              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map(({ label, value, icon: Icon }) => (
                  <div
                    key={label}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-500">
                        {label}
                      </span>
                      <div className="rounded-lg bg-teal-50 p-2.5 text-brand-600">
                        <Icon size={19} />
                      </div>
                    </div>

                    <div className="mt-5 text-3xl font-bold text-navy-950">
                      {operationsSuccess ? value : '—'}
                    </div>

                    <p className="mt-2 text-xs text-slate-400">
                      {selectedDay
                        ? `${selectedDay.operatingArea} · ${formatDate(selectedDay.serviceDate)}`
                        : 'No delivery day selected'}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-7 grid gap-6 xl:grid-cols-3">
                <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 px-6 py-5">
                    <h3 className="font-semibold text-navy-950">
                      Delivery Routes
                    </h3>
                    <p className="mt-1 text-xs text-slate-400">
                      {operationsSuccess
                        ? `${routes.length} routes for selected day`
                        : 'Route overview'}
                    </p>
                  </div>

                  <div className="space-y-2 p-4">
                    {!daysReady || (currentDayId && !operationsReady) ? (
                      <p role="status" className="p-4 text-sm text-slate-500">
                        Loading routes...
                      </p>
                    ) : !currentDayId ? (
                      <p className="p-4 text-sm text-slate-500">
                        No delivery days available.
                      </p>
                    ) : !operationsSuccess ? (
                      <p className="p-4 text-sm text-slate-500">
                        Routes could not be loaded.
                      </p>
                    ) : routes.length === 0 ? (
                      <p className="p-4 text-sm text-slate-500">
                        No routes for this delivery day.
                      </p>
                    ) : (
                      routes.map((route, index) => (
                        <button
                          key={route.id}
                          type="button"
                          onClick={() => {
                            setSelectedRouteId(route.id);
                            setStopsRetry(0);
                          }}
                          className={`w-full rounded-lg border p-4 text-left transition-colors ${
                            currentRouteId === route.id
                              ? 'border-teal-300 bg-teal-50'
                              : 'border-slate-100 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-navy-950">
                              Route {index + 1}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs capitalize text-slate-600">
                              {route.status}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-slate-500">
                            Driver: {route.driverId ? 'Assigned' : 'Unassigned'}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Vehicle: {route.vehicleId ? 'Assigned' : 'Unassigned'}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
                  <div className="border-b border-slate-100 px-6 py-5">
                    <h3 className="font-semibold text-navy-950">
                      Route Stops & Parcels
                    </h3>
                    <p className="mt-1 text-xs text-slate-400">
                      Stops displayed in delivery sequence
                    </p>
                  </div>

                  <div className="space-y-4 p-6">
                    {!operationsSuccess ? (
                      <p className="text-sm text-slate-500">
                        {operationsReady
                          ? 'Route details unavailable.'
                          : 'Waiting for route data...'}
                      </p>
                    ) : !currentRouteId ? (
                      <p className="text-sm text-slate-500">
                        No route selected.
                      </p>
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
                      <p className="text-sm text-slate-500">
                        No stops have been added to this route.
                      </p>
                    ) : (
                      stops.map((stop) => {
                        const stopParcels = parcels.filter(
                          (parcel) => parcel.stopId === stop.id,
                        );

                        return (
                          <div
                            key={stop.id}
                            className="rounded-xl border border-slate-200 p-4"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-bold text-brand-600">
                                {stop.sequence}
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-navy-950">
                                  {stop.locationKey}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                  {stopParcels.length} parcels
                                </p>
                              </div>
                            </div>

                            {stopParcels.length > 0 && (
                              <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                                {stopParcels.map((parcel) => (
                                  <div
                                    key={parcel.id}
                                    className="flex items-start gap-2 rounded-lg bg-slate-50 p-3"
                                  >
                                    <Package
                                      size={16}
                                      className="mt-0.5 shrink-0 text-brand-600"
                                    />
                                    <div>
                                      <p className="text-xs font-semibold text-navy-950">
                                        {parcel.trackingNumber}
                                      </p>
                                      <p className="mt-1 text-xs text-slate-500">
                                        {parcel.destination}
                                      </p>
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

              <div className="mt-6 flex items-center gap-2 text-xs text-slate-400">
                <ClipboardList size={14} />
                Read-only operations overview · Data from Logistics API
              </div>
            </>
          ) : (
            <section className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <h2 className="text-xl font-bold text-navy-950">
                {activePage}
              </h2>
              <p className="mt-3 text-sm text-slate-500">
                This workspace will be implemented in a future ticket.
              </p>
            </section>
          )}
        </main>

        <footer className="border-t border-slate-200 px-9 py-4 text-center text-xs text-slate-400">
          AI Logistics Control Tower · Dispatcher Workspace
        </footer>
      </div>
    </div>
  );
}

export default App;
