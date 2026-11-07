import { SimulationRuntimeService } from './simulation-runtime.service';
import { SimulationService } from './simulation.service';
import { SimulationTickerService } from './simulation-ticker.service';
import { SimulationGateway } from './simulation.gateway';

describe('SimulationRuntimeService', () => {
  const routeId = 'c0f26946-c6f0-47e0-806d-810a1e67090e';

  const runningSnapshot = {
    routeId,
    longitude: 24.9414,
    latitude: 60.1719,
    distanceTraveledMeters: 0,
    totalDistanceMeters: 1700,
    progress: 0,
    completed: false,
    status: 'running' as const,
    elapsedSeconds: 0,
    speedMetersPerSecond: 10,
  };

  const simulations = {
    start: jest.fn(),
    get: jest.fn(),
    advance: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    stop: jest.fn(),
  };

  const ticker = {
    startTicker: jest.fn(),
    register: jest.fn(),
    resetClock: jest.fn(),
    unregister: jest.fn(),
  };

  const gateway = {
    broadcastPosition: jest.fn(),
  };

  let runtime: SimulationRuntimeService;

  beforeEach(() => {
    jest.resetAllMocks();

    runtime = new SimulationRuntimeService(
      simulations as unknown as SimulationService,
      ticker as unknown as SimulationTickerService,
      gateway as unknown as SimulationGateway,
    );
  });

  it('starts the ticker and connects its WebSocket listener', () => {
    runtime.onModuleInit();

    expect(ticker.startTicker).toHaveBeenCalledWith(expect.any(Function));

    const listener = ticker.startTicker.mock.calls[0][0] as (
      snapshot: typeof runningSnapshot,
    ) => void;

    listener(runningSnapshot);

    expect(gateway.broadcastPosition).toHaveBeenCalledWith(runningSnapshot);
  });

  it('starts and registers a route simulation', async () => {
    simulations.start.mockResolvedValue(runningSnapshot);

    const result = await runtime.start(routeId, 10);

    expect(simulations.start).toHaveBeenCalledWith(routeId, 10);
    expect(ticker.register).toHaveBeenCalledWith(routeId);
    expect(gateway.broadcastPosition).toHaveBeenCalledWith(runningSnapshot);
    expect(result).toEqual(runningSnapshot);
  });

  it('returns the existing snapshot', () => {
    simulations.get.mockReturnValue(runningSnapshot);

    expect(runtime.get(routeId)).toEqual(runningSnapshot);
    expect(simulations.get).toHaveBeenCalledWith(routeId);
  });

  it('broadcasts and resets the clock after manual advancement', () => {
    const advanced = {
      ...runningSnapshot,
      elapsedSeconds: 5,
      distanceTraveledMeters: 50,
      progress: 50 / 1700,
    };

    simulations.advance.mockReturnValue(advanced);

    expect(runtime.advance(routeId, 5)).toEqual(advanced);
    expect(ticker.resetClock).toHaveBeenCalledWith(routeId);
    expect(gateway.broadcastPosition).toHaveBeenCalledWith(advanced);
  });

  it('unregisters a completed simulation', () => {
    const completed = {
      ...runningSnapshot,
      status: 'completed' as const,
      completed: true,
      progress: 1,
      distanceTraveledMeters: 1700,
    };

    simulations.advance.mockReturnValue(completed);

    runtime.advance(routeId, 500);

    expect(ticker.unregister).toHaveBeenCalledWith(routeId);
    expect(ticker.resetClock).not.toHaveBeenCalled();
    expect(gateway.broadcastPosition).toHaveBeenCalledWith(completed);
  });

  it('pauses movement and broadcasts the paused state', () => {
    const paused = {
      ...runningSnapshot,
      status: 'paused' as const,
    };

    simulations.pause.mockReturnValue(paused);

    expect(runtime.pause(routeId)).toEqual(paused);
    expect(ticker.resetClock).toHaveBeenCalledWith(routeId);
    expect(gateway.broadcastPosition).toHaveBeenCalledWith(paused);
  });

  it('resumes movement with a fresh ticker clock', () => {
    simulations.resume.mockReturnValue(runningSnapshot);

    expect(runtime.resume(routeId)).toEqual(runningSnapshot);
    expect(ticker.resetClock).toHaveBeenCalledWith(routeId);
    expect(gateway.broadcastPosition).toHaveBeenCalledWith(runningSnapshot);
  });

  it('stops tracking and broadcasts the stopped state', () => {
    const stopped = {
      ...runningSnapshot,
      status: 'stopped' as const,
    };

    simulations.stop.mockReturnValue(stopped);

    expect(runtime.stop(routeId)).toEqual(stopped);
    expect(ticker.unregister).toHaveBeenCalledWith(routeId);
    expect(gateway.broadcastPosition).toHaveBeenCalledWith(stopped);
  });

  it('does not register or broadcast when starting fails', async () => {
    simulations.start.mockRejectedValue(new Error('Route unavailable'));

    await expect(runtime.start(routeId, 10)).rejects.toThrow(
      'Route unavailable',
    );

    expect(ticker.register).not.toHaveBeenCalled();
    expect(gateway.broadcastPosition).not.toHaveBeenCalled();
  });
});
