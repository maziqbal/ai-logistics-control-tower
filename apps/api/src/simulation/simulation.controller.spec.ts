import { SimulationController } from './simulation.controller';
import { SimulationService } from './simulation.service';

describe('SimulationController', () => {
  let controller: SimulationController;

  const routeId = 'c0f26946-c6f0-47e0-806d-810a1e67090e';

  const snapshot = {
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

  const simulationService = {
    start: jest.fn(),
    get: jest.fn(),
    advance: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    stop: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    controller = new SimulationController(
      simulationService as unknown as SimulationService,
    );
  });

  it('starts a simulation for the requested route', async () => {
    simulationService.start.mockResolvedValue(snapshot);

    const result = await controller.start(routeId, 10);

    expect(simulationService.start).toHaveBeenCalledWith(routeId, 10);
    expect(result).toEqual(snapshot);
  });

  it('returns the current simulation snapshot', () => {
    simulationService.get.mockReturnValue(snapshot);

    expect(controller.get(routeId)).toEqual(snapshot);
    expect(simulationService.get).toHaveBeenCalledWith(routeId);
  });

  it('advances the simulation by the requested duration', () => {
    const advancedSnapshot = {
      ...snapshot,
      distanceTraveledMeters: 50,
      elapsedSeconds: 5,
      progress: 50 / 1700,
    };

    simulationService.advance.mockReturnValue(advancedSnapshot);

    const result = controller.advance(routeId, 5);

    expect(simulationService.advance).toHaveBeenCalledWith(routeId, 5);
    expect(result).toEqual(advancedSnapshot);
  });

  it('pauses the simulation', () => {
    const pausedSnapshot = {
      ...snapshot,
      status: 'paused' as const,
    };

    simulationService.pause.mockReturnValue(pausedSnapshot);

    expect(controller.pause(routeId)).toEqual(pausedSnapshot);
    expect(simulationService.pause).toHaveBeenCalledWith(routeId);
  });

  it('resumes the simulation', () => {
    simulationService.resume.mockReturnValue(snapshot);

    expect(controller.resume(routeId)).toEqual(snapshot);
    expect(simulationService.resume).toHaveBeenCalledWith(routeId);
  });

  it('stops the simulation', () => {
    const stoppedSnapshot = {
      ...snapshot,
      status: 'stopped' as const,
    };

    simulationService.stop.mockReturnValue(stoppedSnapshot);

    expect(controller.stop(routeId)).toEqual(stoppedSnapshot);
    expect(simulationService.stop).toHaveBeenCalledWith(routeId);
  });

  it('propagates errors from the simulation service', () => {
    simulationService.pause.mockImplementation(() => {
      throw new Error('Only a running simulation can be paused');
    });

    expect(() => controller.pause(routeId)).toThrow(
      'Only a running simulation can be paused',
    );
  });
});
