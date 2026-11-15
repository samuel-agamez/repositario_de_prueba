import { z } from 'zod';

export const credencialesSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email('Debe ser un correo electrónico válido')
      .max(254, 'El correo es demasiado largo'),
    password: z
      .string()
      .min(6, 'Debe tener al menos 6 caracteres')
      .max(4096, 'La contraseña es demasiado larga'),
  })
  .strict();

export const refreshTokenSchema = z
  .object({
    refreshToken: z
      .string()
      .trim()
      .min(1, 'El token de actualización es obligatorio')
      .max(4096, 'El token de actualización es demasiado largo'),
  })
  .strict();
