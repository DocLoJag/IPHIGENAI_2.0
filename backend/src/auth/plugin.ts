import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import { env } from '../config/env.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import type { AuthPrincipal, AuthRole } from './types.js';

const COOKIE_NAME = 'iphigenai_session';

export default fp(async (app: FastifyInstance) => {
  await app.register(cookie, {
    // non serve un secret per cookie non firmati: il JWT è già firmato
    hook: 'onRequest',
  });

  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_EXPIRES_IN },
    cookie: { cookieName: COOKIE_NAME, signed: false },
  });

  app.decorateRequest('principal', undefined);

  // onRequest: se c'è il cookie, decodifica e popola request.principal
  app.addHook('onRequest', async (req: FastifyRequest) => {
    const raw = req.cookies?.[COOKIE_NAME];
    if (!raw) return;
    try {
      const decoded = await req.jwtVerify<AuthPrincipal>();
      req.principal = decoded;
    } catch {
      // cookie presente ma invalido: ignoralo, l'auth guard reagirà
    }
  });

  app.decorate(
    'requireAuth',
    async function (this: FastifyInstance, req: FastifyRequest, _reply: FastifyReply) {
      if (!req.principal) throw unauthorized();
    },
  );

  app.decorate(
    'requireRole',
    function (this: FastifyInstance, ...roles: AuthRole[]) {
      return async (req: FastifyRequest, _reply: FastifyReply) => {
        if (!req.principal) throw unauthorized();
        if (!roles.includes(req.principal.role)) throw forbidden();
      };
    },
  );

  app.decorate(
    'issueSessionCookie',
    function (this: FastifyInstance, reply: FastifyReply, principal: AuthPrincipal): string {
      const token = reply.server.jwt.sign(principal);
      reply.setCookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: env.COOKIE_SECURE,
        sameSite: env.COOKIE_SECURE ? 'none' : 'lax',
        domain: env.COOKIE_DOMAIN || undefined,
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 giorni max; JWT_EXPIRES_IN controlla la validità logica
      });
      return token;
    },
  );

  app.decorate('clearSessionCookie', function (this: FastifyInstance, reply: FastifyReply): void {
    reply.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: env.COOKIE_SECURE ? 'none' : 'lax',
      domain: env.COOKIE_DOMAIN || undefined,
      path: '/',
    });
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (
      ...roles: AuthRole[]
    ) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    issueSessionCookie: (reply: FastifyReply, principal: AuthPrincipal) => string;
    clearSessionCookie: (reply: FastifyReply) => void;
  }
}
