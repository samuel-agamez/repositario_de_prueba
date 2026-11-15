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

export function responderError(error: unknown): NextResponse {
  const { status, body } = respuestaError(error);
  return NextResponse.json(body, { status });
}
