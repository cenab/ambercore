import { IsString, IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class MessageDto {
  @IsString()
  channel: string;

  @IsString()
  @IsOptional()
  event?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  data?: Record<string, any>;
}

export class ChatMessageDto extends MessageDto {
  @IsString()
  message: string;

  @IsString()
  userId: string;
}

export class StatusUpdateDto extends MessageDto {
  @IsString()
  userId: string;

  @IsObject()
  data: {
    status: string;
    [key: string]: any;
  };
} 