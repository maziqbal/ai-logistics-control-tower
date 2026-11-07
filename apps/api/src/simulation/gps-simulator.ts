import {
  RoutePositionCalculator,
  type RouteLineString,
  type RoutePosition,
} from './route-position';

export type SimulationStatus =
  'idle' | 'running' | 'paused' | 'stopped' | 'completed';

export interface SimulationSnapshot extends RoutePosition {
  status: SimulationStatus;
  elapsedSeconds: number;
  speedMetersPerSecond: number;
}

export class GpsSimulator {
  private readonly calculator: RoutePositionCalculator;
  private readonly speedMetersPerSecond: number;

  private status: SimulationStatus = 'idle';
  private elapsedSeconds = 0;

  constructor(geometry: RouteLineString, speedMetersPerSecond: number) {
    if (!Number.isFinite(speedMetersPerSecond) || speedMetersPerSecond <= 0) {
      throw new Error('Simulation speed must be a positive finite number');
    }

    this.calculator = new RoutePositionCalculator(geometry);
    this.speedMetersPerSecond = speedMetersPerSecond;
  }

  start(): SimulationSnapshot {
    if (this.status !== 'idle') {
      throw new Error('Simulation can only start from idle');
    }

    this.status = 'running';
    return this.getSnapshot();
  }

  pause(): SimulationSnapshot {
    if (this.status !== 'running') {
      throw new Error('Only a running simulation can be paused');
    }

    this.status = 'paused';
    return this.getSnapshot();
  }

  resume(): SimulationSnapshot {
    if (this.status !== 'paused') {
      throw new Error('Only a paused simulation can resume');
    }

    this.status = 'running';
    return this.getSnapshot();
  }

  stop(): SimulationSnapshot {
    if (this.status !== 'running' && this.status !== 'paused') {
      throw new Error('Only an active simulation can be stopped');
    }

    this.status = 'stopped';
    return this.getSnapshot();
  }

  advance(seconds: number): SimulationSnapshot {
    if (!Number.isFinite(seconds) || seconds < 0) {
      throw new Error('Advance duration must be a non-negative finite number');
    }

    if (this.status !== 'running') {
      throw new Error('Only a running simulation can advance');
    }

    const remainingSeconds =
      (this.calculator.totalDistanceMeters -
        this.getSnapshot().distanceTraveledMeters) /
      this.speedMetersPerSecond;

    this.elapsedSeconds += Math.min(seconds, remainingSeconds);

    const position = this.calculator.positionAtElapsedTime(
      this.elapsedSeconds,
      this.speedMetersPerSecond,
    );

    if (position.completed) {
      this.status = 'completed';
    }

    return this.getSnapshot();
  }

  getSnapshot(): SimulationSnapshot {
    const position = this.calculator.positionAtElapsedTime(
      this.elapsedSeconds,
      this.speedMetersPerSecond,
    );

    return {
      ...position,
      status: this.status,
      elapsedSeconds: this.elapsedSeconds,
      speedMetersPerSecond: this.speedMetersPerSecond,
    };
  }
}
