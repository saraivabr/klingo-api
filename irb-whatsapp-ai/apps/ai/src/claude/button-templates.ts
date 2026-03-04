/**
 * Button Templates for Patient Journey
 * Predefined interactive message templates for each stage of the patient journey
 */

/**
 * Single button template - Simple question with up to 3 button options
 */
export interface ButtonTemplate {
  text: string;
  buttons: Array<{
    id: string;
    text: string;
  }>;
}

/**
 * List template - Sectioned list for selecting from multiple items (e.g., specialties)
 */
export interface ListTemplate {
  text: string;
  buttonText: string;
  sections: Array<{
    title: string;
    items: Array<{
      id: string;
      title: string;
      description?: string;
    }>;
  }>;
}

// ============================================================================
// 1. WELCOME / INITIAL CONTACT
// ============================================================================

/**
 * Welcome message for first-time visitors or returning patients
 */
export const welcomeButtons: ButtonTemplate = {
  text: "Oii! Sou a Julia da IRB Prime Care 😊 O que te trouxe ate a gente?",
  buttons: [
    { id: "agendar", text: "Quero agendar" },
    { id: "conhecer", text: "Quero conhecer" },
    { id: "atendente", text: "Falar com alguem" },
  ],
};

// ============================================================================
// 2. SCHEDULING PERIOD SELECTION
// ============================================================================

/**
 * Ask patient for preferred time period
 */
export const periodButtons: ButtonTemplate = {
  text: "Em menos de 1 minuto voce resolve! Qual periodo fica melhor? 😊",
  buttons: [
    { id: "manha", text: "🌅 Manhã (7h-12h)" },
    { id: "tarde", text: "🌇 Tarde (13h-18h)" },
    { id: "qualquer", text: "✨ Qualquer horário" },
  ],
};

// ============================================================================
// 3. APPOINTMENT CONFIRMATION
// ============================================================================

/**
 * Dynamic confirmation template for appointment details
 * @param date - Appointment date
 * @param time - Appointment time
 * @param doctor - Doctor/specialist name
 */
export const confirmationButtons = (
  date: string,
  time: string,
  doctor: string,
): ButtonTemplate => ({
  text: `Otima escolha! ${date} as ${time} com ${doctor}. Confirma? 😊`,
  buttons: [
    { id: "confirmar", text: "✅ Confirmar" },
    { id: "outro_horario", text: "🔄 Outro horário" },
  ],
});

// ============================================================================
// 4. SPECIALTIES SELECTION (LIST)
// ============================================================================

/**
 * List of available medical specialties grouped by category
 * Includes descriptions for each specialty
 */
export const specialtiesList: ListTemplate = {
  text: "A gente tem uma equipe incrivel aqui! Qual area voce ta buscando?",
  buttonText: "📋 Ver especialidades",
  sections: [
    {
      title: "Clínicas Gerais",
      items: [
        {
          id: "clinica_geral",
          title: "Clínica Geral",
          description: "Consultas gerais e check-up",
        },
        {
          id: "cardiologia",
          title: "Cardiologia",
          description: "Coração e circulação",
        },
        {
          id: "dermatologia",
          title: "Dermatologia",
          description: "Pele, cabelo e unhas",
        },
        {
          id: "ortopedia",
          title: "Ortopedia",
          description: "Ossos e articulações",
        },
        {
          id: "ginecologia",
          title: "Ginecologia",
          description: "Saúde da mulher",
        },
      ],
    },
    {
      title: "Especialidades",
      items: [
        {
          id: "oftalmologia",
          title: "Oftalmologia",
          description: "Olhos e visão",
        },
        {
          id: "otorrino",
          title: "Otorrinolaringologia",
          description: "Ouvido, nariz e garganta",
        },
        {
          id: "neurologia",
          title: "Neurologia",
          description: "Sistema nervoso",
        },
        {
          id: "urologia",
          title: "Urologia",
          description: "Sistema urinário",
        },
        {
          id: "endocrinologia",
          title: "Endocrinologia",
          description: "Hormônios e metabolismo",
        },
      ],
    },
  ],
};

