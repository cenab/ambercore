import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { MessagingService } from '../messaging/messaging.service';

interface Notification {
  userId: string;
  message: string;
  type: 'info' | 'warning' | 'error';
  timestamp: string;
}

@Injectable()
export class NotificationService implements OnModuleInit, OnModuleDestroy {
  private readonly NOTIFICATIONS_CHANNEL = 'notifications';

  constructor(private readonly messagingService: MessagingService) {}

  async onModuleInit() {
    // Subscribe to notifications
    await this.messagingService.subscribe<Notification>(
      this.NOTIFICATIONS_CHANNEL,
      async (notification) => {
        await this.processNotification(notification);
      }
    );
  }

  async onModuleDestroy() {
    await this.messagingService.unsubscribe(this.NOTIFICATIONS_CHANNEL);
  }

  async sendNotification(notification: Omit<Notification, 'timestamp'>) {
    const fullNotification: Notification = {
      ...notification,
      timestamp: new Date().toISOString(),
    };

    await this.messagingService.publish(this.NOTIFICATIONS_CHANNEL, fullNotification);
  }

  private async processNotification(notification: Notification) {
    // Here you would implement your notification processing logic
    // For example, sending push notifications, emails, or saving to database
    console.log('Processing notification:', notification);
  }
} 