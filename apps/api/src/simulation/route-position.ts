export type Coordinate = [longitude: number, latitude: number];

export interface RouteLineString {
  type: 'LineString';
  coordinates: Coordinate[];
}

export interface RoutePosition {
  longitude: number;
  latitude: number;
  distanceTraveledMeters: number;
  totalDistanceMeters: number;
  progress: number;
  completed: boolean;
}

const EARTH_RADIUS_METERS = 6_371_000;

function validateCoordinate(coordinate: Coordinate): void {
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
    throw new Error('Invalid route coordinate');
  }
}

export function distanceBetweenCoordinates(
  from: Coordinate,
  to: Coordinate,
): number {
  validateCoordinate(from);
  validateCoordinate(to);

  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

  const latitude1 = toRadians(from[1]);
  const latitude2 = toRadians(to[1]);

  const deltaLatitude = latitude2 - latitude1;
  const deltaLongitude = toRadians(to[0] - from[0]);

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(deltaLongitude / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, a)));
}

export class RoutePositionCalculator {
  private readonly coordinates: Coordinate[];
  private readonly segmentDistances: number[];
  readonly totalDistanceMeters: number;

  constructor(geometry: RouteLineString) {
    if (
      geometry?.type !== 'LineString' ||
      !Array.isArray(geometry.coordinates) ||
      geometry.coordinates.length < 2
    ) {
      throw new Error('Route must contain at least two coordinates');
    }

    this.coordinates = geometry.coordinates.map((coordinate) => {
      validateCoordinate(coordinate);
      return [coordinate[0], coordinate[1]];
    });

    this.segmentDistances = [];

    for (let index = 1; index < this.coordinates.length; index++) {
      this.segmentDistances.push(
        distanceBetweenCoordinates(
          this.coordinates[index - 1],
          this.coordinates[index],
        ),
      );
    }

    this.totalDistanceMeters = this.segmentDistances.reduce(
      (total, distance) => total + distance,
      0,
    );

    if (this.totalDistanceMeters <= 0) {
      throw new Error('Route must contain at least two distinct positions');
    }
  }

  positionAtDistance(requestedDistanceMeters: number): RoutePosition {
    if (!Number.isFinite(requestedDistanceMeters)) {
      throw new Error('Distance must be a finite number');
    }

    const distanceTraveledMeters = Math.max(
      0,
      Math.min(requestedDistanceMeters, this.totalDistanceMeters),
    );

    const completed = distanceTraveledMeters >= this.totalDistanceMeters;

    if (completed) {
      const finalCoordinate = this.coordinates[this.coordinates.length - 1];

      return {
        longitude: finalCoordinate[0],
        latitude: finalCoordinate[1],
        distanceTraveledMeters,
        totalDistanceMeters: this.totalDistanceMeters,
        progress: 1,
        completed: true,
      };
    }

    let remainingDistance = distanceTraveledMeters;

    for (let index = 0; index < this.segmentDistances.length; index++) {
      const segmentDistance = this.segmentDistances[index];

      if (segmentDistance === 0) {
        continue;
      }

      if (remainingDistance <= segmentDistance) {
        const from = this.coordinates[index];
        const to = this.coordinates[index + 1];

        const ratio = remainingDistance / segmentDistance;

        return {
          longitude: from[0] + (to[0] - from[0]) * ratio,
          latitude: from[1] + (to[1] - from[1]) * ratio,
          distanceTraveledMeters,
          totalDistanceMeters: this.totalDistanceMeters,
          progress: distanceTraveledMeters / this.totalDistanceMeters,
          completed: false,
        };
      }

      remainingDistance -= segmentDistance;
    }

    throw new Error('Unable to calculate route position');
  }

  positionAtElapsedTime(
    elapsedSeconds: number,
    speedMetersPerSecond: number,
  ): RoutePosition {
    if (
      !Number.isFinite(elapsedSeconds) ||
      elapsedSeconds < 0 ||
      !Number.isFinite(speedMetersPerSecond) ||
      speedMetersPerSecond < 0
    ) {
      throw new Error(
        'Elapsed time and speed must be non-negative finite numbers',
      );
    }

    return this.positionAtDistance(elapsedSeconds * speedMetersPerSecond);
  }
}
