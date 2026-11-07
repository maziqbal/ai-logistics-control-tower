import { GpsSimulator } from './gps-simulator';
import type { RouteLineString } from './route-position';

describe('GpsSimulator', () => {
  const geometry: RouteLineString = {
    type: 'LineString',
    coordinates: [
      [24.9414, 60.1719],
      [24.945, 60.172],
      [24.9525, 60.1705],
    ],
  };

  const createSimulator = () => new GpsSimulator(geometry, 10);

  it('starts in the idle state at the first coordinate', () => {
    const simulator = createSimulator();
    const snapshot = simulator.getSnapshot();

    expect(snapshot.status).toBe('idle');
    expect(snapshot.progress).toBe(0);
    expect(snapshot.longitude).toBe(24.9414);
  });

  it('starts a simulation', () => {
    const simulator = createSimulator();

    expect(simulator.start().status).toBe('running');
  });

  it('advances along the road geometry', () => {
    const simulator = createSimulator();
    simulator.start();

    const snapshot = simulator.advance(5);

    expect(snapshot.status).toBe('running');
    expect(snapshot.distanceTraveledMeters).toBeCloseTo(50);
    expect(snapshot.elapsedSeconds).toBe(5);
    expect(snapshot.progress).toBeGreaterThan(0);
  });

  it('pauses and resumes without losing progress', () => {
    const simulator = createSimulator();
    simulator.start();
    simulator.advance(5);

    const paused = simulator.pause();

    expect(paused.status).toBe('paused');
    expect(() => simulator.advance(5)).toThrow();

    const resumed = simulator.resume();

    expect(resumed.status).toBe('running');
    expect(resumed.distanceTraveledMeters).toBeCloseTo(50);

    const next = simulator.advance(5);

    expect(next.distanceTraveledMeters).toBeCloseTo(100);
  });

  it('stops an active simulation', () => {
    const simulator = createSimulator();
    simulator.start();
    simulator.advance(2);

    const stopped = simulator.stop();

    expect(stopped.status).toBe('stopped');
    expect(() => simulator.advance(1)).toThrow();
  });

  it('completes automatically at the destination', () => {
    const simulator = createSimulator();
    simulator.start();

    const snapshot = simulator.advance(10000);

    expect(snapshot.status).toBe('completed');
    expect(snapshot.completed).toBe(true);
    expect(snapshot.progress).toBe(1);
    expect(snapshot.longitude).toBe(24.9525);
    expect(snapshot.latitude).toBe(60.1705);
  });

  it('does not allow starting twice', () => {
    const simulator = createSimulator();
    simulator.start();

    expect(() => simulator.start()).toThrow();
  });

  it('rejects invalid speed', () => {
    expect(() => new GpsSimulator(geometry, 0)).toThrow();
    expect(() => new GpsSimulator(geometry, -5)).toThrow();
    expect(() => new GpsSimulator(geometry, NaN)).toThrow();
  });

  it('rejects invalid advance durations', () => {
    const simulator = createSimulator();
    simulator.start();

    expect(() => simulator.advance(-1)).toThrow();
    expect(() => simulator.advance(Infinity)).toThrow();
  });

  it('returns deterministic snapshots', () => {
    const first = createSimulator();
    const second = createSimulator();

    first.start();
    second.start();

    expect(first.advance(12)).toEqual(second.advance(12));
  });
});
