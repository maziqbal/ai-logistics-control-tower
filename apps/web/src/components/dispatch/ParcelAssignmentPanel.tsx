import { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, PackagePlus } from 'lucide-react';

import type { DeliveryStop, Parcel } from '../../api/logistics-api';

type ParcelAssignmentPanelProps = {
  parcels: Parcel[];
  stops: DeliveryStop[];
  routeLabel: string;
  disabled?: boolean;
  onAssign: (parcelId: string, stopId: string) => Promise<void>;
};

export function ParcelAssignmentPanel({
  parcels,
  stops,
  routeLabel,
  disabled = false,
  onAssign,
}: ParcelAssignmentPanelProps) {
  const [selectedParcelId, setSelectedParcelId] = useState('');
  const [selectedStopId, setSelectedStopId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const unassignedParcels = parcels.filter((parcel) => parcel.stopId === null);

  const selectedParcelIsValid = unassignedParcels.some((parcel) => parcel.id === selectedParcelId);

  const selectedStopIsValid = stops.some((stop) => stop.id === selectedStopId);

  const canSubmit = !disabled && !submitting && selectedParcelIsValid && selectedStopIsValid;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) return;

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await onAssign(selectedParcelId, selectedStopId);

      setSuccess('Parcel assigned successfully.');
      setSelectedParcelId('');
      setSelectedStopId('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to assign parcel. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
          <PackagePlus size={19} />
        </div>

        <div>
          <h3 className="text-sm font-bold text-[#14243b]">Assign Parcel to Stop</h3>
          <p className="mt-1 text-xs text-slate-500">Assign parcels to {routeLabel}.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700"
          >
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-lg border border-teal-200 bg-teal-50 p-3 text-xs text-teal-800"
          >
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {unassignedParcels.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
            No unassigned parcels available.
          </p>
        ) : (
          <>
            <div>
              <label
                htmlFor="assignment-parcel"
                className="mb-2 block text-xs font-semibold text-slate-600"
              >
                Unassigned Parcel
              </label>

              <select
                id="assignment-parcel"
                value={selectedParcelId}
                onChange={(event) => {
                  setSelectedParcelId(event.target.value);
                  setError('');
                  setSuccess('');
                }}
                disabled={disabled || submitting}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#14243b] disabled:opacity-60"
              >
                <option value="">Select a parcel</option>
                {unassignedParcels.map((parcel) => (
                  <option key={parcel.id} value={parcel.id}>
                    {parcel.trackingNumber} — {parcel.destination}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="assignment-stop"
                className="mb-2 block text-xs font-semibold text-slate-600"
              >
                Destination Stop
              </label>

              <select
                id="assignment-stop"
                value={selectedStopId}
                onChange={(event) => {
                  setSelectedStopId(event.target.value);
                  setError('');
                  setSuccess('');
                }}
                disabled={disabled || submitting || stops.length === 0}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#14243b] disabled:opacity-60"
              >
                <option value="">
                  {stops.length === 0 ? 'No stops available' : 'Select a stop'}
                </option>

                {stops.map((stop) => (
                  <option key={stop.id} value={stop.id}>
                    Stop {stop.sequence} — {stop.locationKey}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <PackagePlus size={16} />
                  Assign Parcel
                </>
              )}
            </button>
          </>
        )}
      </form>
    </section>
  );
}
