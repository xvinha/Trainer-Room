import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface UserShape {
  id: string;
  tenantId: string | null;
  role: string;
  name: string;
  email: string;
  phone?: string | null;
  isActive: boolean;
  passwordHash?: string;
  createdAt: any;
  updatedAt: any;
}

export interface TenantShape {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  isActive: boolean;
}

export interface StudentShape {
  id: string;
  tenantId: string;
  studentId: string;
  userId?: string | null;
  name: string;
  isApproved: boolean;
  approvedAt?: any;
  approvedBy?: string | null;
}

export interface JwtPayload {
  userId: string;
  role: 'MASTER_ADMIN' | 'TRAINER' | 'STUDENT';
  tenantId: string | null;
  studentId: string | null;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, env.jwtSecret) as JwtPayload;
  } catch {
    return null;
  }
}

export function makeAuthResponse(
  user: Omit<UserShape, 'passwordHash'>,
  tenant?: TenantShape,
  student?: StudentShape
) {
  const token = signToken({
    userId: user.id,
    role: user.role as JwtPayload['role'],
    tenantId: user.tenantId,
    studentId: (student as any)?.id || null,
  });

  return {
    token,
    user: {
      id: user.id,
      tenantId: user.tenantId,
      role: user.role,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    tenant,
    student,
  };
}

