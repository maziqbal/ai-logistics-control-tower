import { useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, Loader2, PackagePlus } from 'lucide-react';

import type { CreateParcelInput } from '../../api/logistics-api';

type ParcelCreationPanelProps = {
  onCreate: (input: CreateParcelInput) => Promise<void>;
  disabled?: boolean;
};

type FormValues = {
  trackingNumber: string;
  destination: string;
  locationKey: string;
  longitude: string;
  latitude: string;
};

const initialValues: FormValues = {
  trackingNumber: '',
  destination: '',
  locationKey: '',
  longitude: '',
  latitude: '',
};

export function ParcelCreationPanel({ onCreate, disabled = false }: ParcelCreationPanelProps) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function updateField(field: keyof FormValues, value: string) {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));

    setError('');
    setSuccess('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (disabled || submitting) return;

    const trackingNumber = values.trackingNumber.trim();
    const destination = values.destination.trim();
    const locationKey = values.locationKey.trim();

    if (!trackingNumber || !destination || !locationKey) {
      setError('Please complete all required fields.');
      return;
    }

    if (!values.longitude.trim() || !values.latitude.trim()) {
      setError('Please enter both longitude and latitude.');
      return;
    }

    const longitude = Number(values.longitude);
    const latitude = Number(values.latitude);

    if (
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      longitude < -180 ||
      longitude > 180 ||
      latitude < -90 ||
      latitude > 90
    ) {
      setError('Please enter valid longitude and latitude coordinates.');
      return;
    }

    // NestJS expects longitude and latitude as top-level properties.
    const input: CreateParcelInput = {
      trackingNumber,
      destination,
      locationKey,
      longitude,
      latitude,
    };

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await onCreate(input);
      setValues({ ...initialValues });
      setSuccess('Parcel created successfully.');
    } catch (cause: unknown) {
      setError(
        cause instanceof Error ? cause.message : 'Unable to create parcel. Please try again.',
      );
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
          <h3 className="font-bold text-[#14243b]">Create Parcel</h3>
          <p className="mt-1 text-xs text-slate-500">
            Add a new unassigned parcel to the selected delivery day.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <div className="space-y-1.5">
          <label
            htmlFor="parcel-tracking-number"
            className="block text-xs font-semibold text-slate-600"
          >
            Tracking Number
          </label>
          <input
            id="parcel-tracking-number"
            type="text"
            required
            value={values.trackingNumber}
            onChange={(event) => updateField('trackingNumber', event.target.value)}
            placeholder="PKG-HEL-0002"
            disabled={disabled || submitting}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 disabled:bg-slate-50"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="parcel-destination"
            className="block text-xs font-semibold text-slate-600"
          >
            Destination
          </label>
          <input
            id="parcel-destination"
            type="text"
            required
            value={values.destination}
            onChange={(event) => updateField('destination', event.target.value)}
            placeholder="Mannerheimintie 10, Helsinki"
            disabled={disabled || submitting}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 disabled:bg-slate-50"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="parcel-location-key"
            className="block text-xs font-semibold text-slate-600"
          >
            Location Key
          </label>
          <input
            id="parcel-location-key"
            type="text"
            required
            value={values.locationKey}
            onChange={(event) => updateField('locationKey', event.target.value)}
            placeholder="helsinki-location-002"
            disabled={disabled || submitting}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 disabled:bg-slate-50"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label
              htmlFor="parcel-longitude"
              className="block text-xs font-semibold text-slate-600"
            >
              Longitude
            </label>
            <input
              id="parcel-longitude"
              type="number"
              step="any"
              min="-180"
              max="180"
              required
              value={values.longitude}
              onChange={(event) => updateField('longitude', event.target.value)}
              placeholder="24.9384"
              disabled={disabled || submitting}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 disabled:bg-slate-50"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="parcel-latitude" className="block text-xs font-semibold text-slate-600">
              Latitude
            </label>
            <input
              id="parcel-latitude"
              type="number"
              step="any"
              min="-90"
              max="90"
              required
              value={values.latitude}
              onChange={(event) => updateField('latitude', event.target.value)}
              placeholder="60.1699"
              disabled={disabled || submitting}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 disabled:bg-slate-50"
            />
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700"
          >
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-lg bg-teal-50 p-3 text-xs text-teal-800"
          >
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={disabled || submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Creating Parcel...
            </>
          ) : (
            <>
              <PackagePlus size={16} />
              Create Parcel
            </>
          )}
        </button>
      </form>
    </section>
  );
}
