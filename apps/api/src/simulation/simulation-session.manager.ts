import { GpsSimulator, type SimulationSnapshot } from './gps-simulator';
import type { RouteLineString } from './route-position';

export interface SimulationSessionSnapshot extends SimulationSnapshot {
  routeId: string;
}

export class SimulationSessionManager {
  private readonly sessions = new Map<string, GpsSimulator>();

  create(
    routeId: string,
    geometry: RouteLineString,
    speedMetersPerSecond: number,
  ): SimulationSessionSnapshot {
    this.validateRouteId(routeId);

    if (this.sessions.has(routeId)) {
      throw new Error(`Simulation already exists for route ${routeId}`);
    }

    const simulator = new GpsSimulator(geometry, speedMetersPerSecond);

    const snapshot = simulator.start();

    this.sessions.set(routeId, simulator);

    return {
      routeId,
      ...snapshot,
    };
  }

  get(routeId: string): SimulationSessionSnapshot {
    const simulator = this.getExistingSession(routeId);

    return {
      routeId,
      ...simulator.getSnapshot(),
    };
  }

  pause(routeId: string): SimulationSessionSnapshot {
    return this.apply(routeId, (simulator) => simulator.pause());
  }

  resume(routeId: string): SimulationSessionSnapshot {
    return this.apply(routeId, (simulator) => simulator.resume());
  }

  stop(routeId: string): SimulationSessionSnapshot {
    return this.apply(routeId, (simulator) => simulator.stop());
  }

  advance(routeId: string, seconds: number): SimulationSessionSnapshot {
    return this.apply(routeId, (simulator) => simulator.advance(seconds));
  }

  remove(routeId: string): void {
    this.validateRouteId(routeId);

    if (!this.sessions.delete(routeId)) {
      throw new Error(`No simulation exists for route ${routeId}`);
    }
  }

  list(): SimulationSessionSnapshot[] {
    return Array.from(this.sessions.entries()).map(([routeId, simulator]) => ({
      routeId,
      ...simulator.getSnapshot(),
    }));
  }

  private apply(
    routeId: string,
    operation: (simulator: GpsSimulator) => SimulationSnapshot,
  ): SimulationSessionSnapshot {
    const simulator = this.getExistingSession(routeId);

    return {
      routeId,
      ...operation(simulator),
    };
  }

  private getExistingSession(routeId: string): GpsSimulator {
    this.validateRouteId(routeId);

    const simulator = this.sessions.get(routeId);

    if (!simulator) {
      throw new Error(`No simulation exists for route ${routeId}`);
    }

    return simulator;
  }

  private validateRouteId(routeId: string): void {
    if (typeof routeId !== 'string' || routeId.trim().length === 0) {
      throw new Error('Route ID is required');
    }
  }
}
