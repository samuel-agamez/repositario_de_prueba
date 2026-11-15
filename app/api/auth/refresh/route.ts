import { NextResponse } from 'next/server';
import { leerJson, responderError, validar } from '../../../../lib/http';
import { refreshTokenSchema } from '../../../../lib/schemas';
import { renovarToken } from '../../../../lib/services/firebase-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { refreshToken } = validar(refreshTokenSchema, await leerJson(request));
    const token = await renovarToken(refreshToken);
    return NextResponse.json(token);
  } catch (error) {
    return responderError(error);
  }
}
