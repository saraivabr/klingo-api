import { FastifyInstance } from 'fastify';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@irb/shared/constants';

const messageIntakeQueue = new Queue(QUEUE_NAMES.MESSAGE_INTAKE, {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
  },
});

/**
 * UAZAPI Webhook Event Structure
 * Real format from UAZAPI webhook
 */
interface UazapiMessage {
  chatid?: string;
  chatlid?: string;
  messageid?: string;
  id?: string;
  sender?: string;
  senderName?: string;
  sender_pn?: string;
  fromMe?: boolean;
  isGroup?: boolean;
  messageType?: string;
  messageTimestamp?: number;
  text?: string;
  content?: { text?: string };
  mediaType?: string;
  buttonOrListid?: string;
  vote?: string;
  wasSentByApi?: boolean;
  type?: string;
}

interface UazapiChat {
  wa_chatid?: string;
  wa_name?: string;
  wa_contactName?: string;
  name?: string;
  phone?: string;
  wa_isGroup?: boolean;
}

interface UazapiWebhookBody {
  // Top-level fields
  BaseUrl?: string;
  EventType?: string;
  instanceName?: string;
  owner?: string;
  token?: string;
  
  // Nested message object (actual message data)
  message?: UazapiMessage;
  
  // Chat/contact info
  chat?: UazapiChat;
  
  // Legacy flat format (fallback)
  event?: string;
  chatid?: string;
  sender?: string;
  senderName?: string;
  fromMe?: boolean;
  isGroup?: boolean;
  messageType?: string;
  messageTimestamp?: number;
  text?: string;
  messageid?: string;
  wasSentByApi?: boolean;
  buttonOrListid?: string;
  vote?: string;
  pushName?: string;
}

/**
 * Extract phone number from JID
 * @example "5517999999999@s.whatsapp.net" -> "5517999999999"
 */
function extractPhone(jidOrPhone: string): string {
  if (!jidOrPhone) return '';
  return jidOrPhone.replace(/@s\.whatsapp\.net$/, '').replace(/@.*$/, '').replace(/\D/g, '');
}

/**
 * Map UAZAPI message types to internal types
 */
function mapMessageType(uazapiType: string | undefined): 'text' | 'image' | 'audio' | 'document' {
  switch (uazapiType) {
    case 'imageMessage':
    case 'image':
      return 'image';
    case 'audioMessage':
    case 'pttMessage':
    case 'audio':
    case 'ptt':
      return 'audio';
    case 'documentMessage':
    case 'document':
      return 'document';
    case 'conversation':
    case 'extendedTextMessage':
    case 'text':
    default:
      return 'text';
  }
}

function parseAllowedInstanceNames(): Set<string> {
  const raw =
    process.env.UAZAPI_ALLOWED_INSTANCE_NAMES ||
    process.env.EVOLUTION_INSTANCE_NAME ||
    'irbPRIME,uazapi';
  return new Set(
    raw
      .split(',')
      .map(v => v.trim())
      .filter(Boolean),
  );
}

