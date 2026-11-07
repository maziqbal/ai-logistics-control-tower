import { BadGatewayException, NotFoundException } from '@nestjs/common';

import { StopsService } from '../stops/stops.service';
import { RouteGeometryService } from './route-geometry.service';

describe('RouteGeometryService', () => {
  let service: RouteGeometryService;
  let findByRoute: jest.Mock;
  let fetchMock: jest.Mock;

  const routeId = 'c0f26946-c6f0-47e0-806d-810a1e67090e';

  const stops = [
    {
      id: 'stop-1',
      sequence: 1,
      longitude: 24.9414,
      latitude: 60.1719,
    },
    {
      id: 'stop-2',
      sequence: 2,
      longitude: 24.9525,
      latitude: 60.1705,
    },
  ];

  const osrmRoute = {
    code: 'Ok',
    routes: [
      {
        distance: 1704.1,
        duration: 334.4,
        geometry: {
          type: 'LineString',
          coordinates: [
            [24.9414, 60.1719],
            [24.945, 60.172],
            [24.9525, 60.1705],
          ],
        },
      },
    ],
  };

  beforeEach(() => {
    findByRoute = jest.fn();
    fetchMock = jest.fn();

    const stopsService = {
      findByRoute,
    } as unknown as StopsService;

    service = new RouteGeometryService(stopsService);

    jest.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns geometry, distance and duration for a valid route', async () => {
    findByRoute.mockResolvedValue(stops);

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => osrmRoute,
    });

    const result = await service.findByRoute(routeId);

    expect(result).toEqual({
      routeId,
      status: 'ready',
      geometry: osrmRoute.routes[0].geometry,
      distanceMeters: 1704.1,
      durationSeconds: 334.4,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const requestedUrl = String(fetchMock.mock.calls[0][0]);

    expect(requestedUrl).toContain('24.9414,60.1719;24.9525,60.1705');
    expect(requestedUrl).toContain('geometries=geojson');
  });

  it('returns insufficient_stops without calling OSRM', async () => {
    findByRoute.mockResolvedValue([stops[0]]);

    const result = await service.findByRoute(routeId);

    expect(result).toEqual({
      routeId,
      status: 'insufficient_stops',
      geometry: null,
      distanceMeters: null,
      durationSeconds: null,
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns insufficient_stops for an empty route', async () => {
    findByRoute.mockResolvedValue([]);

    const result = await service.findByRoute(routeId);

    expect(result.status).toBe('insufficient_stops');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preserves the route-not-found exception', async () => {
    findByRoute.mockRejectedValue(new NotFoundException('Route not found'));

    await expect(service.findByRoute(routeId)).rejects.toThrow(
      NotFoundException,
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns no_route when OSRM cannot find a driving path', async () => {
    findByRoute.mockResolvedValue(stops);

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'NoRoute' }),
    });

    const result = await service.findByRoute(routeId);

    expect(result.status).toBe('no_route');
    expect(result.geometry).toBeNull();
  });

  it('returns 502 when OSRM is unavailable', async () => {
    findByRoute.mockResolvedValue(stops);
    fetchMock.mockRejectedValue(new Error('Connection refused'));

    await expect(service.findByRoute(routeId)).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('returns 502 for an unsuccessful HTTP response', async () => {
    findByRoute.mockResolvedValue(stops);
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    await expect(service.findByRoute(routeId)).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('returns 502 for invalid JSON', async () => {
    findByRoute.mockResolvedValue(stops);

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('Invalid JSON');
      },
    });

    await expect(service.findByRoute(routeId)).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('returns 502 for an invalid OSRM route response', async () => {
    findByRoute.mockResolvedValue(stops);

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 'Ok',
        routes: [{ distance: 100 }],
      }),
    });

    await expect(service.findByRoute(routeId)).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('preserves the supplied stop order for multiple stops', async () => {
    const threeStops = [
      stops[0],
      {
        id: 'stop-3',
        sequence: 2,
        longitude: 24.948,
        latitude: 60.175,
      },
      { ...stops[1], sequence: 3 },
    ];

    findByRoute.mockResolvedValue(threeStops);

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => osrmRoute,
    });

    await service.findByRoute(routeId);

    const requestedUrl = String(fetchMock.mock.calls[0][0]);

    expect(requestedUrl).toContain(
      '24.9414,60.1719;24.948,60.175;24.9525,60.1705',
    );
  });
});
