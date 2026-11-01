import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { RouteMap } from './RouteMap';
import type { DeliveryStop, Parcel } from '../../api/logistics-api';

const mapMocks = vi.hoisted(() => ({
  mapConstructor: vi.fn(),
  addControl: vi.fn(),
  flyTo: vi.fn(),
  fitBounds: vi.fn(),
  mapRemove: vi.fn(),

  markerConstructor: vi.fn(),
  markerSetLngLat: vi.fn(),
  markerSetPopup: vi.fn(),
  markerAddTo: vi.fn(),
  markerRemove: vi.fn(),

  popupConstructor: vi.fn(),
  popupSetDOMContent: vi.fn(),

  boundsConstructor: vi.fn(),
  boundsExtend: vi.fn(),
}));

vi.mock('maplibre-gl', () => {
  class Map {
    addControl = mapMocks.addControl;
    flyTo = mapMocks.flyTo;
    fitBounds = mapMocks.fitBounds;
    remove = mapMocks.mapRemove;

    constructor(options: unknown) {
      mapMocks.mapConstructor(options);
    }
  }

  class NavigationControl {}

  class Popup {
    constructor(options: unknown) {
      mapMocks.popupConstructor(options);
    }

    setDOMContent(element: HTMLElement) {
      mapMocks.popupSetDOMContent(element);
      return this;
    }
  }

  class Marker {
  constructor(options: unknown) {
    mapMocks.markerConstructor(options);
  }

  setLngLat(coordinates: [number, number]) {
    mapMocks.markerSetLngLat(coordinates);
    return this;
  }

  setPopup(popup: Popup) {
    mapMocks.markerSetPopup(popup);
    return this;
  }

  addTo(map: Map) {
    mapMocks.markerAddTo(map);
    return this;
  }

  remove() {
    mapMocks.markerRemove();
    return this;
  }
}

  class LngLatBounds {
    constructor() {
      mapMocks.boundsConstructor();
    }

    extend(coordinates: [number, number]) {
      mapMocks.boundsExtend(coordinates);
      return this;
    }
  }

  return {
    Map,
    NavigationControl,
    Popup,
    Marker,
    LngLatBounds,
  };
});

const firstStop: DeliveryStop = {
  id: 'stop-1',
  routeId: 'route-1',
  deliveryDayId: 'day-1',
  sequence: 1,
  locationKey: 'Helsinki Central Railway Station',
  status: 'pending',
  longitude: 24.941,
  latitude: 60.171,
};

const secondStop: DeliveryStop = {
  id: 'stop-2',
  routeId: 'route-1',
  deliveryDayId: 'day-1',
  sequence: 2,
  locationKey: 'Helsinki Cathedral',
  status: 'pending',
  longitude: 24.952,
  latitude: 60.17,
};

const firstParcel: Parcel = {
  id: 'parcel-1',
  deliveryDayId: 'day-1',
  stopId: 'stop-1',
  trackingNumber: 'ALT-DEMO-001',
  destination: 'Helsinki Central Railway Station',
  locationKey: 'Helsinki Central Railway Station',
};

