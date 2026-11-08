import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RouteMap } from './RouteMap';

import type { DeliveryStop, Parcel } from '../../api/logistics-api';

import type { SimulationSnapshot } from '../../hooks/useLiveSimulation';

const mapMocks = vi.hoisted(() => ({
  mapConstructor: vi.fn(),
  addControl: vi.fn(),
  flyTo: vi.fn(),
  fitBounds: vi.fn(),
  mapRemove: vi.fn(),
  isStyleLoaded: vi.fn(() => true),
  getSource: vi.fn(),
  getLayer: vi.fn(),
  addSource: vi.fn(),
  addLayer: vi.fn(),
  removeSource: vi.fn(),
  removeLayer: vi.fn(),
  mapOnce: vi.fn(),
  mapOff: vi.fn(),

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
    isStyleLoaded = mapMocks.isStyleLoaded;
    getSource = mapMocks.getSource;
    getLayer = mapMocks.getLayer;
    addSource = mapMocks.addSource;
    addLayer = mapMocks.addLayer;
    removeSource = mapMocks.removeSource;
    removeLayer = mapMocks.removeLayer;
    once = mapMocks.mapOnce;
    off = mapMocks.mapOff;

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
    setWorkerUrl: vi.fn(),
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

// A reusable, valid simulation snapshot for vehicle tests.
const runningVehicle: SimulationSnapshot = {
  routeId: 'route-1',
  longitude: 24.941,
  latitude: 60.171,
  distanceTraveledMeters: 0,
  totalDistanceMeters: 1700,
  progress: 0,
  completed: false,
  status: 'running',
  elapsedSeconds: 0,
  speedMetersPerSecond: 5,
};

/**
 * Manually control animation frames.
 *
 * This lets tests verify interpolation without real timers
 * or depending on browser rendering speed.
 */
function mockAnimationFrames() {
  const callbacks: FrameRequestCallback[] = [];

  const requestFrame = vi.fn((callback: FrameRequestCallback): number => {
    callbacks.push(callback);
    return callbacks.length;
  });

  const cancelFrame = vi.fn();

  vi.stubGlobal('requestAnimationFrame', requestFrame);

  vi.stubGlobal('cancelAnimationFrame', cancelFrame);

  return {
    callbacks,
    requestFrame,
    cancelFrame,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  mapMocks.isStyleLoaded.mockReturnValue(true);
  mapMocks.getSource.mockReturnValue(undefined);
  mapMocks.getLayer.mockReturnValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RouteMap', () => {
  // --------------------------------------------------
  // Existing MapLibre and delivery stop tests
  // --------------------------------------------------

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

    expect(screen.getByLabelText('Delivery route map')).toBeInTheDocument();
  });

  it('creates numbered markers at the correct coordinates', () => {
    render(<RouteMap stops={[firstStop, secondStop]} parcels={[]} />);

    expect(mapMocks.markerConstructor).toHaveBeenCalledTimes(2);

    const firstMarkerOptions = mapMocks.markerConstructor.mock.calls[0][0] as {
      element: HTMLElement;
    };

    const secondMarkerOptions = mapMocks.markerConstructor.mock.calls[1][0] as {
      element: HTMLElement;
    };

    expect(firstMarkerOptions.element.textContent).toBe('1');

    expect(secondMarkerOptions.element.textContent).toBe('2');

    expect(mapMocks.markerSetLngLat).toHaveBeenCalledWith([24.941, 60.171]);

    expect(mapMocks.markerSetLngLat).toHaveBeenCalledWith([24.952, 60.17]);

    expect(mapMocks.markerAddTo).toHaveBeenCalledTimes(2);
  });

  it('includes the location and parcel count in marker popups', () => {
    render(<RouteMap stops={[firstStop]} parcels={[firstParcel, secondParcel]} />);

    expect(mapMocks.popupConstructor).toHaveBeenCalledWith({
      offset: 20,
    });

    expect(mapMocks.popupSetDOMContent).toHaveBeenCalledTimes(1);

    const popupContent = mapMocks.popupSetDOMContent.mock.calls[0][0] as HTMLElement;

    expect(popupContent.textContent).toContain('Stop 1');

    expect(popupContent.textContent).toContain('Helsinki Central Railway Station');

    expect(popupContent.textContent).toContain('2 parcels');
  });

  it('centers on a single stop', () => {
    render(<RouteMap stops={[firstStop]} parcels={[]} />);

    expect(mapMocks.flyTo).toHaveBeenCalledWith({
      center: [24.941, 60.171],
      zoom: 14,
    });

    expect(mapMocks.fitBounds).not.toHaveBeenCalled();
  });

  it('fits the map bounds around multiple stops', () => {
    render(<RouteMap stops={[firstStop, secondStop]} parcels={[]} />);

    expect(mapMocks.boundsConstructor).toHaveBeenCalledTimes(1);

    expect(mapMocks.boundsExtend).toHaveBeenCalledWith([24.941, 60.171]);

    expect(mapMocks.boundsExtend).toHaveBeenCalledWith([24.952, 60.17]);

    expect(mapMocks.fitBounds).toHaveBeenCalledWith(expect.anything(), {
      padding: 60,
      maxZoom: 14,
    });
  });

  it('shows an empty state when the route has no stops', () => {
    render(<RouteMap stops={[]} parcels={[]} />);

    expect(screen.getByText('No stops available for this route.')).toBeInTheDocument();

    expect(screen.getByText('0 delivery stops')).toBeInTheDocument();

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

    render(<RouteMap stops={[firstStop, invalidStop]} parcels={[]} />);

    expect(mapMocks.markerConstructor).toHaveBeenCalledTimes(1);

    expect(mapMocks.markerSetLngLat).toHaveBeenCalledWith([24.941, 60.171]);
  });

  it('updates markers when the selected route changes', () => {
    const { rerender } = render(<RouteMap stops={[firstStop]} parcels={[]} />);

    expect(mapMocks.markerConstructor).toHaveBeenCalledTimes(1);

    const anotherRouteStop: DeliveryStop = {
      ...secondStop,
      routeId: 'route-2',
    };

    rerender(<RouteMap stops={[anotherRouteStop]} parcels={[]} />);

    expect(mapMocks.markerRemove).toHaveBeenCalledTimes(1);

    expect(mapMocks.markerConstructor).toHaveBeenCalledTimes(2);

    expect(mapMocks.markerSetLngLat).toHaveBeenLastCalledWith([24.952, 60.17]);
  });

  it('draws the road geometry as a GeoJSON line layer', () => {
    const geometry = {
      type: 'LineString' as const,
      coordinates: [
        [24.941, 60.171],
        [24.945, 60.172],
        [24.952, 60.17],
      ],
    };

    render(<RouteMap stops={[firstStop, secondStop]} parcels={[]} geometry={geometry} />);

    expect(mapMocks.addSource).toHaveBeenCalledWith(
      'delivery-road-route',
      expect.objectContaining({
        type: 'geojson',
        data: expect.objectContaining({
          type: 'Feature',
          geometry: expect.objectContaining({
            coordinates: geometry.coordinates,
          }),
        }),
      }),
    );

    expect(mapMocks.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'delivery-road-route-line',
        type: 'line',
        source: 'delivery-road-route',
      }),
    );
  });

  it('waits until the map style is available before adding road geometry', () => {
    mapMocks.isStyleLoaded.mockReturnValue(false);

    const geometry = {
      type: 'LineString' as const,
      coordinates: [
        [24.941, 60.171],
        [24.952, 60.17],
      ],
    };

    render(<RouteMap stops={[firstStop, secondStop]} parcels={[]} geometry={geometry} />);

    expect(mapMocks.mapOnce).toHaveBeenCalledWith('load', expect.any(Function));

    expect(mapMocks.mapOnce).toHaveBeenCalledWith('idle', expect.any(Function));

    expect(mapMocks.addLayer).not.toHaveBeenCalled();

    const loadHandler = mapMocks.mapOnce.mock.calls.find(([event]) => event === 'load')?.[1];

    expect(loadHandler).toBeTypeOf('function');

    loadHandler();

    expect(mapMocks.addLayer).toHaveBeenCalledTimes(1);
  });

  it('cleans up map resources when unmounted', () => {
    const { unmount } = render(<RouteMap stops={[firstStop, secondStop]} parcels={[]} />);

    unmount();

    expect(mapMocks.markerRemove).toHaveBeenCalledTimes(2);

    expect(mapMocks.mapRemove).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------
  // ALT-033: Live vehicle marker tests
  // --------------------------------------------------

  it('creates one live vehicle marker at the GPS coordinates', () => {
    render(
      <RouteMap
        stops={[]}
        parcels={[]}
        vehicle={runningVehicle}
        liveConnectionStatus="connected"
      />,
    );

    expect(mapMocks.markerConstructor).toHaveBeenCalledTimes(1);

    const options = mapMocks.markerConstructor.mock.calls[0][0] as {
      element: HTMLElement;
      anchor: string;
    };

    expect(options.element.getAttribute('aria-label')).toBe('Live delivery vehicle');

    expect(options.anchor).toBe('center');

    expect(mapMocks.markerSetLngLat).toHaveBeenCalledWith([24.941, 60.171]);

    expect(mapMocks.markerAddTo).toHaveBeenCalledTimes(1);

    expect(screen.getByText('GPS Connected')).toBeInTheDocument();

    expect(screen.getByText('Live Vehicle')).toBeInTheDocument();

    expect(
      screen.getByRole('progressbar', {
        name: 'Vehicle route progress',
      }),
    ).toBeInTheDocument();
  });

  it('animates the existing vehicle marker without recreating the map', () => {
    const animation = mockAnimationFrames();

    const { rerender } = render(<RouteMap stops={[]} parcels={[]} vehicle={runningVehicle} />);

    expect(mapMocks.markerConstructor).toHaveBeenCalledTimes(1);

    const destinationVehicle: SimulationSnapshot = {
      ...runningVehicle,
      longitude: 24.9414,
      latitude: 60.171,
      distanceTraveledMeters: 25,
      progress: 25 / 1700,
      elapsedSeconds: 5,
    };

    rerender(<RouteMap stops={[]} parcels={[]} vehicle={destinationVehicle} />);

    expect(animation.requestFrame).toHaveBeenCalledTimes(1);

    // Start of animation.
    act(() => {
      animation.callbacks[0](100);
    });

    expect(mapMocks.markerSetLngLat).toHaveBeenLastCalledWith([24.941, 60.171]);

    // Halfway through the 900 ms animation.
    act(() => {
      animation.callbacks[1](550);
    });

    const midpoint = mapMocks.markerSetLngLat.mock.lastCall?.[0] as [number, number];

    expect(midpoint[0]).toBeGreaterThan(24.941);
    expect(midpoint[0]).toBeLessThan(24.9414);

    // End of animation.
    act(() => {
      animation.callbacks[2](1000);
    });

    expect(mapMocks.markerSetLngLat).toHaveBeenLastCalledWith([24.9414, 60.171]);

    // GPS updates must not recreate MapLibre or the marker.
    expect(mapMocks.mapConstructor).toHaveBeenCalledTimes(1);

    expect(mapMocks.markerConstructor).toHaveBeenCalledTimes(1);
  });

  it('cancels pending animation and snaps to the paused GPS position', () => {
    const animation = mockAnimationFrames();

    const { rerender } = render(<RouteMap stops={[]} parcels={[]} vehicle={runningVehicle} />);

    const movedVehicle: SimulationSnapshot = {
      ...runningVehicle,
      longitude: 24.9414,
      distanceTraveledMeters: 25,
      progress: 25 / 1700,
      elapsedSeconds: 5,
    };

    rerender(<RouteMap stops={[]} parcels={[]} vehicle={movedVehicle} />);

    expect(animation.requestFrame).toHaveBeenCalled();

    const pausedVehicle: SimulationSnapshot = {
      ...movedVehicle,
      status: 'paused',
    };

    rerender(<RouteMap stops={[]} parcels={[]} vehicle={pausedVehicle} />);

    expect(animation.cancelFrame).toHaveBeenCalled();

    expect(mapMocks.markerSetLngLat).toHaveBeenLastCalledWith([24.9414, 60.171]);

    expect(screen.getByText('paused')).toBeInTheDocument();
  });

  it('removes the vehicle marker when the simulation disappears', () => {
    const { rerender } = render(<RouteMap stops={[]} parcels={[]} vehicle={runningVehicle} />);

    expect(mapMocks.markerConstructor).toHaveBeenCalledTimes(1);

    rerender(<RouteMap stops={[]} parcels={[]} vehicle={null} />);

    expect(mapMocks.markerRemove).toHaveBeenCalledTimes(1);

    expect(screen.getByText('No active GPS simulation for this route.')).toBeInTheDocument();
  });

  it('ignores vehicle snapshots with invalid coordinates', () => {
    const invalidVehicle: SimulationSnapshot = {
      ...runningVehicle,
      longitude: 200,
      latitude: 100,
    };

    render(<RouteMap stops={[]} parcels={[]} vehicle={invalidVehicle} />);

    expect(mapMocks.markerConstructor).not.toHaveBeenCalled();
  });

  it('cleans up the vehicle marker and pending animation on unmount', () => {
    const animation = mockAnimationFrames();

    const { rerender, unmount } = render(
      <RouteMap stops={[]} parcels={[]} vehicle={runningVehicle} />,
    );

    rerender(
      <RouteMap
        stops={[]}
        parcels={[]}
        vehicle={{
          ...runningVehicle,
          longitude: 24.9414,
          distanceTraveledMeters: 25,
          progress: 25 / 1700,
          elapsedSeconds: 5,
        }}
      />,
    );

    expect(animation.requestFrame).toHaveBeenCalled();

    unmount();

    expect(animation.cancelFrame).toHaveBeenCalled();

    expect(mapMocks.markerRemove).toHaveBeenCalledTimes(1);

    expect(mapMocks.mapRemove).toHaveBeenCalledTimes(1);
  });
});
