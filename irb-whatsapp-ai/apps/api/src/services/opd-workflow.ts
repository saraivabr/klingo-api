/**
 * Serviço de Workflow OPD (Consultas Ambulatoriais)
 * 
 * Jornada completa:
 * 1. Check-in do paciente (manual ou via webhook Klingo)
 * 2. Criação da visita OPD
 * 3. Registro de sinais vitais
 * 4. Atendimento médico (diagnóstico, prescrição)
 * 5. Solicitação de exames (Lab)
 * 6. Geração de fatura (Billing)
 * 7. Notificações WhatsApp em cada etapa
 */

import { db, schema } from '@irb/database';
import { eq, and, desc } from 'drizzle-orm';
import { getKlingoExternalClient } from './klingo-external-client.js';
import {
  notifyOPDCheckin,
  notifyOPDCalled,
  notifyOPDCompleted,
  notifyLabOrderCreated,
  notifyBillCreated,
  notifyPrescriptionCreated,
} from './whatsapp-notifications.js';
import type {
  NotificationRecipient,
  AppointmentInfo,
  LabOrderInfo,
  BillInfo,
  PrescriptionInfo,
} from './whatsapp-notifications.js';

// ============================================================================
// Types
// ============================================================================

export interface CheckinResult {
  success: boolean;
  opdVisitId?: string;
  message: string;
  klingoCheckinDone?: boolean;
}

export interface StartConsultationResult {
  success: boolean;
  opdVisitId: string;
  message: string;
}

export interface CompleteConsultationResult {
  success: boolean;
  opdVisitId: string;
  billId?: string;
  labOrderId?: string;
  prescriptionId?: string;
  message: string;
}

export interface CreateLabOrderParams {
  opdVisitId: string;
  patientId: string;
  doctorId: string;
  testIds: string[];
  priority?: 'normal' | 'urgent';
  notes?: string;
}

export interface CreateBillParams {
  opdVisitId: string;
  patientId: string;
  items: Array<{
    chargeId: string;
    quantity?: number;
    description?: string;
  }>;
  discountPercent?: number;
  notes?: string;
  createdBy?: string;
}

export interface CreatePrescriptionParams {
  opdVisitId: string;
  patientId: string;
  doctorId: string;
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions?: string;
  }>;
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

async function getDoctorInfo(doctorId: string): Promise<{ name: string; specialty?: string } | null> {
  const [doctor] = await db.select({
    name: schema.doctors.name,
    specialty: schema.doctors.specialty,
  })
    .from(schema.doctors)
    .where(eq(schema.doctors.id, doctorId))
    .limit(1);

  if (!doctor) return null;

  return {
    name: doctor.name,
    specialty: doctor.specialty || undefined,
  };
}

async function getAppointmentInfo(appointmentId: string): Promise<AppointmentInfo | null> {
  const [appointment] = await db.select({
    scheduledAt: schema.appointments.scheduledAt,
    doctorName: schema.doctors.name,
    specialty: schema.doctors.specialty,
  })
    .from(schema.appointments)
    .leftJoin(schema.doctors, eq(schema.appointments.doctorId, schema.doctors.id))
    .where(eq(schema.appointments.id, appointmentId))
    .limit(1);

  if (!appointment) return null;

  const date = new Date(appointment.scheduledAt);
  return {
    date: date.toISOString().split('T')[0],
    time: date.toTimeString().slice(0, 5),
    doctorName: appointment.doctorName || 'Médico',
    specialty: appointment.specialty || undefined,
    location: 'IRB Prime Care',
  };
}

// ============================================================================
// Workflow: Check-in
// ============================================================================

/**
 * Realiza check-in do paciente
 * - Cria visita OPD se não existir
 * - Sincroniza com Klingo
 * - Notifica paciente via WhatsApp
 */
