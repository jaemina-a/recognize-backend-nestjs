import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AppleLoginDto {
  @IsString()
  @IsNotEmpty()
  identityToken!: string;

  @IsString()
  @IsOptional()
  authorizationCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  nickname?: string;
}
