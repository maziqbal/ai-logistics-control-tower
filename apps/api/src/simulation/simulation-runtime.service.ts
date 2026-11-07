import { Injectable, OnModuleInit } from '@nestjs/common';

import { SimulationGateway } from './simulation.gateway';
import { SimulationService } from './simulation.service';
import { SimulationTickerService } from './simulation-ticker.service';
import type { SimulationSessionSnapshot } from './simulation-session.manager';

@Injectable()
export class SimulationRuntimeService implements OnModuleInit {
  constructor(
    private readonly simulations: SimulationService,
    private readonly ticker: SimulationTickerService,
    private readonly gateway: SimulationGateway,
  ) {}

  onModuleInit(): void {
    this.ticker.startTicker((snapshot) => {
      this.gateway.broadcastPosition(snapshot);
    });
  }

  async start(
    routeId: string,
    speedMetersPerSecond: number,
  ): Promise<SimulationSessionSnapshot> {
    const snapshot = await this.simulations.start(
      routeId,
      speedMetersPerSecond,
    );

    this.ticker.register(routeId);
    this.gateway.broadcastPosition(snapshot);

    return snapshot;
  }

  get(routeId: string): SimulationSessionSnapshot {
    return this.simulations.get(routeId);
  }

  advance(routeId: string, seconds: number): SimulationSessionSnapshot {
    const snapshot = this.simulations.advance(routeId, seconds);

    // Manual advancement and automatic ticking share one clock.
    // Resetting prevents counting the same wall-clock interval twice.
    if (snapshot.status === 'running') {
      this.ticker.resetClock(routeId);
    } else if (snapshot.status === 'completed') {
      this.ticker.unregister(routeId);
    }

    this.gateway.broadcastPosition(snapshot);
    return snapshot;
  }

  pause(routeId: string): SimulationSessionSnapshot {
    const snapshot = this.simulations.pause(routeId);

    this.ticker.resetClock(routeId);
    this.gateway.broadcastPosition(snapshot);

    return snapshot;
  }

  resume(routeId: string): SimulationSessionSnapshot {
    const snapshot = this.simulations.resume(routeId);

    // Discard time spent paused.
    this.ticker.resetClock(routeId);
    this.gateway.broadcastPosition(snapshot);

    return snapshot;
  }

  stop(routeId: string): SimulationSessionSnapshot {
    const snapshot = this.simulations.stop(routeId);

    this.ticker.unregister(routeId);
    this.gateway.broadcastPosition(snapshot);

    return snapshot;
  }
}
