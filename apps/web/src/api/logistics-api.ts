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

export type Driver = {
  id: string;
  name: string;
  active: boolean;
};

export type Vehicle = {
  id: string;
  registrationNumber: string;
  active: boolean;
};

export type CreateDriverInput = {
  name: string;
  active: boolean;
};

export type CreateVehicleInput = {
  registrationNumber: string;
  active: boolean;
};

export type UpdateRouteAssignmentInput = {
  driverId?: string | null;
  vehicleId?: string | null;
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

  getDrivers: (signal?: AbortSignal) => getJson<Driver[]>('/api/v1/drivers', signal),

  getVehicles: (signal?: AbortSignal) => getJson<Vehicle[]>('/api/v1/vehicles', signal),

  createDriver: async (input: CreateDriverInput): Promise<Driver> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/drivers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`Driver creation failed (${response.status})`);
    }

    return (await response.json()) as Driver;
  },

  createVehicle: async (input: CreateVehicleInput): Promise<Vehicle> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/vehicles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      if (response.status === 409) {
        throw new Error('A vehicle with this registration number already exists.');
      }

      throw new Error(`Vehicle creation failed (${response.status})`);
    }

    return (await response.json()) as Vehicle;
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

  updateRouteAssignment: async (
    routeId: string,
    input: UpdateRouteAssignmentInput,
  ): Promise<DeliveryRoute> => {
    const path = `/api/v1/routes/${encodeURIComponent(routeId)}/assignment`;

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      if (response.status === 409) {
        throw new Error(
          'Assignment conflict. The route or resource may have changed. Refresh and try again.',
        );
      }

      if (response.status === 404) {
        throw new Error('Route, driver, or vehicle not found. Refresh and try again.');
      }

      throw new Error(`Route assignment failed (${response.status})`);
    }

    return (await response.json()) as DeliveryRoute;
  },
};
