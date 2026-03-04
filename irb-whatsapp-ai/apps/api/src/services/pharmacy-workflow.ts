/**
 * Serviço de Workflow da Farmácia
 * 
 * Jornadas:
 * 1. Dispensação de receitas (integração com OPD)
 * 2. Venda direta (POS)
 * 3. Controle de estoque
 * 4. Alertas de estoque baixo
 * 5. Notificações ao paciente
 */

import { db, schema } from '@irb/database';
import { eq, and, lt, inArray, sql } from 'drizzle-orm';
import {
  notifyPrescriptionCreated,
  notifyPharmacySaleCompleted,
} from './whatsapp-notifications.js';
import type { NotificationRecipient, PrescriptionInfo } from './whatsapp-notifications.js';

// ============================================================================
// Types
// ============================================================================

export interface DispensePrescriptionParams {
  prescriptionId: string;
  patientId: string;
  items: Array<{
    medicineId: string;
    quantity: number;
    instructions?: string;
  }>;
  discountPercent?: number;
  paymentMethod?: string;
}

export interface DispensePrescriptionResult {
  success: boolean;
  saleId?: string;
  saleNumber?: string;
  totalAmount?: number;
  stockWarnings: string[];
  message: string;
}

export interface CreateSaleParams {
  patientId?: string;
  items: Array<{
    medicineId: string;
    quantity: number;
  }>;
  discountPercent?: number;
  paymentMethod?: string;
  soldBy?: string;
}

export interface CreateSaleResult {
  success: boolean;
  saleId?: string;
  saleNumber?: string;
  totalAmount?: number;
  netAmount?: number;
  stockWarnings: string[];
  message: string;
}

export interface StockAdjustmentParams {
  medicineId: string;
  adjustment: number; // positivo = entrada, negativo = saída
  reason: string;
  batchNumber?: string;
  expiryDate?: string;
}

