import { SimulationSessionManager } from './simulation-session.manager';
import type { RouteLineString } from './route-position';

describe('SimulationSessionManager', () => {
  let manager: SimulationSessionManager;

  const geometry: RouteLineString = {
    type: 'LineString',
    coordinates: [
      [24.9414, 60.1719],
      [24.945, 60.172],
      [24.9525, 60.1705],
    ],
  };

  beforeEach(() => {
    manager = new SimulationSessionManager();
  });

  it('creates and starts a simulation for a route', () => {
    const session = manager.create('route-1', geometry, 10);

    expect(session.routeId).toBe('route-1');
    expect(session.status).toBe('running');
    expect(session.progress).toBe(0);
  });

  it('retrieves an existing simulation', () => {
    manager.create('route-1', geometry, 10);

    expect(manager.get('route-1').status).toBe('running');
  });

  it('rejects duplicate sessions for the same route', () => {
    manager.create('route-1', geometry, 10);

    expect(() => manager.create('route-1', geometry, 10)).toThrow(
      'Simulation already exists',
    );
  });

  it('advances the selected simulation', () => {
    manager.create('route-1', geometry, 10);

    const snapshot = manager.advance('route-1', 5);

    expect(snapshot.distanceTraveledMeters).toBeCloseTo(50);
    expect(snapshot.elapsedSeconds).toBe(5);
  });

  it('keeps different route sessions independent', () => {
    manager.create('route-1', geometry, 10);
    manager.create('route-2', geometry, 5);

    manager.advance('route-1', 10);

    expect(manager.get('route-1').distanceTraveledMeters).toBeCloseTo(100);
    expect(manager.get('route-2').distanceTraveledMeters).toBe(0);
  });

  it('pauses and resumes a simulation', () => {
    manager.create('route-1', geometry, 10);
    manager.advance('route-1', 5);

    expect(manager.pause('route-1').status).toBe('paused');

    expect(() => manager.advance('route-1', 5)).toThrow();

    expect(manager.resume('route-1').status).toBe('running');

    expect(manager.advance('route-1', 5).distanceTraveledMeters).toBeCloseTo(
      100,
    );
  });

  it('stops a running simulation', () => {
    manager.create('route-1', geometry, 10);

    expect(manager.stop('route-1').status).toBe('stopped');

    expect(() => manager.advance('route-1', 1)).toThrow();
  });

  it('completes a simulation at the final route coordinate', () => {
    manager.create('route-1', geometry, 10);

    const snapshot = manager.advance('route-1', 10000);

    expect(snapshot.status).toBe('completed');
    expect(snapshot.progress).toBe(1);
    expect(snapshot.longitude).toBe(24.9525);
    expect(snapshot.latitude).toBe(60.1705);
  });

  it('lists all sessions', () => {
    manager.create('route-1', geometry, 10);
    manager.create('route-2', geometry, 5);

    expect(manager.list()).toHaveLength(2);
    expect(manager.list().map((session) => session.routeId)).toEqual([
      'route-1',
      'route-2',
    ]);
  });

  it('removes a simulation session', () => {
    manager.create('route-1', geometry, 10);
    manager.remove('route-1');

    expect(manager.list()).toHaveLength(0);
    expect(() => manager.get('route-1')).toThrow();
  });

  it('allows a new session after removing the old one', () => {
    manager.create('route-1', geometry, 10);
    manager.stop('route-1');
    manager.remove('route-1');

    expect(manager.create('route-1', geometry, 5).status).toBe('running');
  });

  it('rejects unknown routes', () => {
    expect(() => manager.get('missing-route')).toThrow();
    expect(() => manager.pause('missing-route')).toThrow();
    expect(() => manager.remove('missing-route')).toThrow();
  });

  it('rejects an empty route ID', () => {
    expect(() => manager.create('', geometry, 10)).toThrow(
      'Route ID is required',
    );
  });

  it('does not create sessions with invalid geometry', () => {
    expect(() =>
      manager.create(
        'route-1',
        {
          type: 'LineString',
          coordinates: [],
        },
        10,
      ),
    ).toThrow();

    expect(manager.list()).toHaveLength(0);
  });
});
