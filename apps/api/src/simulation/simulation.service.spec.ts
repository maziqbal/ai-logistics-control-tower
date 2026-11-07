import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { RouteGeometryService } from '../routes/route-geometry.service';
import { SimulationSessionManager } from './simulation-session.manager';
import { SimulationService } from './simulation.service';

describe('SimulationService', () => {
  let service: SimulationService;
  let sessions: SimulationSessionManager;

  const routeId = 'route-1';

  const geometry = {
    type: 'LineString' as const,
    coordinates: [
      [24.9414, 60.1719],
      [24.945, 60.172],
      [24.9525, 60.1705],
    ],
  };

  const findByRoute = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    sessions = new SimulationSessionManager();

    const routeGeometryService = {
      findByRoute,
    } as unknown as RouteGeometryService;

    service = new SimulationService(routeGeometryService, sessions);

    findByRoute.mockResolvedValue({
      routeId,
      status: 'ready',
      geometry,
      distanceMeters: 1704.1,
      durationSeconds: 334.4,
    });
  });

  it('starts a simulation using real route geometry', async () => {
    const snapshot = await service.start(routeId, 10);

    expect(findByRoute).toHaveBeenCalledWith(routeId);

    expect(snapshot.routeId).toBe(routeId);
    expect(snapshot.status).toBe('running');
    expect(snapshot.longitude).toBe(24.9414);
    expect(snapshot.latitude).toBe(60.1719);
    expect(snapshot.progress).toBe(0);
  });

  it('creates a session that can advance along the route', async () => {
    await service.start(routeId, 10);

    const snapshot = sessions.advance(routeId, 5);

    expect(snapshot.status).toBe('running');
    expect(snapshot.distanceTraveledMeters).toBeCloseTo(50);
    expect(snapshot.progress).toBeGreaterThan(0);
  });

  it('keeps simulations independent by route ID', async () => {
    await service.start('route-1', 10);
    await service.start('route-2', 5);

    sessions.advance('route-1', 5);

    expect(sessions.get('route-1').distanceTraveledMeters).toBeCloseTo(50);
    expect(sessions.get('route-2').distanceTraveledMeters).toBe(0);
  });

  it('rejects duplicate simulation sessions', async () => {
    await service.start(routeId, 10);

    await expect(service.start(routeId, 10)).rejects.toThrow(ConflictException);

    expect(findByRoute).toHaveBeenCalledTimes(1);
  });

  it('rejects routes with insufficient stops', async () => {
    findByRoute.mockResolvedValue({
      routeId,
      status: 'insufficient_stops',
      geometry: null,
      distanceMeters: null,
      durationSeconds: null,
    });

    await expect(service.start(routeId, 10)).rejects.toThrow(
      UnprocessableEntityException,
    );

    expect(sessions.list()).toHaveLength(0);
  });

  it('rejects routes that OSRM cannot connect', async () => {
    findByRoute.mockResolvedValue({
      routeId,
      status: 'no_route',
      geometry: null,
      distanceMeters: null,
      durationSeconds: null,
    });

    await expect(service.start(routeId, 10)).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('rejects empty route IDs', async () => {
    await expect(service.start('', 10)).rejects.toThrow(BadRequestException);

    expect(findByRoute).not.toHaveBeenCalled();
  });

  it('rejects invalid simulation speeds', async () => {
    await expect(service.start(routeId, 0)).rejects.toThrow(
      BadRequestException,
    );

    await expect(service.start(routeId, -5)).rejects.toThrow(
      BadRequestException,
    );

    await expect(service.start(routeId, Number.NaN)).rejects.toThrow(
      BadRequestException,
    );

    expect(findByRoute).not.toHaveBeenCalled();
  });

  it('rejects invalid OSRM coordinates', async () => {
    findByRoute.mockResolvedValue({
      routeId,
      status: 'ready',
      geometry: {
        type: 'LineString',
        coordinates: [
          [24.9414, 60.1719],
          [200, 100],
        ],
      },
    });

    await expect(service.start(routeId, 10)).rejects.toThrow(
      BadGatewayException,
    );

    expect(sessions.list()).toHaveLength(0);
  });

  it('rejects geometry with fewer than two coordinates', async () => {
    findByRoute.mockResolvedValue({
      routeId,
      status: 'ready',
      geometry: {
        type: 'LineString',
        coordinates: [[24.9414, 60.1719]],
      },
    });

    await expect(service.start(routeId, 10)).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('rejects geometry without movement', async () => {
    findByRoute.mockResolvedValue({
      routeId,
      status: 'ready',
      geometry: {
        type: 'LineString',
        coordinates: [
          [24.9414, 60.1719],
          [24.9414, 60.1719],
        ],
      },
    });

    await expect(service.start(routeId, 10)).rejects.toThrow(
      BadGatewayException,
    );

    expect(sessions.list()).toHaveLength(0);
  });
});
