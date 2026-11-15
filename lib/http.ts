import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, respuestaError, validacion } from './errors';

export async function leerJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, 'Cuerpo JSON inválido');
  }
}

export function validar<T>(schema: z.ZodType<T>, cuerpo: unknown): T {
  const resultado = schema.safeParse(cuerpo);
  if (resultado.success) {
    return resultado.data;
  }

  throw validacion(
    resultado.error.issues.map((issue) => ({
      campo: issue.path.join('.') || 'cuerpo',
      mensaje: issue.message,
    })),
  );
}

const EPOCH = '1970-01-01T00:00:00.000Z';

export function leerSince(request: Request): string {
  const valor = new URL(request.url).searchParams.get('since');
  if (valor === null) {
    return EPOCH;
  }
  if (!z.iso.datetime().safeParse(valor).success) {
    throw validacion([{ campo: 'since', mensaje: 'Debe ser una fecha ISO 8601 UTC' }]);
  }
  return valor;
}

export function responderError(error: unknown): NextResponse {
  const { status, body } = respuestaError(error);
  return NextResponse.json(body, { status });
}