export async function performCheckin(
  appointmentId: string,
  patientId: string,
): Promise<CheckinResult> {
  try {
    // 1. Buscar appointment
    const [appointment] = await db.select()
      .from(schema.appointments)
      .where(eq(schema.appointments.id, appointmentId))
      .limit(1);

    if (!appointment) {
      return { success: false, message: 'Agendamento não encontrado' };
    }

    // 2. Verificar se já existe visita OPD para este appointment
    const existingVisits = await db.select()
      .from(schema.opdVisits)
      .where(eq(schema.opdVisits.appointmentId, appointmentId))
      .limit(1);

    let opdVisitId: string;

    if (existingVisits.length > 0) {
      opdVisitId = existingVisits[0].id;
    } else {
      // 3. Criar nova visita OPD
      const today = new Date().toISOString().split('T')[0];
      const [newVisit] = await db.insert(schema.opdVisits).values({
        patientId,
        doctorId: appointment.doctorId!,
        appointmentId,
        visitDate: today,
        status: 'waiting',
      }).returning();

      opdVisitId = newVisit.id;

      // 4. Adicionar entrada na timeline
      await db.insert(schema.opdTimelines).values({
        opdVisitId,
        title: 'Check-in realizado',
        description: 'Paciente realizou check-in e aguarda atendimento',
        date: new Date(),
      });
    }

    // 5. Atualizar status do appointment
    await db.update(schema.appointments)
      .set({ status: 'checked_in' })
      .where(eq(schema.appointments.id, appointmentId));

    // 6. Sincronizar com Klingo (se configurado)
    let klingoCheckinDone = false;
    const klingoClient = getKlingoExternalClient();
    
    if (klingoClient && appointment.klingoVoucherId) {
      try {
        // Buscar klingoPatientId
        const [patient] = await db.select()
          .from(schema.patients)
          .where(eq(schema.patients.id, patientId))
          .limit(1);

        if (patient?.klingoPatientId) {
          await klingoClient.checkin(patient.klingoPatientId, {
            id: appointment.klingoVoucherId,
          });
          klingoCheckinDone = true;
        }
      } catch (err) {
        console.error('[OPD Workflow] Erro no check-in Klingo:', err);
        // Não falha a operação local se Klingo der erro
      }
    }

    // 7. Notificar paciente via WhatsApp
    const patientInfo = await getPatientInfo(patientId);
    const appointmentInfo = await getAppointmentInfo(appointmentId);

    if (patientInfo && appointmentInfo) {
      try {
        await notifyOPDCheckin(patientInfo, appointmentInfo);
      } catch (err) {
        console.error('[OPD Workflow] Erro ao enviar notificação de check-in:', err);
      }
    }

    return {
      success: true,
      opdVisitId,
      message: 'Check-in realizado com sucesso',
      klingoCheckinDone,
    };
  } catch (error) {
    console.error('[OPD Workflow] Erro no check-in:', error);
    return { success: false, message: 'Erro ao realizar check-in' };
  }
}

// ============================================================================
// Workflow: Chamar Paciente
// ============================================================================

/**
 * Chama o paciente para atendimento
 * - Atualiza status da visita para in_progress
 * - Notifica paciente via WhatsApp
 */
export async function callPatient(
  opdVisitId: string,
  roomNumber?: string,
): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Buscar visita
    const [visit] = await db.select({
      id: schema.opdVisits.id,
      patientId: schema.opdVisits.patientId,
      doctorId: schema.opdVisits.doctorId,
      status: schema.opdVisits.status,
    })
      .from(schema.opdVisits)
      .where(eq(schema.opdVisits.id, opdVisitId))
      .limit(1);

    if (!visit) {
      return { success: false, message: 'Visita não encontrada' };
    }

    if (visit.status !== 'waiting') {
      return { success: false, message: 'Paciente não está aguardando' };
    }

    // 2. Atualizar status
    await db.update(schema.opdVisits)
      .set({ status: 'in_progress' })
      .where(eq(schema.opdVisits.id, opdVisitId));

    // 3. Adicionar entrada na timeline
    await db.insert(schema.opdTimelines).values({
      opdVisitId,
      title: 'Paciente chamado',
      description: roomNumber ? `Chamado para sala ${roomNumber}` : 'Chamado para atendimento',
      date: new Date(),
    });

    // 4. Notificar paciente via WhatsApp
    const patientInfo = await getPatientInfo(visit.patientId);
    const doctorInfo = await getDoctorInfo(visit.doctorId);

    if (patientInfo && doctorInfo) {
      try {
        await notifyOPDCalled(patientInfo, doctorInfo.name, roomNumber);
      } catch (err) {
        console.error('[OPD Workflow] Erro ao enviar notificação de chamada:', err);
      }
    }

    return { success: true, message: 'Paciente notificado' };
  } catch (error) {
    console.error('[OPD Workflow] Erro ao chamar paciente:', error);
    return { success: false, message: 'Erro ao chamar paciente' };
  }
}

