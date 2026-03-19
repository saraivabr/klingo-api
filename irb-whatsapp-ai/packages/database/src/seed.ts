import 'dotenv/config';
import { and, eq, inArray, like } from 'drizzle-orm';
import { db, schema } from './postgres/client.js';

const FINANCE_TAG = '[SEED_FINANCEIRO]';

const cents = (value: number) => Math.round(value * 100);

function isoDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

type IdRow = { id: string };

async function deleteByIds<T extends IdRow>(
  rows: T[],
  table: any,
  column: any,
) {
  if (!rows.length) return;
  await db.delete(table).where(inArray(column, rows.map((row) => row.id)));
}

async function seedCoreData() {
  await db.insert(schema.businessHours).values([
    { dayOfWeek: 0, isOpen: false },
    { dayOfWeek: 1, openTime: '07:00', closeTime: '19:00', isOpen: true },
    { dayOfWeek: 2, openTime: '07:00', closeTime: '19:00', isOpen: true },
    { dayOfWeek: 3, openTime: '07:00', closeTime: '19:00', isOpen: true },
    { dayOfWeek: 4, openTime: '07:00', closeTime: '19:00', isOpen: true },
    { dayOfWeek: 5, openTime: '07:00', closeTime: '19:00', isOpen: true },
    { dayOfWeek: 6, isOpen: false },
  ]).onConflictDoNothing();

  await db.insert(schema.services).values([
    { name: 'Consulta com Especialista', priceCents: 14990, durationMinutes: 30, category: 'consulta' },
    { name: 'Consulta Cardiologista', priceCents: 14990, durationMinutes: 30, category: 'consulta' },
    { name: 'Consulta Neurologista', priceCents: 14990, durationMinutes: 30, category: 'consulta' },
    { name: 'Consulta Urologista', priceCents: 14990, durationMinutes: 30, category: 'consulta' },
    { name: 'Consulta Vascular', priceCents: 14990, durationMinutes: 30, category: 'consulta' },
    { name: 'Consulta Reumatologista', priceCents: 14990, durationMinutes: 30, category: 'consulta' },
    { name: 'Consulta Psiquiatra', priceCents: 14990, durationMinutes: 30, category: 'consulta' },
    { name: 'Consulta Clínico Geral', priceCents: 14990, durationMinutes: 30, category: 'consulta' },
    { name: 'Consulta Gastroenterologista', priceCents: 14990, durationMinutes: 30, category: 'consulta' },
    { name: 'Consulta Endocrinologista', priceCents: 14990, durationMinutes: 30, category: 'consulta' },
    { name: 'Avaliação Estética', priceCents: 8990, durationMinutes: 30, category: 'consulta' },
    { name: 'Eletrocardiograma (ECG)', priceCents: 9900, durationMinutes: 20, category: 'exame' },
    { name: 'Ecocardiograma', priceCents: 19990, durationMinutes: 30, category: 'exame' },
    { name: 'Tomografia', priceCents: 19990, durationMinutes: 30, category: 'exame' },
  ]).onConflictDoNothing();

  await db.insert(schema.doctors).values([
    { name: 'Dr. Flavio Barbieri', specialty: 'Clínica Médica', crm: 'CRM/SP' },
    { name: 'Dra. Natalia Mucare', specialty: 'Cardiologia', crm: 'CRM/SP' },
    { name: 'Dr. Pedro Cardoso', specialty: 'Urologia', crm: 'CRM/SP' },
    { name: 'Dr. Angelo Campos', specialty: 'Neurologia', crm: 'CRM/SP' },
    { name: 'Dra. Karla Souza', specialty: 'Reumatologia', crm: 'CRM/SP' },
    { name: 'Dr. Rodrigo Favoreto', specialty: 'Ultrassonografia', crm: 'CRM/SP' },
    { name: 'Dr. Lucas Rodrigues', specialty: 'Ultrassonografia', crm: 'CRM/SP' },
    { name: 'Dr. Eduardo Marim', specialty: 'Cirurgia Vascular', crm: 'CRM/SP' },
    { name: 'Dra. Maira Melo', specialty: 'Psiquiatria', crm: 'CRM/SP' },
    { name: 'Dra. Thalita Goulart', specialty: 'Odontologia', crm: 'CRO/SP' },
    { name: 'Dra. Natalia Barbosa', specialty: 'Estética', crm: 'CRM/SP' },
    { name: 'Dra. Beatriz', specialty: 'Pediatria', crm: 'CRM/RO' },
  ]).onConflictDoNothing();

  await db.insert(schema.knowledgeBase).values([
    { key: 'endereco', question: 'Qual o endereço da clínica?', answer: 'Rua Boa Vista, 99 - 6o Andar, São Paulo, SP (entrada alternativa: Rua Quinze de Novembro, 212 - 6o Andar). Ponto de referência: rua acima da 25 de Março, próximo ao Metrô São Bento. Os dois endereços são entradas diferentes do mesmo prédio.', category: 'geral' },
    { key: 'estacionamento', question: 'Tem estacionamento?', answer: 'A clínica fica no centro de São Paulo, próximo ao Metrô São Bento. Há estacionamentos pagos nas redondezas.', category: 'geral' },
    { key: 'formas_pagamento', question: 'Quais formas de pagamento?', answer: 'Aceitamos PIX (chave: ceo@irbprimecare.com.br), cartão de crédito (até 3x sem juros) e boleto.', category: 'financeiro' },
    { key: 'convenios', question: 'Aceita convênio?', answer: 'Não aceitamos convênios. O atendimento é exclusivamente particular, porém com possibilidade de reembolso pelo seu plano de saúde.', category: 'financeiro' },
    { key: 'horario_funcionamento', question: 'Qual o horário de funcionamento?', answer: 'Segunda a sexta das 7h às 19h. Sábado e domingo: fechado.', category: 'geral' },
    { key: 'cancelamento', question: 'Como cancelo uma consulta?', answer: 'Você pode cancelar ou reagendar sua consulta entrando em contato conosco com pelo menos 24h de antecedência.', category: 'agendamento' },
    { key: 'preparo_exames', question: 'Preciso de preparo para exames?', answer: 'Para exames de imagem e laboratoriais, é necessário pedido médico. Para exames de sangue, geralmente é necessário jejum de 8-12h. Se não tiver pedido, pode agendar consulta com o especialista que ele solicita os exames.', category: 'exame' },
    { key: 'valor_consulta', question: 'Qual o valor da consulta?', answer: 'Consulta com especialista por R$ 149,90, com retorno no período de 30 dias.', category: 'financeiro' },
    { key: 'resultado_exame', question: 'Quando sai o resultado do exame?', answer: 'Imagens disponíveis na hora. Laudo de imagem e ECG: 24 horas. Exames laboratoriais: até 7 dias úteis. Acesse pelo Portal do Paciente: https://portal-irb.klingo.app', category: 'exame' },
    { key: 'teleprime', question: 'Como funciona o Teleprime?', answer: 'O Teleprime é nosso pronto atendimento digital 24h. Plano Mensal Flexível: R$ 14,90/mês (cancela quando quiser). Plano Anual: R$ 9,90/mês. Compre no site irbprimecare.com.br, receba login em até 4 dias úteis, e baixe o app IRB Prime Care.', category: 'planos' },
  ]).onConflictDoNothing();

  await db.insert(schema.plans).values([
    { klingoPlanId: 4, name: 'PRIME ESSENCIAL', slug: 'prime-essencial', priceCents: 10000, description: 'Plano essencial com acesso a consultas e exames básicos', features: ['Consultas com desconto', 'Teleprime incluso', 'Agendamento prioritário'] },
    { klingoPlanId: 5, name: 'PRIME PLUS', slug: 'prime-plus', priceCents: 15000, description: 'Plano intermediário com benefícios ampliados', features: ['Tudo do Essencial', 'Exames com desconto', 'Retorno ilimitado'] },
    { klingoPlanId: 6, name: 'PRIME ELITE', slug: 'prime-elite', priceCents: 20000, description: 'Plano completo com cobertura máxima', features: ['Tudo do Plus', 'Check-up anual incluso', 'Atendimento preferencial'] },
  ]).onConflictDoNothing();

  await db.insert(schema.aiSettings).values([
    { key: 'model', value: 'gpt-4o' },
    { key: 'max_tokens', value: 1024 },
    { key: 'temperature', value: 0.7 },
    { key: 'follow_up_delay_hours', value: 24 },
    { key: 'conversation_timeout_hours', value: 24 },
    { key: 'max_messages_per_minute', value: 10 },
  ]).onConflictDoNothing();
}

