/*
 * Rotte sulle proposte di task (generate dal curator, approvate dal tutor).
 * - GET  /tutor/proposals
 * - GET  /tutor/students/:id/proposals
 * - POST /tutor/proposals/:id/approve           (crea la activity corrispondente)
 * - POST /tutor/proposals/:id/reject
 */
import type { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/postgres.js';
import { activities, activityProposals, students } from '../../db/schema.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { id as genId } from '../../lib/ids.js';
import {
  activityKindSchema,
  assertSessionBelongsToStudent,
  assertTutorOwnsProposal,
  assertTutorOwnsStudent,
} from './guards.js';
import { serializeProposal, serializeTutorActivity } from './serializers.js';

const proposalStatusSchema = z.enum(['pending', 'approved', 'rejected']);

const proposalsListQuery = z.object({
  status: proposalStatusSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// Approvare una proposta crea una activity. Il tutor può sovrascrivere uno o
// più campi prima della creazione (es. cambiare priority, aggiungere
// scheduled_for, correggere il titolo). Tutti i campi sono opzionali: se assenti
// si usa il valore della proposta.
const approveProposalBody = z
  .object({
    kind: activityKindSchema.optional(),
    subject: z.string().trim().min(1).max(200).optional(),
    title: z.string().trim().min(1).max(500).optional(),
    kicker: z.string().trim().max(500).nullable().optional(),
    estimated_minutes: z.number().int().positive().max(600).nullable().optional(),
    priority: z.number().int().min(0).max(10000).optional(),
    scheduled_for: z.string().datetime({ offset: true }).nullable().optional(),
    linked_session_id: z.string().min(1).nullable().optional(),
  })
  .strict();

const rejectProposalBody = z
  .object({
    reason: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();

export default async function tutorProposalsRoutes(app: FastifyInstance) {
  const guard = { onRequest: [app.requireRole('tutor')] };

  // GET /tutor/proposals — coda proposte (tutti gli studenti assegnati al tutor loggato).
  // Filtro opzionale per status. Ordine: più recenti prima.
  app.get('/tutor/proposals', guard, async (req) => {
    const tutorId = req.principal!.sub;
    const { status, limit } = proposalsListQuery.parse(req.query ?? {});

    const myStudents = await db
      .select({ userId: students.userId })
      .from(students)
      .where(eq(students.tutorId, tutorId));

    const studentIds = myStudents.map((s) => s.userId);
    if (studentIds.length === 0) {
      return { items: [], total: 0 };
    }

    const whereClause = status
      ? and(inArray(activityProposals.studentId, studentIds), eq(activityProposals.status, status))
      : inArray(activityProposals.studentId, studentIds);

    const rows = await db
      .select()
      .from(activityProposals)
      .where(whereClause)
      .orderBy(desc(activityProposals.createdAt))
      .limit(limit);

    return { items: rows.map(serializeProposal), total: rows.length };
  });

  // GET /tutor/students/:id/proposals — proposte per un singolo studente
  app.get<{ Params: { id: string } }>(
    '/tutor/students/:id/proposals',
    guard,
    async (req) => {
      const tutorId = req.principal!.sub;
      const studentId = req.params.id;
      await assertTutorOwnsStudent(tutorId, studentId);

      const { status, limit } = proposalsListQuery.parse(req.query ?? {});

      const whereClause = status
        ? and(eq(activityProposals.studentId, studentId), eq(activityProposals.status, status))
        : eq(activityProposals.studentId, studentId);

      const rows = await db
        .select()
        .from(activityProposals)
        .where(whereClause)
        .orderBy(desc(activityProposals.createdAt))
        .limit(limit);

      return { items: rows.map(serializeProposal), total: rows.length };
    },
  );

  // POST /tutor/proposals/:id/approve — approva la proposta e crea la activity
  // corrispondente. Il tutor può sovrascrivere i campi via body (tutto opzionale).
  // Ordine dei controlli: ownership (404/403) → stato (400 ALREADY_DECIDED) → body (400 VALIDATION).
  app.post<{ Params: { id: string } }>(
    '/tutor/proposals/:id/approve',
    guard,
    async (req, reply) => {
      const tutorId = req.principal!.sub;
      const proposalId = req.params.id;
      const current = await assertTutorOwnsProposal(tutorId, proposalId);

      if (current.status !== 'pending') {
        throw badRequest('Proposta già decisa', 'ALREADY_DECIDED');
      }

      const body = approveProposalBody.parse(req.body ?? {});

      if (body.linked_session_id) {
        await assertSessionBelongsToStudent(body.linked_session_id, current.studentId);
      }

      const now = new Date();
      const newActivityId = genId.activity();

      // Sovrascrittura campo-a-campo: il body batte la proposta, la proposta batte il default.
      const kind = body.kind ?? current.kind;
      const subject = body.subject ?? current.subject;
      const title = body.title ?? current.title;
      const kicker = body.kicker !== undefined ? body.kicker : current.kicker;
      const estimatedMinutes =
        body.estimated_minutes !== undefined ? body.estimated_minutes : current.estimatedMinutes;
      const priority = body.priority ?? current.priority;
      const scheduledFor =
        body.scheduled_for !== undefined
          ? body.scheduled_for
            ? new Date(body.scheduled_for)
            : null
          : current.scheduledFor;
      const linkedSessionId =
        body.linked_session_id !== undefined ? body.linked_session_id : current.sourceSessionId;

      const [newActivity] = await db
        .insert(activities)
        .values({
          id: newActivityId,
          studentId: current.studentId,
          kind,
          subject,
          title,
          kicker,
          estimatedMinutes,
          preparedBy: tutorId,
          preparedAt: now,
          priority,
          linkedSessionId,
          scheduledFor,
        })
        .returning();

      if (!newActivity) throw notFound('Creazione activity dalla proposta fallita');

      const [updatedProposal] = await db
        .update(activityProposals)
        .set({
          status: 'approved',
          decidedAt: now,
          decidedBy: tutorId,
          createdActivityId: newActivityId,
        })
        .where(eq(activityProposals.id, proposalId))
        .returning();

      if (!updatedProposal) throw notFound('Proposta non trovata');

      reply.code(201);
      return {
        proposal: serializeProposal(updatedProposal),
        activity: serializeTutorActivity(newActivity),
      };
    },
  );

  // POST /tutor/proposals/:id/reject — rifiuta la proposta, opzionalmente con
  // motivazione breve (utile per fare tuning del curator in futuro).
  app.post<{ Params: { id: string } }>(
    '/tutor/proposals/:id/reject',
    guard,
    async (req) => {
      const tutorId = req.principal!.sub;
      const proposalId = req.params.id;
      const current = await assertTutorOwnsProposal(tutorId, proposalId);

      if (current.status !== 'pending') {
        throw badRequest('Proposta già decisa', 'ALREADY_DECIDED');
      }

      const body = rejectProposalBody.parse(req.body ?? {});

      const [updated] = await db
        .update(activityProposals)
        .set({
          status: 'rejected',
          decidedAt: new Date(),
          decidedBy: tutorId,
          rejectionReason: body.reason ?? null,
        })
        .where(eq(activityProposals.id, proposalId))
        .returning();

      if (!updated) throw notFound('Proposta non trovata');
      return serializeProposal(updated);
    },
  );
}
