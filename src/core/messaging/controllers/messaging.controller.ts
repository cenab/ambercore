import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  Param, 
  Query,
  ValidationPipe, 
  HttpCode, 
  HttpStatus 
} from '@nestjs/common';
import { MessagingService, Message } from '../services/messaging.service';

@Controller('messaging')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post('send')
  @HttpCode(HttpStatus.OK)
  async sendMessage(@Body(ValidationPipe) message: Partial<Message>) {
    const result = await this.messagingService.sendMessage(message);
    return { success: true, data: result };
  }

  @Get('channels/:channel/messages')
  async getChannelMessages(
    @Param('channel') channel: string,
    @Query('limit') limit?: number,
  ) {
    const messages = await this.messagingService.getMessages(channel, limit);
    return { success: true, data: messages };
  }

  @Get('channels')
  async getChannels() {
    const channels = await this.messagingService.getChannels();
    return { success: true, data: channels };
  }

  @Get('channels/:channel')
  async getChannelInfo(@Param('channel') channel: string) {
    const info = await this.messagingService.getChannel(channel);
    return { success: true, data: info };
  }
} 