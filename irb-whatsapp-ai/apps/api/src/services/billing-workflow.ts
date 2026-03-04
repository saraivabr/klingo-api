/**
 * Serviço de Workflow de Faturamento
 * 
 * Jornada completa:
 * 1. Criação de fatura (manual ou via OPD)
 * 2. Geração de cobrança Asaas (PIX, Boleto, etc)
 * 3. Envio de notificação ao paciente
 * 4. Processamento de pagamentos (webhook Asaas)
 * 5. Lembretes de cobrança
 * 6. Conciliação
 */

import { db, schema } from '@irb/database';
import { eq, and, lt, sql } from 'drizzle-orm';
import { getAsaasClient, type AsaasCustomerRequest } from './asaas.js';
import {
  notifyBillCreated,
  notifyBillPixPayment,
  notifyPaymentReceived,
  notifyBillReminder,
} from './whatsapp-notifications.js';
import type { NotificationRecipient, BillInfo } from './whatsapp-notifications.js';

// ============================================================================
// Types
// ============================================================================

export interface CreateAsaasChargeParams {
  billId: string;
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
  dueDate: string; // YYYY-MM-DD
}

export interface CreateAsaasChargeResult {
  success: boolean;
  asaasPaymentId?: string;
  pixCode?: string;
  invoiceUrl?: string;
  message: string;
}

export interface ProcessPaymentParams {
  billId: string;
  amountPaid: number;
  paymentMethod: string;
  transactionRef?: string;
  notes?: string;
  asaasPaymentId?: string;
}

