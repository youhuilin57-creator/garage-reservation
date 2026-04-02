import { SignJWT, jwtVerify } from 'jose'
import { env } from '../config/env'

const secret = new TextEncoder().encode(env.JWT_SECRET)

export interface JwtPayload {
  sub: string
  role: string
  shopId: string
}

export async function signAccessToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret)
}

export async function verifyAccessToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, secret)
  return {
    sub: payload.sub as string,
    role: payload.role as string,
    shopId: payload.shopId as string,
  }
}
