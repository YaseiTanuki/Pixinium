import { z } from 'zod'

export const loginSchema = z.object({
  email: z.email().trim().max(254),
  password: z.string().min(1).max(128),
})
export const signupSchema = loginSchema.extend({
  displayName: z.string().trim().min(2).max(100),
  password: z.string().min(12).max(128),
  confirmPassword: z.string().max(128),
}).refine((value) => value.password === value.confirmPassword, {
  message: 'Passwords must match.', path: ['confirmPassword'],
})

export type AuthState = { error?: string; message?: string }