export async function uazapiWebhookRoutes(app: FastifyInstance) {
  app.post('/uazapi', async (request, reply) => {
    const body = request.body as UazapiWebhookBody;
    
    // Webhook authentication - multiple methods supported
    const WEBHOOK_TOKEN = process.env.UAZAPI_WEBHOOK_TOKEN || process.env.EVOLUTION_WEBHOOK_SECRET;
    const UAZAPI_INSTANCE_TOKEN = process.env.UAZAPI_TOKEN || process.env.EVOLUTION_API_KEY;
    // Support comma-separated list of accepted tokens (for multi-instance UAZAPI)
    const ACCEPTED_TOKENS = process.env.UAZAPI_ACCEPTED_TOKENS;
    const acceptedTokenSet = new Set<string>();
    if (UAZAPI_INSTANCE_TOKEN) acceptedTokenSet.add(UAZAPI_INSTANCE_TOKEN);
    if (WEBHOOK_TOKEN) acceptedTokenSet.add(WEBHOOK_TOKEN);
    if (ACCEPTED_TOKENS) {
      ACCEPTED_TOKENS.split(',').map(t => t.trim()).filter(Boolean).forEach(t => acceptedTokenSet.add(t));
    }

    // Method 1: Header x-webhook-token
    const headerToken = request.headers['x-webhook-token'] as string | undefined;
    // Method 2: Query string ?token=xxx
    const queryToken = (request.query as Record<string, string>)?.token;
    // Method 3: Instance token in body (UAZAPI sends this)
    const bodyToken = body.token;

    const isAuthorized =
      (headerToken && acceptedTokenSet.has(headerToken)) ||
      (queryToken && acceptedTokenSet.has(queryToken)) ||
      (bodyToken && acceptedTokenSet.has(bodyToken)) ||
      // In production, reject if no tokens configured. In dev, allow.
      (process.env.NODE_ENV !== 'production' && acceptedTokenSet.size === 0);

    if (!isAuthorized) {
      app.log.warn({
        ip: request.ip,
        bodyToken: bodyToken,
        acceptedCount: acceptedTokenSet.size,
      }, '[uazapi-webhook] Unauthorized webhook request');
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const incomingInstanceName = (
      body.instanceName ||
      process.env.UAZAPI_INSTANCE_NAME ||
      process.env.EVOLUTION_INSTANCE_NAME ||
      'uazapi'
    ).trim();
    const allowedInstanceNames = parseAllowedInstanceNames();
    if (!allowedInstanceNames.has(incomingInstanceName)) {
      app.log.warn(
        {
          ip: request.ip,
          incomingInstanceName,
          allowedInstanceNames: [...allowedInstanceNames],
        },
        '[uazapi-webhook] Ignored message from non-allowed instance'
      );
      return reply.send({ status: 'ignored', reason: 'instance_not_allowed' });
    }
    
    app.log.info({ eventType: body.EventType, chatId: body.message?.chatid || body.chatid }, '[uazapi-webhook] Received');

    // Extract message from nested structure or flat structure
    const msg = body.message;
    const chat = body.chat;
    
    // Get values from nested message or fallback to flat body
    const fromMe = msg?.fromMe ?? body.fromMe;
    const wasSentByApi = msg?.wasSentByApi ?? body.wasSentByApi;
    const isGroup = msg?.isGroup ?? chat?.wa_isGroup ?? body.isGroup;
    const chatId = msg?.chatid || chat?.wa_chatid || body.chatid;
    const sender = msg?.sender || msg?.sender_pn || body.sender;
    const senderName = msg?.senderName || chat?.wa_name || chat?.wa_contactName || chat?.name || body.senderName || body.pushName;
    const text = msg?.text || msg?.content?.text || body.text || '';
    const messageType = msg?.messageType || msg?.type || body.messageType;
    const messageId = msg?.messageid || msg?.id || body.messageid || `uazapi_${Date.now()}`;
    const messageTimestamp = msg?.messageTimestamp || body.messageTimestamp;
    const buttonOrListid = msg?.buttonOrListid || body.buttonOrListid;
    const vote = msg?.vote || body.vote;
    
    app.log.info(
      { 
        eventType: body.EventType,
        messageType,
        sender,
        chatId,
        fromMe,
        wasSentByApi,
        isGroup,
        text: text?.substring(0, 50),
        senderName,
      },
      'UAZAPI webhook received'
    );

    // Skip messages sent by API to prevent loops
    if (wasSentByApi) {
      return reply.send({ status: 'ignored', reason: 'sent_by_api' });
    }

    // Skip messages from self
    if (fromMe) {
      return reply.send({ status: 'ignored', reason: 'from_me' });
    }

    // Skip group messages
    if (isGroup) {
      return reply.send({ status: 'ignored', reason: 'group_message' });
    }

    // Extract phone from chatId (preferred) or sender JID
    // chatId is more reliable as sender can be a LID (internal WhatsApp ID)
    const phoneSource = chatId || sender || '';
    const phone = extractPhone(phoneSource);
    
    app.log.info({ phoneSource, phone, chatId, sender }, 'Phone extraction debug');
    
    if (!phone) {
      return reply.send({ status: 'ignored', reason: 'no_phone' });
    }

    // Get message text
    const mappedType = mapMessageType(messageType);
    const isAudio = mappedType === 'audio';

    // If no text AND not audio AND not a button/list/poll response, ignore
    const hasInteractiveResponse = !!(buttonOrListid || vote);
    if (!text.trim() && !isAudio && !hasInteractiveResponse) {
      return reply.send({ status: 'ignored', reason: 'empty_message' });
    }

    // Enqueue for processing
    await messageIntakeQueue.add(
      'process',
      {
        phone,
        text: text.trim(),
        pushName: senderName || null,
        messageId,
        instanceName: incomingInstanceName,
        timestamp: messageTimestamp 
          ? new Date(messageTimestamp).toISOString()
          : new Date().toISOString(),
        messageType: messageType || 'conversation',
        audioUrl: isAudio ? (msg as any).fileURL : null,
        audioMessageKey: isAudio ? {
          remoteJid: sender || chatId,
          fromMe: fromMe || false,
          id: messageId,
        } : null,
        // Pass button/list selection if present
        buttonResponse: buttonOrListid || null,
        pollVote: vote || null,
      },
      {
        removeOnComplete: 100,
        removeOnFail: 500,
      }
    );

    app.log.info({ phone, text: text.substring(0, 30), messageId }, 'Message queued for processing');
    return reply.send({ status: 'queued' });
  });

  // Webhook validation endpoint (UAZAPI sends GET to verify)
  app.get('/uazapi', async (request, reply) => {
    return reply.send({ status: 'ok', message: 'UAZAPI webhook endpoint active' });
  });

  // Health check endpoint
  app.get('/uazapi/health', async (request, reply) => {
    return reply.send({ status: 'ok', timestamp: new Date().toISOString() });
  });
}
