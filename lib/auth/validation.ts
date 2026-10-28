import { z } from 'zod'

export const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,12}$/, 'Use 3-12 letters, numbers or underscores.')

export const loginSchema = z.object({
  email: z.email().trim().max(254),
  password: z.string().min(1).max(128),
})
export const signupSchema = loginSchema.extend({
  password: z.string().min(12).max(128),
  confirmPassword: z.string().max(128),
}).refine((value) => value.password === value.confirmPassword, {
  message: 'Passwords must match.', path: ['confirmPassword'],
})

export type AuthState = { error?: string; message?: string }
