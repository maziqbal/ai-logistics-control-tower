import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { BadRequestException } from '@nestjs/common';
import type { Namespace, Socket } from 'socket.io';

import type { SimulationSessionSnapshot } from './simulation-session.manager';

type RouteSubscription = {
  routeId: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@WebSocketGateway({
  namespace: 'simulations',
  cors: {
    origin: 'http://localhost:5173',
  },
})
export class SimulationGateway {
  @WebSocketServer()
  server!: Namespace;

  @SubscribeMessage('simulation:subscribe')
  async subscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: RouteSubscription,
  ) {
    const routeId = this.validateRouteId(payload);

    await client.join(this.roomFor(routeId));

    return {
      event: 'simulation:subscribed',
      data: { routeId },
    };
  }

  @SubscribeMessage('simulation:unsubscribe')
  async unsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: RouteSubscription,
  ) {
    const routeId = this.validateRouteId(payload);

    await client.leave(this.roomFor(routeId));

    return {
      event: 'simulation:unsubscribed',
      data: { routeId },
    };
  }

  broadcastPosition(snapshot: SimulationSessionSnapshot): void {
    this.server
      .to(this.roomFor(snapshot.routeId))
      .emit('simulation:position', snapshot);
  }

  private roomFor(routeId: string): string {
    return `route:${routeId}`;
  }

  private validateRouteId(payload: RouteSubscription): string {
    const routeId = payload?.routeId;

    if (typeof routeId !== 'string' || !UUID_PATTERN.test(routeId)) {
      throw new BadRequestException('Valid route ID is required');
    }

    return routeId;
  }
}
