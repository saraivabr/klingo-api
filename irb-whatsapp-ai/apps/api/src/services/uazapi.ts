/**
 * UAZAPI Service - Complete WhatsApp API Integration
 * 
 * Endpoints disponíveis:
 * - /send/text - Enviar texto
 * - /send/media - Enviar mídia (imagem, vídeo, áudio, documento)
 * - /send/menu - Enviar botões, listas, enquetes, carrossel
 * - /send/location - Enviar localização
 * - /send/contact - Enviar contato (vCard)
 * - /send/pix-button - Enviar botão PIX
 * - /message/presence - Enviar status de digitando/gravando
 * - /message/react - Enviar reação
 */

const UAZAPI_URL = process.env.UAZAPI_URL || 'https://saraiva.uazapi.com';
const UAZAPI_TOKEN = process.env.UAZAPI_TOKEN || '';

// ============================================================================
// Types
// ============================================================================

interface SendMessageResult {
  key: { id: string };
  status: string;
  response?: {
    status: string;
    message: string;
  };
}

interface CommonOptions {
  delay?: number;           // Delay em ms antes de enviar (mostra "digitando...")
  readchat?: boolean;       // Marca conversa como lida
  readmessages?: boolean;   // Marca mensagens recebidas como lidas
  replyid?: string;         // ID da mensagem para responder
  mentions?: string;        // Números para mencionar (separados por vírgula)
}

// Button types
interface ButtonChoice {
  id: string;
  text: string;
  type?: 'REPLY' | 'URL' | 'COPY' | 'CALL';
}

interface ListSection {
  title: string;
  items: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
}

interface CarouselCard {
  text: string;
  image?: string;
  video?: string;
  buttons: ButtonChoice[];
}

// ============================================================================
// Helper Functions
// ============================================================================

function cleanPhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

async function uazapiRequest<T>(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${UAZAPI_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'token': UAZAPI_TOKEN,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`UAZAPI error: ${response.status} - ${error}`);
  }

  return response.json() as Promise<T>;
}

// ============================================================================
// Core Messaging Functions
// ============================================================================

/**
 * Enviar mensagem de texto simples
 */
export async function sendTextMessage(
  phone: string,
  text: string,
  options?: CommonOptions & {
    linkPreview?: boolean;
    linkPreviewTitle?: string;
    linkPreviewDescription?: string;
    linkPreviewImage?: string;
  },
): Promise<SendMessageResult> {
  return uazapiRequest<SendMessageResult>('/send/text', {
    number: cleanPhone(phone),
    text,
    ...options,
  });
}

/**
 * Enviar status de presença (digitando, gravando)
 */
export async function sendPresence(
  phone: string,
  presence: 'composing' | 'recording' | 'paused' = 'composing',
  delay: number = 30000,
): Promise<void> {
  try {
    await uazapiRequest('/message/presence', {
      number: cleanPhone(phone),
      presence,
      delay: Math.min(delay, 300000), // Max 5 minutos
    });
  } catch (err) {
    console.error('sendPresence error:', err);
  }
}

/**
 * Enviar reação a uma mensagem
 */
export async function sendReaction(
  phone: string,
  messageId: string,
  reaction: string,
): Promise<void> {
  try {
    await uazapiRequest('/message/react', {
      number: cleanPhone(phone),
      id: messageId,
      text: reaction,
    });
  } catch (err) {
    console.error('sendReaction error:', err);
  }
}

// ============================================================================
// Interactive Messages (Buttons, Lists, Polls)
// ============================================================================

/**
 * Enviar botões de resposta rápida
 * 
 * @example
 * await sendButtons('5517...', 'Como posso ajudar?', [
 *   { id: 'agendar', text: 'Agendar consulta' },
 *   { id: 'horarios', text: 'Ver horários' },
 *   { id: 'humano', text: 'Falar com atendente' }
 * ])
 */
export async function sendButtons(
  phone: string,
  text: string,
  buttons: Array<{ id: string; text: string }>,
  options?: CommonOptions & {
    footerText?: string;
    imageButton?: string;  // URL da imagem para os botões
  },
): Promise<SendMessageResult> {
  // Converter para formato UAZAPI: "texto|id"
  const choices = buttons.map(b => `${b.text}|${b.id}`);

  return uazapiRequest<SendMessageResult>('/send/menu', {
    number: cleanPhone(phone),
    type: 'button',
    text,
    choices,
    footerText: options?.footerText,
    imageButton: options?.imageButton,
    delay: options?.delay,
    readchat: options?.readchat,
    replyid: options?.replyid,
  });
}

