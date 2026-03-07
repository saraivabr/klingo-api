import { Job, Queue } from 'bullmq';
import { db, schema } from '@irb/database';
import { QUEUE_NAMES } from '@irb/shared/constants';
import { eq, and, sql, or } from 'drizzle-orm';

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
};

const messageSendQueue = new Queue(QUEUE_NAMES.MESSAGE_SEND, { connection: redisConnection });

const FINANCE_PHONE = process.env.FINANCE_PHONE || '5511988888888';

/**
 * Daily job - Check for overdue receivables and prepare collection list
 * Also sends WhatsApp reminders to patients with overdue payments
 */
export async function processOverdueCollection(job: Job) {
  console.log('[overdue-collection] Running overdue check...');

  const today = new Date().toISOString().slice(0, 10);

  // Get overdue receivables (only particular patients - not insurance)
  const overdueItems = await db.select({
    id: schema.accountsReceivable.id,
    patientName: schema.patients.name,
    patientPhone: schema.patients.phone,
    totalAmount: schema.accountsReceivable.totalAmount,
    receivedAmount: schema.accountsReceivable.receivedAmount,
    glosaAmount: schema.accountsReceivable.glosaAmount,
    dueDate: schema.accountsReceivable.dueDate,
    serviceDate: schema.accountsReceivable.serviceDate,
    procedureDescription: schema.accountsReceivable.procedureDescription,
    daysOverdue: sql<number>`${today}::date - ${schema.accountsReceivable.dueDate}::date`,
  })
    .from(schema.accountsReceivable)
    .leftJoin(schema.patients, eq(schema.accountsReceivable.patientId, schema.patients.id))
    .where(and(
      eq(schema.accountsReceivable.paymentType, 'particular'),
      or(
        eq(schema.accountsReceivable.status, 'pending'),
        eq(schema.accountsReceivable.status, 'partial')
      ),
      sql`${schema.accountsReceivable.dueDate} < ${today}`
    ))
    .orderBy(sql`${today}::date - ${schema.accountsReceivable.dueDate}::date desc`);

  if (overdueItems.length === 0) {
    console.log('[overdue-collection] No overdue items found');
    return { status: 'completed', overdueCount: 0, notifications: 0 };
  }

  const formatBRL = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Group by patient for summary
  const byPatient = new Map<string, typeof overdueItems>();
  for (const item of overdueItems) {
    const phone = item.patientPhone || 'sem_telefone';
    if (!byPatient.has(phone)) {
      byPatient.set(phone, []);
    }
    byPatient.get(phone)!.push(item);
  }

  let notifications = 0;

  // Send individual reminders to patients
  for (const [phone, items] of byPatient.entries()) {
    if (phone === 'sem_telefone') continue;

    const totalBalance = items.reduce((sum, i) => sum + (i.totalAmount - (i.receivedAmount || 0) - (i.glosaAmount || 0)), 0);
    const patientName = items[0].patientName || 'Paciente';
    const oldestDays = Math.max(...items.map(i => Number(i.daysOverdue)));

    // Different messages based on how overdue
    let message: string;
    
    if (oldestDays <= 7) {
      // 1-7 days: Gentle reminder
      message = `Olá ${patientName}! 😊\n\n` +
        `Verificamos que existe um valor em aberto referente ao seu atendimento na IRB Prime Care.\n\n` +
        `Valor: ${formatBRL(totalBalance)}\n` +
        `Vencimento: ${items[0].dueDate}\n\n` +
        `Por favor, entre em contato para regularização.\n\n` +
        `📞 Financeiro IRB\n` +
        `WhatsApp: (11) 98888-8888`;
    } else if (oldestDays <= 30) {
      // 8-30 days: Firmer reminder
      message = `${patientName}, bom dia!\n\n` +
        `Identificamos pendência financeira em seu cadastro:\n\n` +
        `💰 Valor em aberto: ${formatBRL(totalBalance)}\n` +
        `📅 Vencido há ${oldestDays} dias\n\n` +
        `Solicitamos a gentileza de regularizar a pendência para evitar restrições.\n\n` +
        `Para pagamento ou negociação, entre em contato:\n` +
        `📞 Financeiro: (11) 98888-8888`;
    } else {
      // 30+ days: Final notice
      message = `*AVISO IMPORTANTE* - ${patientName}\n\n` +
        `Consta em nosso sistema uma pendência financeira de ${formatBRL(totalBalance)} vencida há ${oldestDays} dias.\n\n` +
        `⚠️ Caso não haja regularização em 5 dias úteis, seu cadastro poderá ser encaminhado para cobrança.\n\n` +
        `Entre em contato URGENTE para negociação:\n` +
        `📞 (11) 98888-8888`;
    }

    await messageSendQueue.add('send', {
      conversationId: `overdue-collection-${phone}`,
      patientPhone: phone,
      text: message,
      instanceName: 'uazapi',
    }, { 
      removeOnComplete: 50, 
      removeOnFail: 100,
      delay: notifications * 2000, // Space out messages
    });

    notifications++;
  }

  // Send summary to finance team
  const totalOverdue = overdueItems.reduce((sum, i) => sum + (i.totalAmount - (i.receivedAmount || 0) - (i.glosaAmount || 0)), 0);
  
  const agingBuckets = {
    '1-7 dias': overdueItems.filter(i => Number(i.daysOverdue) <= 7),
    '8-30 dias': overdueItems.filter(i => Number(i.daysOverdue) > 7 && Number(i.daysOverdue) <= 30),
    '31-60 dias': overdueItems.filter(i => Number(i.daysOverdue) > 30 && Number(i.daysOverdue) <= 60),
    '60+ dias': overdueItems.filter(i => Number(i.daysOverdue) > 60),
  };

  let summaryMessage = `*📊 Relatório de Inadimplência - ${new Date().toLocaleDateString('pt-BR')}*\n\n`;
  summaryMessage += `Total em aberto: ${formatBRL(totalOverdue)}\n`;
  summaryMessage += `Pacientes: ${byPatient.size}\n\n`;
  summaryMessage += `*Aging:*\n`;

  for (const [bucket, items] of Object.entries(agingBuckets)) {
    if (items.length > 0) {
      const bucketTotal = items.reduce((sum, i) => sum + (i.totalAmount - (i.receivedAmount || 0) - (i.glosaAmount || 0)), 0);
      summaryMessage += `• ${bucket}: ${items.length} (${formatBRL(bucketTotal)})\n`;
    }
  }

  summaryMessage += `\n📨 ${notifications} lembretes enviados`;

  await messageSendQueue.add('send', {
    conversationId: `overdue-summary-${new Date().toISOString().slice(0, 10)}`,
    patientPhone: FINANCE_PHONE,
    text: summaryMessage,
    instanceName: 'uazapi',
  }, { removeOnComplete: 50, removeOnFail: 100 });

  // Update status to overdue for very old items
  await db.update(schema.accountsReceivable)
    .set({ status: 'overdue', updatedAt: new Date() })
    .where(and(
      eq(schema.accountsReceivable.status, 'pending'),
      sql`${schema.accountsReceivable.dueDate} < ${today}::date - interval '30 days'`
    ));

  console.log(`[overdue-collection] Found ${overdueItems.length} overdue items, sent ${notifications} notifications`);

  return { 
    status: 'completed', 
    overdueCount: overdueItems.length,
    overdueTotal: totalOverdue,
    notifications,
    patientCount: byPatient.size,
  };
}

