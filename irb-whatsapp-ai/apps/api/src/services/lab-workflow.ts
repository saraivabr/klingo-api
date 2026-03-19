/**
 * Serviço de Workflow do Laboratório
 * 
 * Jornada completa:
 * 1. Pedido de exames (via OPD ou direto)
 * 2. Coleta de amostras
 * 3. Processamento
 * 4. Entrada de resultados
 * 5. Geração de laudo PDF
 * 6. Notificação ao paciente via WhatsApp
 * 7. Integração com Klingo (resultados)
 */

import { db, schema } from '@irb/database';
import { eq, and, inArray } from 'drizzle-orm';
import { getKlingoExternalClient } from './klingo-external-client.js';
import { generateLabReportPDF } from './lab-report-generator.js';
import {
  notifyLabSampleCollected,
  notifyLabResultsReady,
} from './whatsapp-notifications.js';
import type { NotificationRecipient } from './whatsapp-notifications.js';

// ============================================================================
// Types
// ============================================================================

export interface CollectSamplesResult {
  success: boolean;
  collectedCount: number;
  allCollected: boolean;
  message: string;
}

export interface EnterResultsParams {
  labOrderItemId: string;
  results: Array<{
    parameterId?: string;
    value: string;
    isAbnormal?: boolean;
    notes?: string;
  }>;
  enteredBy: string;
}

export interface EnterResultsResult {
  success: boolean;
  resultsCount: number;
  allComplete: boolean;
  message: string;
}

