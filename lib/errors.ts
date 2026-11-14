export type DetalleError = {
  campo: string;
  mensaje: string;
};

export type CuerpoError = {
  error: string;
  detalles?: DetalleError[];
};

export type RespuestaError = {
  status: number;
  body: CuerpoError;
};

/**
 * Error controlado que una ruta puede lanzar y traducir a una respuesta HTTP.
 * El mensaje es seguro para el cliente; nunca metas datos internos aquí.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly detalles: DetalleError[] | null;

  constructor(status: number, mensaje: string, detalles: DetalleError[] | null = null) {
    super(mensaje);
    this.name = 'ApiError';
    this.status = status;
    this.detalles = detalles;
  }
}

export const noAutorizado = (mensaje = 'No autorizado'): ApiError => new ApiError(401, mensaje);

export const prohibido = (mensaje = 'Prohibido'): ApiError => new ApiError(403, mensaje);

export const noEncontrado = (mensaje = 'No encontrado'): ApiError => new ApiError(404, mensaje);

export const conflicto = (mensaje = 'Conflicto'): ApiError => new ApiError(409, mensaje);

export const validacion = (detalles: DetalleError[]): ApiError =>
  new ApiError(400, 'Datos inválidos', detalles);

export function respuestaError(error: unknown): RespuestaError {
  if (error instanceof ApiError) {
    const body: CuerpoError = error.detalles
      ? { error: error.message, detalles: error.detalles }
      : { error: error.message };
    return { status: error.status, body };
  }

  // Un error no controlado nunca expone su mensaje ni el stack al cliente.
  return { status: 500, body: { error: 'Error interno' } };
}