export interface LowStockItem {
  id: string;
  name: string;
  currentQuantity: number;
  alertQuantity: number;
  deficit: number;
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

async function getMedicineInfo(medicineId: string) {
  const [medicine] = await db.select()
    .from(schema.medicines)
    .where(eq(schema.medicines.id, medicineId))
    .limit(1);

  return medicine;
}

async function checkStockAvailability(
  items: Array<{ medicineId: string; quantity: number }>,
): Promise<{
  available: boolean;
  unavailableItems: Array<{ name: string; requested: number; available: number }>;
}> {
  const unavailableItems: Array<{ name: string; requested: number; available: number }> = [];

  for (const item of items) {
    const medicine = await getMedicineInfo(item.medicineId);
    
    if (!medicine) {
      unavailableItems.push({
        name: `ID: ${item.medicineId}`,
        requested: item.quantity,
        available: 0,
      });
      continue;
    }

    if ((medicine.quantity || 0) < item.quantity) {
      unavailableItems.push({
        name: medicine.name,
        requested: item.quantity,
        available: medicine.quantity || 0,
      });
    }
  }

  return {
    available: unavailableItems.length === 0,
    unavailableItems,
  };
}

// ============================================================================
// Workflow: Dispensar Prescrição
// ============================================================================

/**
 * Dispensa medicamentos de uma prescrição
 * - Verifica estoque
 * - Cria venda
 * - Baixa estoque
 * - Notifica paciente
 */
export async function dispensePrescription(
  params: DispensePrescriptionParams,
): Promise<DispensePrescriptionResult> {
  const { prescriptionId, patientId, items, discountPercent = 0, paymentMethod = 'dinheiro' } = params;

  try {
    // 1. Verificar disponibilidade de estoque
    const stockCheck = await checkStockAvailability(items);

    if (!stockCheck.available) {
      const warnings = stockCheck.unavailableItems.map(
        i => `${i.name}: solicitado ${i.requested}, disponível ${i.available}`,
      );

      return {
        success: false,
        stockWarnings: warnings,
        message: 'Estoque insuficiente para alguns itens',
      };
    }

    // 2. Calcular valores
    let totalAmount = 0;
    const saleItems: Array<{
      medicineId: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      batchNumber: string | null;
      expiryDate: string | null;
    }> = [];

    for (const item of items) {
      const medicine = await getMedicineInfo(item.medicineId);
      if (!medicine) continue;

      const unitPrice = medicine.sellingPrice;
      const totalPrice = unitPrice * item.quantity;
      totalAmount += totalPrice;

      saleItems.push({
        medicineId: item.medicineId,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        batchNumber: medicine.batchNumber,
        expiryDate: medicine.expiryDate,
      });
    }

    const discountAmount = Math.round(totalAmount * discountPercent / 100);
    const netAmount = totalAmount - discountAmount;
    const saleNumber = `DISP-${Date.now()}`;

    // 3. Criar venda
    const [sale] = await db.insert(schema.medicineSales).values({
      patientId,
      saleNumber,
      totalAmount,
      discountPercent,
      netAmount,
      paymentMethod,
      status: 'completed',
      soldAt: new Date(),
    }).returning();

    // 4. Criar itens e baixar estoque
    const stockWarnings: string[] = [];

    for (const item of saleItems) {
      // Criar item da venda
      await db.insert(schema.medicineSaleItems).values({
        saleId: sale.id,
        medicineId: item.medicineId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
      });

      // Baixar estoque
      const medicine = await getMedicineInfo(item.medicineId);
      if (medicine) {
        const newQuantity = (medicine.quantity || 0) - item.quantity;

        await db.update(schema.medicines)
          .set({ quantity: newQuantity })
          .where(eq(schema.medicines.id, item.medicineId));

        // Verificar se ficou abaixo do alerta
        if (newQuantity <= (medicine.alertQuantity || 10)) {
          stockWarnings.push(
            `⚠️ ${medicine.name}: estoque baixo (${newQuantity} ${medicine.unit || 'un'})`,
          );
        }
      }
    }

    // 5. Atualizar prescrição como dispensada
    await db.update(schema.prescriptions)
      .set({
        sentViaWhatsapp: true, // Marcando como processada
      })
      .where(eq(schema.prescriptions.id, prescriptionId));

    // 6. Notificar paciente
    const patientInfo = await getPatientInfo(patientId);

    if (patientInfo) {
      try {
        await notifyPharmacySaleCompleted(patientInfo, saleNumber, netAmount);
      } catch (err) {
        console.error('[Pharmacy Workflow] Erro ao notificar:', err);
      }
    }

    return {
      success: true,
      saleId: sale.id,
      saleNumber,
      totalAmount: netAmount,
      stockWarnings,
      message: 'Prescrição dispensada com sucesso',
    };
  } catch (error) {
    console.error('[Pharmacy Workflow] Erro ao dispensar prescrição:', error);
    return {
      success: false,
      stockWarnings: [],
      message: 'Erro ao dispensar prescrição',
    };
  }
}

// ============================================================================
// Workflow: Criar Venda Direta (POS)
// ============================================================================

/**
 * Cria venda direta (sem prescrição)
 */
export async function createSale(params: CreateSaleParams): Promise<CreateSaleResult> {
  const { patientId, items, discountPercent = 0, paymentMethod = 'dinheiro', soldBy } = params;

  try {
    // 1. Verificar estoque
    const stockCheck = await checkStockAvailability(items);

    if (!stockCheck.available) {
      const warnings = stockCheck.unavailableItems.map(
        i => `${i.name}: solicitado ${i.requested}, disponível ${i.available}`,
      );

      return {
        success: false,
        stockWarnings: warnings,
        message: 'Estoque insuficiente',
      };
    }

    // 2. Calcular valores
    let totalAmount = 0;
    const saleItems: Array<{
      medicineId: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      batchNumber: string | null;
      expiryDate: string | null;
    }> = [];

    for (const item of items) {
      const medicine = await getMedicineInfo(item.medicineId);
      if (!medicine) continue;

      const unitPrice = medicine.sellingPrice;
      const totalPrice = unitPrice * item.quantity;
      totalAmount += totalPrice;

      saleItems.push({
        medicineId: item.medicineId,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        batchNumber: medicine.batchNumber,
        expiryDate: medicine.expiryDate,
      });
    }

    const netAmount = Math.round(totalAmount * (1 - discountPercent / 100));
    const saleNumber = `SALE-${Date.now()}`;

    // 3. Criar venda
    const [sale] = await db.insert(schema.medicineSales).values({
      patientId: patientId || null,
      saleNumber,
      totalAmount,
      discountPercent,
      netAmount,
      paymentMethod,
      status: 'completed',
      soldBy: soldBy || null,
      soldAt: new Date(),
    }).returning();

    // 4. Criar itens e baixar estoque
    const stockWarnings: string[] = [];

    for (const item of saleItems) {
      await db.insert(schema.medicineSaleItems).values({
        saleId: sale.id,
        medicineId: item.medicineId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
      });

      // Baixar estoque
      const medicine = await getMedicineInfo(item.medicineId);
      if (medicine) {
        const newQuantity = (medicine.quantity || 0) - item.quantity;

        await db.update(schema.medicines)
          .set({ quantity: newQuantity })
          .where(eq(schema.medicines.id, item.medicineId));

        if (newQuantity <= (medicine.alertQuantity || 10)) {
          stockWarnings.push(
            `⚠️ ${medicine.name}: estoque baixo (${newQuantity} ${medicine.unit || 'un'})`,
          );
        }
      }
    }

    // 5. Notificar paciente (se identificado)
    if (patientId) {
      const patientInfo = await getPatientInfo(patientId);
      if (patientInfo) {
        try {
          await notifyPharmacySaleCompleted(patientInfo, saleNumber, netAmount);
        } catch (err) {
          console.error('[Pharmacy Workflow] Erro ao notificar:', err);
        }
      }
    }

    return {
      success: true,
      saleId: sale.id,
      saleNumber,
      totalAmount,
      netAmount,
      stockWarnings,
      message: 'Venda realizada com sucesso',
    };
  } catch (error) {
    console.error('[Pharmacy Workflow] Erro ao criar venda:', error);
    return {
      success: false,
      stockWarnings: [],
      message: 'Erro ao criar venda',
    };
  }
}

// ============================================================================
// Workflow: Ajustar Estoque
// ============================================================================

/**
 * Ajusta estoque de um medicamento
 */
export async function adjustStock(
  params: StockAdjustmentParams,
): Promise<{ success: boolean; newQuantity?: number; message: string }> {
  const { medicineId, adjustment, reason, batchNumber, expiryDate } = params;

  try {
    const medicine = await getMedicineInfo(medicineId);
    if (!medicine) {
      return { success: false, message: 'Medicamento não encontrado' };
    }

    const currentQuantity = medicine.quantity || 0;
    const newQuantity = currentQuantity + adjustment;

    if (newQuantity < 0) {
      return {
        success: false,
        message: `Estoque insuficiente. Atual: ${currentQuantity}, ajuste: ${adjustment}`,
      };
    }

    // Atualizar quantidade
    const updates: Partial<typeof schema.medicines.$inferInsert> = {
      quantity: newQuantity,
    };

    // Atualizar lote e validade se entrada
    if (adjustment > 0) {
      if (batchNumber) updates.batchNumber = batchNumber;
      if (expiryDate) updates.expiryDate = expiryDate;
    }

    await db.update(schema.medicines)
      .set(updates)
      .where(eq(schema.medicines.id, medicineId));

    // TODO: Criar registro de movimentação de estoque para auditoria

    return {
      success: true,
      newQuantity,
      message: `Estoque ajustado: ${currentQuantity} → ${newQuantity} (${reason})`,
    };
  } catch (error) {
    console.error('[Pharmacy Workflow] Erro ao ajustar estoque:', error);
    return { success: false, message: 'Erro ao ajustar estoque' };
  }
}

// ============================================================================
// Workflow: Verificar Estoque Baixo
// ============================================================================

/**
 * Retorna medicamentos com estoque abaixo do alerta
 */
export async function getLowStockItems(): Promise<LowStockItem[]> {
  const medicines = await db.select({
    id: schema.medicines.id,
    name: schema.medicines.name,
    quantity: schema.medicines.quantity,
    alertQuantity: schema.medicines.alertQuantity,
  })
    .from(schema.medicines)
    .where(
      and(
        eq(schema.medicines.isActive, true),
        lt(schema.medicines.quantity, schema.medicines.alertQuantity),
      ),
    );

  return medicines.map(m => ({
    id: m.id,
    name: m.name,
    currentQuantity: m.quantity || 0,
    alertQuantity: m.alertQuantity || 10,
    deficit: (m.alertQuantity || 10) - (m.quantity || 0),
  }));
}

// ============================================================================
// Workflow: Verificar Medicamentos Vencendo
// ============================================================================

/**
 * Retorna medicamentos próximos do vencimento
 */
export async function getExpiringMedicines(
  daysAhead: number = 30,
): Promise<Array<{
  id: string;
  name: string;
  quantity: number;
  expiryDate: string;
  daysUntilExpiry: number;
}>> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

