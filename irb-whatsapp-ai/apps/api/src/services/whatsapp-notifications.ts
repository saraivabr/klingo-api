/**
 * Serviço centralizado de notificações WhatsApp
 * Envia mensagens em cada etapa das jornadas HMS
 */

import { sendTextMessage, sendButtons, sendDocument } from './uazapi.js';

// ============================================================================
// Types
// ============================================================================

export interface NotificationRecipient {
  phone: string;
  name: string;
}

export interface AppointmentInfo {
  date: string;
  time: string;
  doctorName: string;
  specialty?: string;
  location?: string;
}

export interface LabOrderInfo {
  orderNumber: string;
  patientName: string;
  tests: string[];
  estimatedDate?: string;
}

export interface BillInfo {
  billNumber: string;
  patientName: string;
  totalAmount: number;
  netAmount: number;
  dueDate?: string;
  pixCode?: string;
  invoiceUrl?: string;
}

export interface PrescriptionInfo {
  doctorName: string;
  patientName: string;
  medications: Array<{ name: string; dosage: string; instructions: string }>;
  pdfUrl?: string;
}

// ============================================================================
// Formatters
// ============================================================================

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(time: string): string {
  return time.slice(0, 5); // HH:MM
}

// ============================================================================
// OPD / Consultas Notifications
// ============================================================================

/**
 * Notificar paciente sobre check-in realizado
 */
export async function notifyOPDCheckin(
  recipient: NotificationRecipient,
  appointment: AppointmentInfo,
): Promise<void> {
  const message = `Ola ${recipient.name}! 👋

✅ *Check-in confirmado!*

Sua consulta de hoje:
📅 ${formatDate(appointment.date)} às ${appointment.time}
👨‍⚕️ ${appointment.doctorName}
${appointment.specialty ? `🏥 ${appointment.specialty}` : ''}
${appointment.location ? `📍 ${appointment.location}` : ''}

Aguarde ser chamado(a). Voce sera notificado(a) quando for sua vez.

_IRB Prime Care_`;

  await sendTextMessage(recipient.phone, message);
}

/**
 * Notificar paciente que é sua vez (chamada)
 */
export async function notifyOPDCalled(
  recipient: NotificationRecipient,
  doctorName: string,
  roomNumber?: string,
): Promise<void> {
  const message = `🔔 *${recipient.name}, é sua vez!*

O(A) ${doctorName} está aguardando você.
${roomNumber ? `\n📍 Dirija-se à sala ${roomNumber}` : ''}

_IRB Prime Care_`;

  await sendTextMessage(recipient.phone, message);
}

/**
 * Notificar paciente sobre consulta finalizada com resumo
 */
export async function notifyOPDCompleted(
  recipient: NotificationRecipient,
  doctorName: string,
  hasLabOrders: boolean,
  hasPrescription: boolean,
  hasBill: boolean,
): Promise<void> {
  let message = `Ola ${recipient.name}! 👋

✅ *Consulta finalizada*
👨‍⚕️ Dr(a). ${doctorName}

`;

  if (hasLabOrders) {
    message += `🧪 *Exames solicitados* - Voce recebera instruções em breve.\n`;
  }

  if (hasPrescription) {
    message += `💊 *Receita disponivel* - Enviamos o PDF em seguida.\n`;
  }

  if (hasBill) {
    message += `💳 *Fatura gerada* - Enviamos os dados de pagamento em seguida.\n`;
  }

  message += `
Qualquer duvida, estamos a disposição!

_IRB Prime Care_`;

  await sendTextMessage(recipient.phone, message);
}

// ============================================================================
// Lab / Laboratorio Notifications
// ============================================================================

/**
 * Notificar paciente sobre exames solicitados
 */
export async function notifyLabOrderCreated(
  recipient: NotificationRecipient,
  order: LabOrderInfo,
): Promise<void> {
  const testList = order.tests.slice(0, 5).join('\n• ');
  const moreTests = order.tests.length > 5 ? `\n... e mais ${order.tests.length - 5} exame(s)` : '';

  const message = `Ola ${recipient.name}! 👋

🧪 *Exames solicitados*
Pedido: ${order.orderNumber}

Exames:
• ${testList}${moreTests}

${order.estimatedDate ? `📅 Previsão de resultado: ${formatDate(order.estimatedDate)}` : ''}

⚠️ *Orientações:*
• Apresente-se no laboratório com documento de identificação
• Siga as orientações de preparo informadas
• Jejum pode ser necessário para alguns exames

_IRB Prime Care_`;

  await sendTextMessage(recipient.phone, message);
}

/**
 * Notificar paciente que amostra foi coletada
 */
