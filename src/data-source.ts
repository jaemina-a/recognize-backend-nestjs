import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

const envPath = `.env${process.env.NODE_ENV === 'production' ? '.production' : ''}`;
dotenv.config({ path: envPath });

/**
 * TypeORM CLI 전용 DataSource.
 * - migration:generate / migration:run / migration:revert 시 사용
 * - 런타임(NestJS bootstrap)에서는 사용하지 않음 (app.module의 TypeOrmModule.forRootAsync 사용)
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});
