import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('dev')
export class DevController {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  @Get('reset')
  async reset() {
    await this.dataSource.query(`
      TRUNCATE TABLE
        photos,
        room_members,
        rooms
      RESTART IDENTITY CASCADE
    `);
    return { message: 'DB 초기화 완료' };
  }
}
