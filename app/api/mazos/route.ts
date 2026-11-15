import { NextResponse } from 'next/server';
import { usuarioDe } from '../../../lib/auth';
import { leerSince, responderError } from '../../../lib/http';
import { listarDesde } from '../../../lib/services/sincronizacion';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const usuario = await usuarioDe(request);
    const sincronizacion = await listarDesde(usuario.id, 'mazo', leerSince(request));
    return NextResponse.json(sincronizacion);
  } catch (error) {
    return responderError(error);
  }
}
