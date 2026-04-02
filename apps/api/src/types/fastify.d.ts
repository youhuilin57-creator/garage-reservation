import { PrismaClient } from '@prisma/client'

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
    authorize: (roles: string[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>
  }

  interface FastifyRequest {
    user: {
      id: string
      role: string
      shopId: string
    }
  }
}