/**
 * Enviar lista de opções (menu dropdown)
 * 
 * @example
 * await sendList('5517...', 'Escolha uma especialidade:', 'Ver opções', [
 *   {
 *     title: 'Clínica Geral',
 *     items: [
 *       { id: 'clinico', title: 'Clínico Geral', description: 'Consultas gerais' },
 *       { id: 'pediatra', title: 'Pediatria', description: 'Crianças até 12 anos' }
 *     ]
 *   }
 * ])
 */
export async function sendList(
  phone: string,
  text: string,
  buttonText: string,
  sections: ListSection[],
  options?: CommonOptions & { footerText?: string },
): Promise<SendMessageResult> {
  // Converter para formato UAZAPI: "[Seção]" e "texto|id|descrição"
  const choices: string[] = [];
  for (const section of sections) {
    choices.push(`[${section.title}]`);
    for (const item of section.items) {
      choices.push(`${item.title}|${item.id}|${item.description || ''}`);
    }
  }

  return uazapiRequest<SendMessageResult>('/send/menu', {
    number: cleanPhone(phone),
    type: 'list',
    text,
    choices,
    listButton: buttonText,
    footerText: options?.footerText,
    delay: options?.delay,
    readchat: options?.readchat,
    replyid: options?.replyid,
  });
}

/**
 * Enviar enquete/votação
 * 
 * @example
 * await sendPoll('5517...', 'Qual horário prefere?', [
 *   'Manhã (8h-12h)',
 *   'Tarde (13h-17h)',
 *   'Noite (18h-22h)'
 * ], 1)
 */
export async function sendPoll(
  phone: string,
  text: string,
  options: string[],
  selectableCount: number = 1,
  commonOptions?: CommonOptions,
): Promise<SendMessageResult> {
  return uazapiRequest<SendMessageResult>('/send/menu', {
    number: cleanPhone(phone),
    type: 'poll',
    text,
    choices: options,
    selectableCount,
    delay: commonOptions?.delay,
    readchat: commonOptions?.readchat,
    replyid: commonOptions?.replyid,
  });
}

/**
 * Enviar carrossel de cards com imagens e botões
 * 
 * @example
 * await sendCarousel('5517...', 'Nossos produtos', [
 *   {
 *     text: 'Produto A\nDescrição do produto',
 *     image: 'https://exemplo.com/img1.jpg',
 *     buttons: [
 *       { id: 'comprar_a', text: 'Comprar', type: 'REPLY' },
 *       { id: 'https://loja.com/a', text: 'Ver mais', type: 'URL' }
 *     ]
 *   }
 * ])
 */
export async function sendCarousel(
  phone: string,
  text: string,
  cards: CarouselCard[],
  options?: CommonOptions,
): Promise<SendMessageResult> {
  return uazapiRequest<SendMessageResult>('/send/carousel', {
    number: cleanPhone(phone),
    text,
    carousel: cards.map(card => ({
      text: card.text,
      image: card.image,
      video: card.video,
      buttons: card.buttons.map(b => ({
        id: b.id,
        text: b.text,
        type: b.type || 'REPLY',
      })),
    })),
    delay: options?.delay,
    readchat: options?.readchat,
    replyid: options?.replyid,
  });
}

// ============================================================================
// Media Messages
// ============================================================================

type MediaType = 'image' | 'video' | 'document' | 'audio' | 'ptt' | 'sticker';

/**
 * Enviar mídia (imagem, vídeo, documento, áudio)
 * 
 * @example
 * // Imagem
 * await sendMedia('5517...', 'image', 'https://exemplo.com/foto.jpg', 'Veja esta foto!')
 * 
 * // Documento
 * await sendMedia('5517...', 'document', 'https://exemplo.com/doc.pdf', 'Seu documento', { docName: 'Contrato.pdf' })
 * 
 * // Áudio de voz (PTT)
 * await sendMedia('5517...', 'ptt', 'https://exemplo.com/audio.ogg')
 */
