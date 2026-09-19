import * as entities from './entities';

// `abstract new` porque ./entities también reexporta AuditableEntity (la
// base abstracta de las auditables) e enums (TipoNotificacion, etc.) —
// ambos inofensivos para TypeORM, que ignora cualquier valor sin metadata
// de @Entity(), pero mezclados en el mismo módulo no arman una unión que
// un type predicate pueda estrechar limpiamente; se filtra por valor y se
// castea el resultado ya filtrado (nunca `any`, nunca el tipo `Function`).
type ClaseEntidad = abstract new (...args: never[]) => object;

export const listaEntidades = Object.values(entities).filter(
  (value) => typeof value === 'function',
) as unknown as ClaseEntidad[];
