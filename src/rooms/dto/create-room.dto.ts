import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
