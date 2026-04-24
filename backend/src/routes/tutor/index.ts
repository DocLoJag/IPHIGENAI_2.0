/*
 * Entry point delle rotte del tutor panel.
 *
 * Le rotte sono suddivise per sotto-dominio in file distinti, perché il
 * pannello tutor è ormai abbastanza ricco da rendere un file unico difficile
 * da navigare. La suddivisione è puramente organizzativa: tutti i sotto-file
 * registrano rotte sotto il prefisso /tutor e condividono gli helper in
 * `guards.ts` e i serializer in `serializers.ts`.
 */
import type { FastifyInstance } from 'fastify';
import tutorStudentsRoutes from './students.js';
import tutorActivitiesRoutes from './activities.js';
import tutorNotesRoutes from './notes.js';
import tutorProposalsRoutes from './proposals.js';

export default async function tutorRoutes(app: FastifyInstance) {
  await app.register(tutorStudentsRoutes);
  await app.register(tutorActivitiesRoutes);
  await app.register(tutorNotesRoutes);
  await app.register(tutorProposalsRoutes);
}