export async function notifyLabSampleCollected(
  recipient: NotificationRecipient,
  orderNumber: string,
  estimatedHours?: number,
): Promise<void> {
  const message = `Ola ${recipient.name}! 👋

✅ *Amostra coletada com sucesso!*
Pedido: ${orderNumber}

${estimatedHours ? `⏱️ Previsão: resultados em aproximadamente ${estimatedHours} horas.` : ''}

Voce sera notificado(a) assim que os resultados estiverem disponiveis.

_IRB Prime Care_`;

  await sendTextMessage(recipient.phone, message);
}

/**
 * Notificar paciente que resultados estão prontos
 */
export async function notifyLabResultsReady(
  recipient: NotificationRecipient,
  orderNumber: string,
  pdfUrl?: string,
): Promise<void> {
  const message = `Ola ${recipient.name}! 👋

📋 *Seus resultados de exames estão prontos!*
Pedido: ${orderNumber}

${pdfUrl ? '📄 Enviamos o laudo em PDF a seguir.' : 'Retire seus resultados na recepção ou acesse pelo portal do paciente.'}

⚠️ Lembre-se de apresentar os resultados ao seu médico na próxima consulta.

_IRB Prime Care_`;

  await sendTextMessage(recipient.phone, message);

  // Enviar PDF se disponível
  if (pdfUrl) {
    await sendDocument(
      recipient.phone,
      pdfUrl,
      `Laudo_${orderNumber}.pdf`,
      'Laudo de exames - IRB Prime Care',
    );
  }
}

// ============================================================================
// Billing / Faturamento Notifications
// ============================================================================

/**
 * Notificar paciente sobre fatura gerada
 */
export async function notifyBillCreated(
  recipient: NotificationRecipient,
  bill: BillInfo,
): Promise<void> {
  const message = `Ola ${recipient.name}! 👋

💳 *Fatura gerada*
Numero: ${bill.billNumber}

💰 *Valor: ${formatCurrency(bill.netAmount)}*
${bill.dueDate ? `📅 Vencimento: ${formatDate(bill.dueDate)}` : ''}

Formas de pagamento:
• PIX (pagamento instantâneo)
• Cartão de crédito/débito
• Dinheiro (na recepção)

_IRB Prime Care_`;

  // Botões de ação
  await sendButtons(recipient.phone, message, [
    { id: 'pagar_pix', text: '💳 Pagar com PIX' },
    { id: 'ver_fatura', text: '📄 Ver fatura' },
    { id: 'falar_financeiro', text: '💬 Falar com financeiro' },
  ]);
}

/**
 * Enviar QR Code PIX para pagamento
 */
export async function notifyBillPixPayment(
  recipient: NotificationRecipient,
  bill: BillInfo,
): Promise<void> {
  if (!bill.pixCode) return;

  const message = `💳 *Pagamento via PIX*

Fatura: ${bill.billNumber}
Valor: ${formatCurrency(bill.netAmount)}

📱 *Código PIX (copie e cole):*
\`\`\`
${bill.pixCode}
\`\`\`

Após o pagamento, você receberá a confirmação automaticamente.

_IRB Prime Care_`;

  await sendTextMessage(recipient.phone, message);
}

/**
 * Confirmar pagamento recebido
 */
export async function notifyPaymentReceived(
  recipient: NotificationRecipient,
  billNumber: string,
  amountPaid: number,
  paymentMethod: string,
): Promise<void> {
  const methodNames: Record<string, string> = {
    pix: 'PIX',
    credit_card: 'Cartão de Crédito',
    debit_card: 'Cartão de Débito',
    cash: 'Dinheiro',
    boleto: 'Boleto',
  };

  const message = `Ola ${recipient.name}! 👋

✅ *Pagamento confirmado!*

Fatura: ${billNumber}
Valor: ${formatCurrency(amountPaid)}
Forma: ${methodNames[paymentMethod] || paymentMethod}

Obrigado pela preferência!

_IRB Prime Care_`;

  await sendTextMessage(recipient.phone, message);
}

/**
 * Lembrete de fatura pendente
 */
export async function notifyBillReminder(
  recipient: NotificationRecipient,
  bill: BillInfo,
  daysOverdue: number,
): Promise<void> {
  const urgencyEmoji = daysOverdue > 7 ? '⚠️' : '📢';

  const message = `${urgencyEmoji} *Lembrete de pagamento*

Ola ${recipient.name},

Identificamos que sua fatura ${bill.billNumber} está ${daysOverdue > 0 ? `vencida há ${daysOverdue} dia(s)` : 'com vencimento próximo'}.

💰 Valor: ${formatCurrency(bill.netAmount)}

Caso já tenha efetuado o pagamento, desconsidere esta mensagem.

_IRB Prime Care_`;

  await sendButtons(recipient.phone, message, [
    { id: 'pagar_agora', text: '💳 Pagar agora' },
    { id: 'ja_paguei', text: '✅ Já paguei' },
    { id: 'falar_financeiro', text: '💬 Falar com financeiro' },
  ]);
}

