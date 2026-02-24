import { Job } from 'bullmq';
import { ConversationModel, publishEvent } from '@irb/database';

const UAZAPI_URL = process.env.UAZAPI_URL || 'https://saraiva.uazapi.com';
const UAZAPI_TOKEN = process.env.UAZAPI_TOKEN || '';

interface ButtonItem {
  id: string;
  text: string;
}

interface ListItem {
  id: string;
  title: string;
  description?: string;
}

interface ListSection {
  title: string;
  items: ListItem[];
}

interface InteractiveMessage {
  type: 'buttons' | 'list';
  text: string;
  buttons?: ButtonItem[];
  listButtonText?: string;
  listSections?: ListSection[];
  footerText?: string;
}

interface SendJobData {
  conversationId: string;
  patientPhone: string;
  text: string;
  interactive?: InteractiveMessage;
}

function calculateTypingDelay(text: string): number {
  const delay = text.length * 40; // ~40ms per character
  return Math.min(Math.max(delay, 1500), 8000); // min 1.5s, max 8s
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendPresence(phone: string, delay: number): Promise<void> {
  try {
    const response = await fetch(`${UAZAPI_URL}/message/presence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': UAZAPI_TOKEN,
      },
      body: JSON.stringify({ number: phone, presence: 'composing', delay }),
    });
    if (!response.ok) {
      const err = await response.text();
      console.error(`sendPresence error: ${response.status} - ${err}`);
    }
  } catch (err) {
    console.error('sendPresence failed:', err);
  }
}

async function sendText(phone: string, text: string): Promise<{ key?: { id: string } }> {
  const response = await fetch(`${UAZAPI_URL}/send/text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'token': UAZAPI_TOKEN,
    },
    body: JSON.stringify({ number: phone, text }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`UAZAPI error ${response.status}: ${errText}`);
  }

  return response.json() as Promise<{ key?: { id: string } }>;
}

function truncateButtonText(text: string, maxLen = 20): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}

async function sendButtons(
  phone: string,
  text: string,
  buttons: ButtonItem[],
  footerText?: string,
): Promise<{ key?: { id: string } }> {
  // UAZAPI format: "texto|id" — truncate button text to 20 chars
  const choices = buttons.map(b => `${truncateButtonText(b.text)}|${b.id}`);

  const response = await fetch(`${UAZAPI_URL}/send/menu`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'token': UAZAPI_TOKEN,
    },
    body: JSON.stringify({
      number: phone,
      type: 'button',
      text,
      choices,
      footerText,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`UAZAPI buttons error ${response.status}: ${errText}`);
  }

  return response.json() as Promise<{ key?: { id: string } }>;
}

async function sendList(
  phone: string,
  text: string,
  buttonText: string,
  sections: ListSection[],
  footerText?: string,
): Promise<{ key?: { id: string } }> {
  // UAZAPI format: "[Section]" and "title|id|description"
  const choices: string[] = [];
  for (const section of sections) {
    choices.push(`[${section.title}]`);
    for (const item of section.items) {
      choices.push(`${item.title}|${item.id}|${item.description || ''}`);
    }
  }

  const response = await fetch(`${UAZAPI_URL}/send/menu`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'token': UAZAPI_TOKEN,
    },
    body: JSON.stringify({
      number: phone,
      type: 'list',
      text,
      choices,
      listButton: buttonText,
      footerText,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`UAZAPI list error ${response.status}: ${errText}`);
  }

  return response.json() as Promise<{ key?: { id: string } }>;
}

export async function processMessageSend(job: Job<SendJobData>) {
  const { conversationId, patientPhone, text, interactive } = job.data;
  const phone = patientPhone.replace(/^\+/, '');

  let lastMessageId: string | undefined;

  // Handle interactive messages (buttons/lists)
  if (interactive) {
    // Send AI conversational text BEFORE the interactive message (if different)
    const aiTextDiffers = text && text.trim() && text.trim() !== interactive.text.trim();
    if (aiTextDiffers) {
      const textParts = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
      for (const part of textParts) {
        const typingDelay = calculateTypingDelay(part);
        await sendPresence(phone, typingDelay);
        await sleep(typingDelay);
        const result = await sendText(phone, part);
        if (result.key?.id) lastMessageId = result.key.id;
      }
    }

    // Send the interactive message with try/catch fallback
    const typingDelay = calculateTypingDelay(interactive.text);
    await sendPresence(phone, typingDelay);
    await sleep(typingDelay);

    try {
      let result: { key?: { id: string } };

      if (interactive.type === 'buttons' && interactive.buttons) {
        result = await sendButtons(
          phone,
          interactive.text,
          interactive.buttons,
          interactive.footerText,
        );
      } else if (interactive.type === 'list' && interactive.listSections && interactive.listButtonText) {
        result = await sendList(
          phone,
          interactive.text,
          interactive.listButtonText,
          interactive.listSections,
          interactive.footerText,
        );
      } else {
        result = await sendText(phone, interactive.text);
      }

      if (result.key?.id) {
        lastMessageId = result.key.id;
      }
    } catch (err) {
      // Fallback: send interactive text as plain text if UAZAPI rejects buttons/list
      console.error('[MESSAGE-SEND] Interactive send failed, falling back to text:', err);
      try {
        const fallback = await sendText(phone, interactive.text);
        if (fallback.key?.id) lastMessageId = fallback.key.id;
      } catch (fallbackErr) {
        console.error('[MESSAGE-SEND] Fallback text also failed:', fallbackErr);
      }
    }
  } else {
    // Standard text message flow
    // Split response into multiple messages on double newlines
    const parts = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      // Show "typing..." before each message
      const typingDelay = calculateTypingDelay(part);
      await sendPresence(phone, typingDelay);
      await sleep(typingDelay);

      // Send the message
      const result = await sendText(phone, part);
      if (result.key?.id) {
        lastMessageId = result.key.id;
      }
    }
  }

  // Update delivery status in MongoDB
  if (lastMessageId) {
    const conversation = await ConversationModel.findById(conversationId);
    if (conversation) {
      const lastAiMsg = [...conversation.messages].reverse().find(m => m.sender === 'ai');
      if (lastAiMsg) {
        lastAiMsg.messageId = lastMessageId;
        lastAiMsg.deliveryStatus = 'sent';
        await conversation.save();
      }
    }
  }

  // Publish to dashboard
  await publishEvent('channel:conversations', {
    type: 'message:sent',
    payload: {
      conversationId,
      patientPhone,
      text,
      sender: 'ai',
      messageId: lastMessageId,
      interactive: interactive ? {
        type: interactive.type,
        text: interactive.text,
      } : undefined,
    },
    timestamp: new Date(),
  });

  return { status: 'sent', messageId: lastMessageId, interactive: !!interactive };
}
