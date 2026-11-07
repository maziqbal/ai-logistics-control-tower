import {
  RoutePositionCalculator,
  distanceBetweenCoordinates,
  type RouteLineString,
} from './route-position';

describe('RoutePositionCalculator', () => {
  const geometry: RouteLineString = {
    type: 'LineString',
    coordinates: [
      [24.9414, 60.1719],
      [24.945, 60.172],
      [24.9525, 60.1705],
    ],
  };

  it('calculates the total route distance', () => {
    const calculator = new RoutePositionCalculator(geometry);

    expect(calculator.totalDistanceMeters).toBeGreaterThan(0);
  });

  it('starts at the first coordinate', () => {
    const calculator = new RoutePositionCalculator(geometry);

    const position = calculator.positionAtDistance(0);

    expect(position.longitude).toBe(24.9414);
    expect(position.latitude).toBe(60.1719);
    expect(position.progress).toBe(0);
    expect(position.completed).toBe(false);
  });

  it('moves along the route after time has elapsed', () => {
    const calculator = new RoutePositionCalculator(geometry);

    const position = calculator.positionAtElapsedTime(5, 10);

    expect(position.distanceTraveledMeters).toBe(50);
    expect(position.progress).toBeGreaterThan(0);
    expect(position.completed).toBe(false);
  });

  it('reaches the final coordinate when the route completes', () => {
    const calculator = new RoutePositionCalculator(geometry);

    const position = calculator.positionAtDistance(
      calculator.totalDistanceMeters,
    );

    expect(position.longitude).toBe(24.9525);
    expect(position.latitude).toBe(60.1705);
    expect(position.progress).toBe(1);
    expect(position.completed).toBe(true);
  });

  it('clamps distances beyond the route length', () => {
    const calculator = new RoutePositionCalculator(geometry);

    const position = calculator.positionAtDistance(999999);

    expect(position.completed).toBe(true);
    expect(position.progress).toBe(1);
  });

  it('clamps negative distances to the start', () => {
    const calculator = new RoutePositionCalculator(geometry);

    const position = calculator.positionAtDistance(-100);

    expect(position.progress).toBe(0);
    expect(position.longitude).toBe(24.9414);
  });

  it('rejects empty or insufficient route geometry', () => {
    expect(
      () =>
        new RoutePositionCalculator({
          type: 'LineString',
          coordinates: [],
        }),
    ).toThrow();
  });

  it('rejects invalid coordinates', () => {
    expect(
      () =>
        new RoutePositionCalculator({
          type: 'LineString',
          coordinates: [
            [24.9414, 60.1719],
            [200, 100],
          ],
        }),
    ).toThrow('Invalid route coordinate');
  });

  it('rejects a route with no actual movement', () => {
    expect(
      () =>
        new RoutePositionCalculator({
          type: 'LineString',
          coordinates: [
            [24.9414, 60.1719],
            [24.9414, 60.1719],
          ],
        }),
    ).toThrow();
  });

  it('handles duplicate intermediate coordinates', () => {
    const calculator = new RoutePositionCalculator({
      type: 'LineString',
      coordinates: [
        [24.9414, 60.1719],
        [24.9414, 60.1719],
        [24.9525, 60.1705],
      ],
    });

    const position = calculator.positionAtDistance(
      calculator.totalDistanceMeters / 2,
    );

    expect(Number.isFinite(position.longitude)).toBe(true);
    expect(Number.isFinite(position.latitude)).toBe(true);
  });

  it('returns the same position for the same inputs', () => {
    const calculator = new RoutePositionCalculator(geometry);

    const first = calculator.positionAtElapsedTime(10, 5);
    const second = calculator.positionAtElapsedTime(10, 5);

    expect(first).toEqual(second);
  });

  it('rejects invalid time and speed', () => {
    const calculator = new RoutePositionCalculator(geometry);

    expect(() => calculator.positionAtElapsedTime(-1, 10)).toThrow();
    expect(() => calculator.positionAtElapsedTime(5, -10)).toThrow();
  });

  it('measures geographical distance between coordinates', () => {
    const distance = distanceBetweenCoordinates(
      [24.9414, 60.1719],
      [24.9525, 60.1705],
    );

    expect(distance).toBeGreaterThan(0);
    expect(
      distanceBetweenCoordinates([24.9414, 60.1719], [24.9414, 60.1719]),
    ).toBe(0);
  });
});
