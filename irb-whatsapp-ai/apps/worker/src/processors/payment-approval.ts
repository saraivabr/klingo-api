import { Job, Queue } from 'bullmq';
import { db, schema } from '@irb/database';
import { QUEUE_NAMES } from '@irb/shared/constants';
import { eq, and, sql, lte, or } from 'drizzle-orm';

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
};

const messageSendQueue = new Queue(QUEUE_NAMES.MESSAGE_SEND, { connection: redisConnection });

// Director's WhatsApp number for approval notifications
const DIRECTOR_PHONE = process.env.DIRECTOR_PHONE || '5511999999999';
const FINANCE_PHONE = process.env.FINANCE_PHONE || '5511988888888';
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://dashboard.irb.com';

/**
 * Daily job (8h BRT) - Send pending approvals summary to director
 */
export async function processPaymentApprovalNotification(job: Job) {
  console.log('[payment-approval] Running daily approval notification...');

  const today = new Date().toISOString().slice(0, 10);

  // Get pending payments summary
  const [summary] = await db.select({
    pendingCount: sql<number>`count(case when ${schema.accountsPayable.status} = 'pending' then 1 end)`,
    pendingTotal: sql<number>`coalesce(sum(case when ${schema.accountsPayable.status} = 'pending' then ${schema.accountsPayable.netAmount} else 0 end), 0)`,
    approvedCount: sql<number>`count(case when ${schema.accountsPayable.status} = 'approved' then 1 end)`,
    approvedTotal: sql<number>`coalesce(sum(case when ${schema.accountsPayable.status} = 'approved' then ${schema.accountsPayable.netAmount} else 0 end), 0)`,
    overdueCount: sql<number>`count(case when ${schema.accountsPayable.status} in ('pending', 'approved') and ${schema.accountsPayable.dueDate} < ${today} then 1 end)`,
    overdueTotal: sql<number>`coalesce(sum(case when ${schema.accountsPayable.status} in ('pending', 'approved') and ${schema.accountsPayable.dueDate} < ${today} then ${schema.accountsPayable.netAmount} else 0 end), 0)`,
    dueTodayCount: sql<number>`count(case when ${schema.accountsPayable.dueDate} = ${today} and ${schema.accountsPayable.status} in ('pending', 'approved') then 1 end)`,
    dueTodayTotal: sql<number>`coalesce(sum(case when ${schema.accountsPayable.dueDate} = ${today} and ${schema.accountsPayable.status} in ('pending', 'approved') then ${schema.accountsPayable.netAmount} else 0 end), 0)`,
  })
    .from(schema.accountsPayable);

  const pendingCount = Number(summary.pendingCount);
  const pendingTotal = Number(summary.pendingTotal);
  const approvedCount = Number(summary.approvedCount);
  const approvedTotal = Number(summary.approvedTotal);
  const overdueCount = Number(summary.overdueCount);
  const overdueTotal = Number(summary.overdueTotal);
  const dueTodayCount = Number(summary.dueTodayCount);
  const dueTodayTotal = Number(summary.dueTodayTotal);

  // Only notify if there are pending items
  if (pendingCount === 0 && approvedCount === 0) {
    console.log('[payment-approval] No pending or approved payments, skipping notification');
    return { status: 'skipped', reason: 'no_pending_payments' };
  }

  // Format amounts in BRL
  const formatBRL = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Build message
  let message = `*Bom dia! Resumo Financeiro - ${new Date().toLocaleDateString('pt-BR')}*\n\n`;
  
  if (pendingCount > 0) {
    message += `🔴 *${pendingCount} pagamentos aguardam aprovação*\n`;
    message += `   Total: ${formatBRL(pendingTotal)}\n\n`;
  }

  if (approvedCount > 0) {
    message += `🟢 *${approvedCount} pagamentos aprovados para pagar*\n`;
    message += `   Total: ${formatBRL(approvedTotal)}\n\n`;
  }

  if (dueTodayCount > 0) {
    message += `⏰ *${dueTodayCount} vencem HOJE*\n`;
    message += `   Total: ${formatBRL(dueTodayTotal)}\n\n`;
  }

  if (overdueCount > 0) {
    message += `⚠️ *${overdueCount} em ATRASO*\n`;
    message += `   Total: ${formatBRL(overdueTotal)}\n\n`;
  }

  message += `📊 Acesse o dashboard para aprovar:\n${DASHBOARD_URL}/financeiro/pagamentos`;

  // Send to director
  await messageSendQueue.add('send', {
    conversationId: `payment-approval-director-${today}`,
    patientPhone: DIRECTOR_PHONE,
    text: message,
    instanceName: 'uazapi',
  }, { removeOnComplete: 50, removeOnFail: 100 });

  // Also send to finance team if there are items to pay today
  if (dueTodayCount > 0 || approvedCount > 0) {
    const financeMessage = `*Pagamentos do dia - ${new Date().toLocaleDateString('pt-BR')}*\n\n` +
      `${approvedCount} aprovados para pagar: ${formatBRL(approvedTotal)}\n` +
      `${dueTodayCount} vencem hoje: ${formatBRL(dueTodayTotal)}\n\n` +
      `${DASHBOARD_URL}/financeiro/pagamentos?status=approved`;

    await messageSendQueue.add('send', {
      conversationId: `payment-approval-finance-${today}`,
      patientPhone: FINANCE_PHONE,
      text: financeMessage,
      instanceName: 'uazapi',
    }, { removeOnComplete: 50, removeOnFail: 100 });
  }

  console.log(`[payment-approval] Notified director (${pendingCount} pending, ${approvedCount} approved)`);

  // Update pending approvals to mark as notified
  await db.update(schema.paymentApprovals)
    .set({
      notifiedViaWhatsapp: true,
      whatsappNotifiedAt: new Date(),
    })
    .where(and(
      eq(schema.paymentApprovals.status, 'pending'),
      eq(schema.paymentApprovals.notifiedViaWhatsapp, false)
    ));

  return { 
    status: 'completed', 
    pendingCount, 
    approvedCount, 
    dueTodayCount,
    overdueCount,
  };
}