export async function sendMedia(
  phone: string,
  type: MediaType,
  fileUrl: string,
  caption?: string,
  options?: CommonOptions & { docName?: string },
): Promise<SendMessageResult> {
  return uazapiRequest<SendMessageResult>('/send/media', {
    number: cleanPhone(phone),
    type,
    file: fileUrl,
    text: caption,
    docName: options?.docName,
    delay: options?.delay,
    readchat: options?.readchat,
    replyid: options?.replyid,
  });
}

/**
 * Shorthand: Enviar imagem
 */
export async function sendImage(
  phone: string,
  imageUrl: string,
  caption?: string,
  options?: CommonOptions,
): Promise<SendMessageResult> {
  return sendMedia(phone, 'image', imageUrl, caption, options);
}

/**
 * Shorthand: Enviar documento
 */
export async function sendDocument(
  phone: string,
  documentUrl: string,
  fileName: string,
  caption?: string,
  options?: CommonOptions,
): Promise<SendMessageResult> {
  return sendMedia(phone, 'document', documentUrl, caption, { ...options, docName: fileName });
}

/**
 * Shorthand: Enviar áudio (mensagem de voz)
 */
export async function sendAudio(
  phone: string,
  audioUrl: string,
  options?: CommonOptions,
): Promise<SendMessageResult> {
  return sendMedia(phone, 'ptt', audioUrl, undefined, options);
}

// ============================================================================
// Location & Contact
// ============================================================================

/**
 * Enviar localização
 * 
 * @example
 * await sendLocation('5517...', -23.5616, -46.6562, 'MASP', 'Av. Paulista, 1578')
 */
export async function sendLocation(
  phone: string,
  latitude: number,
  longitude: number,
  name?: string,
  address?: string,
  options?: CommonOptions,
): Promise<SendMessageResult> {
  return uazapiRequest<SendMessageResult>('/send/location', {
    number: cleanPhone(phone),
    latitude,
    longitude,
    name,
    address,
    delay: options?.delay,
    readchat: options?.readchat,
    replyid: options?.replyid,
  });
}

/**
 * Enviar cartão de contato (vCard)
 * 
 * @example
 * await sendContact('5517...', 'Dr. João Silva', '5517999999999', {
 *   organization: 'Clínica IRB',
 *   email: 'joao@clinica.com'
 * })
 */
export async function sendContact(
  phone: string,
  fullName: string,
  phoneNumber: string,
  extraInfo?: {
    organization?: string;
    email?: string;
    url?: string;
  },
  options?: CommonOptions,
): Promise<SendMessageResult> {
  return uazapiRequest<SendMessageResult>('/send/contact', {
    number: cleanPhone(phone),
    fullName,
    phoneNumber: cleanPhone(phoneNumber),
    organization: extraInfo?.organization,
    email: extraInfo?.email,
    url: extraInfo?.url,
    delay: options?.delay,
    readchat: options?.readchat,
    replyid: options?.replyid,
  });
}

// ============================================================================
// PIX Payment
// ============================================================================

type PixType = 'CPF' | 'CNPJ' | 'PHONE' | 'EMAIL' | 'EVP';

/**
 * Enviar botão de pagamento PIX
 * 
 * @example
 * await sendPixButton('5517...', 'EVP', '123e4567-e89b-12d3-a456-426614174000', 'Clínica IRB')
 */
export async function sendPixButton(
  phone: string,
  pixType: PixType,
  pixKey: string,
  pixName?: string,
  options?: CommonOptions,
): Promise<SendMessageResult> {
  return uazapiRequest<SendMessageResult>('/send/pix-button', {
    number: cleanPhone(phone),
    pixType,
    pixKey,
    pixName,
    delay: options?.delay,
    readchat: options?.readchat,
    replyid: options?.replyid,
  });
}

// ============================================================================
// Instance Status
// ============================================================================

/**
 * Verificar status da instância
 */
export async function getInstanceStatus(): Promise<string> {
  try {
    const response = await fetch(`${UAZAPI_URL}/instance`, {
      headers: { 'token': UAZAPI_TOKEN },
    });

    if (!response.ok) return 'error';
    const data = await response.json() as { status?: string; state?: string };
    return data.status || data.state || 'unknown';
  } catch {
    return 'error';
  }
}

/**
 * Download de mídia de uma mensagem
 */
export async function downloadMedia(messageId: string): Promise<{ base64?: string; url?: string }> {
  return uazapiRequest('/message/download', { messageId });
}