// ============================================================================
// Workflow: Registrar Sinais Vitais
// ============================================================================

/**
 * Registra sinais vitais do paciente
 */
export async function recordVitals(
  opdVisitId: string,
  vitals: {
    height?: number;
    weight?: number;
    bloodPressure?: string;
    pulse?: number;
    temperature?: number;
    respirationRate?: number;
  },
): Promise<{ success: boolean; vitalId?: string; message: string }> {
  try {
    const [newVital] = await db.insert(schema.opdVitals).values({
      opdVisitId,
      height: vitals.height || null,
      weight: vitals.weight || null,
      bloodPressure: vitals.bloodPressure || null,
      pulse: vitals.pulse || null,
      temperature: vitals.temperature || null,
      respirationRate: vitals.respirationRate || null,
      recordedAt: new Date(),
    }).returning();

    // Adicionar entrada na timeline
    await db.insert(schema.opdTimelines).values({
      opdVisitId,
      title: 'Sinais vitais registrados',
      description: `PA: ${vitals.bloodPressure || '-'}, Pulso: ${vitals.pulse || '-'}, Temp: ${vitals.temperature ? vitals.temperature / 10 + '°C' : '-'}`,
      date: new Date(),
    });

    return { success: true, vitalId: newVital.id, message: 'Sinais vitais registrados' };
  } catch (error) {
    console.error('[OPD Workflow] Erro ao registrar sinais vitais:', error);
    return { success: false, message: 'Erro ao registrar sinais vitais' };
  }
}

// ============================================================================
// Workflow: Solicitar Exames de Laboratório
// ============================================================================

/**
 * Cria pedido de exames integrado com Lab
 * - Cria lab order
 * - Adiciona itens
 * - Notifica paciente
 */
export async function createLabOrder(params: CreateLabOrderParams): Promise<{
  success: boolean;
  labOrderId?: string;
  orderNumber?: string;
  message: string;
}> {
  try {
    const { opdVisitId, patientId, doctorId, testIds, priority = 'normal', notes } = params;

    // 1. Buscar nomes dos testes
    const tests = await db.select({
      id: schema.labTests.id,
      name: schema.labTests.name,
      turnaroundHours: schema.labTests.turnaroundHours,
    })
      .from(schema.labTests)
      .where(eq(schema.labTests.isActive, true));

    const selectedTests = tests.filter(t => testIds.includes(t.id));

    if (selectedTests.length === 0) {
      return { success: false, message: 'Nenhum exame válido selecionado' };
    }

    // 2. Criar pedido
    const orderNumber = `LAB-${Date.now()}`;
    
    const [order] = await db.insert(schema.labOrders).values({
      patientId,
      doctorId,
      opdVisitId,
      orderNumber,
      priority,
      notes,
      status: 'ordered',
      orderedAt: new Date(),
    }).returning();

    // 3. Criar itens
    await db.insert(schema.labOrderItems).values(
      testIds.map(testId => ({
        labOrderId: order.id,
        labTestId: testId,
        status: 'pending',
      })),
    );

    // 4. Adicionar entrada na timeline da visita
    await db.insert(schema.opdTimelines).values({
      opdVisitId,
      title: 'Exames solicitados',
      description: `${selectedTests.length} exame(s): ${selectedTests.map(t => t.name).join(', ')}`,
      date: new Date(),
    });

    // 5. Calcular previsão (maior turnaround entre os testes)
    const maxTurnaround = Math.max(...selectedTests.map(t => t.turnaroundHours || 24));
    const estimatedDate = new Date();
    estimatedDate.setHours(estimatedDate.getHours() + maxTurnaround);

    // 6. Notificar paciente
    const patientInfo = await getPatientInfo(patientId);

    if (patientInfo) {
      const labOrderInfo: LabOrderInfo = {
        orderNumber,
        patientName: patientInfo.name,
        tests: selectedTests.map(t => t.name),
        estimatedDate: estimatedDate.toISOString().split('T')[0],
      };

      try {
        await notifyLabOrderCreated(patientInfo, labOrderInfo);
      } catch (err) {
        console.error('[OPD Workflow] Erro ao enviar notificação de lab:', err);
      }
    }

    return {
      success: true,
      labOrderId: order.id,
      orderNumber,
      message: `Pedido ${orderNumber} criado com ${selectedTests.length} exame(s)`,
    };
  } catch (error) {
    console.error('[OPD Workflow] Erro ao criar pedido de exames:', error);
    return { success: false, message: 'Erro ao criar pedido de exames' };
  }
}

