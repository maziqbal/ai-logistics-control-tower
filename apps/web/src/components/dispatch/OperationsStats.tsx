import {
  Activity,
  CheckCircle2,
  Package,
  Route,
} from 'lucide-react';

type OperationsStatsProps = {
  routesCount: number;
  parcelsCount: number;
  assignedCount: number;
  isReady: boolean;
};

export function OperationsStats({
  routesCount,
  parcelsCount,
  assignedCount,
  isReady,
}: OperationsStatsProps) {
  const unassignedCount = parcelsCount - assignedCount;

  const assignmentPercent =
    parcelsCount > 0
      ? Math.round((assignedCount / parcelsCount) * 100)
      : 0;

  const stats = [
    {
      label: 'Routes',
      value: routesCount,
      icon: Route,
    },
    {
      label: 'Parcels',
      value: parcelsCount,
      icon: Package,
    },
    {
      label: 'Assigned Parcels',
      value: assignedCount,
      icon: CheckCircle2,
    },
    {
      label: 'Unassigned Parcels',
      value: unassignedCount,
      icon: Activity,
    },
  ];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">
                {label}
              </span>

              <Icon size={17} className="text-teal-700" />
            </div>

            <p className="mt-3 text-3xl font-bold text-[#14243b]">
              {isReady ? value : '—'}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
        <div className="min-w-42">
          <p className="text-xs font-bold text-[#14243b]">
            Assignment Progress
          </p>

          <p className="mt-1 text-[11px] text-slate-500">
            {isReady
              ? `${assignedCount} of ${parcelsCount} parcels assigned`
              : 'Waiting for assignment data'}
          </p>
        </div>

        <div
          className="h-2 min-w-30 flex-1 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-label="Parcel assignment progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={isReady ? assignmentPercent : 0}
        >
          <div
            className="h-full rounded-full bg-teal-500"
            style={{
              width: `${isReady ? assignmentPercent : 0}%`,
            }}
          />
        </div>

        <span className="text-sm font-bold text-teal-700">
          {isReady ? `${assignmentPercent}%` : '—'}
        </span>
      </div>
    </>
  );
}
