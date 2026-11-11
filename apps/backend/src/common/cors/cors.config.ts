export function crearValidadorCors(allowedOrigins: Set<string>) {
  return (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ): void => {
    const normalized = origin ? origin.replace(/\/+$/, '') : origin;
    if (!origin || allowedOrigins.has(origin) || (normalized && allowedOrigins.has(normalized))) {
      callback(null, true);
      return;
    }
    // No lanzar error 500 para orígenes no permitidos; simplemente responder sin cabeceras CORS
    callback(null, false);
  };
}
