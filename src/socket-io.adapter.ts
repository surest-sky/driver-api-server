import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';

export class SocketIOAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      allowEIO3: true, // 允许 Socket.IO v2/v3 兼容性
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });
    
    return server;
  }
}