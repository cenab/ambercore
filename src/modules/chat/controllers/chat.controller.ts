import { Controller, Post, Body, Get, Param, ValidationPipe, HttpCode, HttpStatus, Request } from '@nestjs/common';
import { ChatService } from '../services/chat.service';
import { CreateRoomDto, JoinRoomDto, ChatMessagePayloadDto } from '../dto/chat.dto';
import { User } from '@supabase/supabase-js';

interface AuthenticatedRequest extends Request {
  user: User;
}

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('rooms')
  @HttpCode(HttpStatus.CREATED)
  async createRoom(
    @Request() req: AuthenticatedRequest,
    @Body(ValidationPipe) createRoomDto: CreateRoomDto
  ) {
    const room = await this.chatService.createRoom({
      ...createRoomDto,
      participants: [...(createRoomDto.participants || []), req.user.id]
    });
    return {
      success: true,
      message: 'Chat room created successfully',
      data: room
    };
  }

  @Post('rooms/join')
  @HttpCode(HttpStatus.OK)
  async joinRoom(
    @Request() req: AuthenticatedRequest,
    @Body(ValidationPipe) joinRoomDto: JoinRoomDto
  ) {
    const result = await this.chatService.joinRoom({
      ...joinRoomDto,
      userId: req.user.id
    });
    return {
      success: true,
      message: 'Joined chat room successfully',
      data: result
    };
  }

  @Post('rooms/leave')
  @HttpCode(HttpStatus.OK)
  async leaveRoom(
    @Request() req: AuthenticatedRequest,
    @Body(ValidationPipe) joinRoomDto: JoinRoomDto
  ) {
    const result = await this.chatService.leaveRoom({
      ...joinRoomDto,
      userId: req.user.id
    });
    return {
      success: true,
      message: 'Left chat room successfully',
      data: result
    };
  }

  @Post('messages')
  @HttpCode(HttpStatus.OK)
  async sendMessage(
    @Request() req: AuthenticatedRequest,
    @Body(ValidationPipe) messageDto: ChatMessagePayloadDto
  ) {
    const result = await this.chatService.sendMessage({
      ...messageDto,
      senderId: req.user.id
    });
    return {
      success: true,
      message: 'Message sent successfully',
      data: result
    };
  }

  @Get('rooms/:roomId/participants')
  async getRoomParticipants(@Param('roomId') roomId: string) {
    const participants = await this.chatService.getRoomParticipants(roomId);
    return {
      success: true,
      data: participants
    };
  }
} 