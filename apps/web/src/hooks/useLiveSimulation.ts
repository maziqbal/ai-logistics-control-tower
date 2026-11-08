import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export type SimulationSnapshot = {
  routeId: string;
  longitude: number;
  latitude: number;
  distanceTraveledMeters: number;
  totalDistanceMeters: number;
  progress: number;
  completed: boolean;
  status: 'idle' | 'running' | 'paused' | 'stopped' | 'completed';
  elapsedSeconds: number;
  speedMetersPerSecond: number;
};

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

type LiveSimulationState = {
  routeId: string;
  snapshot: SimulationSnapshot | null;
  connectionStatus: ConnectionStatus;
  error: string | null;
};

const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');

function isSnapshot(value: unknown, routeId: string): value is SimulationSnapshot {
  if (!value || typeof value !== 'object') return false;

  const data = value as Partial<SimulationSnapshot>;

  return (
    data.routeId === routeId &&
    typeof data.status === 'string' &&
    typeof data.longitude === 'number' &&
    Number.isFinite(data.longitude) &&
    data.longitude >= -180 &&
    data.longitude <= 180 &&
    typeof data.latitude === 'number' &&
    Number.isFinite(data.latitude) &&
    data.latitude >= -90 &&
    data.latitude <= 90 &&
    typeof data.distanceTraveledMeters === 'number' &&
    Number.isFinite(data.distanceTraveledMeters) &&
    typeof data.totalDistanceMeters === 'number' &&
    Number.isFinite(data.totalDistanceMeters) &&
    typeof data.progress === 'number' &&
    Number.isFinite(data.progress) &&
    ['idle', 'running', 'paused', 'stopped', 'completed'].includes(data.status)
  );
}

export function useLiveSimulation(routeId: string) {
  const [state, setState] = useState<LiveSimulationState>({
    routeId: '',
    snapshot: null,
    connectionStatus: 'disconnected',
    error: null,
  });

  useEffect(() => {
    if (!routeId) return;

    let active = true;
    const abortController = new AbortController();

    const socket = io(`${API_ORIGIN}/simulations`, {
      autoConnect: false,
      reconnection: true,
    });

    async function loadCurrentSnapshot() {
      try {
        const response = await fetch(
          `${API_ORIGIN}/api/v1/simulations/${encodeURIComponent(routeId)}`,
          { signal: abortController.signal },
        );

        if (!active) return;

        // No simulation has started for this route yet.
        if (response.status === 404) {
          return;
        }

        if (!response.ok) {
          throw new Error(`Unable to load simulation (HTTP ${response.status})`);
        }

        const data: unknown = await response.json();

        if (!active || !isSnapshot(data, routeId)) return;

        setState((previous) => {
          if (previous.routeId !== routeId) return previous;

          // Avoid overwriting a newer WebSocket position with
          // an older REST response.
          if (previous.snapshot && previous.snapshot.elapsedSeconds > data.elapsedSeconds) {
            return previous;
          }

          return {
            ...previous,
            snapshot: data,
          };
        });
      } catch (error) {
        if (!active || abortController.signal.aborted) return;

        setState((previous) => ({
          ...previous,
          error: error instanceof Error ? error.message : 'Unable to load simulation',
        }));
      }
    }

    function onConnect() {
      if (!active) return;

      setState((previous) => ({
        ...previous,
        connectionStatus: 'connected',
        error: null,
      }));

      socket.emit('simulation:subscribe', { routeId });

      // On reconnect, recover the latest position that may
      // have been missed while disconnected.
      void loadCurrentSnapshot();
    }

    function onDisconnect() {
      if (!active) return;

      setState((previous) => ({
        ...previous,
        connectionStatus: 'disconnected',
      }));
    }

    function onConnectError() {
      if (!active) return;

      setState((previous) => ({
        ...previous,
        connectionStatus: 'disconnected',
        error: 'Unable to connect to live GPS updates',
      }));
    }

    function onPosition(data: unknown) {
      if (!active || !isSnapshot(data, routeId)) return;

      setState((previous) => {
        if (previous.routeId !== routeId) return previous;

        return {
          ...previous,
          snapshot: data,
          error: null,
        };
      });
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('simulation:position', onPosition);

    socket.connect();

    // Schedule the initial state as part of the connection
    // lifecycle so route switching cannot display old data.
    const initialize = () => {
      if (!active) return;

      setState({
        routeId,
        snapshot: null,
        connectionStatus: socket.connected ? 'connected' : 'connecting',
        error: null,
      });
    };

    initialize();

    return () => {
      active = false;
      abortController.abort();

      if (socket.connected) {
        socket.emit('simulation:unsubscribe', { routeId });
      }

      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('simulation:position', onPosition);

      socket.disconnect();
    };
  }, [routeId]);

  // Prevent the previous route's vehicle from appearing
  // during the first render after a route switch.
  if (!routeId || state.routeId !== routeId) {
    return {
      snapshot: null,
      connectionStatus: 'disconnected' as ConnectionStatus,
      error: null,
    };
  }

  return {
    snapshot: state.snapshot,
    connectionStatus: state.connectionStatus,
    error: state.error,
  };
}
