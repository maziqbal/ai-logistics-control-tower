import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useLiveSimulation } from './useLiveSimulation';

const socketMocks = vi.hoisted(() => ({
  io: vi.fn(),
}));

vi.mock('socket.io-client', () => ({
  io: socketMocks.io,
}));

const ROUTE_A = 'c0f26946-c6f0-47e0-806d-810a1e67090e';
const ROUTE_B = 'fbb04c2f-c71a-44e8-9b82-fb2a2fcac27b';

type SocketHandler = (...args: unknown[]) => void;

function createMockSocket() {
  const handlers = new Map<string, SocketHandler>();

  const socket = {
    connected: false,
    on: vi.fn((event: string, handler: SocketHandler) => {
      handlers.set(event, handler);
      return socket;
    }),
    off: vi.fn((event: string) => {
      handlers.delete(event);
      return socket;
    }),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  function trigger(event: string, payload?: unknown) {
    if (event === 'connect') socket.connected = true;
    if (event === 'disconnect') socket.connected = false;

    act(() => {
      handlers.get(event)?.(payload);
    });
  }

  return { socket, trigger };
}

function makeSnapshot(routeId = ROUTE_A) {
  return {
    routeId,
    longitude: 24.941,
    latitude: 60.171,
    distanceTraveledMeters: 50,
    totalDistanceMeters: 1700,
    progress: 50 / 1700,
    completed: false,
    status: 'running',
    elapsedSeconds: 5,
    speedMetersPerSecond: 10,
  };
}

function TestComponent({ routeId }: { routeId: string }) {
  const { snapshot, connectionStatus, error } = useLiveSimulation(routeId);

  return (
    <div>
      <p data-testid="connection">{connectionStatus}</p>
      <p data-testid="distance">{snapshot?.distanceTraveledMeters ?? 'none'}</p>
      <p data-testid="route">{snapshot?.routeId ?? 'none'}</p>
      <p data-testid="error">{error ?? 'none'}</p>
    </div>
  );
}

describe('useLiveSimulation', () => {
  let sockets: ReturnType<typeof createMockSocket>[];

  beforeEach(() => {
    vi.clearAllMocks();
    sockets = [];

    socketMocks.io.mockImplementation(() => {
      const instance = createMockSocket();
      sockets.push(instance);
      return instance.socket;
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('connects to the simulations namespace', () => {
    render(<TestComponent routeId={ROUTE_A} />);

    expect(socketMocks.io).toHaveBeenCalledWith(
      expect.stringContaining('/simulations'),
      expect.objectContaining({
        autoConnect: false,
        reconnection: true,
      }),
    );

    expect(sockets[0].socket.connect).toHaveBeenCalledOnce();
    expect(screen.getByTestId('connection')).toHaveTextContent('connecting');
  });

  it('subscribes to the selected route on connection', () => {
    render(<TestComponent routeId={ROUTE_A} />);

    sockets[0].trigger('connect');

    expect(sockets[0].socket.emit).toHaveBeenCalledWith('simulation:subscribe', {
      routeId: ROUTE_A,
    });

    expect(screen.getByTestId('connection')).toHaveTextContent('connected');
  });

  it('updates the GPS snapshot when a position event arrives', () => {
    render(<TestComponent routeId={ROUTE_A} />);

    sockets[0].trigger('connect');

    sockets[0].trigger('simulation:position', makeSnapshot());

    expect(screen.getByTestId('distance')).toHaveTextContent('50');

    expect(screen.getByTestId('route')).toHaveTextContent(ROUTE_A);
  });

  it('ignores GPS events belonging to another route', () => {
    render(<TestComponent routeId={ROUTE_A} />);

    sockets[0].trigger('simulation:position', makeSnapshot(ROUTE_B));

    expect(screen.getByTestId('distance')).toHaveTextContent('none');
  });

  it('treats a missing simulation as a normal state', async () => {
    render(<TestComponent routeId={ROUTE_A} />);

    sockets[0].trigger('connect');

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    expect(screen.getByTestId('error')).toHaveTextContent('none');

    expect(screen.getByTestId('distance')).toHaveTextContent('none');
  });

  it('loads the current snapshot after connecting', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => makeSnapshot(),
      }),
    );

    render(<TestComponent routeId={ROUTE_A} />);

    sockets[0].trigger('connect');

    await waitFor(() => {
      expect(screen.getByTestId('distance')).toHaveTextContent('50');
    });
  });

  it('cleans up the old subscription when routes change', () => {
    const { rerender } = render(<TestComponent routeId={ROUTE_A} />);

    sockets[0].trigger('connect');

    rerender(<TestComponent routeId={ROUTE_B} />);

    expect(sockets[0].socket.emit).toHaveBeenCalledWith('simulation:unsubscribe', {
      routeId: ROUTE_A,
    });

    expect(sockets[0].socket.disconnect).toHaveBeenCalledOnce();

    expect(sockets).toHaveLength(2);

    sockets[1].trigger('connect');

    expect(sockets[1].socket.emit).toHaveBeenCalledWith('simulation:subscribe', {
      routeId: ROUTE_B,
    });

    expect(screen.getByTestId('distance')).toHaveTextContent('none');
  });

  it('recovers the latest GPS snapshot on reconnection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => makeSnapshot(),
      }),
    );

    render(<TestComponent routeId={ROUTE_A} />);

    sockets[0].trigger('connect');

    await waitFor(() => {
      expect(screen.getByTestId('distance')).toHaveTextContent('50');
    });

    sockets[0].trigger('disconnect');

    expect(screen.getByTestId('connection')).toHaveTextContent('disconnected');

    sockets[0].trigger('connect');

    expect(sockets[0].socket.emit).toHaveBeenCalledTimes(2);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });
  });

  it('disconnects and removes listeners on unmount', () => {
    const { unmount } = render(<TestComponent routeId={ROUTE_A} />);

    sockets[0].trigger('connect');

    unmount();

    expect(sockets[0].socket.disconnect).toHaveBeenCalledOnce();

    expect(sockets[0].socket.off).toHaveBeenCalledWith('simulation:position', expect.any(Function));
  });
});
