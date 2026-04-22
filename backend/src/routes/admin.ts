import type { FastifyInstance } from 'fastify';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/postgres.js';
import { students, users } from '../db/schema.js';
import { hashPassword } from '../auth/passwords.js';
import { conflict, notFound } from '../lib/errors.js';
import { id as mkId } from '../lib/ids.js';

const createBody = z.object({
  role: z.enum(['student', 'tutor', 'admin']),
  username: z.string().min(3).max(32).regex(/^[a-z0-9_.-]+$/i),
  password: z.string().min(6),
  name: z.string().min(1),
  full_name: z.string().optional(),
  avatar_initial: z.string().max(2).optional(),
  grade: z.string().optional(),
  school: z.string().optional(),
  tutor_id: z.string().optional(),
});

const updateBody = z.object({
  password: z.string().min(6).optional(),
  name: z.string().min(1).optional(),
  full_name: z.string().optional(),
  avatar_initial: z.string().max(2).optional(),
  grade: z.string().optional(),
  school: z.string().optional(),
  tutor_id: z.string().optional(),
});

function serializeUser(u: typeof users.$inferSelect, s?: typeof students.$inferSelect) {
  return {
    id: u.id,
    role: u.role,
    username: u.username,
    name: u.name,
    full_name: u.fullName,
    avatar_initial: u.avatarInitial,
    created_at: u.createdAt.toISOString(),
    disabled_at: u.disabledAt?.toISOString() ?? null,
    grade: s?.grade ?? null,
    school: s?.school ?? null,
    tutor_id: s?.tutorId ?? null,
  };
}

export default async function adminRoutes(app: FastifyInstance) {
  const guard = { onRequest: [app.requireRole('admin')] };

  // POST /admin/users
  app.post('/admin/users', guard, async (req, reply) => {
    const body = createBody.parse(req.body);

    const existing = await db.select().from(users).where(eq(users.username, body.username));
    if (existing.length > 0) throw conflict('Username già in uso', 'USERNAME_TAKEN');

    const userId = mkId.user(body.role, body.username);
    const passwordHash = await hashPassword(body.password);

    await db.insert(users).values({
      id: userId,
      role: body.role,
      username: body.username,
      passwordHash,
      name: body.name,
      fullName: body.full_name ?? null,
      avatarInitial: body.avatar_initial ?? body.name.charAt(0).toUpperCase(),
    });

    let studentRow: typeof students.$inferSelect | undefined;
    if (body.role === 'student') {
      await db.insert(students).values({
        userId,
        grade: body.grade ?? null,
        school: body.school ?? null,
        tutorId: body.tutor_id ?? null,
      });
      [studentRow] = await db.select().from(students).where(eq(students.userId, userId));
    }

    const [u] = await db.select().from(users).where(eq(users.id, userId));
    reply.code(201);
    return { user: serializeUser(u!, studentRow) };
  });

  // GET /admin/users
  app.get('/admin/users', guard, async () => {
    const rows = await db
      .select()
      .from(users)
      .where(isNull(users.disabledAt))
      .orderBy(desc(users.createdAt));
    const studs = await db.select().from(students);
    const byUser = new Map(studs.map((s) => [s.userId, s]));
    return { users: rows.map((u) => serializeUser(u, byUser.get(u.id))) };
  });

  // PUT /admin/users/:id
  app.put<{ Params: { id: string } }>('/admin/users/:id', guard, async (req) => {
    const body = updateBody.parse(req.body);
    const [u] = await db.select().from(users).where(eq(users.id, req.params.id));
    if (!u) throw notFound('Utente non trovato');

    const updates: Partial<typeof users.$inferInsert> = {};
    if (body.password) updates.passwordHash = await hashPassword(body.password);
    if (body.name) updates.name = body.name;
    if (body.full_name !== undefined) updates.fullName = body.full_name;
    if (body.avatar_initial !== undefined) updates.avatarInitial = body.avatar_initial;
    if (Object.keys(updates).length > 0) {
      await db.update(users).set(updates).where(eq(users.id, u.id));
    }

    if (u.role === 'student') {
      const sUpdates: Partial<typeof students.$inferInsert> = {};
      if (body.grade !== undefined) sUpdates.grade = body.grade;
      if (body.school !== undefined) sUpdates.school = body.school;
      if (body.tutor_id !== undefined) sUpdates.tutorId = body.tutor_id;
      if (Object.keys(sUpdates).length > 0) {
        await db.update(students).set(sUpdates).where(eq(students.userId, u.id));
      }
    }

    const [u2] = await db.select().from(users).where(eq(users.id, u.id));
    const [s2] =
      u.role === 'student'
        ? await db.select().from(students).where(eq(students.userId, u.id))
        : [undefined];
    return { user: serializeUser(u2!, s2) };
  });

  // DELETE /admin/users/:id (soft delete)
  app.delete<{ Params: { id: string } }>('/admin/users/:id', guard, async (req) => {
    const [u] = await db.select().from(users).where(eq(users.id, req.params.id));
    if (!u) throw notFound('Utente non trovato');
    await db
      .update(users)
      .set({ disabledAt: new Date() })
      .where(and(eq(users.id, u.id), isNull(users.disabledAt)));
    return { ok: true };
  });
}