async function seedFinanceData() {
  await db.insert(schema.patients).values([
    { phone: '+5511999000001', name: 'Maria Financeiro', email: 'maria.financeiro@example.com', source: 'seed' },
    { phone: '+5511999000002', name: 'João Convênio', email: 'joao.convenio@example.com', source: 'seed' },
    { phone: '+5511999000003', name: 'Ana Parcelada', email: 'ana.parcelada@example.com', source: 'seed' },
    { phone: '+5511999000004', name: 'Carlos Exames', email: 'carlos.exames@example.com', source: 'seed' },
  ]).onConflictDoNothing();

  await db.insert(schema.costCenters).values([
    { code: 'ADM', name: 'Administrativo', description: 'Sede administrativa' },
    { code: 'PROJ', name: 'Projetos', description: 'Gestão de projetos' },
    { code: 'BRAG', name: 'Bragança', description: 'Unidade Bragança Paulista' },
    { code: 'PARA', name: 'Paraguaçu', description: 'Unidade Paraguaçu Paulista' },
    { code: 'SAMU-MG', name: 'SAMU Minas Gerais', description: 'Operação SAMU em MG' },
    { code: 'NARD', name: 'Nardini', description: 'Hospital Nardini' },
    { code: 'ROND', name: 'Rondônia', description: 'Operação Rondônia' },
    { code: 'PRIME', name: 'IRB Prime Care', description: 'Clínica Prime Care' },
    { code: 'TI', name: 'Tecnologia', description: 'Departamento de TI' },
    { code: 'RH', name: 'Recursos Humanos', description: 'Departamento de RH' },
    { code: 'FIN', name: 'Financeiro', description: 'Departamento Financeiro' },
    { code: 'COM', name: 'Comercial', description: 'Departamento Comercial' },
    { code: 'MKT', name: 'Marketing', description: 'Departamento de Marketing' },
    { code: 'JUR', name: 'Jurídico', description: 'Departamento Jurídico' },
    { code: 'CONT', name: 'Contabilidade', description: 'Contabilidade' },
    { code: 'COMP', name: 'Compras', description: 'Departamento de Compras' },
    { code: 'LOG', name: 'Logística', description: 'Logística e Frota' },
    { code: 'QUA', name: 'Qualidade', description: 'Gestão da Qualidade' },
    { code: 'FAT', name: 'Faturamento', description: 'Faturamento e Cobrança' },
    { code: 'REG', name: 'Regulação', description: 'Regulação e Auditoria' },
    { code: 'DIR', name: 'Diretoria', description: 'Diretoria Executiva' },
  ]).onConflictDoNothing();

  await db.insert(schema.chartOfAccounts).values([
    { code: '3.1', name: 'Pessoal', type: 'expense' },
    { code: '3.1.1', name: 'Salários e Ordenados', type: 'expense' },
    { code: '3.1.2', name: 'Encargos Sociais', type: 'expense' },
    { code: '3.1.3', name: 'Benefícios', type: 'expense' },
    { code: '3.1.4', name: 'Terceirizados', type: 'expense' },
    { code: '3.2', name: 'Impostos e Taxas', type: 'expense' },
    { code: '3.2.1', name: 'INSS', type: 'expense' },
    { code: '3.2.2', name: 'IRPJ/CSLL', type: 'expense' },
    { code: '3.2.3', name: 'PIS/COFINS', type: 'expense' },
    { code: '3.2.4', name: 'ISS', type: 'expense' },
    { code: '3.3', name: 'Operacional', type: 'expense' },
    { code: '3.3.1', name: 'Materiais e Insumos', type: 'expense' },
    { code: '3.3.2', name: 'Medicamentos', type: 'expense' },
    { code: '3.3.3', name: 'Aluguel', type: 'expense' },
    { code: '3.3.4', name: 'Utilidades', type: 'expense' },
    { code: '3.3.5', name: 'Manutenção', type: 'expense' },
    { code: '3.4', name: 'Administrativo', type: 'expense' },
    { code: '3.4.1', name: 'Material de Escritório', type: 'expense' },
    { code: '3.4.2', name: 'Serviços Profissionais', type: 'expense' },
    { code: '3.4.3', name: 'Viagens e Deslocamentos', type: 'expense' },
    { code: '3.4.4', name: 'Seguros', type: 'expense' },
    { code: '3.5', name: 'Financeiro', type: 'expense' },
    { code: '3.5.1', name: 'Juros e Multas', type: 'expense' },
    { code: '3.5.2', name: 'Tarifas Bancárias', type: 'expense' },
    { code: '4.1', name: 'Receita Operacional', type: 'revenue' },
    { code: '4.1.1', name: 'Consultas', type: 'revenue' },
    { code: '4.1.2', name: 'Exames', type: 'revenue' },
    { code: '4.1.3', name: 'Procedimentos', type: 'revenue' },
    { code: '4.1.4', name: 'Convênios', type: 'revenue' },
    { code: '4.1.5', name: 'Particular', type: 'revenue' },
  ]).onConflictDoNothing();

  await db.insert(schema.insuranceProviders).values([
    { code: 'PART', name: 'Particular', paymentTermDays: 0 },
    { code: 'BRAD', name: 'Bradesco Saúde', paymentTermDays: 30 },
    { code: 'AMIL', name: 'Amil', paymentTermDays: 45 },
    { code: 'UNIMED', name: 'Unimed', paymentTermDays: 30 },
    { code: 'SULAM', name: 'SulAmérica', paymentTermDays: 45 },
    { code: 'HAPV', name: 'Hapvida', paymentTermDays: 30 },
    { code: 'NDAM', name: 'NotreDame Intermédica', paymentTermDays: 30 },
    { code: 'PORT', name: 'Porto Seguro Saúde', paymentTermDays: 30 },
    { code: 'PREV', name: 'Prevent Senior', paymentTermDays: 30 },
    { code: 'CASS', name: 'Cassi', paymentTermDays: 45 },
    { code: 'GEAP', name: 'GEAP', paymentTermDays: 45 },
    { code: 'SUS', name: 'SUS', paymentTermDays: 60 },
    { code: 'OUTRO', name: 'Outros Convênios', paymentTermDays: 30 },
  ]).onConflictDoNothing();

  await db.insert(schema.bankAccounts).values([
    { bankCode: '237', bankName: 'Bradesco', agency: '0001', accountNumber: '12345-6', accountType: 'corrente', nickname: 'Bradesco Principal', initialBalance: cents(125000), currentBalance: cents(132450), overdraftLimit: cents(50000) },
    { bankCode: '237', bankName: 'Bradesco', agency: '0001', accountNumber: '12346-7', accountType: 'corrente', nickname: 'Bradesco Folha', initialBalance: cents(48000), currentBalance: cents(50250), overdraftLimit: cents(10000) },
    { bankCode: '237', bankName: 'Bradesco', agency: '0001', accountNumber: '12347-8', accountType: 'corrente', nickname: 'Bradesco Fornecedores', initialBalance: cents(36000), currentBalance: cents(28740), overdraftLimit: cents(15000) },
    { bankCode: '136', bankName: 'Unicred', agency: '0101', accountNumber: '54321-0', accountType: 'corrente', nickname: 'Unicred', initialBalance: cents(22500), currentBalance: cents(31120), overdraftLimit: cents(5000) },
    { bankCode: '422', bankName: 'Safra', agency: '0001', accountNumber: '98765-4', accountType: 'corrente', nickname: 'Safra', initialBalance: cents(19000), currentBalance: cents(16400), overdraftLimit: cents(0) },
    { bankCode: '001', bankName: 'Banco do Brasil', agency: '3456', accountNumber: '11111-1', accountType: 'corrente', nickname: 'BB Principal', initialBalance: cents(54000), currentBalance: cents(58990), overdraftLimit: cents(20000) },
    { bankCode: '237', bankName: 'Bradesco', agency: '0001', accountNumber: '99999-9', accountType: 'aplicação', nickname: 'Bradesco Aplicações', initialBalance: cents(250000), currentBalance: cents(255000), overdraftLimit: 0 },
  ]).onConflictDoNothing();

  await db.insert(schema.suppliers).values([
    {
      cnpj: '12.345.678/0001-90',
      legalName: 'MedCenter Diagnósticos Ltda',
      tradeName: 'MedCenter',
      email: 'financeiro@medcenter.example.com',
      phone: '1131001000',
      city: 'São Paulo',
      state: 'SP',
      bankName: 'Bradesco',
      bankAgency: '0001',
      bankAccount: '88771-2',
      bankAccountType: 'corrente',
      pixKey: 'financeiro@medcenter.example.com',
      notes: `${FINANCE_TAG} fornecedor de exames`,
    },
    {
      cnpj: '23.456.789/0001-01',
      legalName: 'Alfa Serviços Médicos Ltda',
      tradeName: 'Alfa Serviços',
      email: 'repasse@alfamed.example.com',
      phone: '1131002000',
      city: 'São Paulo',
      state: 'SP',
      bankName: 'Banco do Brasil',
      bankAgency: '3456',
      bankAccount: '45454-1',
      bankAccountType: 'corrente',
      pixKey: '23.456.789/0001-01',
      notes: `${FINANCE_TAG} repasse médico`,
    },
    {
      cnpj: '34.567.890/0001-12',
      legalName: 'Office Prime Suprimentos Ltda',
      tradeName: 'Office Prime',
      email: 'cobranca@officeprime.example.com',
      phone: '1131003000',
      city: 'São Paulo',
      state: 'SP',
      bankName: 'Safra',
      bankAgency: '0001',
      bankAccount: '99123-9',
      bankAccountType: 'corrente',
      pixKey: '34.567.890/0001-12',
      notes: `${FINANCE_TAG} material de escritório`,
    },
    {
      cnpj: '45.678.901/0001-23',
      legalName: 'CloudTech Sistemas S.A.',
      tradeName: 'CloudTech',
      email: 'billing@cloudtech.example.com',
      phone: '1131004000',
      city: 'Barueri',
      state: 'SP',
      bankName: 'Unicred',
      bankAgency: '0101',
      bankAccount: '77654-2',
      bankAccountType: 'corrente',
      pixKey: 'billing@cloudtech.example.com',
      notes: `${FINANCE_TAG} software e infraestrutura`,
    },
  ]).onConflictDoNothing();

  const [financeUser] = await db.select({ id: schema.users.id }).from(schema.users).limit(1);

  const costCenters = await db.select({ id: schema.costCenters.id, code: schema.costCenters.code }).from(schema.costCenters);
  const chartAccounts = await db.select({ id: schema.chartOfAccounts.id, code: schema.chartOfAccounts.code }).from(schema.chartOfAccounts);
  const suppliers = await db.select({ id: schema.suppliers.id, cnpj: schema.suppliers.cnpj }).from(schema.suppliers);
  const bankAccounts = await db.select({ id: schema.bankAccounts.id, nickname: schema.bankAccounts.nickname }).from(schema.bankAccounts);
  const doctors = await db.select({ id: schema.doctors.id, name: schema.doctors.name }).from(schema.doctors);
  const patients = await db.select({ id: schema.patients.id, phone: schema.patients.phone }).from(schema.patients);
  const insuranceProviders = await db.select({ id: schema.insuranceProviders.id, code: schema.insuranceProviders.code }).from(schema.insuranceProviders);

  const costCenterByCode = Object.fromEntries(costCenters.map((row) => [row.code, row.id]));
  const chartByCode = Object.fromEntries(chartAccounts.map((row) => [row.code, row.id]));
  const supplierByCnpj = Object.fromEntries(suppliers.map((row) => [row.cnpj || '', row.id]));
  const bankByNickname = Object.fromEntries(bankAccounts.map((row) => [row.nickname || '', row.id]));
  const doctorByName = Object.fromEntries(doctors.map((row) => [row.name, row.id]));
  const patientByPhone = Object.fromEntries(patients.map((row) => [row.phone, row.id]));
  const insuranceByCode = Object.fromEntries(insuranceProviders.map((row) => [row.code || '', row.id]));

  const payableRows = await db.select({ id: schema.accountsPayable.id })
    .from(schema.accountsPayable)
    .where(like(schema.accountsPayable.documentNumber, 'SEED-AP-%'));
  await deleteByIds(
    await db.select({ id: schema.paymentApprovals.id }).from(schema.paymentApprovals).where(like(schema.paymentApprovals.notes, `${FINANCE_TAG}%`)),
    schema.paymentApprovals,
    schema.paymentApprovals.id,
  );
  await deleteByIds(
    await db.select({ id: schema.bankTransactions.id }).from(schema.bankTransactions).where(like(schema.bankTransactions.externalRef, 'SEED-%')),
    schema.bankTransactions,
    schema.bankTransactions.id,
  );
  await deleteByIds(payableRows, schema.accountsPayable, schema.accountsPayable.id);

  const receivableRows = await db.select({ id: schema.accountsReceivable.id })
    .from(schema.accountsReceivable)
    .where(like(schema.accountsReceivable.guideNumber, 'SEED-AR-%'));
  await deleteByIds(
    await db.select({ id: schema.receivablePayments.id }).from(schema.receivablePayments).where(like(schema.receivablePayments.transactionRef, 'SEED-%')),
    schema.receivablePayments,
    schema.receivablePayments.id,
  );
  if (receivableRows.length) {
    await deleteByIds(
      await db.select({ id: schema.receivableInstallments.id })
        .from(schema.receivableInstallments)
        .where(inArray(schema.receivableInstallments.accountReceivableId, receivableRows.map((row) => row.id))),
      schema.receivableInstallments,
      schema.receivableInstallments.id,
    );
  }
  await deleteByIds(receivableRows, schema.accountsReceivable, schema.accountsReceivable.id);

  const reimbursementRows = await db.select({ id: schema.reimbursementRequests.id })
    .from(schema.reimbursementRequests)
    .where(like(schema.reimbursementRequests.requestNumber, 'SEED-REEMB-%'));
  if (reimbursementRows.length) {
    await deleteByIds(
      await db.select({ id: schema.reimbursementItems.id })
        .from(schema.reimbursementItems)
        .where(inArray(schema.reimbursementItems.reimbursementRequestId, reimbursementRows.map((row) => row.id))),
      schema.reimbursementItems,
      schema.reimbursementItems.id,
    );
  }
  await deleteByIds(reimbursementRows, schema.reimbursementRequests, schema.reimbursementRequests.id);

  await db.delete(schema.creditCardPurchases).where(like(schema.creditCardPurchases.description, `${FINANCE_TAG}%`));
  await db.delete(schema.transportVouchers).where(like(schema.transportVouchers.notes, `${FINANCE_TAG}%`));
  await db.delete(schema.cashFlowSnapshots).where(like(schema.cashFlowSnapshots.notes, `${FINANCE_TAG}%`));

  const [apRent] = await db.insert(schema.accountsPayable).values({
    documentNumber: 'SEED-AP-001',
    documentType: 'Boleto',
    supplierId: supplierByCnpj['12.345.678/0001-90'],
    costCenterId: costCenterByCode.PRIME,
    chartAccountId: chartByCode['3.3.3'],
    bankAccountId: bankByNickname['Bradesco Fornecedores'],
    description: 'Locação de equipamentos de imagem',
    grossAmount: cents(8450),
    netAmount: cents(8450),
    issueDate: isoDate(-20),
    dueDate: isoDate(4),
    competenceDate: isoDate(-1),
    status: 'approved',
    paymentMethod: 'boleto',
    approvedBy: financeUser?.id,
    approvedAt: new Date(),
    notes: `${FINANCE_TAG} despesa operacional aprovada`,
    barcode: '34191.79001 01043.510047 91020.150008 5 91230000845000',
    createdBy: financeUser?.id,
  }).returning();

  const [apRepasse] = await db.insert(schema.accountsPayable).values({
    documentNumber: 'SEED-AP-002',
    documentType: 'NF',
    supplierId: supplierByCnpj['23.456.789/0001-01'],
    costCenterId: costCenterByCode.PRIME,
    chartAccountId: chartByCode['3.1.4'],
    bankAccountId: bankByNickname['BB Principal'],
    description: 'Repasse médico cardiologia',
    grossAmount: cents(5200),
    netAmount: cents(4464.2),
    inssRetention: cents(572),
    irpjRetention: cents(249.6),
    csllRetention: cents(156),
    cofinsRetention: cents(156),
    pisRetention: cents(33.8),
    issRetention: cents(568.4),
    issueDate: isoDate(-18),
    dueDate: isoDate(-2),
    paymentDate: isoDate(-1),
    competenceDate: isoDate(-15),
    status: 'paid',
    paymentMethod: 'pix',
    approvedBy: financeUser?.id,
    approvedAt: new Date(),
    paidBy: financeUser?.id,
    pixCode: '00020101021126580014BR.GOV.BCB.PIX01362345678900010152040000530398654074464.205802BR5920ALFA SERVICOS MEDICOS6009SAO PAULO62070503***6304ABCD',
    notes: `${FINANCE_TAG} conta paga com retenções`,
    createdBy: financeUser?.id,
  }).returning();

  const [apCloud] = await db.insert(schema.accountsPayable).values({
    documentNumber: 'SEED-AP-003',
    documentType: 'Fatura',
    supplierId: supplierByCnpj['45.678.901/0001-23'],
    costCenterId: costCenterByCode.TI,
    chartAccountId: chartByCode['3.4.2'],
    bankAccountId: bankByNickname.Unicred,
    description: 'Infraestrutura cloud e APIs de produção',
    grossAmount: cents(2390),
    netAmount: cents(2390),
    issueDate: isoDate(-12),
    dueDate: isoDate(8),
    competenceDate: isoDate(-5),
    status: 'pending',
    paymentMethod: 'ted',
    notes: `${FINANCE_TAG} despesa de TI pendente`,
    createdBy: financeUser?.id,
  }).returning();

  const [apOffice] = await db.insert(schema.accountsPayable).values({
    documentNumber: 'SEED-AP-004',
    documentType: 'NF',
    supplierId: supplierByCnpj['34.567.890/0001-12'],
    costCenterId: costCenterByCode.ADM,
    chartAccountId: chartByCode['3.4.1'],
    bankAccountId: bankByNickname.Safra,
    description: 'Material de escritório matriz',
    grossAmount: cents(780),
    netAmount: cents(780),
    issueDate: isoDate(-25),
    dueDate: isoDate(-3),
    competenceDate: isoDate(-20),
    status: 'overdue',
    paymentMethod: 'boleto',
    notes: `${FINANCE_TAG} conta vencida para fila de cobrança`,
    createdBy: financeUser?.id,
  }).returning();

  await db.insert(schema.paymentApprovals).values([
    {
      accountPayableId: apRent.id,
      requestedBy: financeUser?.id,
      approvedBy: financeUser?.id,
      approvedAt: new Date(),
      status: 'approved',
      notes: `${FINANCE_TAG} aprovação da locação`,
    },
    {
      accountPayableId: apCloud.id,
      requestedBy: financeUser?.id,
      status: 'pending',
      notes: `${FINANCE_TAG} aguardando aprovação de TI`,
    },
  ]);

  await db.insert(schema.creditCardPurchases).values([
    {
      cardLastDigits: '4432',
      cardHolder: 'IRB Prime Care',
      merchantName: 'Meta Ads',
      purchaseDate: isoDate(-6),
      totalAmount: cents(1480),
      installments: 2,
      installmentAmount: cents(740),
      currentInstallment: 1,
      costCenterId: costCenterByCode.MKT,
      chartAccountId: chartByCode['3.4.2'],
      description: `${FINANCE_TAG} campanha digital março`,
      status: 'active',
    },
    {
      cardLastDigits: '4432',
      cardHolder: 'IRB Prime Care',
      merchantName: 'Google Workspace',
      purchaseDate: isoDate(-14),
      totalAmount: cents(326.4),
      installments: 1,
      installmentAmount: cents(326.4),
      currentInstallment: 1,
      costCenterId: costCenterByCode.TI,
      chartAccountId: chartByCode['3.4.2'],
      description: `${FINANCE_TAG} licenças corporativas`,
      status: 'active',
    },
  ]);

  const [arParticular] = await db.insert(schema.accountsReceivable).values({
    patientId: patientByPhone['+5511999000001'],
    doctorId: doctorByName['Dra. Natalia Mucare'],
    costCenterId: costCenterByCode.PRIME,
    serviceType: 'medical',
    procedureCode: '10101012',
    procedureDescription: 'Consulta cardiologia particular',
    guideNumber: 'SEED-AR-001',
    authorizationNumber: 'AUTH-001',
    totalAmount: cents(149.9),
    receivedAmount: cents(149.9),
    serviceDate: isoDate(-6),
    dueDate: isoDate(-6),
    receivedDate: isoDate(-6),
    status: 'received',
    paymentType: 'particular',
    notes: `${FINANCE_TAG} consulta particular liquidada`,
    createdBy: financeUser?.id,
  }).returning();

  const [arConvenio] = await db.insert(schema.accountsReceivable).values({
    patientId: patientByPhone['+5511999000002'],
    doctorId: doctorByName['Dr. Flavio Barbieri'],
    insuranceProviderId: insuranceByCode.BRAD,
    costCenterId: costCenterByCode.FAT,
    serviceType: 'medical',
    procedureCode: '20202020',
    procedureDescription: 'Consulta clínica convênio Bradesco',
    guideNumber: 'SEED-AR-002',
    authorizationNumber: 'AUTH-002',
    totalAmount: cents(320),
    receivedAmount: cents(160),
    serviceDate: isoDate(-14),
    dueDate: isoDate(10),
    status: 'partial',
    paymentType: 'insurance',
    notes: `${FINANCE_TAG} convênio parcialmente recebido`,
    createdBy: financeUser?.id,
  }).returning();

  const [arParcelado] = await db.insert(schema.accountsReceivable).values({
    patientId: patientByPhone['+5511999000003'],
    doctorId: doctorByName['Dr. Pedro Cardoso'],
    insuranceProviderId: insuranceByCode.PART,
    costCenterId: costCenterByCode.PRIME,
    serviceType: 'procedure',
    procedureCode: '30303030',
    procedureDescription: 'Procedimento urológico parcelado',
    guideNumber: 'SEED-AR-003',
    authorizationNumber: 'AUTH-003',
    totalAmount: cents(1200),
    receivedAmount: cents(400),
    serviceDate: isoDate(-20),
    dueDate: isoDate(-5),
    status: 'partial',
    paymentType: 'particular',
    notes: `${FINANCE_TAG} particular em cobrança`,
    createdBy: financeUser?.id,
  }).returning();

  const [arExame] = await db.insert(schema.accountsReceivable).values({
    patientId: patientByPhone['+5511999000004'],
    doctorId: doctorByName['Dr. Rodrigo Favoreto'],
    insuranceProviderId: insuranceByCode.UNIMED,
    costCenterId: costCenterByCode.FAT,
    serviceType: 'exam',
    procedureCode: '40404040',
    procedureDescription: 'Ecocardiograma convênio Unimed',
    guideNumber: 'SEED-AR-004',
    authorizationNumber: 'AUTH-004',
    totalAmount: cents(420),
    receivedAmount: 0,
    glosaAmount: cents(20),
    serviceDate: isoDate(-11),
    dueDate: isoDate(18),
    status: 'glosa',
    paymentType: 'insurance',
    notes: `${FINANCE_TAG} glosa parcial em auditoria`,
    createdBy: financeUser?.id,
  }).returning();

  const [arFuture] = await db.insert(schema.accountsReceivable).values({
    patientId: patientByPhone['+5511999000001'],
    doctorId: doctorByName['Dra. Natalia Barbosa'],
    insuranceProviderId: insuranceByCode.PART,
    costCenterId: costCenterByCode.PRIME,
    serviceType: 'procedure',
    procedureCode: '50505050',
    procedureDescription: 'Procedimento estético agendado',
    guideNumber: 'SEED-AR-005',
    authorizationNumber: 'AUTH-005',
    totalAmount: cents(890),
    receivedAmount: 0,
    serviceDate: isoDate(-1),
    dueDate: isoDate(12),
    status: 'pending',
    paymentType: 'particular',
    notes: `${FINANCE_TAG} receita futura em aberto`,
    createdBy: financeUser?.id,
  }).returning();

  await db.insert(schema.receivableInstallments).values([
    {
      accountReceivableId: arParcelado.id,
      installmentNumber: 1,
      amount: cents(400),
      dueDate: isoDate(-20),
      paidAmount: cents(400),
      paidDate: isoDate(-18),
      status: 'paid',
    },
    {
      accountReceivableId: arParcelado.id,
      installmentNumber: 2,
      amount: cents(400),
      dueDate: isoDate(-5),
      paidAmount: 0,
      status: 'pending',
    },
    {
      accountReceivableId: arParcelado.id,
      installmentNumber: 3,
      amount: cents(400),
      dueDate: isoDate(25),
      paidAmount: 0,
      status: 'pending',
    },
    {
      accountReceivableId: arConvenio.id,
      installmentNumber: 1,
      amount: cents(160),
      dueDate: isoDate(-1),
      paidAmount: cents(160),
      paidDate: isoDate(-1),
      status: 'paid',
    },
    {
      accountReceivableId: arConvenio.id,
      installmentNumber: 2,
      amount: cents(160),
      dueDate: isoDate(10),
      paidAmount: 0,
      status: 'pending',
    },
  ]);

  await db.insert(schema.receivablePayments).values([
    {
      accountReceivableId: arParticular.id,
      amount: cents(149.9),
      paymentDate: isoDate(-6),
      paymentMethod: 'pix',
      bankAccountId: bankByNickname['Bradesco Principal'],
      transactionRef: 'SEED-RCV-001',
      notes: `${FINANCE_TAG} pagamento consulta`,
      receivedBy: financeUser?.id,
    },
    {
      accountReceivableId: arConvenio.id,
      amount: cents(160),
      paymentDate: isoDate(-1),
      paymentMethod: 'transferencia',
      bankAccountId: bankByNickname['BB Principal'],
      transactionRef: 'SEED-RCV-002',
      notes: `${FINANCE_TAG} repasse parcial convênio`,
      receivedBy: financeUser?.id,
    },
    {
      accountReceivableId: arParcelado.id,
      installmentId: (
        await db.select({ id: schema.receivableInstallments.id })
          .from(schema.receivableInstallments)
          .where(and(
            eq(schema.receivableInstallments.accountReceivableId, arParcelado.id),
            eq(schema.receivableInstallments.installmentNumber, 1),
          ))
      )[0]?.id,
      amount: cents(400),
      paymentDate: isoDate(-18),
      paymentMethod: 'cartao',
      bankAccountId: bankByNickname['Bradesco Principal'],
      transactionRef: 'SEED-RCV-003',
      notes: `${FINANCE_TAG} entrada parcelada`,
      receivedBy: financeUser?.id,
    },
  ]);

  await db.insert(schema.bankTransactions).values([
    {
      bankAccountId: bankByNickname['Bradesco Principal'],
      transactionDate: isoDate(-6),
      type: 'credit',
      amount: cents(149.9),
      description: 'Recebimento consulta Maria Financeiro',
      accountReceivableId: arParticular.id,
      reconciled: true,
      reconciledAt: new Date(),
      reconciledBy: financeUser?.id,
      externalRef: 'SEED-BANK-001',
    },
    {
      bankAccountId: bankByNickname['Bradesco Principal'],
      transactionDate: isoDate(-18),
      type: 'credit',
      amount: cents(400),
      description: 'Pagamento parcela procedimento',
      accountReceivableId: arParcelado.id,
      reconciled: true,
      reconciledAt: new Date(),
      reconciledBy: financeUser?.id,
      externalRef: 'SEED-BANK-002',
    },
    {
      bankAccountId: bankByNickname['BB Principal'],
      transactionDate: isoDate(-1),
      type: 'credit',
      amount: cents(160),
      description: 'Recebimento convênio Bradesco',
      accountReceivableId: arConvenio.id,
      reconciled: true,
      reconciledAt: new Date(),
      reconciledBy: financeUser?.id,
      externalRef: 'SEED-BANK-003',
    },
    {
      bankAccountId: bankByNickname['BB Principal'],
      transactionDate: isoDate(-1),
      type: 'debit',
      amount: cents(4464.2),
      description: 'PIX repasse médico cardiologia',
      accountPayableId: apRepasse.id,
      reconciled: true,
      reconciledAt: new Date(),
      reconciledBy: financeUser?.id,
      externalRef: 'SEED-BANK-004',
    },
    {
      bankAccountId: bankByNickname['Bradesco Fornecedores'],
      transactionDate: isoDate(0),
      type: 'debit',
      amount: cents(125),
      description: 'Tarifa bancária diária',
      reconciled: false,
      externalRef: 'SEED-BANK-005',
    },
  ]);

  await db.insert(schema.reimbursementRequests).values([
    {
      requestNumber: 'SEED-REEMB-001',
      employeeName: 'Paulo Assistencial',
      employeeDepartment: 'Operações',
      employeeCpf: '111.222.333-44',
      tripOrigin: 'São Paulo',
      tripDestination: 'Bragança Paulista',
      tripStartDate: isoDate(-7),
      tripEndDate: isoDate(-6),
      tripPurpose: 'Visita técnica à unidade',
      bankName: 'Bradesco',
      bankAgency: '0001',
      bankAccount: '77889-0',
      bankAccountType: 'corrente',
      pixKey: '11122233344',
      totalAmount: cents(186.7),
      approvedAmount: cents(180),
      status: 'approved',
      requestedBy: financeUser?.id,
      approvedBy: financeUser?.id,
      approvedAt: new Date(),
      notes: `${FINANCE_TAG} reembolso operacional`,
    },
    {
      requestNumber: 'SEED-REEMB-002',
      employeeName: 'Luciana RH',
      employeeDepartment: 'RH',
      employeeCpf: '555.666.777-88',
      tripOrigin: 'São Paulo',
      tripDestination: 'Campinas',
      tripStartDate: isoDate(-2),
      tripEndDate: isoDate(-2),
      tripPurpose: 'Treinamento externo',
      bankName: 'Banco do Brasil',
      bankAgency: '3456',
      bankAccount: '99887-1',
      bankAccountType: 'corrente',
      pixKey: 'luciana.rh@example.com',
      totalAmount: cents(92.4),
      status: 'pending',
      requestedBy: financeUser?.id,
      notes: `${FINANCE_TAG} reembolso aguardando conferência`,
    },
  ]).returning();

  const reimbursementRequests = await db.select({
    id: schema.reimbursementRequests.id,
    requestNumber: schema.reimbursementRequests.requestNumber,
  }).from(schema.reimbursementRequests).where(like(schema.reimbursementRequests.requestNumber, 'SEED-REEMB-%'));

  const reimbursementByNumber = Object.fromEntries(reimbursementRequests.map((row) => [row.requestNumber, row.id]));

  await db.insert(schema.reimbursementItems).values([
    {
      reimbursementRequestId: reimbursementByNumber['SEED-REEMB-001'],
      expenseDate: isoDate(-7),
      expenseType: 'combustivel',
      description: 'Abastecimento visita técnica',
      receiptNumber: 'REC-001',
      amount: cents(120.3),
      approved: true,
      approvedAmount: cents(120.3),
    },
    {
      reimbursementRequestId: reimbursementByNumber['SEED-REEMB-001'],
      expenseDate: isoDate(-6),
      expenseType: 'pedagio',
      description: 'Pedágios ida e volta',
      receiptNumber: 'REC-002',
      amount: cents(66.4),
      approved: true,
      approvedAmount: cents(59.7),
    },
    {
      reimbursementRequestId: reimbursementByNumber['SEED-REEMB-002'],
      expenseDate: isoDate(-2),
      expenseType: 'alimentacao',
      description: 'Almoço em treinamento',
      receiptNumber: 'REC-003',
      amount: cents(92.4),
    },
  ]);

  await db.insert(schema.transportVouchers).values([
    {
      employeeName: 'Fernanda Recepção',
      employeeCpf: '222.333.444-55',
      employeeRole: 'Recepcionista',
      contractType: 'clt',
      costCenterId: costCenterByCode.PRIME,
      monthlyAmount: cents(420),
      referenceMonth: isoDate(0).slice(0, 7),
      workDays: 21,
      dailyAmount: cents(20),
      status: 'pending',
      notes: `${FINANCE_TAG} vale transporte recepção`,
    },
    {
      employeeName: 'Marcos TI',
      employeeCpf: '333.444.555-66',
      employeeRole: 'Analista de Sistemas',
      contractType: 'clt',
      costCenterId: costCenterByCode.TI,
      monthlyAmount: cents(360),
      referenceMonth: isoDate(0).slice(0, 7),
      workDays: 20,
      dailyAmount: cents(18),
      status: 'paid',
      paidAt: new Date(),
      notes: `${FINANCE_TAG} vale transporte TI`,
    },
  ]);

  await db.insert(schema.cashFlowSnapshots).values([
    {
      snapshotDate: isoDate(-2),
      costCenterId: costCenterByCode.PRIME,
      openingBalance: cents(128450),
      totalCredits: cents(0),
      totalDebits: cents(0),
      closingBalance: cents(128450),
      revenueBreakdown: { consultas: 0, procedimentos: 0 },
      expenseBreakdown: { operacional: 0 },
      isProjected: false,
      notes: `${FINANCE_TAG} snapshot histórico`,
      generatedBy: financeUser?.id,
    },
    {
      snapshotDate: isoDate(-1),
      costCenterId: costCenterByCode.PRIME,
      openingBalance: cents(128450),
      totalCredits: cents(160),
      totalDebits: cents(4464.2),
      closingBalance: cents(124145.8),
      revenueBreakdown: { convenios: cents(160) },
      expenseBreakdown: { terceiros: cents(4464.2) },
      isProjected: false,
      notes: `${FINANCE_TAG} snapshot após repasse médico`,
      generatedBy: financeUser?.id,
    },
    {
      snapshotDate: isoDate(7),
      costCenterId: costCenterByCode.PRIME,
      openingBalance: cents(124145.8),
      totalCredits: cents(890),
      totalDebits: cents(8450),
      closingBalance: cents(116585.8),
      revenueBreakdown: { procedimentos: cents(890) },
      expenseBreakdown: { aluguel: cents(8450) },
      isProjected: true,
      notes: `${FINANCE_TAG} projeção semanal`,
      generatedBy: financeUser?.id,
    },
  ]);
}

async function seed() {
  console.log('Seeding database...');

  await seedCoreData();
  await seedFinanceData();

  console.log('Seed completed!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
