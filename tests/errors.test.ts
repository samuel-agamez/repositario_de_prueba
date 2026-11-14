import { describe, expect, it } from 'vitest';
import {
  ApiError,
  conflicto,
  noAutorizado,
  noEncontrado,
  prohibido,
  respuestaError,
  validacion,
} from '../lib/errors';

describe('respuestaError', () => {
  it('traduce un error de validación a 400 con detalles', () => {
    const result = respuestaError(validacion([{ campo: 'pregunta', mensaje: 'es obligatoria' }]));
    expect(result.status).toBe(400);
    expect(result.body).toEqual({
      error: 'Datos inválidos',
      detalles: [{ campo: 'pregunta', mensaje: 'es obligatoria' }],
    });
  });

  it('traduce 401, 403, 404 y 409', () => {
    expect(respuestaError(noAutorizado()).status).toBe(401);
    expect(respuestaError(prohibido()).status).toBe(403);
    expect(respuestaError(noEncontrado()).status).toBe(404);
    expect(respuestaError(conflicto()).status).toBe(409);
  });

  it('no incluye detalles cuando no los hay', () => {
    const result = respuestaError(new ApiError(413, 'Documento demasiado grande'));
    expect(result).toEqual({ status: 413, body: { error: 'Documento demasiado grande' } });
  });

  it('oculta el mensaje de un error desconocido detrás de 500 Error interno', () => {
    const result = respuestaError(new Error('FIREBASE_PRIVATE_KEY=secreto'));
    expect(result).toEqual({ status: 500, body: { error: 'Error interno' } });
    expect(JSON.stringify(result)).not.toContain('secreto');
  });
});
