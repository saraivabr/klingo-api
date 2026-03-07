import { Job, Queue } from 'bullmq';
import { db, schema } from '@irb/database';
import { QUEUE_NAMES } from '@irb/shared/constants';
import { eq, and, sql } from 'drizzle-orm';

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
};

const paymentNotificationQueue = new Queue(QUEUE_NAMES.PAYMENT_NOTIFICATION, { connection: redisConnection });

export async function processPaymentReminder(job: Job) {
  console.log('[payment-reminder] Running daily check...');

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // 3 days from now
  const in3Days = new Date(today);
  in3Days.setDate(in3Days.getDate() + 3);
  const in3DaysStr = in3Days.toISOString().slice(0, 10);

  // Find PENDING payments due in 3 days → send reminder
  const upcomingPayments = await db.select({
    paymentId: schema.payments.id,
    dueDate: schema.payments.dueDate,
    amountCents: schema.payments.amountCents,
    subscriptionId: schema.payments.subscriptionId,
    patientPhone: schema.patients.phone,
  })
    .from(schema.payments)
    .innerJoin(schema.subscriptions, eq(schema.payments.subscriptionId, schema.subscriptions.id))
    .innerJoin(schema.patients, eq(schema.subscriptions.patientId, schema.patients.id))
    .where(and(
      eq(schema.payments.status, 'PENDING'),
      eq(schema.payments.dueDate, in3DaysStr),
    ));

  let reminders = 0;
  for (const p of upcomingPayments) {
    if (!p.patientPhone) continue;
    await paymentNotificationQueue.add('notify', {
      type: 'payment_reminder',
      patientPhone: p.patientPhone,
      subscriptionId: p.subscriptionId,
      paymentId: p.paymentId,
      amountCents: p.amountCents,
      dueDate: p.dueDate,
    }, { removeOnComplete: 50, removeOnFail: 100 });
    reminders++;
  }

  // Find PENDING payments due TODAY → send urgent reminder
  const todayPayments = await db.select({
    paymentId: schema.payments.id,
    dueDate: schema.payments.dueDate,
    amountCents: schema.payments.amountCents,
    subscriptionId: schema.payments.subscriptionId,
    patientPhone: schema.patients.phone,
  })
    .from(schema.payments)
    .innerJoin(schema.subscriptions, eq(schema.payments.subscriptionId, schema.subscriptions.id))
    .innerJoin(schema.patients, eq(schema.subscriptions.patientId, schema.patients.id))
    .where(and(
      eq(schema.payments.status, 'PENDING'),
      eq(schema.payments.dueDate, todayStr),
    ));

  let urgentReminders = 0;
  for (const p of todayPayments) {
    if (!p.patientPhone) continue;
    await paymentNotificationQueue.add('notify', {
      type: 'payment_reminder',
      patientPhone: p.patientPhone,
      subscriptionId: p.subscriptionId,
      paymentId: p.paymentId,
      amountCents: p.amountCents,
      dueDate: p.dueDate,
    }, { removeOnComplete: 50, removeOnFail: 100 });
    urgentReminders++;
  }

  console.log(`[payment-reminder] Sent ${reminders} reminders (3-day) + ${urgentReminders} urgent (today)`);
  return { status: 'completed', reminders, urgentReminders };
}
