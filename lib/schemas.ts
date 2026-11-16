import { z } from 'zod';
import { validacion } from './errors';

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

export const mazoSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  publico: z.boolean('Debe ser verdadero o falso'),
});

export const tarjetaSchema = z.object({
  mazo_id: z.string().uuid('Debe ser un UUID'),
  pregunta: z
    .string()
    .trim()
    .min(1, 'La pregunta es obligatoria')
    .max(300, 'La pregunta debe tener máximo 300 caracteres'),
  respuesta: z
    .string()
    .trim()
    .min(1, 'La respuesta es obligatoria')
    .max(300, 'La respuesta debe tener máximo 300 caracteres'),
  caja: z.number().int('Debe ser un número entero').min(1, 'La caja empieza en 1'),
  proxima_revision: z.string().datetime('Debe ser una fecha ISO 8601 UTC').nullable(),
});

export type MazoCampos = z.infer<typeof mazoSchema>;
export type TarjetaCampos = z.infer<typeof tarjetaSchema>;

export function validarIdRecurso(id: string): void {
  if (!z.string().uuid().safeParse(id).success) {
    throw validacion([{ campo: 'id', mensaje: 'Debe ser un UUID' }]);
  }
}