export interface ProcessPaymentResult {
  success: boolean;
  transactionId?: string;
  newStatus: string;
  remainingAmount: number;
  message: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function getPatientInfo(patientId: string): Promise<NotificationRecipient | null> {
  const [patient] = await db.select({
    phone: schema.patients.phone,
    name: schema.patients.name,
  })
    .from(schema.patients)
    .where(eq(schema.patients.id, patientId))
    .limit(1);

  if (!patient) return null;

  return {
    phone: patient.phone,
    name: patient.name || 'Paciente',
  };
}

async function getBillWithPatient(billId: string) {
  const [bill] = await db.select({
    id: schema.bills.id,
    billNumber: schema.bills.billNumber,
    patientId: schema.bills.patientId,
    totalAmount: schema.bills.totalAmount,
    discountPercent: schema.bills.discountPercent,
    netAmount: schema.bills.netAmount,
    status: schema.bills.status,
    patientName: schema.patients.name,
    patientPhone: schema.patients.phone,
    patientEmail: schema.patients.email,
    patientCpfHash: schema.patients.cpfHash,
  })
    .from(schema.bills)
    .innerJoin(schema.patients, eq(schema.bills.patientId, schema.patients.id))
    .where(eq(schema.bills.id, billId))
    .limit(1);

  return bill;
}

async function getOrCreateAsaasCustomer(patientId: string): Promise<string | null> {
  const asaasClient = getAsaasClient();
  if (!asaasClient) return null;

  // Verificar se já existe customer Asaas
  const [existing] = await db.select()
    .from(schema.asaasCustomers)
    .where(eq(schema.asaasCustomers.patientId, patientId))
    .limit(1);

  if (existing) {
    return existing.asaasId;
  }

  // Buscar dados do paciente
  const [patient] = await db.select()
    .from(schema.patients)
    .where(eq(schema.patients.id, patientId))
    .limit(1);

  if (!patient) return null;

  // TODO: Descriptografar CPF se necessário
  // Por enquanto, assumimos que não temos CPF disponível
  // O Asaas requer CPF para criar customer

  // Se não temos CPF, não podemos criar customer no Asaas
  // Retornar null e processar pagamento manualmente
  console.warn('[Billing Workflow] Paciente sem CPF - cobrança Asaas não disponível');
  return null;
}

async function calculatePaidAmount(billId: string): Promise<number> {
  const result = await db.select({
    total: sql<number>`COALESCE(SUM(amount_paid), 0)`,
  })
    .from(schema.billTransactions)
    .where(eq(schema.billTransactions.billId, billId));

  return Number(result[0]?.total || 0);
}

// ============================================================================
// Workflow: Criar Cobrança Asaas
// ============================================================================

/**
 * Cria cobrança no Asaas para a fatura
 * - Cria/busca customer
 * - Cria payment
 * - Obtém QR Code PIX se aplicável
 * - Notifica paciente
 */
export async function createAsaasCharge(
  params: CreateAsaasChargeParams,
): Promise<CreateAsaasChargeResult> {
  const { billId, billingType, dueDate } = params;

  try {
    const asaasClient = getAsaasClient();
    
    if (!asaasClient) {
      return {
        success: false,
        message: 'Integração Asaas não configurada',
      };
    }

    // 1. Buscar fatura
    const bill = await getBillWithPatient(billId);
    if (!bill) {
      return { success: false, message: 'Fatura não encontrada' };
    }

    // 2. Obter/criar customer Asaas
    const asaasCustomerId = await getOrCreateAsaasCustomer(bill.patientId);
    
    if (!asaasCustomerId) {
      return {
        success: false,
        message: 'Não foi possível criar cliente no Asaas (CPF necessário)',
      };
    }

    // 3. Criar payment no Asaas
    // TODO: Implementar criação de payment avulso no AsaasClient
    // Por enquanto, usamos o modelo de subscription existente

    // 4. Se PIX, obter QR Code
    let pixCode: string | undefined;
    let invoiceUrl: string | undefined;

    // TODO: Implementar após adicionar createPayment no AsaasClient

    return {
      success: false,
      message: 'Funcionalidade em desenvolvimento - use pagamento manual',
    };
  } catch (error) {
    console.error('[Billing Workflow] Erro ao criar cobrança Asaas:', error);
    return { success: false, message: 'Erro ao criar cobrança' };
  }
}

// ============================================================================
// Workflow: Processar Pagamento
// ============================================================================

/**
 * Processa pagamento de fatura
 * - Registra transação
 * - Atualiza status da fatura
 * - Notifica paciente
 */
export async function processPayment(
  params: ProcessPaymentParams,
): Promise<ProcessPaymentResult> {
  const { billId, amountPaid, paymentMethod, transactionRef, notes, asaasPaymentId } = params;

  try {
    // 1. Buscar fatura
    const bill = await getBillWithPatient(billId);
    if (!bill) {
      return {
        success: false,
        newStatus: 'unknown',
        remainingAmount: 0,
        message: 'Fatura não encontrada',
      };
    }

    // 2. Criar transação
    const [transaction] = await db.insert(schema.billTransactions).values({
      billId,
      amountPaid,
      paymentMethod,
      transactionRef: transactionRef || asaasPaymentId,
      notes,
      paidAt: new Date(),
    }).returning();

    // 3. Calcular total pago
    const totalPaid = await calculatePaidAmount(billId);
    const remainingAmount = bill.netAmount - totalPaid;

    // 4. Determinar novo status
    let newStatus: string;
    if (totalPaid >= bill.netAmount) {
      newStatus = 'paid';
    } else if (totalPaid > 0) {
      newStatus = 'partial';
    } else {
      newStatus = 'pending';
    }

    // 5. Atualizar status da fatura
    await db.update(schema.bills)
      .set({ status: newStatus })
      .where(eq(schema.bills.id, billId));

    // 6. Notificar paciente
    const patientInfo = await getPatientInfo(bill.patientId);

    if (patientInfo) {
      try {
        await notifyPaymentReceived(
          patientInfo,
          bill.billNumber,
          amountPaid,
          paymentMethod,
        );
      } catch (err) {
        console.error('[Billing Workflow] Erro ao enviar notificação:', err);
      }
    }

    return {
      success: true,
      transactionId: transaction.id,
      newStatus,
      remainingAmount: Math.max(0, remainingAmount),
      message: newStatus === 'paid'
        ? 'Pagamento completo - fatura quitada'
        : `Pagamento parcial - restam R$ ${(remainingAmount / 100).toFixed(2)}`,
    };
  } catch (error) {
    console.error('[Billing Workflow] Erro ao processar pagamento:', error);
    return {
      success: false,
      newStatus: 'error',
      remainingAmount: 0,
      message: 'Erro ao processar pagamento',
    };
  }
}

// ============================================================================
// Workflow: Enviar Lembrete de Cobrança
// ============================================================================

/**
 * Envia lembrete de pagamento para fatura pendente
 */
export async function sendPaymentReminder(
  billId: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const bill = await getBillWithPatient(billId);
    if (!bill) {
      return { success: false, message: 'Fatura não encontrada' };
    }

    if (bill.status === 'paid' || bill.status === 'cancelled') {
      return { success: false, message: 'Fatura já está paga ou cancelada' };
    }

    const patientInfo = await getPatientInfo(bill.patientId);
    if (!patientInfo) {
      return { success: false, message: 'Paciente não encontrado' };
    }

    // Calcular dias de atraso (se tiver vencimento)
    // Por enquanto, assumimos 0 dias
    const daysOverdue = 0;

    const billInfo: BillInfo = {
      billNumber: bill.billNumber,
      patientName: patientInfo.name,
      totalAmount: bill.totalAmount,
      netAmount: bill.netAmount,
    };

    await notifyBillReminder(patientInfo, billInfo, daysOverdue);

    return { success: true, message: 'Lembrete enviado' };
  } catch (error) {
    console.error('[Billing Workflow] Erro ao enviar lembrete:', error);
    return { success: false, message: 'Erro ao enviar lembrete' };
  }
}

