// src/lib/socket.ts
// Socket.IO server reference for emitting appointment_event from routes (e.g. trustAdapter).
// Set in index.ts when server starts; null in test mode.

import type { Server } from "socket.io";

let io: Server | null = null;

export function setSocketIO(server: Server): void {
  io = server;
}

export function getSocketIO(): Server | null {
  return io;
}
