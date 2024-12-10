import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Pusher, { PresenceChannelData } from 'pusher';
import { RedisService } from '../../shared/services/redis.service';

export interface PusherMessage {
  channel: string;
  event: string;
  data: Record<string, any>;
}

export interface ChannelInfo {
  name: string;
  info: {
    subscription_count?: number;
    user_count?: number;
    occupied?: boolean;
    lastActivity?: string;
  } | null;
}

@Injectable()
export class PusherService implements OnModuleInit {
  private client: Pusher;
  private readonly CACHE_TTL = 3600;

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
  ) {}

  onModuleInit() {
    this.client = new Pusher({
      appId: this.configService.getOrThrow('PUSHER_APP_ID'),
      key: this.configService.getOrThrow('PUSHER_KEY'),
      secret: this.configService.getOrThrow('PUSHER_SECRET'),
      cluster: this.configService.getOrThrow('PUSHER_CLUSTER'),
      useTLS: true,
    });
  }

  private getCacheKey(type: string, id: string): string {
    return `pusher:${type}:${id}`;
  }

  async sendMessage({ channel, event, data }: PusherMessage): Promise<boolean> {
    try {
      await this.client.trigger(channel, event, data);
      await this.redisService.set(
        this.getCacheKey('channel', channel),
        JSON.stringify({ lastActivity: new Date().toISOString() }),
        this.CACHE_TTL
      );
      return true;
    } catch (error) {
      console.error('Pusher send error:', error);
      return false;
    }
  }

  async getChannel(channelName: string): Promise<ChannelInfo['info']> {
    const cached = await this.redisService.get(
      this.getCacheKey('channel', channelName)
    );
    
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const response = await this.client.get({ 
        path: `/channels/${channelName}`,
        params: {} 
      });

      const info = response as ChannelInfo['info'];
      if (info) {
        await this.redisService.set(
          this.getCacheKey('channel', channelName),
          JSON.stringify(info),
          this.CACHE_TTL
        );
      }

      return info;
    } catch (error) {
      console.error('Pusher channel info error:', error);
      return null;
    }
  }

  async getChannels(): Promise<ChannelInfo[]> {
    const cached = await this.redisService.keys('pusher:channel:*');
    if (cached.length > 0) {
      const channels = await Promise.all(
        cached.map(async key => {
          const info = await this.redisService.get(key);
          return {
            name: key.replace('pusher:channel:', ''),
            info: info ? JSON.parse(info) : null
          };
        })
      );
      return channels.filter(ch => ch.info !== null);
    }

    try {
      const response = await this.client.get({ path: '/channels', params: {} });
      const channelsData = response as Record<string, any>;
      
      return Object.entries(channelsData.channels || {}).map(([name, info]) => ({
        name,
        info: info as ChannelInfo['info']
      }));
    } catch (error) {
      console.error('Pusher channels error:', error);
      return [];
    }
  }

  async authenticate(socketId: string, channel: string, data?: Record<string, any>) {
    try {
      if (channel.startsWith('presence-') && data) {
        const presenceData: PresenceChannelData = {
          user_id: data.user_id,
          user_info: data
        };
        return this.client.authorizeChannel(socketId, channel, presenceData);
      }
      return this.client.authorizeChannel(socketId, channel);
    } catch (error) {
      console.error('Pusher auth error:', error);
      throw error;
    }
  }
} 