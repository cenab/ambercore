import {
  WebSocketGateway as NestWebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WebSocketMessage } from '../types/api.types';

@NestWebSocketGateway({
  cors: {
    origin: '*',
  },
})
export abstract class BaseGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer() protected server: Server;
  protected readonly logger: Logger;

  constructor(context: string) {
    this.logger = new Logger(context);
  }

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  protected emit<T>(event: string, data: T) {
    const message: WebSocketMessage<T> = {
      event,
      data,
      timestamp: new Date().toISOString(),
    };
    this.server.emit(event, message);
  }

  protected emitToRoom<T>(room: string, event: string, data: T) {
    const message: WebSocketMessage<T> = {
      event,
      data,
      timestamp: new Date().toISOString(),
    };
    this.server.to(room).emit(event, message);
  }

  protected emitToClient<T>(clientId: string, event: string, data: T) {
    const message: WebSocketMessage<T> = {
      event,
      data,
      timestamp: new Date().toISOString(),
    };
    this.server.to(clientId).emit(event, message);
  }

  protected async joinRoom(clientId: string, room: string) {
    const socket = this.server.sockets.sockets.get(clientId);
    if (socket) {
      await socket.join(room);
      this.logger.log(`Client ${clientId} joined room: ${room}`);
    }
  }

  protected async leaveRoom(clientId: string, room: string) {
    const socket = this.server.sockets.sockets.get(clientId);
    if (socket) {
      await socket.leave(room);
      this.logger.log(`Client ${clientId} left room: ${room}`);
    }
  }
} 