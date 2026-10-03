import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import prisma from "../lib/prisma";
import { forbidden, unauthorized } from "../lib/errors";
import { verifyToken } from "../services/services";

export type AuthUser = {
  id: number;
  email: string;
  role: Role;
  locale: string;
  district_id: number | null;
  is_vulnerable: boolean;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const STAFF_ROLES: Role[] = ["AGENT", "ADMIN"];

export const isStaff = (user?: AuthUser) => !!user && STAFF_ROLES.includes(user.role);

// The user is reloaded on every request so role changes and deactivation apply immediately.
const resolveUser = async (req: Request, strict: boolean): Promise<AuthUser | undefined> => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return undefined;

  let payload: { id: number };
  try {
    payload = verifyToken(header.slice(7));
  } catch {
    if (strict) throw unauthorized("Invalid or expired token");
    return undefined;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: {
      id: true,
      email: true,
      role: true,
      locale: true,
      district_id: true,
      is_vulnerable: true,
      is_active: true,
    },
  });
  if (!user || !user.is_active) {
    if (strict) throw unauthorized("Account not found or disabled");
    return undefined;
  }

  const { is_active: _active, ...authUser } = user;
  return authUser;
};

// Requires a valid Bearer token.
export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  const user = await resolveUser(req, true);
  if (!user) throw unauthorized();
  req.user = user;
  next();
};

// Attaches the user when a valid token is sent; anonymous visitors pass through.
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  req.user = await resolveUser(req, false);
  next();
};

// Use after `authenticate`.
export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };

export const requireStaff = requireRole(...STAFF_ROLES);
export const requireAdmin = requireRole("ADMIN");