// ============================================================================
// Workflow: Gerar Fatura
// ============================================================================

/**
 * Gera fatura para a consulta
 * - Calcula valores dos itens
 * - Cria bill e items
 * - Notifica paciente
 */
export async function createBill(params: CreateBillParams): Promise<{
  success: boolean;
  billId?: string;
  billNumber?: string;
  netAmount?: number;
  message: string;
}> {
  try {
    const { opdVisitId, patientId, items, discountPercent = 0, notes, createdBy } = params;

    // 1. Buscar charges e calcular total
    let totalAmount = 0;
    const billItems: Array<{
      chargeId: string;
      chargeName: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }> = [];

    for (const item of items) {
      const [charge] = await db.select()
        .from(schema.charges)
        .where(eq(schema.charges.id, item.chargeId))
        .limit(1);

      if (!charge) continue;

      const quantity = item.quantity || 1;
      const unitPrice = charge.standardCharge;
      const totalPrice = unitPrice * quantity;

      billItems.push({
        chargeId: item.chargeId,
        chargeName: charge.name,
        quantity,
        unitPrice,
        totalPrice,
      });

      totalAmount += totalPrice;
    }

    if (billItems.length === 0) {
      return { success: false, message: 'Nenhum item válido para fatura' };
    }

    const netAmount = Math.round(totalAmount * (1 - discountPercent / 100));
    const billNumber = `BILL-${Date.now()}`;

    // 2. Criar bill
    const [bill] = await db.insert(schema.bills).values({
      patientId,
      opdVisitId,
      billNumber,
      totalAmount,
      discountPercent,
      netAmount,
      status: 'pending',
      notes,
      createdBy,
    }).returning();

    // 3. Criar bill items
    for (const item of billItems) {
      await db.insert(schema.billItems).values({
        billId: bill.id,
        chargeId: item.chargeId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      });
    }

    // 4. Adicionar entrada na timeline
    await db.insert(schema.opdTimelines).values({
      opdVisitId,
      title: 'Fatura gerada',
      description: `Fatura ${billNumber} - R$ ${(netAmount / 100).toFixed(2)}`,
      date: new Date(),
    });

    // 5. Notificar paciente
    const patientInfo = await getPatientInfo(patientId);

    if (patientInfo) {
      const billInfo: BillInfo = {
        billNumber,
        patientName: patientInfo.name,
        totalAmount,
        netAmount,
      };

      try {
        await notifyBillCreated(patientInfo, billInfo);
      } catch (err) {
        console.error('[OPD Workflow] Erro ao enviar notificação de fatura:', err);
      }
    }

    return {
      success: true,
      billId: bill.id,
      billNumber,
      netAmount,
      message: `Fatura ${billNumber} criada`,
    };
  } catch (error) {
    console.error('[OPD Workflow] Erro ao criar fatura:', error);
    return { success: false, message: 'Erro ao criar fatura' };
  }
}

// ============================================================================
// Workflow: Criar Prescrição
// ============================================================================

/**
 * Cria prescrição médica
 * - Salva no banco
 * - Notifica paciente com PDF
 */
export async function createPrescription(params: CreatePrescriptionParams): Promise<{
  success: boolean;
  prescriptionId?: string;
  message: string;
}> {
  try {
    const { opdVisitId, patientId, doctorId, medications } = params;

    // 1. Criar prescrição
    const [prescription] = await db.insert(schema.prescriptions).values({
      patientId,
      doctorId,
      type: 'medication',
      content: { medications },
    }).returning();

    // 2. Adicionar entrada na timeline
    await db.insert(schema.opdTimelines).values({
      opdVisitId,
      title: 'Receita emitida',
      description: `${medications.length} medicamento(s) prescrito(s)`,
      date: new Date(),
    });

    // 3. Notificar paciente
    const patientInfo = await getPatientInfo(patientId);
    const doctorInfo = await getDoctorInfo(doctorId);

    if (patientInfo && doctorInfo) {
      const prescriptionInfo: PrescriptionInfo = {
        doctorName: doctorInfo.name,
        patientName: patientInfo.name,
        medications: medications.map(m => ({
          name: m.name,
          dosage: m.dosage,
          instructions: `${m.frequency}, por ${m.duration}. ${m.instructions || ''}`.trim(),
        })),
        // TODO: Gerar PDF e incluir URL
      };

      try {
        await notifyPrescriptionCreated(patientInfo, prescriptionInfo);
      } catch (err) {
        console.error('[OPD Workflow] Erro ao enviar notificação de prescrição:', err);
      }
    }

    return {
      success: true,
      prescriptionId: prescription.id,
      message: 'Prescrição criada com sucesso',
    };
  } catch (error) {
    console.error('[OPD Workflow] Erro ao criar prescrição:', error);
    return { success: false, message: 'Erro ao criar prescrição' };
  }
}

