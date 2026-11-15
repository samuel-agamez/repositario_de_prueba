import { getAuth } from 'firebase-admin/auth';
import { ApiError, noAutorizado } from './errors';
import { getFirebaseApp } from './firebase';

export type UsuarioAutenticado = {
  id: string;
  email: string | null;
};

const CODIGOS_TOKEN_INVALIDO = new Set([
  'id-token-expired',
  'invalid-id-token',
  'id-token-revoked',
  'invalid-tokens-valid-after-time',
]);

function codigoDeError(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null;
  }
  return typeof error.code === 'string' ? error.code : null;
}

export function tokenBearer(encabezado: string | null): string {
  if (!encabezado) {
    throw noAutorizado('Token de acceso requerido');
  }

  const partes = encabezado.trim().split(/\s+/);
  if (partes.length !== 2 || partes[0]?.toLowerCase() !== 'bearer' || !partes[1]) {
    throw noAutorizado('Token de acceso inválido');
  }
  return partes[1];
}

export async function verificarToken(token: string): Promise<UsuarioAutenticado> {
  try {
    const claims = await getAuth(getFirebaseApp()).verifyIdToken(token);
    if (!claims.uid) {
      throw noAutorizado('Token de acceso inválido');
    }
    return { id: claims.uid, email: claims.email ?? null };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (CODIGOS_TOKEN_INVALIDO.has(codigoDeError(error) ?? '')) {
      throw noAutorizado('Token de acceso inválido');
    }
    throw error;
  }
}

/** Usuario que llama a la ruta, obtenido solo del token Bearer. */
export async function usuarioDe(request: Request): Promise<UsuarioAutenticado> {
  return verificarToken(tokenBearer(request.headers.get('authorization')));
}
