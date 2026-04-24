/*
 * Helper condivisi dalle rotte del tutor panel.
 *
 * Tutte le rotte tutor sono protette da `requireRole('tutor')` — ma il ruolo
 * da solo non basta: il tutor deve essere proprietario della risorsa che
 * sta toccando. Questi helper eseguono l'ownership check + i relativi
 * 404/403 normalizzati, così ogni handler si limita a chiamarli e fidarsi.
 */
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/postgres.js';
import {
  activities,
  activityProposals,
  sessions,
  students,
  tutorNotes,
} from '../../db/schema.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';

export async function assertTutorOwnsStudent(tutorId: string, studentId: string) {
  const [s] = await db
    .select()
    .from(students)
    .where(eq(students.userId, studentId))
    .limit(1);
  if (!s) throw notFound('Studente non trovato');
  if (s.tutorId !== tutorId) throw forbidden('Studente non assegnato a questo tutor');
  return s;
}

export async function assertTutorOwnsNote(tutorId: string, noteId: string) {
  const [n] = await db
    .select()
    .from(tutorNotes)
    .where(eq(tutorNotes.id, noteId))
    .limit(1);
  if (!n) throw notFound('Nota non trovata');
  // Solo l'autore può leggere/modificare/cancellare la propria nota privata.
  // Anche un tutor che ha ricevuto in riassegnazione lo studente non vede
  // le note scritte da un collega: sono appunti personali, non condivisi.
  if (n.tutorId !== tutorId) throw forbidden('Nota non di questo tutor');
  return n;
}

export async function assertTutorOwnsActivity(tutorId: string, activityId: string) {
  const [a] = await db
    .select()
    .from(activities)
    .where(eq(activities.id, activityId))
    .limit(1);
  if (!a) throw notFound('Attività non trovata');
  const [s] = await db
    .select()
    .from(students)
    .where(eq(students.userId, a.studentId))
    .limit(1);
  if (!s || s.tutorId !== tutorId) {
    throw forbidden('Attività non assegnata a uno studente di questo tutor');
  }
  return a;
}

export async function assertTutorOwnsProposal(tutorId: string, proposalId: string) {
  const [p] = await db
    .select()
    .from(activityProposals)
    .where(eq(activityProposals.id, proposalId))
    .limit(1);
  if (!p) throw notFound('Proposta non trovata');
  const [s] = await db
    .select()
    .from(students)
    .where(eq(students.userId, p.studentId))
    .limit(1);
  if (!s || s.tutorId !== tutorId) {
    throw forbidden('Proposta non relativa a uno studente di questo tutor');
  }
  return p;
}

// Usato sia da activities (POST/PATCH) sia da proposals (approve con override):
// `linked_session_id` deve esistere e appartenere allo studente target.
export async function assertSessionBelongsToStudent(sessionId: string, studentId: string) {
  const [sess] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!sess) throw badRequest('Sessione collegata non trovata', 'LINKED_SESSION_NOT_FOUND');
  if (sess.studentId !== studentId) {
    throw badRequest(
      'La sessione collegata non appartiene a questo studente',
      'LINKED_SESSION_MISMATCH',
    );
  }
}

// Enum zod dei kind di activity, specchio dell'enum Postgres `activity_kind`.
// Centralizzato qui perché usato sia da activities sia da proposals/approve.
export const activityKindSchema = z.enum([
  'review',
  'guided-reading',
  'quick-test',
  'analysis',
  'writing',
  'exercise-set',
  'reading',
]);