// ============================================================================
// Pharmacy / Farmacia Notifications
// ============================================================================

/**
 * Enviar receita médica via WhatsApp
 */
export async function notifyPrescriptionCreated(
  recipient: NotificationRecipient,
  prescription: PrescriptionInfo,
): Promise<void> {
  let message = `Ola ${recipient.name}! 👋

💊 *Receita médica*
👨‍⚕️ Dr(a). ${prescription.doctorName}

Medicamentos prescritos:
`;

  for (const med of prescription.medications.slice(0, 5)) {
    message += `\n• *${med.name}* - ${med.dosage}\n  _${med.instructions}_\n`;
  }

  if (prescription.medications.length > 5) {
    message += `\n... e mais ${prescription.medications.length - 5} medicamento(s)`;
  }

  message += `\n\n⚠️ *Importante:*
• Siga as orientações do médico
• Não interrompa o tratamento sem orientação
• Em caso de reação, procure atendimento

_IRB Prime Care_`;

  await sendTextMessage(recipient.phone, message);

  // Enviar PDF se disponível
  if (prescription.pdfUrl) {
    await sendDocument(
      recipient.phone,
      prescription.pdfUrl,
      'Receita_Medica.pdf',
      'Receita médica - IRB Prime Care',
    );
  }
}

/**
 * Notificar venda concluída na farmácia
 */
export async function notifyPharmacySaleCompleted(
  recipient: NotificationRecipient,
  saleNumber: string,
  totalAmount: number,
): Promise<void> {
  const message = `Ola ${recipient.name}! 👋

✅ *Compra realizada com sucesso!*

Comprovante: ${saleNumber}
Valor: ${formatCurrency(totalAmount)}

Obrigado pela preferência!

_IRB Prime Care Farmácia_`;

  await sendTextMessage(recipient.phone, message);
}

// ============================================================================
// Appointment / Agendamento Notifications
// ============================================================================

/**
 * Confirmar agendamento criado
 */
export async function notifyAppointmentCreated(
  recipient: NotificationRecipient,
  appointment: AppointmentInfo,
): Promise<void> {
  const message = `Ola ${recipient.name}! 👋

✅ *Consulta agendada com sucesso!*

📅 ${formatDate(appointment.date)} às ${appointment.time}
👨‍⚕️ ${appointment.doctorName}
${appointment.specialty ? `🏥 ${appointment.specialty}` : ''}
${appointment.location ? `📍 ${appointment.location}` : ''}

⚠️ Chegue com 15 minutos de antecedência para o check-in.

_IRB Prime Care_`;

  await sendButtons(recipient.phone, message, [
    { id: 'confirmar_presenca', text: '✅ Confirmar presença' },
    { id: 'remarcar', text: '📅 Remarcar' },
    { id: 'cancelar', text: '❌ Cancelar' },
  ]);
}

/**
 * Lembrete de consulta (D-1)
 */
export async function notifyAppointmentReminder(
  recipient: NotificationRecipient,
  appointment: AppointmentInfo,
): Promise<void> {
  const message = `📢 *Lembrete de consulta*

Ola ${recipient.name}!

Sua consulta está marcada para *amanhã*:
📅 ${formatDate(appointment.date)} às ${appointment.time}
👨‍⚕️ ${appointment.doctorName}
${appointment.specialty ? `🏥 ${appointment.specialty}` : ''}

Por favor, confirme sua presença:`;

  await sendButtons(recipient.phone, message, [
    { id: 'confirmar_presenca', text: '✅ Vou comparecer' },
    { id: 'remarcar', text: '📅 Preciso remarcar' },
    { id: 'cancelar', text: '❌ Não poderei ir' },
  ]);
}

/**
 * Consulta cancelada
 */
export async function notifyAppointmentCancelled(
  recipient: NotificationRecipient,
  appointment: AppointmentInfo,
  reason?: string,
): Promise<void> {
  const message = `Ola ${recipient.name},

❌ *Consulta cancelada*

A consulta abaixo foi cancelada:
📅 ${formatDate(appointment.date)} às ${appointment.time}
👨‍⚕️ ${appointment.doctorName}
${reason ? `\n📝 Motivo: ${reason}` : ''}

Para reagendar, entre em contato conosco.

_IRB Prime Care_`;

  await sendButtons(recipient.phone, message, [
    { id: 'reagendar', text: '📅 Reagendar' },
    { id: 'falar_atendente', text: '💬 Falar com atendente' },
  ]);
}
