import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagingService } from '../services/messaging.service';

interface StatusUpdateDto {
  userId: string;
  status: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class PusherGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly connectedClients = new Map<string, Set<string>>();

  constructor(private readonly messagingService: MessagingService) {}

  async handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    await this.handleClientDisconnect(client);
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channel: string; userId?: string }
  ) {
    try {
      const { channel, userId } = data;

      if (channel.startsWith('presence-') && userId) {
        const authResponse = await this.messagingService.authenticateChannel(client.id, channel, userId);
        client.emit('subscription_succeeded', { channel, auth: authResponse });
        await this.messagingService.handleUserJoin(channel, userId);
        
        // Track subscription
        this.addClientSubscription(client.id, channel);
        
      } else if (channel.startsWith('private-')) {
        const authResponse = await this.messagingService.authenticateChannel(client.id, channel);
        client.emit('subscription_succeeded', { channel, auth: authResponse });
        
        // Track subscription
        this.addClientSubscription(client.id, channel);
        
      } else {
        client.emit('subscription_succeeded', { channel });
        this.addClientSubscription(client.id, channel);
      }

      client.join(channel);
      
    } catch (error) {
      client.emit('subscription_error', {
        channel: data.channel,
        error: error.message
      });
    }
  }

  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channel: string; userId?: string }
  ) {
    try {
      const { channel, userId } = data;
      client.leave(channel);
      
      if (userId) {
        await this.messagingService.handleUserLeave(channel, userId);
      }

      this.removeClientSubscription(client.id, channel);
      client.emit('unsubscribe_succeeded', { channel });
      
    } catch (error) {
      client.emit('unsubscribe_error', {
        channel: data.channel,
        error: error.message
      });
    }
  }

  @SubscribeMessage('status_update')
  async handleStatusUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: StatusUpdateDto
  ) {
    try {
      const result = await this.messagingService.updateUserStatus(data);
      client.emit('status_updated', { status: 'success', data: result });
    } catch (error) {
      client.emit('status_error', {
        error: error.message
      });
    }
  }

  private addClientSubscription(clientId: string, channel: string) {
    if (!this.connectedClients.has(clientId)) {
      this.connectedClients.set(clientId, new Set());
    }
    this.connectedClients.get(clientId)!.add(channel);
  }

  private removeClientSubscription(clientId: string, channel: string) {
    const channels = this.connectedClients.get(clientId);
    if (channels) {
      channels.delete(channel);
      if (channels.size === 0) {
        this.connectedClients.delete(clientId);
      }
    }
  }

  private async handleClientDisconnect(client: Socket) {
    const channels = this.connectedClients.get(client.id);
    if (channels) {
      for (const channel of channels) {
        await this.handleUnsubscribe(client, { channel });
      }
      this.connectedClients.delete(client.id);
    }
  }
} 