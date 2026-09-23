import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error('[API ERROR]', err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Dados inválidos',
      details: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  if (err instanceof Error) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Erro interno do servidor',
    });
  }

  return res.status(500).json({
    success: false,
    error: 'Erro interno do servidor',
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: `Rota ${req.method} ${req.path} não encontrada`,
  });
}
