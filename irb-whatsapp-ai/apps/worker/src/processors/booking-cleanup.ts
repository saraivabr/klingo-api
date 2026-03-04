import { Job } from 'bullmq';
import { db, schema } from '@irb/database';
import { and, eq, lt } from 'drizzle-orm';

export async function processBookingCleanup(_job: Job) {
  const now = new Date();

  const result = await db.update(schema.bookingLinks)
    .set({ status: 'expired' })
    .where(and(
      eq(schema.bookingLinks.status, 'pending'),
      lt(schema.bookingLinks.expiresAt, now),
    ))
    .returning({ id: schema.bookingLinks.id });

  console.log(`[booking-cleanup] Expired ${result.length} booking links`);
  return { expired: result.length };
}
