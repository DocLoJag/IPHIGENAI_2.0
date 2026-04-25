import type { FastifyInstance } from 'fastify';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/postgres.js';
import { artifacts } from '../db/schema.js';
import { collections } from '../db/mongo.js';
import { forbidden, notFound } from '../lib/errors.js';
import { serializeArtifact } from './serializers.js';

export default async function artifactsRoutes(app: FastifyInstance) {
  // GET /artifacts — restituisce gli artifact dello studente corrente
  app.get('/artifacts', { onRequest: [app.requireAuth] }, async (req) => {
    const p = req.principal!;
    if (p.role !== 'student') throw forbidden('Endpoint riservato allo studente');
    const rows = await db
      .select()
      .from(artifacts)
      .where(eq(artifacts.studentId, p.sub))
      .orderBy(desc(artifacts.createdAt));
    return { artifacts: rows.map(serializeArtifact) };
  });

  // GET /artifacts/:id — include il body da Mongo
  app.get<{ Params: { id: string } }>(
    '/artifacts/:id',
    { onRequest: [app.requireAuth] },
    async (req) => {
      const p = req.principal!;
      const [a] = await db.select().from(artifacts).where(eq(artifacts.id, req.params.id)).limit(1);
      if (!a) throw notFound('Artifact non trovato');
      if (p.role === 'student' && a.studentId !== p.sub) throw forbidden();

      const body = await collections.artifactBodies().findOne({ _id: a.id });
      return {
        artifact: {
          ...serializeArtifact(a),
          body: body ? { ...body, _id: undefined } : null,
        },
      };
    },
  );
}
