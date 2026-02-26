import OpenAI from 'openai';

export const aiTools: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'check_availability',
      description: 'Verifica disponibilidade de horários para uma especialidade ou médico específico. Use quando o paciente quer saber horários disponíveis.',
      parameters: {
        type: 'object',
        properties: {
          specialty: { type: 'string', description: 'Especialidade médica (ex: Dermatologia, Cardiologia)' },
          doctor_name: { type: 'string', description: 'Nome do médico, se especificado pelo paciente' },
          preferred_date: { type: 'string', description: 'Data preferida no formato YYYY-MM-DD' },
          preferred_period: { type: 'string', enum: ['morning', 'afternoon', 'any'], description: 'Período preferido' },
        },
        required: ['specialty'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_service_price',
      description: 'Consulta o preço de um serviço ou consulta. Use quando o paciente perguntar sobre valores.',
      parameters: {
        type: 'object',
        properties: {
          service_name: { type: 'string', description: 'Nome do serviço ou especialidade' },
          category: { type: 'string', enum: ['consulta', 'exame'], description: 'Categoria do serviço' },
        },
        required: ['service_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'book_appointment',
      description: 'Agenda uma consulta ou exame para o paciente. Use APENAS quando tiver todas as informações necessárias e o paciente confirmar.',
      parameters: {
        type: 'object',
        properties: {
          patient_name: { type: 'string', description: 'Nome completo do paciente' },
          patient_phone: { type: 'string', description: 'Telefone do paciente' },
          service_name: { type: 'string', description: 'Nome do serviço' },
          doctor_name: { type: 'string', description: 'Nome do médico' },
          date_time: { type: 'string', description: 'Data e hora no formato YYYY-MM-DD HH:mm' },
        },
        required: ['patient_name', 'service_name', 'date_time'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_knowledge',
      description: 'Busca informações da base de conhecimento da clínica (endereço, formas de pagamento, convênios, horários, etc).',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'Tópico da pergunta (endereco, estacionamento, formas_pagamento, convenios, horario_funcionamento, cancelamento, preparo_exames)' },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_booking_link',
      description: 'Gera um link personalizado de agendamento para o paciente. PRIORIZE SEMPRE esta ferramenta em vez de coletar dados no chat. O paciente recebe um link, clica, escolhe o horário e confirma em segundos. Muito mais rápido e prático!',
      parameters: {
        type: 'object',
        properties: {
          specialty: { type: 'string', description: 'Especialidade médica (ex: Dermatologia, Cardiologia)' },
          doctor_name: { type: 'string', description: 'Nome do médico, se o paciente especificou preferência' },
          service_name: { type: 'string', description: 'Nome do serviço/exame, se especificado' },
          preferred_period: { type: 'string', enum: ['morning', 'afternoon', 'any'], description: 'Período preferido pelo paciente' },
        },
        required: ['specialty'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'escalate_to_human',
      description: 'Transfere a conversa para um atendente humano. Use quando: o paciente pedir explicitamente, houver urgência médica, reclamação formal, ou quando você não tiver certeza da resposta.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', enum: ['patient_request', 'medical_urgency', 'complaint', 'ai_uncertainty', 'complex_scheduling'], description: 'Motivo da escalação' },
          summary: { type: 'string', description: 'Resumo da conversa até aqui para o atendente' },
          priority: { type: 'number', description: 'Prioridade 1-5 (1=mais alta)' },
        },
        required: ['reason', 'summary'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_interactive_message',
      description: 'Envia mensagem interativa com botões ou lista. USE FREQUENTEMENTE! Sempre que tiver 2-3 opções para o paciente (período, confirmação, especialidade), USE ESTA TOOL em vez de perguntar por texto.',
      parameters: {
        type: 'object',
        properties: {
          message_type: {
            type: 'string',
            enum: ['buttons', 'list'],
            description: 'Tipo: "buttons" para até 3 opções rápidas, "list" para menu com mais opções (até 10)',
          },
          text: {
            type: 'string',
            description: 'Texto principal da mensagem (máx 1024 chars). Seja natural e conversacional.',
          },
          buttons: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'ID único do botão (ex: "agendar", "manha", "tarde")' },
                text: { type: 'string', description: 'Texto do botão (máx 20 chars). Curto e direto.' },
              },
              required: ['id', 'text'],
            },
            description: 'Array de botões (máx 3). Use apenas com message_type="buttons".',
          },
          list_button_text: {
            type: 'string',
            description: 'Texto do botão que abre a lista (ex: "Ver especialidades"). Use apenas com message_type="list".',
          },
          list_sections: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Título da seção' },
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', description: 'ID único do item' },
                      title: { type: 'string', description: 'Título do item (máx 24 chars)' },
                      description: { type: 'string', description: 'Descrição opcional (máx 72 chars)' },
                    },
                    required: ['id', 'title'],
                  },
                },
              },
              required: ['title', 'items'],
            },
            description: 'Seções da lista. Use apenas com message_type="list".',
          },
          footer_text: {
            type: 'string',
            description: 'Texto de rodapé opcional (máx 60 chars). Ex: "IRB Prime Care"',
          },
        },
        required: ['message_type', 'text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_appointment',
      description: 'Cancela uma consulta do paciente. Use quando o paciente pedir pra cancelar. Não precisa mais escalar pra humano!',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Motivo do cancelamento informado pelo paciente' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_patient_appointments',
      description: 'Lista os agendamentos futuros do paciente. Use quando o paciente perguntar sobre suas consultas marcadas.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_exam_results',
      description: 'Verifica se o paciente tem resultados de exames disponíveis. Use quando o paciente perguntar sobre resultados.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
];
