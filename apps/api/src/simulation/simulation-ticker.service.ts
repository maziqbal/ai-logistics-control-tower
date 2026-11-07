import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

import {
  SimulationSessionManager,
  type SimulationSessionSnapshot,
} from './simulation-session.manager';

const DEFAULT_TICK_INTERVAL_MS = 1000;

type SnapshotListener = (snapshot: SimulationSessionSnapshot) => void;

@Injectable()
export class SimulationTickerService implements OnModuleDestroy {
  private readonly lastTickByRoute = new Map<string, number>();

  private timer: ReturnType<typeof setInterval> | null = null;
  private snapshotListener: SnapshotListener | null = null;
  private readonly logger = new Logger(SimulationTickerService.name);

  constructor(private readonly sessions: SimulationSessionManager) {}

  register(routeId: string, nowMs = Date.now()): void {
    this.validateTime(nowMs);

    const session = this.sessions.get(routeId);

    if (session.status !== 'running') {
      throw new Error('Only running simulations can be registered');
    }

    if (this.lastTickByRoute.has(routeId)) {
      throw new Error(`Simulation ticker already tracks ${routeId}`);
    }

    this.lastTickByRoute.set(routeId, nowMs);
  }

  resetClock(routeId: string, nowMs = Date.now()): void {
    this.validateTime(nowMs);

    if (!this.lastTickByRoute.has(routeId)) {
      throw new Error(`Simulation ticker does not track ${routeId}`);
    }

    this.lastTickByRoute.set(routeId, nowMs);
  }

  unregister(routeId: string): void {
    this.lastTickByRoute.delete(routeId);
  }

  tick(nowMs = Date.now()): SimulationSessionSnapshot[] {
    this.validateTime(nowMs);

    const updates: SimulationSessionSnapshot[] = [];

    for (const [routeId, previousMs] of this.lastTickByRoute) {
      const session = this.sessions.get(routeId);

      if (session.status === 'completed' || session.status === 'stopped') {
        this.unregister(routeId);
        continue;
      }

      if (session.status === 'paused') {
        this.lastTickByRoute.set(routeId, nowMs);
        continue;
      }

      if (session.status !== 'running') {
        continue;
      }

      const elapsedSeconds = Math.max(0, (nowMs - previousMs) / 1000);

      if (elapsedSeconds === 0) {
        continue;
      }

      const snapshot = this.sessions.advance(routeId, elapsedSeconds);

      this.lastTickByRoute.set(routeId, nowMs);
      updates.push(snapshot);

      if (snapshot.status === 'completed') {
        this.unregister(routeId);
      }
    }

    return updates;
  }

  /**
   * Starts the automatic timer and optionally publishes
   * each updated simulation snapshot.
   */

  startTicker(listener?: SnapshotListener): void {
    if (listener) {
      this.snapshotListener = listener;
    }

    if (this.timer !== null) {
      return;
    }

    this.timer = setInterval(() => {
      try {
        const updates = this.tick();

        for (const snapshot of updates) {
          try {
            this.snapshotListener?.(snapshot);
          } catch (error) {
            this.logger.error(
              `Failed to publish GPS update for route ${snapshot.routeId}`,
              error instanceof Error ? error.stack : String(error),
            );
          }
        }
      } catch (error) {
        this.logger.error(
          'Automatic GPS simulation tick failed',
          error instanceof Error ? error.stack : String(error),
        );
      }
    }, DEFAULT_TICK_INTERVAL_MS);
  }

  stopTicker(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.snapshotListener = null;
  }

  getTrackedRouteIds(): string[] {
    return Array.from(this.lastTickByRoute.keys());
  }

  onModuleDestroy(): void {
    this.stopTicker();
    this.lastTickByRoute.clear();
  }

  private validateTime(nowMs: number): void {
    if (!Number.isFinite(nowMs) || nowMs < 0) {
      throw new Error('Ticker time must be a non-negative finite number');
    }
  }
}
