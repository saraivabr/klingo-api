import { FastifyInstance } from 'fastify';
import { db, schema } from '@irb/database';
import { authMiddleware } from '../middleware/auth.js';
import { eq, and, desc } from 'drizzle-orm';

export async function scheduleRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // GET /api/schedules - listar agendas
  app.get('/', async (request) => {
    const { doctorId } = request.query as { doctorId?: string };

    if (doctorId) {
      return await db.select().from(schema.schedules)
        .where(eq(schema.schedules.doctorId, doctorId))
        .orderBy(schema.schedules.dayOfWeek, schema.schedules.startTime);
    }

    return await db.select().from(schema.schedules)
      .orderBy(schema.schedules.dayOfWeek, schema.schedules.startTime);
  });

  // GET /api/schedules/:doctorId - get doctor's schedule
  app.get('/:doctorId', async (request) => {
    const { doctorId } = request.params as { doctorId: string };

    const schedules = await db
      .select()
      .from(schema.schedules)
      .where(
        and(
          eq(schema.schedules.doctorId, doctorId),
          eq(schema.schedules.isActive, true)
        )
      )
      .orderBy(schema.schedules.dayOfWeek, schema.schedules.startTime);

    const lunchBreaks = await db
      .select()
      .from(schema.lunchBreaks)
      .where(eq(schema.lunchBreaks.doctorId, doctorId));

    return { schedules, lunchBreaks };
  });

  // POST /api/schedules - create schedule
  app.post('/', async (request, reply) => {
    const {
      doctorId,
      dayOfWeek,
      startTime,
      endTime,
      perPatientTime,
    } = request.body as {
      doctorId: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      perPatientTime: number;
    };

    if (!doctorId || dayOfWeek === undefined || !startTime || !endTime || !perPatientTime) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    try {
      const newSchedule = await db
        .insert(schema.schedules)
        .values({
          doctorId,
          dayOfWeek,
          startTime,
          endTime,
          perPatientTime,
          isActive: true,
        })
        .returning();

      return reply.status(201).send(newSchedule[0]);
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to create schedule' });
    }
  });

  // PUT /api/schedules/:id - update schedule
  app.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const {
      dayOfWeek,
      startTime,
      endTime,
      perPatientTime,
      isActive,
    } = request.body as {
      dayOfWeek?: number;
      startTime?: string;
      endTime?: string;
      perPatientTime?: number;
      isActive?: boolean;
    };

    try {
      const updated = await db
        .update(schema.schedules)
        .set({
          ...(dayOfWeek !== undefined && { dayOfWeek }),
          ...(startTime && { startTime }),
          ...(endTime && { endTime }),
          ...(perPatientTime && { perPatientTime }),
          ...(isActive !== undefined && { isActive }),
          updatedAt: new Date(),
        })
        .where(eq(schema.schedules.id, id))
        .returning();

      if (!updated.length) {
        return reply.status(404).send({ error: 'Schedule not found' });
      }

      return updated[0];
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to update schedule' });
    }
  });

  // DELETE /api/schedules/:id - delete schedule
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const deleted = await db
        .delete(schema.schedules)
        .where(eq(schema.schedules.id, id))
        .returning();

      if (!deleted.length) {
        return reply.status(404).send({ error: 'Schedule not found' });
      }

      return { success: true };
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to delete schedule' });
    }
  });

  // GET /api/schedules/:doctorId/availability?date=YYYY-MM-DD - get available slots
  app.get('/:doctorId/availability', async (request, reply) => {
    const { doctorId } = request.params as { doctorId: string };
    const { date } = request.query as { date: string };

    if (!date) {
      return reply.status(400).send({ error: 'Date parameter required (YYYY-MM-DD)' });
    }

    try {
      const targetDate = new Date(date);
      const dayOfWeek = targetDate.getDay();

      // Get schedule for this day of week
      const schedules = await db
        .select()
        .from(schema.schedules)
        .where(
          and(
            eq(schema.schedules.doctorId, doctorId),
            eq(schema.schedules.dayOfWeek, dayOfWeek),
            eq(schema.schedules.isActive, true)
          )
        );

      if (!schedules.length) {
        return { available: false, slots: [] };
      }

      // Check if doctor has a holiday on this date
      const holiday = await db
        .select()
        .from(schema.doctorHolidays)
        .where(
          and(
            eq(schema.doctorHolidays.doctorId, doctorId),
            eq(schema.doctorHolidays.date, date)
          )
        );

      if (holiday.length) {
        return { available: false, slots: [], reason: holiday[0].reason };
      }

      // Get lunch breaks
      const lunchBreaks = await db
        .select()
        .from(schema.lunchBreaks)
        .where(eq(schema.lunchBreaks.doctorId, doctorId));

      // Get existing appointments for this date
      const appointments = await db
        .select()
        .from(schema.appointments)
        .where(
          and(
            eq(schema.appointments.doctorId, doctorId),
            eq(
              schema.appointments.status,
              'scheduled'
            )
          )
        );

      const appointmentsOnDate = appointments.filter((apt) => {
        const aptDate = new Date(apt.scheduledAt).toISOString().split('T')[0];
        return aptDate === date;
      });

      // Generate available slots
      const schedule = schedules[0];
      const slots: string[] = [];
      const [startHour, startMin] = schedule.startTime.split(':').map(Number);
      const [endHour, endMin] = schedule.endTime.split(':').map(Number);

      let currentTime = new Date();
      currentTime.setHours(startHour, startMin, 0, 0);
      const endTime = new Date();
      endTime.setHours(endHour, endMin, 0, 0);

      while (currentTime <= endTime) {
        // Check if in lunch break
        const hours = currentTime.getHours().toString().padStart(2, '0');
        const minutes = currentTime.getMinutes().toString().padStart(2, '0');
        const timeStr = `${hours}:${minutes}`;

        const inLunchBreak = lunchBreaks.some((lb) => {
          const [lunchStartH, lunchStartM] = lb.startTime.split(':').map(Number);
          const [lunchEndH, lunchEndM] = lb.endTime.split(':').map(Number);
          const lunchStart = new Date();
          lunchStart.setHours(lunchStartH, lunchStartM, 0, 0);
          const lunchEnd = new Date();
          lunchEnd.setHours(lunchEndH, lunchEndM, 0, 0);
          return currentTime >= lunchStart && currentTime < lunchEnd;
        });

        const slotTaken = appointmentsOnDate.some(
          (apt) =>
            apt.scheduledAt >=
              new Date(currentTime.getTime()) &&
            apt.scheduledAt <
              new Date(
                currentTime.getTime() +
                  schedule.perPatientTime * 60000
              )
        );

        if (!inLunchBreak && !slotTaken) {
          const slotDateTime = new Date(currentTime);
          slotDateTime.setFullYear(targetDate.getFullYear());
          slotDateTime.setMonth(targetDate.getMonth());
          slotDateTime.setDate(targetDate.getDate());
          slots.push(slotDateTime.toISOString());
        }

        currentTime = new Date(
          currentTime.getTime() + schedule.perPatientTime * 60000
        );
      }

      return { available: slots.length > 0, slots };
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to get availability' });
    }
  });

  // POST /api/schedules/:doctorId/holidays - add holiday
  app.post('/:doctorId/holidays', async (request, reply) => {
    const { doctorId } = request.params as { doctorId: string };
    const { date, reason } = request.body as { date: string; reason?: string };

    if (!date) {
      return reply.status(400).send({ error: 'Date is required' });
    }

    try {
      const holiday = await db
        .insert(schema.doctorHolidays)
        .values({
          doctorId,
          date,
          reason,
        })
        .returning();

      return reply.status(201).send(holiday[0]);
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to add holiday' });
    }
  });

  // DELETE /api/schedules/:doctorId/holidays/:id - remove holiday
  app.delete('/:doctorId/holidays/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const deleted = await db
        .delete(schema.doctorHolidays)
        .where(eq(schema.doctorHolidays.id, id))
        .returning();

      if (!deleted.length) {
        return reply.status(404).send({ error: 'Holiday not found' });
      }

      return { success: true };
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to delete holiday' });
    }
  });
}