/**
 * Notify when a payment is approved
 */
export async function notifyPaymentApproved(accountPayableId: string) {
  const [payment] = await db.select({
    description: schema.accountsPayable.description,
    netAmount: schema.accountsPayable.netAmount,
    dueDate: schema.accountsPayable.dueDate,
    supplierName: schema.suppliers.legalName,
  })
    .from(schema.accountsPayable)
    .leftJoin(schema.suppliers, eq(schema.accountsPayable.supplierId, schema.suppliers.id))
    .where(eq(schema.accountsPayable.id, accountPayableId));

  if (!payment) return;

  const formatBRL = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const message = `✅ *Pagamento Aprovado*\n\n` +
    `Fornecedor: ${payment.supplierName || 'N/A'}\n` +
    `Descrição: ${payment.description}\n` +
    `Valor: ${formatBRL(payment.netAmount)}\n` +
    `Vencimento: ${payment.dueDate}\n\n` +
    `Acesse o dashboard para efetuar o pagamento.`;

  await messageSendQueue.add('send', {
    conversationId: `payment-approved-${accountPayableId}`,
    patientPhone: FINANCE_PHONE,
    text: message,
    instanceName: 'uazapi',
  }, { removeOnComplete: 50, removeOnFail: 100 });
}

/**
 * Notify when a payment is rejected
 */
export async function notifyPaymentRejected(accountPayableId: string, reason: string) {
  const [payment] = await db.select({
    description: schema.accountsPayable.description,
    netAmount: schema.accountsPayable.netAmount,
    supplierName: schema.suppliers.legalName,
  })
    .from(schema.accountsPayable)
    .leftJoin(schema.suppliers, eq(schema.accountsPayable.supplierId, schema.suppliers.id))
    .where(eq(schema.accountsPayable.id, accountPayableId));

  if (!payment) return;

  const formatBRL = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const message = `❌ *Pagamento Rejeitado*\n\n` +
    `Fornecedor: ${payment.supplierName || 'N/A'}\n` +
    `Descrição: ${payment.description}\n` +
    `Valor: ${formatBRL(payment.netAmount)}\n\n` +
    `Motivo: ${reason}`;

  await messageSendQueue.add('send', {
    conversationId: `payment-rejected-${accountPayableId}`,
    patientPhone: FINANCE_PHONE,
    text: message,
    instanceName: 'uazapi',
  }, { removeOnComplete: 50, removeOnFail: 100 });
}