const secondParcel: Parcel = {
  ...firstParcel,
  id: 'parcel-2',
  trackingNumber: 'ALT-DEMO-002',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RouteMap', () => {
  it('initializes MapLibre with the Helsinki default center', () => {
    render(<RouteMap stops={[]} parcels={[]} />);

    expect(mapMocks.mapConstructor).toHaveBeenCalledTimes(1);

    expect(mapMocks.mapConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [24.9384, 60.1699],
        zoom: 11,
        style: expect.objectContaining({
          version: 8,
        }),
      }),
    );

    expect(mapMocks.addControl).toHaveBeenCalledTimes(1);

    expect(
      screen.getByLabelText('Delivery route map'),
    ).toBeInTheDocument();
  });

  it('creates numbered markers at the correct coordinates', () => {
    render(
      <RouteMap
        stops={[firstStop, secondStop]}
        parcels={[]}
      />,
    );

    expect(mapMocks.markerConstructor).toHaveBeenCalledTimes(2);

    const firstMarkerOptions =
      mapMocks.markerConstructor.mock.calls[0][0] as {
        element: HTMLElement;
      };

    const secondMarkerOptions =
      mapMocks.markerConstructor.mock.calls[1][0] as {
        element: HTMLElement;
      };

    expect(firstMarkerOptions.element.textContent).toBe('1');
    expect(secondMarkerOptions.element.textContent).toBe('2');

    expect(mapMocks.markerSetLngLat).toHaveBeenCalledWith([
      24.941,
      60.171,
    ]);

    expect(mapMocks.markerSetLngLat).toHaveBeenCalledWith([
      24.952,
      60.17,
    ]);

    expect(mapMocks.markerAddTo).toHaveBeenCalledTimes(2);
  });

  it('includes the location and parcel count in marker popups', () => {
    render(
      <RouteMap
        stops={[firstStop]}
        parcels={[firstParcel, secondParcel]}
      />,
    );

    expect(mapMocks.popupConstructor).toHaveBeenCalledWith({
      offset: 20,
    });

    expect(mapMocks.popupSetDOMContent).toHaveBeenCalledTimes(1);

    const popupContent =
      mapMocks.popupSetDOMContent.mock.calls[0][0] as HTMLElement;

    expect(popupContent.textContent).toContain('Stop 1');
    expect(popupContent.textContent).toContain(
      'Helsinki Central Railway Station',
    );
    expect(popupContent.textContent).toContain('2 parcels');
  });

  it('centers on a single stop', () => {
    render(
      <RouteMap stops={[firstStop]} parcels={[]} />,
    );

    expect(mapMocks.flyTo).toHaveBeenCalledWith({
      center: [24.941, 60.171],
      zoom: 14,
    });

    expect(mapMocks.fitBounds).not.toHaveBeenCalled();
  });

  it('fits the map bounds around multiple stops', () => {
    render(
      <RouteMap
        stops={[firstStop, secondStop]}
        parcels={[]}
      />,
    );

    expect(mapMocks.boundsConstructor).toHaveBeenCalledTimes(1);

    expect(mapMocks.boundsExtend).toHaveBeenCalledWith([
      24.941,
      60.171,
    ]);

    expect(mapMocks.boundsExtend).toHaveBeenCalledWith([
      24.952,
      60.17,
    ]);

    expect(mapMocks.fitBounds).toHaveBeenCalledWith(
      expect.anything(),
      {
        padding: 60,
        maxZoom: 14,
      },
    );
  });

  it('shows an empty state when the route has no stops', () => {
    render(<RouteMap stops={[]} parcels={[]} />);

    expect(
      screen.getByText('No stops available for this route.'),
    ).toBeInTheDocument();

    expect(
      screen.getByText('0 delivery stops'),
    ).toBeInTheDocument();

    expect(mapMocks.markerConstructor).not.toHaveBeenCalled();

    expect(mapMocks.flyTo).toHaveBeenCalledWith({
      center: [24.9384, 60.1699],
      zoom: 11,
    });
  });

  it('ignores stops with invalid coordinates', () => {
    const invalidStop: DeliveryStop = {
      ...firstStop,
      id: 'invalid-stop',
      longitude: 200,
      latitude: 100,
    };

    render(
      <RouteMap
        stops={[firstStop, invalidStop]}
        parcels={[]}
      />,
    );

    expect(mapMocks.markerConstructor).toHaveBeenCalledTimes(1);

    expect(mapMocks.markerSetLngLat).toHaveBeenCalledWith([
      24.941,
      60.171,
    ]);
  });

  it('updates markers when the selected route changes', () => {
    const { rerender } = render(
      <RouteMap
        stops={[firstStop]}
        parcels={[]}
      />,
    );

    expect(mapMocks.markerConstructor).toHaveBeenCalledTimes(1);

    const anotherRouteStop: DeliveryStop = {
      ...secondStop,
      routeId: 'route-2',
    };

    rerender(
      <RouteMap
        stops={[anotherRouteStop]}
        parcels={[]}
      />,
    );

    expect(mapMocks.markerRemove).toHaveBeenCalledTimes(1);

    expect(mapMocks.markerConstructor).toHaveBeenCalledTimes(2);

    expect(mapMocks.markerSetLngLat).toHaveBeenLastCalledWith([
      24.952,
      60.17,
    ]);
  });

  it('cleans up map resources when unmounted', () => {
    const { unmount } = render(
      <RouteMap
        stops={[firstStop, secondStop]}
        parcels={[]}
      />,
    );

    unmount();

    expect(mapMocks.markerRemove).toHaveBeenCalledTimes(2);
    expect(mapMocks.mapRemove).toHaveBeenCalledTimes(1);
  });
});
