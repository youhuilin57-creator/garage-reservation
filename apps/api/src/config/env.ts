import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('noreply@example.com'),
  INVOICE_TAX_RATE: z.coerce.number().default(0.10),
  INVOICE_REGISTRANT_NUMBER: z.string().default(''),
})

export const env = envSchema.parse(process.env)
