import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class MockLoginDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['재민', '아란', '흥희', '은순'])
  nickname: string;
}
