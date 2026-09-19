/** Forma estándar de TODA respuesta de error de la API (punto 7 del brief). */
export interface ApiError {
  statusCode: number;
  errorCode: string;
  message: string;
  field?: string;
}

/**
 * Excepciones de negocio deben extender esto (o lanzar HttpException con
 * este shape en el `response`) para que el filtro global les asigne un
 * `errorCode` estable en vez de uno genérico por status HTTP.
 */
export class ErrorCodeException extends Error {
  constructor(
    public readonly errorCode: string,
    message: string,
    public readonly statusCode: number,
    public readonly field?: string,
  ) {
    super(message);
  }
}
