import { AlertCircle, MapPin, Package, RefreshCw } from 'lucide-react';

import type { DeliveryStop, Parcel } from '../../api/logistics-api';

type RouteStopsPanelProps = {
  operationsSuccess: boolean;
  operationsReady: boolean;
  currentRouteId: string;
  stopsReady: boolean;
  stopsSuccess: boolean;
  stops: DeliveryStop[];
  parcels: Parcel[];
  stopsError: string;
  onRetryStops: () => void;
};

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

export function RouteStopsPanel({
  operationsSuccess,
  operationsReady,
  currentRouteId,
  stopsReady,
  stopsSuccess,
  stops,
  parcels,
  stopsError,
  onRetryStops,
}: RouteStopsPanelProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="font-bold text-[#14243b]">Route Stops &amp; Parcels</h3>

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
          <ErrorNotice message={`Unable to load stops: ${stopsError}`} onRetry={onRetryStops} />
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
  );
}
