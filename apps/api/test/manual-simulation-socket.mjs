import { io } from 'socket.io-client';

const routeId = 'c0f26946-c6f0-47e0-806d-810a1e67090e';

const socket = io('http://localhost:3000/simulations', {
  transports: ['websocket'],
  reconnection: false,
});

socket.on('connect', () => {
  console.log('Connected:', socket.id);

  socket.emit('simulation:subscribe', { routeId });
});

socket.on('simulation:subscribed', ({ routeId }) => {
  console.log('Subscribed to route:', routeId);
});

socket.on('simulation:position', (snapshot) => {
  console.log('GPS update:', {
    latitude: snapshot.latitude,
    longitude: snapshot.longitude,
    distance: snapshot.distanceTraveledMeters,
    status: snapshot.status,
  });
});

socket.on('connect_error', (error) => {
  console.error('Connection failed:', error.message);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

process.on('SIGINT', () => {
  socket.disconnect();
  process.exit(0);
});
