import 'reflect-metadata';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { listaEntidades } from './entity-list';
import { construirOpcionesConexion } from './opciones-conexion';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export const AppDataSource = new DataSource({
  type: 'postgres',
  // Mismas reglas de conexión y SSL que la app (ver opciones-conexion.ts).
  ...construirOpcionesConexion(process.env),
  entities: listaEntidades,
  migrations: [path.join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
