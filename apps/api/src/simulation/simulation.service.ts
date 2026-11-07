import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { RouteGeometryService } from '../routes/route-geometry.service';
import type { Coordinate, RouteLineString } from './route-position';
import {
  SimulationSessionManager,
  type SimulationSessionSnapshot,
} from './simulation-session.manager';

@Injectable()
export class SimulationService {
  constructor(
    private readonly routeGeometryService: RouteGeometryService,
    private readonly sessions: SimulationSessionManager,
  ) {}

  async start(
    routeId: string,
    speedMetersPerSecond: number,
  ): Promise<SimulationSessionSnapshot> {
    if (!routeId?.trim()) {
      throw new BadRequestException('Route ID is required');
    }

    if (!Number.isFinite(speedMetersPerSecond) || speedMetersPerSecond <= 0) {
      throw new BadRequestException(
        'Simulation speed must be a positive finite number',
      );
    }

    if (this.sessions.list().some((session) => session.routeId === routeId)) {
      throw new ConflictException(
        `Simulation already exists for route ${routeId}`,
      );
    }

    const result = await this.routeGeometryService.findByRoute(routeId);

    if (result.status !== 'ready' || !result.geometry) {
      throw new UnprocessableEntityException(
        `Cannot start simulation: route geometry is ${result.status}`,
      );
    }

    const geometry = this.toRouteLineString(result.geometry);

    try {
      return this.sessions.create(routeId, geometry, speedMetersPerSecond);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith('Simulation already exists')
      ) {
        throw new ConflictException(error.message);
      }

      throw error;
    }
  }

  get(routeId: string): SimulationSessionSnapshot {
    return this.withSession(() => this.sessions.get(routeId));
  }

  advance(routeId: string, seconds: number): SimulationSessionSnapshot {
    if (!Number.isFinite(seconds) || seconds < 0) {
      throw new BadRequestException(
        'Advance duration must be a non-negative finite number',
      );
    }

    return this.withSession(() => this.sessions.advance(routeId, seconds));
  }

  pause(routeId: string): SimulationSessionSnapshot {
    return this.withSession(() => this.sessions.pause(routeId));
  }

  resume(routeId: string): SimulationSessionSnapshot {
    return this.withSession(() => this.sessions.resume(routeId));
  }

  stop(routeId: string): SimulationSessionSnapshot {
    return this.withSession(() => this.sessions.stop(routeId));
  }

  private withSession(
    operation: () => SimulationSessionSnapshot,
  ): SimulationSessionSnapshot {
    try {
      return operation();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.startsWith('No simulation exists')) {
          throw new NotFoundException(error.message);
        }

        if (error.message === 'Route ID is required') {
          throw new BadRequestException(error.message);
        }

        // Invalid lifecycle transitions are conflicts.
        throw new ConflictException(error.message);
      }

      throw error;
    }
  }

  private toRouteLineString(geometry: {
    type: 'LineString';
    coordinates: number[][];
  }): RouteLineString {
    if (
      geometry.type !== 'LineString' ||
      !Array.isArray(geometry.coordinates) ||
      geometry.coordinates.length < 2
    ) {
      throw new BadGatewayException(
        'Routing service returned invalid simulation geometry',
      );
    }

    const coordinates: Coordinate[] = geometry.coordinates.map((coordinate) => {
      if (
        !Array.isArray(coordinate) ||
        coordinate.length !== 2 ||
        !Number.isFinite(coordinate[0]) ||
        !Number.isFinite(coordinate[1]) ||
        coordinate[0] < -180 ||
        coordinate[0] > 180 ||
        coordinate[1] < -90 ||
        coordinate[1] > 90
      ) {
        throw new BadGatewayException(
          'Routing service returned invalid simulation coordinates',
        );
      }

      return [coordinate[0], coordinate[1]];
    });

    const hasMovement = coordinates.some(
      (coordinate, index) =>
        index > 0 &&
        (coordinate[0] !== coordinates[index - 1][0] ||
          coordinate[1] !== coordinates[index - 1][1]),
    );

    if (!hasMovement) {
      throw new BadGatewayException(
        'Routing service returned a route with no movement',
      );
    }

    return {
      type: 'LineString',
      coordinates,
    };
  }
}
