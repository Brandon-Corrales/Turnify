import 'reflect-metadata';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import * as entities from './entities';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const useUrl = Boolean(process.env.DATABASE_URL);

export const AppDataSource = new DataSource({
  type: 'postgres',
  ...(useUrl
    ? { url: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5432),
        username: process.env.DB_USERNAME ?? 'turnify',
        password: process.env.DB_PASSWORD ?? 'turnify',
        database: process.env.DB_NAME ?? 'turnify',
      }),
  entities: Object.values(entities).filter(
    (value) => typeof value === 'function',
  ) as Function[],
  migrations: [path.join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