  const medicines = await db.select({
    id: schema.medicines.id,
    name: schema.medicines.name,
    quantity: schema.medicines.quantity,
    expiryDate: schema.medicines.expiryDate,
  })
    .from(schema.medicines)
    .where(
      and(
        eq(schema.medicines.isActive, true),
        lt(schema.medicines.expiryDate, cutoffDate.toISOString().split('T')[0]),
      ),
    );

  const today = new Date();

  return medicines
    .filter(m => m.expiryDate)
    .map(m => {
      const expiry = new Date(m.expiryDate!);
      const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      return {
        id: m.id,
        name: m.name,
        quantity: m.quantity || 0,
        expiryDate: m.expiryDate!,
        daysUntilExpiry,
      };
    })
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}

// ============================================================================
// Workflow: Buscar Prescrições Pendentes
// ============================================================================

/**
 * Busca prescrições que ainda não foram dispensadas
 */
export async function getPendingPrescriptions(): Promise<Array<{
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  doctorName: string;
  medications: any[];
  createdAt: Date;
}>> {
  const prescriptions = await db.select({
    id: schema.prescriptions.id,
    patientId: schema.prescriptions.patientId,
    patientName: schema.patients.name,
    patientPhone: schema.patients.phone,
    doctorId: schema.prescriptions.doctorId,
    content: schema.prescriptions.content,
    createdAt: schema.prescriptions.createdAt,
  })
    .from(schema.prescriptions)
    .innerJoin(schema.patients, eq(schema.prescriptions.patientId, schema.patients.id))
    .where(
      and(
        eq(schema.prescriptions.type, 'medication'),
        eq(schema.prescriptions.sentViaWhatsapp, false), // Usando como flag de "não dispensada"
      ),
    );

  // Buscar nomes dos médicos
  const results = await Promise.all(
    prescriptions.map(async (p) => {
      let doctorName = 'Médico';
      if (p.doctorId) {
        const [doctor] = await db.select({ name: schema.doctors.name })
          .from(schema.doctors)
          .where(eq(schema.doctors.id, p.doctorId))
          .limit(1);
        if (doctor) doctorName = doctor.name;
      }

      return {
        id: p.id,
        patientId: p.patientId!,
        patientName: p.patientName || 'Paciente',
        patientPhone: p.patientPhone,
        doctorName,
        medications: (p.content as any)?.medications || [],
        createdAt: p.createdAt!,
      };
    }),
  );

  return results;
}