export interface CompleteOrderResult {
  success: boolean;
  pdfUrl?: string;
  notificationSent: boolean;
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

async function getOrderWithItems(orderId: string) {
  const [order] = await db.select()
    .from(schema.labOrders)
    .where(eq(schema.labOrders.id, orderId))
    .limit(1);

  if (!order) return null;

  const items = await db.select()
    .from(schema.labOrderItems)
    .where(eq(schema.labOrderItems.labOrderId, orderId));

  return { order, items };
}

// ============================================================================
// Workflow: Coletar Amostras
// ============================================================================

/**
 * Registra coleta de amostras
 * - Atualiza status dos itens
 * - Atualiza status do pedido se todos coletados
 * - Notifica paciente
 */
export async function collectSamples(
  orderId: string,
  itemIds: string[],
): Promise<CollectSamplesResult> {
  try {
    // 1. Buscar pedido
    const orderData = await getOrderWithItems(orderId);
    if (!orderData) {
      return { success: false, collectedCount: 0, allCollected: false, message: 'Pedido não encontrado' };
    }

    const { order, items } = orderData;

    // 2. Validar itemIds
    const validItemIds = items.filter(i => itemIds.includes(i.id)).map(i => i.id);

    if (validItemIds.length === 0) {
      return { success: false, collectedCount: 0, allCollected: false, message: 'Nenhum item válido para coleta' };
    }

    // 3. Atualizar itens
    const now = new Date();
    await db.update(schema.labOrderItems)
      .set({
        status: 'collected',
        sampleCollectedAt: now,
      })
      .where(inArray(schema.labOrderItems.id, validItemIds));

    // 4. Verificar se todos foram coletados
    const updatedItems = await db.select()
      .from(schema.labOrderItems)
      .where(eq(schema.labOrderItems.labOrderId, orderId));

    const allCollected = updatedItems.every(
      item => item.status === 'collected' || item.status === 'processing' || item.status === 'completed'
    );

    // 5. Atualizar status do pedido
    if (allCollected) {
      await db.update(schema.labOrders)
        .set({ status: 'collected' })
        .where(eq(schema.labOrders.id, orderId));
    }

    // 6. Calcular tempo estimado
    const testIds = items.map(i => i.labTestId);
    const tests = await db.select({ turnaroundHours: schema.labTests.turnaroundHours })
      .from(schema.labTests)
      .where(inArray(schema.labTests.id, testIds));

    const maxHours = Math.max(...tests.map(t => t.turnaroundHours || 24));

    // 7. Notificar paciente
    const patientInfo = await getPatientInfo(order.patientId);

    if (patientInfo && allCollected) {
      try {
        await notifyLabSampleCollected(patientInfo, order.orderNumber, maxHours);
      } catch (err) {
        console.error('[Lab Workflow] Erro ao enviar notificação de coleta:', err);
      }
    }

    return {
      success: true,
      collectedCount: validItemIds.length,
      allCollected,
      message: allCollected
        ? 'Todas as amostras coletadas'
        : `${validItemIds.length} amostra(s) coletada(s)`,
    };
  } catch (error) {
    console.error('[Lab Workflow] Erro ao coletar amostras:', error);
    return { success: false, collectedCount: 0, allCollected: false, message: 'Erro ao coletar amostras' };
  }
}

// ============================================================================
// Workflow: Iniciar Processamento
// ============================================================================

/**
 * Marca itens como em processamento
 */
export async function startProcessing(
  orderId: string,
  itemIds?: string[],
): Promise<{ success: boolean; message: string }> {
  try {
    const orderData = await getOrderWithItems(orderId);
    if (!orderData) {
      return { success: false, message: 'Pedido não encontrado' };
    }

    const { items } = orderData;

    // Filtrar itens coletados que podem entrar em processamento
    const eligibleItems = items.filter(i => 
      i.status === 'collected' && (!itemIds || itemIds.includes(i.id))
    );

    if (eligibleItems.length === 0) {
      return { success: false, message: 'Nenhum item elegível para processamento' };
    }

    // Atualizar status
    await db.update(schema.labOrderItems)
      .set({ status: 'processing' })
      .where(inArray(schema.labOrderItems.id, eligibleItems.map(i => i.id)));

    // Atualizar status do pedido
    await db.update(schema.labOrders)
      .set({ status: 'processing' })
      .where(eq(schema.labOrders.id, orderId));

    return {
      success: true,
      message: `${eligibleItems.length} item(ns) em processamento`,
    };
  } catch (error) {
    console.error('[Lab Workflow] Erro ao iniciar processamento:', error);
    return { success: false, message: 'Erro ao iniciar processamento' };
  }
}

// ============================================================================
// Workflow: Registrar Resultados
// ============================================================================

/**
 * Registra resultados de um exame
 * - Insere valores dos parâmetros
 * - Marca item como completo
 * - Verifica se pedido está completo
 */
export async function enterResults(params: EnterResultsParams): Promise<EnterResultsResult> {
  try {
    const { labOrderItemId, results, enteredBy } = params;

    // 1. Buscar item
    const [item] = await db.select()
      .from(schema.labOrderItems)
      .where(eq(schema.labOrderItems.id, labOrderItemId))
      .limit(1);

    if (!item) {
      return { success: false, resultsCount: 0, allComplete: false, message: 'Item não encontrado' };
    }

    // 2. Inserir resultados
    const now = new Date();
    const insertedResults = await db.insert(schema.labResults).values(
      results.map(r => ({
        labOrderItemId,
        parameterId: r.parameterId || null,
        value: r.value,
        isAbnormal: r.isAbnormal || false,
        notes: r.notes || null,
        enteredBy,
        enteredAt: now,
      })),
    ).returning();

    // 3. Atualizar status do item
    await db.update(schema.labOrderItems)
      .set({
        status: 'completed',
        resultEnteredAt: now,
      })
      .where(eq(schema.labOrderItems.id, labOrderItemId));

    // 4. Verificar se todos os itens do pedido estão completos
    const allItems = await db.select()
      .from(schema.labOrderItems)
      .where(eq(schema.labOrderItems.labOrderId, item.labOrderId));

    const allComplete = allItems.every(i => 
      i.id === labOrderItemId || i.status === 'completed'
    );

    return {
      success: true,
      resultsCount: insertedResults.length,
      allComplete,
      message: allComplete
        ? 'Todos os resultados registrados - pedido pronto para finalização'
        : `${insertedResults.length} resultado(s) registrado(s)`,
    };
  } catch (error) {
    console.error('[Lab Workflow] Erro ao registrar resultados:', error);
    return { success: false, resultsCount: 0, allComplete: false, message: 'Erro ao registrar resultados' };
  }
}

// ============================================================================
// Workflow: Finalizar Pedido
// ============================================================================

/**
 * Finaliza pedido de exames
 * - Gera laudo PDF
 * - Notifica paciente via WhatsApp
 * - Opcionalmente sincroniza com Klingo
 */
export async function completeOrder(
  orderId: string,
  options?: { skipNotification?: boolean },
): Promise<CompleteOrderResult> {
  try {
    // 1. Buscar pedido com todos os dados
    const orderData = await getOrderWithItems(orderId);
    if (!orderData) {
      return { success: false, notificationSent: false, message: 'Pedido não encontrado' };
    }

    const { order, items } = orderData;

    // 2. Verificar se todos os itens estão completos
    const pendingItems = items.filter(i => i.status !== 'completed');
    if (pendingItems.length > 0) {
      return {
        success: false,
        notificationSent: false,
        message: `${pendingItems.length} item(ns) ainda pendente(s)`,
      };
    }

    // 3. Atualizar status do pedido
    await db.update(schema.labOrders)
      .set({ status: 'completed' })
      .where(eq(schema.labOrders.id, orderId));

    // 4. Gerar laudo PDF
    let pdfUrl: string | undefined;

    try {
      // Buscar dados completos para o relatório
      const patient = await db.select()
        .from(schema.patients)
        .where(eq(schema.patients.id, order.patientId))
        .limit(1);

      const doctor = order.doctorId
        ? await db.select().from(schema.doctors).where(eq(schema.doctors.id, order.doctorId)).limit(1)
        : [];

      const itemsWithDetails = await Promise.all(
        items.map(async (item) => {
          const [test] = await db.select().from(schema.labTests).where(eq(schema.labTests.id, item.labTestId));
          const results = await db.select().from(schema.labResults).where(eq(schema.labResults.labOrderItemId, item.id));

          const resultsWithParams = await Promise.all(
            results.map(async (result) => {
              const param = result.parameterId
                ? (await db.select().from(schema.labParameters).where(eq(schema.labParameters.id, result.parameterId)))[0]
                : null;
              return { ...result, parameter: param };
            }),
          );

          return { ...item, test, results: resultsWithParams };
        }),
      );

      const reportData = {
        order,
        items: itemsWithDetails,
        patient: patient[0],
        doctor: doctor[0],
      };

      pdfUrl = await generateLabReportPDF(orderId, reportData);
    } catch (err) {
      console.error('[Lab Workflow] Erro ao gerar PDF:', err);
      // Continua mesmo se PDF falhar
    }

    // 5. Notificar paciente
    let notificationSent = false;

    if (!options?.skipNotification) {
      const patientInfo = await getPatientInfo(order.patientId);

      if (patientInfo) {
        try {
          await notifyLabResultsReady(patientInfo, order.orderNumber, pdfUrl);
          notificationSent = true;
        } catch (err) {
          console.error('[Lab Workflow] Erro ao enviar notificação:', err);
        }
      }
    }

    return {
      success: true,
      pdfUrl,
      notificationSent,
      message: 'Pedido finalizado com sucesso',
    };
  } catch (error) {
    console.error('[Lab Workflow] Erro ao finalizar pedido:', error);
    return { success: false, notificationSent: false, message: 'Erro ao finalizar pedido' };
  }
}

// ============================================================================
// Workflow: Cancelar Pedido
// ============================================================================

/**
 * Cancela pedido de exames
 */
export async function cancelOrder(
  orderId: string,
  reason?: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const [order] = await db.select()
      .from(schema.labOrders)
      .where(eq(schema.labOrders.id, orderId))
      .limit(1);

    if (!order) {
      return { success: false, message: 'Pedido não encontrado' };
    }

    if (order.status === 'completed') {
      return { success: false, message: 'Não é possível cancelar pedido já finalizado' };
    }

    // Atualizar status
    await db.update(schema.labOrders)
      .set({
        status: 'cancelled',
        notes: reason ? `${order.notes || ''}\n[CANCELADO] ${reason}`.trim() : order.notes,
      })
      .where(eq(schema.labOrders.id, orderId));

    // Cancelar itens pendentes
    await db.update(schema.labOrderItems)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(schema.labOrderItems.labOrderId, orderId),
          inArray(schema.labOrderItems.status, ['pending', 'collected', 'processing']),
        ),
      );

    return { success: true, message: 'Pedido cancelado' };
  } catch (error) {
    console.error('[Lab Workflow] Erro ao cancelar pedido:', error);
    return { success: false, message: 'Erro ao cancelar pedido' };
  }
}

// ============================================================================
// Workflow: Verificar Status de Exames (Klingo)
// ============================================================================

/**
 * Verifica se há resultados disponíveis na Klingo
 */
export async function checkKlingoResults(klingoExamId: number): Promise<{
  available: boolean;
  pdfUrl?: string;
}> {
  const klingoClient = getKlingoExternalClient();
  
  if (!klingoClient) {
    return { available: false };
  }

  try {
    const result = await klingoClient.getExamResult(klingoExamId);
    if (Array.isArray(result) && result.length > 0) {
      // Baixar PDF
      const pdfResponse = await klingoClient.getExamResultPdf(klingoExamId);
      if (pdfResponse?.pdf_base64) {
        // TODO: Salvar PDF e retornar URL
        return { available: true };
      }
    }

    return { available: false };
  } catch (err) {
    console.error('[Lab Workflow] Erro ao verificar Klingo:', err);
    return { available: false };
  }
}
