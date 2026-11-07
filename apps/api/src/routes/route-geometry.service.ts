import {
  BadGatewayException,
  Injectable,
} from '@nestjs/common';

import { StopsService } from '../stops/stops.service';

type OsrmRoute = {
  distance: number;
  duration: number;
  geometry: {
    type: 'LineString';
    coordinates: number[][];
  };
};

type OsrmResponse = {
  code: string;
  routes?: OsrmRoute[];
};

@Injectable()
export class RouteGeometryService {
  private readonly osrmBaseUrl =
    process.env.OSRM_BASE_URL ?? 'http://localhost:5000';

  constructor(private readonly stopsService: StopsService) {}

  async findByRoute(routeId: string) {
    const stops = await this.stopsService.findByRoute(routeId);

    if (stops.length < 2) {
      return {
        routeId,
        status: 'insufficient_stops',
        geometry: null,
        distanceMeters: null,
        durationSeconds: null,
      };
    }

    const coordinates = stops
      .map((stop) => `${stop.longitude},${stop.latitude}`)
      .join(';');

    const url = new URL(
      `/route/v1/driving/${coordinates}`,
      this.osrmBaseUrl,
    );

    url.searchParams.set('overview', 'full');
    url.searchParams.set('geometries', 'geojson');

    let response: Response;

    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new BadGatewayException(
        'Routing service is unavailable',
      );
    }

    if (!response.ok) {
      throw new BadGatewayException(
        'Routing service returned an error',
      );
    }

    let data: OsrmResponse;

    try {
      data = (await response.json()) as OsrmResponse;
    } catch {
      throw new BadGatewayException(
        'Routing service returned invalid JSON',
      );
    }

    if (data.code === 'NoRoute') {
      return {
        routeId,
        status: 'no_route',
        geometry: null,
        distanceMeters: null,
        durationSeconds: null,
      };
    }

    const route = data.routes?.[0];

    if (
      data.code !== 'Ok' ||
      !route ||
      !Number.isFinite(route.distance) ||
      !Number.isFinite(route.duration) ||
      route.geometry?.type !== 'LineString' ||
      !Array.isArray(route.geometry.coordinates)
    ) {
      throw new BadGatewayException(
        'Routing service returned an invalid route',
      );
    }

    return {
      routeId,
      status: 'ready',
      geometry: route.geometry,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
    };
  }
}
