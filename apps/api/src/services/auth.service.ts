import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { PrismaClient } from '@prisma/client'
import { signAccessToken } from '../utils/token'
import { Errors } from '../utils/errors'
import { REFRESH_TOKEN_TTL_DAYS } from '../config/constants'

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { shop: true },
    })

    if (!user || !user.isActive) {
      throw Errors.unauthorized('メールアドレスまたはパスワードが正しくありません')
    }

    const isValid = await bcrypt.compare(password, user.passwordHash)
    if (!isValid) {
      throw Errors.unauthorized('メールアドレスまたはパスワードが正しくありません')
    }

    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken({ sub: user.id, role: user.role, shopId: user.shopId }),
      this.createRefreshToken(user.id),
    ])

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        shopId: user.shopId,
        shopName: user.shop.name,
      },
    }
  }

  async refresh(token: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: { include: { shop: true } } },
    })

    if (!stored || stored.expiresAt < new Date()) {
      throw Errors.unauthorized('セッションが期限切れです。再ログインしてください')
    }

    const [accessToken, newRefreshToken] = await Promise.all([
      signAccessToken({
        sub: stored.user.id,
        role: stored.user.role,
        shopId: stored.user.shopId,
      }),
      this.createRefreshToken(stored.userId),
    ])

    // 旧トークン削除（ローテーション）
    await this.prisma.refreshToken.delete({ where: { id: stored.id } })

    return { accessToken, refreshToken: newRefreshToken }
  }

  async logout(token: string) {
    await this.prisma.refreshToken.deleteMany({ where: { token } })
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12)
  }

  private async createRefreshToken(userId: string): Promise<string> {
    const token = randomBytes(64).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS)
    await this.prisma.refreshToken.create({ data: { userId, token, expiresAt } })
    return token
  }
}
