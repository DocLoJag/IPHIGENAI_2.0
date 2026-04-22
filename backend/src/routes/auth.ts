import type { FastifyInstance } from 'fastify';
import { eq, and, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/postgres.js';
import { users, students } from '../db/schema.js';
import { verifyPassword } from '../auth/passwords.js';
import { unauthorized } from '../lib/errors.js';

const loginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export default async function authRoutes(app: FastifyInstance) {
  app.post('/auth/login', async (req, reply) => {
    const body = loginBody.parse(req.body);
    const rows = await db
      .select()
      .from(users)
      .where(and(eq(users.username, body.username), isNull(users.disabledAt)))
      .limit(1);
    const u = rows[0];
    if (!u) throw unauthorized('Credenziali non valide', 'AUTH_INVALID');
    const ok = await verifyPassword(u.passwordHash, body.password);
    if (!ok) throw unauthorized('Credenziali non valide', 'AUTH_INVALID');

    app.issueSessionCookie(reply, {
      sub: u.id,
      role: u.role,
      username: u.username,
    });

    const studentRow =
      u.role === 'student'
        ? (await db.select().from(students).where(eq(students.userId, u.id)).limit(1))[0]
        : undefined;

    return {
      user: {
        id: u.id,
        role: u.role,
        name: u.name,
        full_name: u.fullName,
        avatar_initial: u.avatarInitial,
        grade: studentRow?.grade ?? null,
        school: studentRow?.school ?? null,
        tutor_id: studentRow?.tutorId ?? null,
      },
    };
  });

  app.post('/auth/logout', async (_req, reply) => {
    app.clearSessionCookie(reply);
    return { ok: true };
  });

  app.get('/auth/me', { onRequest: [app.requireAuth] }, async (req) => {
    const p = req.principal!;
    const u = (await db.select().from(users).where(eq(users.id, p.sub)).limit(1))[0];
    if (!u) throw unauthorized();
    const studentRow =
      u.role === 'student'
        ? (await db.select().from(students).where(eq(students.userId, u.id)).limit(1))[0]
        : undefined;
    return {
      user: {
        id: u.id,
        role: u.role,
        name: u.name,
        full_name: u.fullName,
        avatar_initial: u.avatarInitial,
        grade: studentRow?.grade ?? null,
        school: studentRow?.school ?? null,
        tutor_id: studentRow?.tutorId ?? null,
      },
    };
  });
}
