import { BadRequestException } from '@nestjs/common';
import type { Namespace, Socket } from 'socket.io';

import { SimulationGateway } from './simulation.gateway';

describe('SimulationGateway', () => {
  let gateway: SimulationGateway;

  const routeId = 'c0f26946-c6f0-47e0-806d-810a1e67090e';

  const join = jest.fn();
  const leave = jest.fn();
  const emit = jest.fn();
  const to = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    gateway = new SimulationGateway();

    to.mockReturnValue({ emit });

    gateway.server = {
      to,
    } as unknown as Namespace;
  });

  const client = () =>
    ({
      join,
      leave,
    }) as unknown as Socket;

  it('subscribes a client to a route-specific room', async () => {
    const result = await gateway.subscribe(client(), { routeId });

    expect(join).toHaveBeenCalledWith(`route:${routeId}`);
    expect(result).toEqual({
      event: 'simulation:subscribed',
      data: { routeId },
    });
  });

  it('unsubscribes a client from the selected room', async () => {
    const result = await gateway.unsubscribe(client(), { routeId });

    expect(leave).toHaveBeenCalledWith(`route:${routeId}`);
    expect(result).toEqual({
      event: 'simulation:unsubscribed',
      data: { routeId },
    });
  });

  it('rejects invalid subscription route IDs', async () => {
    await expect(
      gateway.subscribe(client(), { routeId: 'invalid' }),
    ).rejects.toThrow(BadRequestException);

    expect(join).not.toHaveBeenCalled();
  });

  it('rejects missing subscription payloads', async () => {
    await expect(
      gateway.subscribe(client(), undefined as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects invalid unsubscribe requests', async () => {
    await expect(
      gateway.unsubscribe(client(), { routeId: '' }),
    ).rejects.toThrow(BadRequestException);

    expect(leave).not.toHaveBeenCalled();
  });

  it('broadcasts GPS snapshots to the correct route room', () => {
    const snapshot = {
      routeId,
      longitude: 24.9414,
      latitude: 60.1719,
      distanceTraveledMeters: 50,
      totalDistanceMeters: 1700,
      progress: 50 / 1700,
      completed: false,
      status: 'running' as const,
      elapsedSeconds: 5,
      speedMetersPerSecond: 10,
    };

    gateway.broadcastPosition(snapshot);

    expect(to).toHaveBeenCalledWith(`route:${routeId}`);
    expect(emit).toHaveBeenCalledWith('simulation:position', snapshot);
  });

  it('uses separate rooms for different routes', () => {
    const firstRoute = routeId;
    const secondRoute = 'fbb04c2f-c71a-44e8-9b82-fb2a2fcac27b';

    const makeSnapshot = (id: string) => ({
      routeId: id,
      longitude: 24.94,
      latitude: 60.17,
      distanceTraveledMeters: 0,
      totalDistanceMeters: 100,
      progress: 0,
      completed: false,
      status: 'running' as const,
      elapsedSeconds: 0,
      speedMetersPerSecond: 10,
    });

    gateway.broadcastPosition(makeSnapshot(firstRoute));
    gateway.broadcastPosition(makeSnapshot(secondRoute));

    expect(to).toHaveBeenNthCalledWith(1, `route:${firstRoute}`);
    expect(to).toHaveBeenNthCalledWith(2, `route:${secondRoute}`);
  });
});
