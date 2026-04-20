import { IsOptional, IsUUID } from 'class-validator';

export class ReadMessagesDto {
  @IsOptional()
  @IsUUID()
  lastReadId?: string;
}
