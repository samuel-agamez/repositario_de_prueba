import { z } from 'zod';
import { ApiError, noAutorizado, validacion } from '../errors';

type OperacionAuth = 'registro' | 'login' | 'refresh';

export type SesionUsuario = {
  token: string;
  refreshToken: string;
  expiraEnSeg: number;
  usuario: {
    id: string;
    email: string;
  };
};

export type TokenRenovado = {
  token: string;
  refreshToken: string;
  expiraEnSeg: number;
};

const segundosSchema = z
  .union([z.string().regex(/^\d+$/), z.number().int().positive()])
  .transform(Number);

const respuestaSesionSchema = z.object({
  idToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresIn: segundosSchema,
  localId: z.string().min(1),
  email: z.string().email(),
});

const respuestaRefreshSchema = z.object({
  user_id: z.string().min(1),
  id_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: segundosSchema,
});

function esRegistro(cuerpo: unknown): cuerpo is Record<string, unknown> {
  return typeof cuerpo === 'object' && cuerpo !== null && !Array.isArray(cuerpo);
}

function codigoDeError(cuerpo: unknown): string | null {
  if (!esRegistro(cuerpo)) {
    return null;
  }

  const error = cuerpo.error;
  if (typeof error === 'string') {
    return error;
  }
  if (!esRegistro(error)) {
    return null;
  }
  if (typeof error.message === 'string') {
    return error.message.split(':')[0]?.trim() ?? null;
  }
  return typeof error.code === 'string' ? error.code : null;
}

function errorDeRegistro(codigo: string | null): Error | null {
  if (codigo === 'EMAIL_EXISTS') {
    return new ApiError(409, 'El correo ya está registrado');
  }
  if (codigo === 'WEAK_PASSWORD') {
    return validacion([{ campo: 'password', mensaje: 'La contraseña no cumple la política' }]);
  }
  if (codigo === 'INVALID_EMAIL') {
    return validacion([{ campo: 'email', mensaje: 'Debe ser un correo electrónico válido' }]);
  }
  return null;
}

function errorDeLogin(codigo: string | null): Error | null {
  const errores = [
    'INVALID_LOGIN_CREDENTIALS',
    'INVALID_PASSWORD',
    'EMAIL_NOT_FOUND',
    'USER_DISABLED',
  ];
  return errores.includes(codigo ?? '') ? noAutorizado('Credenciales inválidas') : null;
}

function errorDeRefresh(codigo: string | null): Error | null {
  const errores = ['INVALID_REFRESH_TOKEN', 'TOKEN_EXPIRED', 'invalid_grant'];
  return errores.includes(codigo ?? '') ? noAutorizado('Token de actualización inválido') : null;
}

const manejadoresError: Record<OperacionAuth, (codigo: string | null) => Error | null> = {
  registro: errorDeRegistro,
  login: errorDeLogin,
  refresh: errorDeRefresh,
};

function errorDeFirebase(cuerpo: unknown, operacion: OperacionAuth): Error {
  const codigo = codigoDeError(cuerpo);
  if (codigo) {
    // eslint-disable-next-line no-console -- código de error de Firebase, sin datos personales
    console.error(`[firebase-auth] ${operacion} código: ${codigo}`);
  }
  if (codigo === 'TOO_MANY_ATTEMPTS_TRY_LATER') {
    return new ApiError(429, 'Demasiados intentos, espera un momento e inténtalo de nuevo');
  }
  const error = manejadoresError[operacion](codigo);
  return error ?? new Error('Firebase Auth rechazó la operación');
}

function limpiarClaveWeb(valor: string | undefined): string | undefined {
  return valor?.trim().replace(/^['"]+|['"]+$/g, '');
}

async function requestFirebase(
  url: string,
  body: BodyInit,
  contentType: string,
  operacion: OperacionAuth,
): Promise<unknown> {
  const apiKey = limpiarClaveWeb(process.env.FIREBASE_WEB_API_KEY);
  if (!apiKey) {
    throw new Error('Falta la variable de entorno FIREBASE_WEB_API_KEY');
  }

  let respuesta: Response;
  try {
    respuesta = await fetch(`${url}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'content-type': contentType },
      body,
      cache: 'no-store',
    });
  } catch {
    throw new Error('No se pudo contactar Firebase Auth');
  }

  let cuerpo: unknown = null;
  try {
    cuerpo = await respuesta.json();
  } catch {
    cuerpo = null;
  }
  if (!respuesta.ok) {
    // eslint-disable-next-line no-console -- status HTTP de Firebase, sin datos personales
    console.error(`[firebase-auth] ${operacion} → HTTP ${respuesta.status}`);
    throw errorDeFirebase(cuerpo, operacion);
  }
  return cuerpo;
}

export async function registrar(email: string, password: string): Promise<SesionUsuario> {
  const cuerpo = await requestFirebase(
    'https://identitytoolkit.googleapis.com/v1/accounts:signUp',
    JSON.stringify({ email, password, returnSecureToken: true }),
    'application/json',
    'registro',
  );
  const datos = respuestaSesionSchema.parse(cuerpo);
  return {
    token: datos.idToken,
    refreshToken: datos.refreshToken,
    expiraEnSeg: datos.expiresIn,
    usuario: { id: datos.localId, email: datos.email },
  };
}

export async function iniciarSesion(email: string, password: string): Promise<SesionUsuario> {
  const cuerpo = await requestFirebase(
    'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword',
    JSON.stringify({ email, password, returnSecureToken: true }),
    'application/json',
    'login',
  );
  const datos = respuestaSesionSchema.parse(cuerpo);
  return {
    token: datos.idToken,
    refreshToken: datos.refreshToken,
    expiraEnSeg: datos.expiresIn,
    usuario: { id: datos.localId, email: datos.email },
  };
}

export async function renovarToken(refreshToken: string): Promise<TokenRenovado> {
  const cuerpo = await requestFirebase(
    'https://securetoken.googleapis.com/v1/token',
    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    'application/x-www-form-urlencoded',
    'refresh',
  );
  const datos = respuestaRefreshSchema.parse(cuerpo);
  return {
    token: datos.id_token,
    refreshToken: datos.refresh_token,
    expiraEnSeg: datos.expires_in,
  };
}
