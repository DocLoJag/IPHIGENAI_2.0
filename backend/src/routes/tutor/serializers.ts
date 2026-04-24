/*
 * Serializer "per tutor": specchio leggermente più ricco di quelli usati
 * dal lato studente. Il tutor ha bisogno di vedere campi di stato/scheduling
 * che allo studente non servirebbero (e inquinerebbero il bundle home).
 */
import type { activities, activityProposals, tutorNotes } from '../../db/schema.js';

// Serializer esteso: include campi di scheduling/stato che il tutor deve
// vedere per confermare che la propria write abbia avuto effetto.
// Non sostituisce serializeActivity (usato nel bundle home dello studente),
// che resta minimale di proposito.
export function serializeTutorActivity(a: typeof activities.$inferSelect) {
  return {
    id: a.id,
    student_id: a.studentId,
    kind: a.kind,
    subject: a.subject,
    title: a.title,
    kicker: a.kicker,
    estimated_minutes: a.estimatedMinutes,
    prepared_by: a.preparedBy,
    prepared_at: a.preparedAt?.toISOString() ?? null,
    priority: a.priority,
    linked_session_id: a.linkedSessionId,
    scheduled_for: a.scheduledFor?.toISOString() ?? null,
    dismissed_at: a.dismissedAt?.toISOString() ?? null,
    completed_at: a.completedAt?.toISOString() ?? null,
  };
}

export function serializeTutorNote(n: typeof tutorNotes.$inferSelect) {
  return {
    id: n.id,
    student_id: n.studentId,
    tutor_id: n.tutorId,
    body: n.body,
    created_at: n.createdAt.toISOString(),
    updated_at: n.updatedAt.toISOString(),
  };
}

export function serializeProposal(p: typeof activityProposals.$inferSelect) {
  return {
    id: p.id,
    student_id: p.studentId,
    source_session_id: p.sourceSessionId,
    status: p.status,
    kind: p.kind,
    subject: p.subject,
    title: p.title,
    kicker: p.kicker,
    estimated_minutes: p.estimatedMinutes,
    priority: p.priority,
    scheduled_for: p.scheduledFor?.toISOString() ?? null,
    rationale: p.rationale,
    created_at: p.createdAt.toISOString(),
    decided_at: p.decidedAt?.toISOString() ?? null,
    decided_by: p.decidedBy,
    created_activity_id: p.createdActivityId,
    rejection_reason: p.rejectionReason,
  };
}

// Nota del curator dal notebook Mongo (non ha tipo drizzle perché Mongo).
export type CuratorNoteDoc = {
  session_id: string;
  written_at: Date;
  body: string;
  signals?: {
    topic?: string;
    confidence?: number;
    stumble_points?: string[];
    next_step_hint?: string;
  };
};

export function serializeCuratorNote(n: CuratorNoteDoc) {
  return {
    session_id: n.session_id,
    written_at: n.written_at.toISOString(),
    body: n.body,
    signals: n.signals ?? {},
  };
}