// ============================================================================
// Workflow: Finalizar Consulta
// ============================================================================

/**
 * Finaliza a consulta
 * - Atualiza status para completed
 * - Notifica paciente com resumo
 */
export async function completeConsultation(
  opdVisitId: string,
): Promise<CompleteConsultationResult> {
  try {
    // 1. Buscar visita com dados relacionados
    const [visit] = await db.select()
      .from(schema.opdVisits)
      .where(eq(schema.opdVisits.id, opdVisitId))
      .limit(1);

    if (!visit) {
      return { success: false, opdVisitId, message: 'Visita não encontrada' };
    }

    // 2. Verificar se há exames, prescrições e faturas
    const labOrders = await db.select()
      .from(schema.labOrders)
      .where(eq(schema.labOrders.opdVisitId, opdVisitId));

    const bills = await db.select()
      .from(schema.bills)
      .where(eq(schema.bills.opdVisitId, opdVisitId));

    // Verificar prescrições pela timeline (ou outra forma)
    const timeline = await db.select()
      .from(schema.opdTimelines)
      .where(eq(schema.opdTimelines.opdVisitId, opdVisitId));

    const hasPrescription = timeline.some(t => t.title === 'Receita emitida');

    // 3. Atualizar status
    await db.update(schema.opdVisits)
      .set({ status: 'completed' })
      .where(eq(schema.opdVisits.id, opdVisitId));

    // 4. Adicionar entrada na timeline
    await db.insert(schema.opdTimelines).values({
      opdVisitId,
      title: 'Consulta finalizada',
      description: 'Atendimento concluído com sucesso',
      date: new Date(),
    });

    // 5. Notificar paciente
    const patientInfo = await getPatientInfo(visit.patientId);
    const doctorInfo = await getDoctorInfo(visit.doctorId);

    if (patientInfo && doctorInfo) {
      try {
        await notifyOPDCompleted(
          patientInfo,
          doctorInfo.name,
          labOrders.length > 0,
          hasPrescription,
          bills.length > 0,
        );
      } catch (err) {
        console.error('[OPD Workflow] Erro ao enviar notificação de conclusão:', err);
      }
    }

    return {
      success: true,
      opdVisitId,
      billId: bills[0]?.id,
      labOrderId: labOrders[0]?.id,
      message: 'Consulta finalizada com sucesso',
    };
  } catch (error) {
    console.error('[OPD Workflow] Erro ao finalizar consulta:', error);
    return { success: false, opdVisitId, message: 'Erro ao finalizar consulta' };
  }
}

// ============================================================================
// Workflow: Criar Visita OPD Direta (Walk-in)
// ============================================================================

/**
 * Cria visita OPD para paciente walk-in (sem agendamento prévio)
 */
export async function createWalkInVisit(
  patientId: string,
  doctorId: string,
  symptoms?: string,
): Promise<{ success: boolean; opdVisitId?: string; message: string }> {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [visit] = await db.insert(schema.opdVisits).values({
      patientId,
      doctorId,
      visitDate: today,
      symptoms,
      status: 'waiting',
    }).returning();

    // Adicionar entrada na timeline
    await db.insert(schema.opdTimelines).values({
      opdVisitId: visit.id,
      title: 'Paciente registrado',
      description: 'Paciente walk-in aguardando atendimento',
      date: new Date(),
    });

    return {
      success: true,
      opdVisitId: visit.id,
      message: 'Visita criada com sucesso',
    };
  } catch (error) {
    console.error('[OPD Workflow] Erro ao criar visita walk-in:', error);
    return { success: false, message: 'Erro ao criar visita' };
  }
}
