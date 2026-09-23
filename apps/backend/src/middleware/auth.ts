import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '../utils/auth';

declare global {
  namespace Express {
    interface Request {
      auth?: JwtPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Token não fornecido' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ success: false, error: 'Token inválido ou expirado' });
  }

  req.auth = payload;
  next();
}

export function requireRole(...roles: JwtPayload['role'][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({ success: false, error: 'Permissão negada' });
    }
    next();
  };
}

export function requireTenant(req: Request, res: Response, next: NextFunction) {
  if (!req.auth?.tenantId) {
    return res.status(403).json({ success: false, error: 'Tenant não associado' });
  }
  next();
}

export function sameTenantOrMaster(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) {
    return res.status(401).json({ success: false, error: 'Não autenticado' });
  }
  if (req.auth.role === 'MASTER_ADMIN') return next();
  const tenantParam = req.params.tenantId || req.query.tenantId || req.body.tenantId;
  if (tenantParam && req.auth.tenantId !== tenantParam) {
    return res.status(403).json({ success: false, error: 'Acesso negado a outro tenant' });
  }
  next();
}
