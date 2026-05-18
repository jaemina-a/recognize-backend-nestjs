import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class MockLoginDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['지우', '서연', '도윤', '하은'])
  nickname: string;
}
