import { NextResponse } from 'next/server';
import { leerJson, responderError, validar } from '../../../../lib/http';
import { credencialesSchema } from '../../../../lib/schemas';
import { iniciarSesion } from '../../../../lib/services/firebase-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const credenciales = validar(credencialesSchema, await leerJson(request));
    const sesion = await iniciarSesion(credenciales.email, credenciales.password);
    return NextResponse.json(sesion);
  } catch (error) {
    return responderError(error);
  }
}
