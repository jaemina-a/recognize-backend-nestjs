import { IsNotEmpty, IsString } from 'class-validator';

export class JoinRoomDto {
  @IsString()
  @IsNotEmpty()
  inviteCode: string;
}
