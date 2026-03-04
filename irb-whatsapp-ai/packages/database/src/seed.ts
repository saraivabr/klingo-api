import 'dotenv/config';
import { db, schema } from './postgres/client.js';
import { connectMongo } from './mongo/client.js';

async function seed() {
  console.log('Seeding database...');

  // Seed business hours (Sab e Dom fechados)
  await db.insert(schema.businessHours).values([
    { dayOfWeek: 0, isOpen: false },
    { dayOfWeek: 1, openTime: '07:00', closeTime: '19:00', isOpen: true },
    { dayOfWeek: 2, openTime: '07:00', closeTime: '19:00', isOpen: true },
    { dayOfWeek: 3, openTime: '07:00', closeTime: '19:00', isOpen: true },
    { dayOfWeek: 4, openTime: '07:00', closeTime: '19:00', isOpen: true },
    { dayOfWeek: 5, openTime: '07:00', closeTime: '19:00', isOpen: true },
    { dayOfWeek: 6, isOpen: false },
  ]).onConflictDoNothing();

  // Seed services (precos reais IRB Prime Care SP)
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

  // Seed doctors (corpo clinico real IRB Prime Care SP)
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

  // Seed knowledge base (dados reais SP)
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

  // Seed plans (mapeamento Klingo)
  await db.insert(schema.plans).values([
    { klingoPlanId: 4, name: 'PRIME ESSENCIAL', slug: 'prime-essencial', priceCents: 10000, description: 'Plano essencial com acesso a consultas e exames básicos', features: JSON.stringify(['Consultas com desconto', 'Teleprime incluso', 'Agendamento prioritário']) },
    { klingoPlanId: 5, name: 'PRIME PLUS', slug: 'prime-plus', priceCents: 15000, description: 'Plano intermediário com benefícios ampliados', features: JSON.stringify(['Tudo do Essencial', 'Exames com desconto', 'Retorno ilimitado']) },
    { klingoPlanId: 6, name: 'PRIME ELITE', slug: 'prime-elite', priceCents: 20000, description: 'Plano completo com cobertura máxima', features: JSON.stringify(['Tudo do Plus', 'Check-up anual incluso', 'Atendimento preferencial']) },
  ]).onConflictDoNothing();

  // Seed AI settings
  await db.insert(schema.aiSettings).values([
    { key: 'model', value: '"gpt-4o"' },
    { key: 'max_tokens', value: '1024' },
    { key: 'temperature', value: '0.7' },
    { key: 'follow_up_delay_hours', value: '24' },
    { key: 'conversation_timeout_hours', value: '24' },
    { key: 'max_messages_per_minute', value: '10' },
  ]).onConflictDoNothing();

  console.log('Seed completed!');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
