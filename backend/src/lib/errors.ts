export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (msg: string, code = 'BAD_REQUEST') => new AppError(400, code, msg);
export const unauthorized = (msg = 'Non autorizzato', code = 'AUTH_REQUIRED') =>
  new AppError(401, code, msg);
export const forbidden = (msg = 'Accesso negato', code = 'FORBIDDEN') =>
  new AppError(403, code, msg);
export const notFound = (msg = 'Risorsa non trovata', code = 'NOT_FOUND') =>
  new AppError(404, code, msg);
export const conflict = (msg: string, code = 'CONFLICT') => new AppError(409, code, msg);
export const unprocessable = (msg: string, code = 'UNPROCESSABLE') =>
  new AppError(422, code, msg);
