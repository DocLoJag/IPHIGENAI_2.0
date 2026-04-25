/*
 * Serializer "condivisi" — la versione minimale di session/activity/completion
 * usata sia dalla home dello studente sia dall'overview del tutor. Centralizzati
 * qui per evitare che il modulo tutor importasse re-export dal modulo students
 * (accoppiamento bidirezionale evitato). I serializer "ricchi" specifici del
 * pannello tutor restano in `routes/tutor/serializers.ts`.
 */
import type { activities, attachments, completions, sessions, artifacts } from '../db/schema.js';

export function serializeSession(s: typeof sessions.$inferSelect) {
  return {
    id: s.id,
    student_id: s.studentId,
    subject: s.subject,
    topic: s.topic,
    focus: s.focus,
    started_at: s.startedAt.toISOString(),
    last_touched_at: s.lastTouchedAt.toISOString(),
    closed_at: s.closedAt?.toISOString() ?? null,
    status: s.status,
    progress: {
      completed: s.completedCount,
      total: s.totalCount,
      elapsed_minutes: s.elapsedMinutes,
    },
    resume_blurb: s.resumeBlurb,
    next_exercise_id: s.nextExerciseId,
  };
}

export function serializeActivity(a: typeof activities.$inferSelect) {
  return {
    id: a.id,
    kind: a.kind,
    subject: a.subject,
    title: a.title,
    kicker: a.kicker,
    estimated_minutes: a.estimatedMinutes,
    prepared_by: a.preparedBy,
    prepared_at: a.preparedAt?.toISOString() ?? null,
    priority: a.priority,
    linked_session_id: a.linkedSessionId,
  };
}

export function serializeCompletion(c: typeof completions.$inferSelect) {
  return {
    id: c.id,
    title: c.title,
    kind: c.kind,
    subject: c.subject,
    completed_at: c.completedAt.toISOString(),
    duration_minutes: c.durationMinutes,
    outcome: c.outcome,
  };
}

export function serializeAttachment(a: typeof attachments.$inferSelect) {
  return {
    id: a.id,
    filename: a.filename,
    mime: a.mime,
    size_bytes: a.sizeBytes,
    owner_id: a.ownerId,
    student_id: a.studentId,
    url: `/api/uploads/${a.id}`,
    created_at: a.createdAt.toISOString(),
    deleted_at: a.deletedAt ? a.deletedAt.toISOString() : null,
  };
}

export function serializeArtifact(a: typeof artifacts.$inferSelect) {
  return {
    id: a.id,
    title: a.title,
    kind: a.kind,
    subject: a.subject,
    description: a.description,
    created_by: a.createdBy,
    created_at: a.createdAt.toISOString(),
    tags: a.tags,
    preview: a.preview,
  };
}
