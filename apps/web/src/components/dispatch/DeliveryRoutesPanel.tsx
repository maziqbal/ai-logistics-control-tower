import { Truck } from 'lucide-react';

import type { DeliveryRoute } from '../../api/logistics-api';

type DeliveryRoutesPanelProps = {
  routes: DeliveryRoute[];
  selectedRouteId: string;
  daysReady: boolean;
  currentDayId: string;
  operationsReady: boolean;
  operationsSuccess: boolean;
  onSelectRoute: (routeId: string) => void;
};

export function DeliveryRoutesPanel({
  routes,
  selectedRouteId,
  daysReady,
  currentDayId,
  operationsReady,
  operationsSuccess,
  onSelectRoute,
}: DeliveryRoutesPanelProps) {
  return (
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
              onClick={() => onSelectRoute(route.id)}
              aria-pressed={selectedRouteId === route.id}
              className={`w-full rounded-lg border p-3 text-left transition-colors ${
                selectedRouteId === route.id
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
  );
}
