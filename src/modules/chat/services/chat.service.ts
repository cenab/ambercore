import { Injectable } from '@nestjs/common';
import { MessagingService } from '../../../core/messaging/services/messaging.service';
import { CreateRoomDto, JoinRoomDto, ChatMessagePayloadDto } from '../dto/chat.dto';

@Injectable()
export class ChatService {
  constructor(private readonly messagingService: MessagingService) {}

  async createRoom(createRoomDto: CreateRoomDto) {
    const roomChannel = `chat-room-${Date.now()}`;
    
    await this.messagingService.sendMessage({
      channel: 'chat-rooms',
      event: 'room_created',
      content: `Room ${roomChannel} created`,
      metadata: {
        roomId: roomChannel,
        ...createRoomDto
      }
    });

    return {
      roomId: roomChannel,
      ...createRoomDto
    };
  }

  async joinRoom(joinRoomDto: JoinRoomDto) {
    const { roomId, userId } = joinRoomDto;

    await this.messagingService.sendMessage({
      channel: roomId,
      event: 'user_joined',
      content: `User ${userId} joined`,
      userId,
      metadata: {
        userId,
        timestamp: new Date().toISOString()
      }
    });

    return {
      roomId,
      userId,
      joined: true
    };
  }

  async leaveRoom(joinRoomDto: JoinRoomDto) {
    const { roomId, userId } = joinRoomDto;

    await this.messagingService.sendMessage({
      channel: roomId,
      event: 'user_left',
      content: `User ${userId} left`,
      userId,
      metadata: {
        userId,
        timestamp: new Date().toISOString()
      }
    });

    return {
      roomId,
      userId,
      left: true
    };
  }

  async sendMessage(messageDto: ChatMessagePayloadDto) {
    const { roomId, content, senderId } = messageDto;

    await this.messagingService.sendMessage({
      channel: roomId,
      event: 'chat_message',
      content,
      userId: senderId,
      metadata: {
        timestamp: new Date().toISOString()
      }
    });

    return {
      sent: true,
      timestamp: new Date().toISOString(),
      roomId,
      senderId,
      content
    };
  }

  async getRoomParticipants(roomId: string) {
    return this.messagingService.getChannel(roomId);
  }
} 