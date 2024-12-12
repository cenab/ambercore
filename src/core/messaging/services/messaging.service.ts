import { Injectable } from '@nestjs/common';
import { PusherService } from './pusher.service';
import { RedisService } from '../../shared/services/redis.service';

export interface Message {
  id: string;
  channel: string;
  event: string;
  content: string;
  userId?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

@Injectable()
export class MessagingService {
  private readonly MESSAGE_TTL = 3600;

  constructor(
    private readonly pusherService: PusherService,
    private readonly redisService: RedisService,
  ) {}

  private getMessageKey(messageId: string): string {
    return `message:${messageId}`;
  }

  async sendMessage(message: Partial<Message>): Promise<Message> {
    const newMessage: Message = {
      id: Date.now().toString(),
      channel: message.channel!,
      event: message.event || 'message',
      content: message.content!,
      userId: message.userId,
      metadata: message.metadata,
      timestamp: new Date().toISOString(),
    };

    // Store in Redis
    await this.redisService.set(
      this.getMessageKey(newMessage.id),
      JSON.stringify(newMessage),
      this.MESSAGE_TTL
    );

    // Send through Pusher
    await this.pusherService.sendMessage({
      channel: newMessage.channel,
      event: newMessage.event,
      data: newMessage,
    });

    return newMessage;
  }

  async getMessages(channel: string, limit = 50): Promise<Message[]> {
    const pattern = `message:*`;
    const keys = await this.redisService.keys(pattern);
    const messages = await Promise.all(
      keys.slice(-limit).map((key: string) => this.redisService.get(key))
    );

    return messages
      .filter((msg: unknown): msg is string => msg !== null)
      .map((msg: string) => JSON.parse(msg))
      .filter((msg: Message) => msg.channel === channel)
      .sort((a: Message, b: Message) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
  }

  async getChannel(channel: string) {
    return this.pusherService.getChannel(channel);
  }

  async getChannels() {
    return this.pusherService.getChannels();
  }

  async authenticateChannel(socketId: string, channel: string, userId?: string) {
    const presenceData = userId ? { user_id: userId } : undefined;
    return this.pusherService.authenticate(socketId, channel, presenceData);
  }

  async handleUserJoin(channel: string, userId: string) {
    return this.sendMessage({
      channel,
      event: 'user_joined',
      content: `User ${userId} joined the channel`,
      userId,
      metadata: { type: 'presence', action: 'join' }
    });
  }

  async handleUserLeave(channel: string, userId: string) {
    return this.sendMessage({
      channel,
      event: 'user_left',
      content: `User ${userId} left the channel`,
      userId,
      metadata: { type: 'presence', action: 'leave' }
    });
  }

  async updateUserStatus(data: { userId: string; status: string }) {
    return this.sendMessage({
      channel: 'presence-status',
      event: 'status_update',
      content: `User ${data.userId} status: ${data.status}`,
      userId: data.userId,
      metadata: { type: 'status', status: data.status }
    });
  }
} 