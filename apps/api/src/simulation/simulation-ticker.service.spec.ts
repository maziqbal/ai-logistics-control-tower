import { SimulationSessionManager } from './simulation-session.manager';
import { SimulationTickerService } from './simulation-ticker.service';
import type { RouteLineString } from './route-position';

describe('SimulationTickerService', () => {
  let sessions: SimulationSessionManager;
  let ticker: SimulationTickerService;

  const geometry: RouteLineString = {
    type: 'LineString',
    coordinates: [
      [24.9414, 60.1719],
      [24.945, 60.172],
      [24.9525, 60.1705],
    ],
  };

  beforeEach(() => {
    sessions = new SimulationSessionManager();
    ticker = new SimulationTickerService(sessions);
  });

  afterEach(() => {
    ticker.onModuleDestroy();
    jest.useRealTimers();
  });

  it('registers a running simulation', () => {
    sessions.create('route-1', geometry, 10);

    ticker.register('route-1', 1000);

    expect(ticker.getTrackedRouteIds()).toEqual(['route-1']);
  });

  it('advances movement using actual elapsed time', () => {
    sessions.create('route-1', geometry, 10);
    ticker.register('route-1', 1000);

    const updates = ticker.tick(2200);

    expect(updates).toHaveLength(1);
    expect(updates[0].distanceTraveledMeters).toBeCloseTo(12);
    expect(updates[0].elapsedSeconds).toBeCloseTo(1.2);
  });

  it('does not advance a paused simulation', () => {
    sessions.create('route-1', geometry, 10);
    ticker.register('route-1', 1000);

    ticker.tick(2000);
    sessions.pause('route-1');
    ticker.resetClock('route-1', 2000);

    expect(ticker.tick(10000)).toHaveLength(0);
    expect(sessions.get('route-1').distanceTraveledMeters).toBeCloseTo(10);

    sessions.resume('route-1');
    ticker.resetClock('route-1', 10000);

    ticker.tick(11000);

    expect(sessions.get('route-1').distanceTraveledMeters).toBeCloseTo(20);
  });

  it('maintains independent clocks for multiple routes', () => {
    sessions.create('route-1', geometry, 10);
    sessions.create('route-2', geometry, 5);

    ticker.register('route-1', 1000);
    ticker.register('route-2', 2000);

    ticker.tick(3000);

    expect(sessions.get('route-1').distanceTraveledMeters).toBeCloseTo(20);
    expect(sessions.get('route-2').distanceTraveledMeters).toBeCloseTo(5);
  });

  it('unregisters a simulation after completion', () => {
    sessions.create('route-1', geometry, 10);
    ticker.register('route-1', 1000);

    const updates = ticker.tick(1000000);

    expect(updates[0].status).toBe('completed');
    expect(ticker.getTrackedRouteIds()).toHaveLength(0);
    expect(sessions.get('route-1').progress).toBe(1);
  });

  it('rejects duplicate registration', () => {
    sessions.create('route-1', geometry, 10);

    ticker.register('route-1', 1000);

    expect(() => ticker.register('route-1', 2000)).toThrow(
      'Simulation ticker already tracks',
    );
  });

  it('does not advance the simulation after unregistering', () => {
    sessions.create('route-1', geometry, 10);
    ticker.register('route-1', 1000);

    ticker.unregister('route-1');
    ticker.tick(5000);

    expect(sessions.get('route-1').distanceTraveledMeters).toBe(0);
  });

  it('does not count negative elapsed time', () => {
    sessions.create('route-1', geometry, 10);
    ticker.register('route-1', 5000);

    expect(ticker.tick(4000)).toHaveLength(0);
    expect(sessions.get('route-1').distanceTraveledMeters).toBe(0);
  });

  it('does not create duplicate automatic intervals', () => {
    jest.useFakeTimers();

    const intervalSpy = jest.spyOn(global, 'setInterval');

    ticker.startTicker();
    ticker.startTicker();

    expect(intervalSpy).toHaveBeenCalledTimes(1);

    intervalSpy.mockRestore();
  });

  it('cleans up the automatic timer on shutdown', () => {
    jest.useFakeTimers();

    sessions.create('route-1', geometry, 10);
    ticker.register('route-1', 1000);
    ticker.startTicker();

    ticker.onModuleDestroy();

    expect(ticker.getTrackedRouteIds()).toHaveLength(0);
    expect(jest.getTimerCount()).toBe(0);
  });
});
