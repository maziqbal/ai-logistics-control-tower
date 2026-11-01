const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export type DeliveryDay = {
  id: string;
  serviceDate: string;
  operatingArea: string;
};

export type DeliveryRoute = {
  id: string;
  deliveryDayId: string;
  driverId: string | null;
  vehicleId: string | null;
  status: string;
  version: number;
};

export type DeliveryStop = {
  id: string;
  routeId: string;
  deliveryDayId: string;
  sequence: number;
  locationKey: string;
};

export type Parcel = {
  id: string;
  deliveryDayId: string;
  stopId: string | null;
  trackingNumber: string;
  destination: string;
  locationKey: string;
};

export type CreateParcelInput = {
  trackingNumber: string;
  destination: string;
  locationKey: string;
  longitude: number;
  latitude: number;
};

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { signal });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}): ${path}`);
  }

  return (await response.json()) as T;
}

export const logisticsApi = {
  getDeliveryDays: (signal?: AbortSignal) =>
    getJson<DeliveryDay[]>('/api/v1/delivery-days', signal),

  getRoutes: (dayId: string, signal?: AbortSignal) =>
    getJson<DeliveryRoute[]>(`/api/v1/delivery-days/${encodeURIComponent(dayId)}/routes`, signal),

  getStops: (routeId: string, signal?: AbortSignal) =>
    getJson<DeliveryStop[]>(`/api/v1/routes/${encodeURIComponent(routeId)}/stops`, signal),

  getParcels: (dayId: string, signal?: AbortSignal) =>
    getJson<Parcel[]>(`/api/v1/delivery-days/${encodeURIComponent(dayId)}/parcels`, signal),

  createParcel: async (dayId: string, input: CreateParcelInput): Promise<Parcel> => {
    const path = `/api/v1/delivery-days/${encodeURIComponent(dayId)}/parcels`;

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`Parcel creation failed (${response.status})`);
    }

    return (await response.json()) as Parcel;
  },

  assignParcelToStop: async (dayId: string, parcelId: string, stopId: string): Promise<void> => {
    const path = `/api/v1/delivery-days/${encodeURIComponent(dayId)}/parcels/${encodeURIComponent(parcelId)}/stop`;

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ stopId }),
    });

    if (!response.ok) {
      throw new Error(`Parcel assignment failed (${response.status})`);
    }
  },
};
