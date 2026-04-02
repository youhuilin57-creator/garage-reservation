export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown,
    public statusCode: number = 400,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const Errors = {
  notFound: (msg = 'リソースが見つかりません') =>
    new AppError('NOT_FOUND', msg, undefined, 404),
  unauthorized: (msg = '認証が必要です') =>
    new AppError('UNAUTHORIZED', msg, undefined, 401),
  forbidden: (msg = '権限がありません') =>
    new AppError('FORBIDDEN', msg, undefined, 403),
  conflict: (msg: string, details?: unknown) =>
    new AppError('CONFLICT', msg, details, 409),
  unprocessable: (msg: string) =>
    new AppError('UNPROCESSABLE', msg, undefined, 422),
  validation: (msg: string, details?: unknown) =>
    new AppError('VALIDATION_ERROR', msg, details, 400),
}