/**
 * Send individual collection reminder to a specific patient
 */
export async function sendCollectionReminder(accountReceivableId: string) {
  const [item] = await db.select({
    patientName: schema.patients.name,
    patientPhone: schema.patients.phone,
    totalAmount: schema.accountsReceivable.totalAmount,
    receivedAmount: schema.accountsReceivable.receivedAmount,
    glosaAmount: schema.accountsReceivable.glosaAmount,
    dueDate: schema.accountsReceivable.dueDate,
    procedureDescription: schema.accountsReceivable.procedureDescription,
  })
    .from(schema.accountsReceivable)
    .leftJoin(schema.patients, eq(schema.accountsReceivable.patientId, schema.patients.id))
    .where(eq(schema.accountsReceivable.id, accountReceivableId));

  if (!item || !item.patientPhone) return { sent: false };

  const balance = item.totalAmount - (item.receivedAmount || 0) - (item.glosaAmount || 0);
  const formatBRL = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const message = `Olá ${item.patientName}!\n\n` +
    `Gostaríamos de lembrá-lo sobre o valor em aberto referente ao seu atendimento:\n\n` +
    `📋 ${item.procedureDescription || 'Atendimento IRB'}\n` +
    `💰 Valor: ${formatBRL(balance)}\n` +
    `📅 Vencimento: ${item.dueDate}\n\n` +
    `Para pagamento ou dúvidas, entre em contato com nosso financeiro.\n\n` +
    `IRB Prime Care`;

  await messageSendQueue.add('send', {
    conversationId: `collection-reminder-${accountReceivableId}`,
    patientPhone: item.patientPhone,
    text: message,
    instanceName: 'uazapi',
  }, { removeOnComplete: 50, removeOnFail: 100 });

  return { sent: true };
}
