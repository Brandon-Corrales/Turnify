import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { AppDataSource } from '../data-source';

/**
 * Ejecuta un script de simulación de migración en una transacción READ ONLY
 * y la revierte al final: cualquier INSERT/UPDATE/DELETE que se colara en el
 * archivo falla en PostgreSQL ("cannot execute ... in a read-only
 * transaction"). Imprime cada resultado como tabla. Nunca imprime la cadena
 * de conexión.
 *
 *   npm run migration:simular -- 1794461165638-NotificacionClaveUnica.sql
 */
async function main(): Promise<void> {
  const archivo = process.argv[2];
  if (!archivo) {
    console.error('Uso: npm run migration:simular -- <archivo.sql de src/database/simulaciones>');
    process.exit(1);
  }
  const sql = fs.readFileSync(path.resolve(__dirname, path.basename(archivo)), 'utf8');
  const sentencias = sql
    .split(/;\s*(?:\n|$)/)
    .map((s) =>
      s
        .split('\n')
        .filter((linea) => !linea.trim().startsWith('--'))
        .join('\n')
        .trim(),
    )
    .filter(Boolean);

  await AppDataSource.initialize();
  const runner = AppDataSource.createQueryRunner();
  try {
    await runner.query('BEGIN TRANSACTION READ ONLY');
    for (const sentencia of sentencias) {
      const filas: unknown = await runner.query(sentencia);
      console.log(`\n${sentencia.split('\n')[0]} …`);
      console.table(filas);
    }
  } finally {
    await runner.query('ROLLBACK');
    await runner.release();
    await AppDataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exit(1);
});