// ============================================================================
// Workflow: Enviar PIX para Pagamento
// ============================================================================

/**
 * Envia QR Code PIX para pagamento da fatura
 */
export async function sendPixPayment(
  billId: string,
  pixCode: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const bill = await getBillWithPatient(billId);
    if (!bill) {
      return { success: false, message: 'Fatura não encontrada' };
    }

    const patientInfo = await getPatientInfo(bill.patientId);
    if (!patientInfo) {
      return { success: false, message: 'Paciente não encontrado' };
    }

    const billInfo: BillInfo = {
      billNumber: bill.billNumber,
      patientName: patientInfo.name,
      totalAmount: bill.totalAmount,
      netAmount: bill.netAmount,
      pixCode,
    };

    await notifyBillPixPayment(patientInfo, billInfo);

    return { success: true, message: 'PIX enviado' };
  } catch (error) {
    console.error('[Billing Workflow] Erro ao enviar PIX:', error);
    return { success: false, message: 'Erro ao enviar PIX' };
  }
}

// ============================================================================
// Workflow: Cancelar Fatura
// ============================================================================

/**
 * Cancela fatura
 * - Verifica se não há pagamentos
 * - Atualiza status
 */
export async function cancelBill(
  billId: string,
  reason?: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const bill = await getBillWithPatient(billId);
    if (!bill) {
      return { success: false, message: 'Fatura não encontrada' };
    }

    if (bill.status === 'paid') {
      return { success: false, message: 'Não é possível cancelar fatura já paga' };
    }

    // Verificar se há pagamentos parciais
    const paidAmount = await calculatePaidAmount(billId);
    if (paidAmount > 0) {
      return {
        success: false,
        message: `Fatura possui R$ ${(paidAmount / 100).toFixed(2)} em pagamentos - estorne primeiro`,
      };
    }

    // Atualizar status
    await db.update(schema.bills)
      .set({
        status: 'cancelled',
        notes: reason ? `[CANCELADO] ${reason}` : '[CANCELADO]',
      })
      .where(eq(schema.bills.id, billId));

    return { success: true, message: 'Fatura cancelada' };
  } catch (error) {
    console.error('[Billing Workflow] Erro ao cancelar fatura:', error);
    return { success: false, message: 'Erro ao cancelar fatura' };
  }
}

// ============================================================================
// Workflow: Gerar Relatório de Faturas Pendentes
// ============================================================================

/**
 * Lista faturas pendentes para cobrança
 */
export async function getPendingBills(): Promise<Array<{
  id: string;
  billNumber: string;
  patientName: string;
  patientPhone: string;
  netAmount: number;
  createdAt: Date;
  status: string;
}>> {
  const bills = await db.select({
    id: schema.bills.id,
    billNumber: schema.bills.billNumber,
    patientName: schema.patients.name,
    patientPhone: schema.patients.phone,
    netAmount: schema.bills.netAmount,
    createdAt: schema.bills.createdAt,
    status: schema.bills.status,
  })
    .from(schema.bills)
    .innerJoin(schema.patients, eq(schema.bills.patientId, schema.patients.id))
    .where(
      and(
        eq(schema.bills.status, 'pending'),
      ),
    );

  return bills.map(b => ({
    id: b.id,
    billNumber: b.billNumber,
    patientName: b.patientName || 'Sem nome',
    patientPhone: b.patientPhone,
    netAmount: b.netAmount,
    createdAt: b.createdAt!,
    status: b.status,
  }));
}

// ============================================================================
// Workflow: Processar Webhook Asaas
// ============================================================================

/**
 * Processa eventos de pagamento do Asaas
 */
export async function processAsaasWebhook(
  event: string,
  payment: {
    id: string;
    status: string;
    value: number;
    billingType: string;
    confirmedDate?: string;
  },
): Promise<{ success: boolean; message: string }> {
  try {
    // Buscar fatura pelo asaasPaymentId (se tivéssemos armazenado)
    // Por enquanto, apenas logamos o evento

    console.log('[Billing Workflow] Webhook Asaas:', event, payment);

    switch (event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        // Pagamento confirmado - registrar transação
        // TODO: Buscar fatura e chamar processPayment
        break;

      case 'PAYMENT_OVERDUE':
        // Pagamento vencido - enviar lembrete
        // TODO: Buscar fatura e chamar sendPaymentReminder
        break;

      case 'PAYMENT_REFUNDED':
        // Pagamento estornado
        // TODO: Reverter transação
        break;
    }

    return { success: true, message: 'Webhook processado' };
  } catch (error) {
    console.error('[Billing Workflow] Erro no webhook:', error);
    return { success: false, message: 'Erro ao processar webhook' };
  }
}
