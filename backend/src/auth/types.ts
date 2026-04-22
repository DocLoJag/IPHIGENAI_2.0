import type { FastifyRequest } from 'fastify';

export type AuthRole = 'student' | 'tutor' | 'admin';

export type AuthPrincipal = {
  sub: string; // user id
  role: AuthRole;
  username: string;
};

declare module 'fastify' {
  interface FastifyRequest {
    principal?: AuthPrincipal;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthPrincipal;
    user: AuthPrincipal;
  }
}

export type AuthedRequest = FastifyRequest & { principal: AuthPrincipal };