// ============================================================================
// 5. RETURNING PATIENT
// ============================================================================

/**
 * Welcome template for returning patients with relevant actions
 */
export const returningPatientButtons: ButtonTemplate = {
  text: "Eee voce voltou! Adoro quando isso acontece 😊 O que posso fazer por voce?",
  buttons: [
    { id: "remarcar", text: "Remarcar consulta" },
    { id: "resultado", text: "Ver resultado" },
    { id: "novo_agendamento", text: "Nova consulta" },
  ],
};

// ============================================================================
// 6. PREVIOUS PATIENT CHECK
// ============================================================================

/**
 * Ask if patient has been attended before
 */
export const previousPatientButtons: ButtonTemplate = {
  text: "Você já foi atendido conosco antes?",
  buttons: [
    { id: "sim", text: "Ja fui sim!" },
    { id: "nao", text: "Primeira vez" },
    { id: "nao_lembro", text: "Nao lembro" },
  ],
};

// ============================================================================
// 7. POST-BOOKING CONFIRMATION
// ============================================================================

/**
 * Confirmation and next steps after successful appointment booking
 */
export const postBookingButtons: ButtonTemplate = {
  text: "Prontinho, ta tudo certo! Voce tomou uma otima decisao 🎉",
  buttons: [
    { id: "comprovante", text: "Ver comprovante" },
    { id: "duvidas", text: "Tenho duvidas" },
    { id: "ok", text: "Valeu, Julia!" },
  ],
};

// ============================================================================
// 8. CANCELLATION CONFIRMATION
// ============================================================================

/**
 * Final confirmation before canceling an appointment
 */
export const cancelConfirmButtons: ButtonTemplate = {
  text: "Puxa, que pena 😢 Tem certeza que quer cancelar?",
  buttons: [
    { id: "confirmar_cancelar", text: "❌ Sim, cancelar" },
    { id: "manter", text: "✅ Não, manter" },
  ],
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get template by ID for dynamic loading
 */
export const getTemplate = (
  templateId: string,
  params?: Record<string, string>,
): ButtonTemplate | ListTemplate | null => {
  const templates: Record<
    string,
    ButtonTemplate | ListTemplate | ((params: Record<string, string>) => ButtonTemplate)
  > = {
    welcome: welcomeButtons,
    period: periodButtons,
    confirmation: (p) => confirmationButtons(p.date, p.time, p.doctor),
    specialties: specialtiesList,
    returning: returningPatientButtons,
    previousPatient: previousPatientButtons,
    postBooking: postBookingButtons,
    cancelConfirm: cancelConfirmButtons,
  };

  const template = templates[templateId];

  if (!template) {
    return null;
  }

  // If it's a function, call it with params
  if (typeof template === "function") {
    return template(params || {});
  }

  return template;
};

/**
 * Validate template structure
 */
export const isValidTemplate = (
  template: unknown,
): template is ButtonTemplate | ListTemplate => {
  if (!template || typeof template !== "object") return false;

  const obj = template as Record<string, unknown>;

  // Check ButtonTemplate
  if ("buttons" in obj && Array.isArray(obj.buttons)) {
    return (
      typeof obj.text === "string" &&
      obj.buttons.every(
        (b) =>
          typeof b === "object" &&
          typeof (b as Record<string, unknown>).id === "string" &&
          typeof (b as Record<string, unknown>).text === "string",
      )
    );
  }

  // Check ListTemplate
  if ("sections" in obj && Array.isArray(obj.sections)) {
    return (
      typeof obj.text === "string" &&
      typeof obj.buttonText === "string" &&
      obj.sections.every(
        (s) =>
          typeof s === "object" &&
          typeof (s as Record<string, unknown>).title === "string" &&
          Array.isArray((s as Record<string, unknown>).items),
      )
    );
  }

  return false;
};
