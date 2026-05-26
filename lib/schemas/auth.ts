import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email').max(200),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(200, 'Password is too long'),
  displayName: z.string().trim().min(1).max(80).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
