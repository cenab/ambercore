import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MessageDto } from '../../../core/messaging/dto/message.dto';

export class CreateRoomDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  participants?: string[];
}

export class JoinRoomDto {
  @IsString()
  roomId: string;

  @IsString()
  userId: string;
}

export class ChatMessagePayloadDto extends MessageDto {
  @IsString()
  roomId: string;

  @IsString()
  content: string;

  @IsString()
  senderId: string;
} 