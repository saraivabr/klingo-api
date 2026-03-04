import { Job } from 'bullmq';
import { db, schema } from '@irb/database';
import { eq, and, lt } from 'drizzle-orm';

export async function processTeleconsultationCleanup(_job: Job) {
  const now = new Date();

  // Mark rooms as no_show if scheduled > 1 hour ago and still waiting
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const noShowRooms = await db.update(schema.teleconsultationRooms)
    .set({ status: 'no_show', endedAt: now })
    .where(
      and(
        eq(schema.teleconsultationRooms.status, 'waiting'),
        lt(schema.teleconsultationRooms.scheduledAt, oneHourAgo),
      ),
    )
    .returning({ id: schema.teleconsultationRooms.id });

  // Safety net: mark very old in_progress rooms as completed (> 4 hours)
  const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);

  const staleRooms = await db.update(schema.teleconsultationRooms)
    .set({ status: 'completed', endedAt: now })
    .where(
      and(
        eq(schema.teleconsultationRooms.status, 'in_progress'),
        lt(schema.teleconsultationRooms.startedAt, fourHoursAgo),
      ),
    )
    .returning({ id: schema.teleconsultationRooms.id });

  return {
    noShow: noShowRooms.length,
    staleCompleted: staleRooms.length,
  };
}
