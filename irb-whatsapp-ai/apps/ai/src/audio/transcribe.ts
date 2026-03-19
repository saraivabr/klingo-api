import OpenAI, { toFile } from 'openai';

// Use Groq for Whisper transcription (faster and cheaper than OpenAI)
// Falls back to OpenAI if Groq key not available
const transcriptionClient = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.GROQ_API_KEY 
    ? 'https://api.groq.com/openai/v1'
    : undefined,
});

// Groq uses 'whisper-large-v3', OpenAI uses 'whisper-1'
const WHISPER_MODEL = process.env.GROQ_API_KEY ? 'whisper-large-v3' : 'whisper-1';

const UAZAPI_URL = process.env.UAZAPI_URL || process.env.EVOLUTION_API_URL || 'https://saraiva.uazapi.com';
const UAZAPI_TOKEN = process.env.UAZAPI_TOKEN || process.env.EVOLUTION_API_KEY || '';

interface MessageKey {
  remoteJid: string;
  fromMe: boolean;
  id: string;
}

/**
 * Downloads audio from UAZAPI using /message/download and transcribes using Whisper.
 * Falls back to direct URL download if message key is not available.
 */
export async function transcribeAudio(
  audioUrl: string | null,
  messageKey: MessageKey | null,
  instanceName: string,
): Promise<string | null> {
  try {
    let audioBuffer: Buffer | null = null;

    // Method 1: Use UAZAPI /message/download (preferred)
    if (messageKey) {
      try {
        const response = await fetch(`${UAZAPI_URL}/message/download`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'token': UAZAPI_TOKEN,
          },
          body: JSON.stringify({ id: messageKey.id }),
        });

        if (response.ok) {
          const data = await response.json() as { base64Data?: string; fileURL?: string; [key: string]: unknown };
          if (data.base64Data) {
            const cleanBase64 = data.base64Data.replace(/^data:[^;]+;base64,/, '');
            audioBuffer = Buffer.from(cleanBase64, 'base64');
            console.log(`[whisper] Downloaded audio via UAZAPI base64 (${audioBuffer.length} bytes)`);
          } else if (data.fileURL) {
            // Download from the public URL returned by UAZAPI
            const fileResp = await fetch(data.fileURL);
            if (fileResp.ok) {
              audioBuffer = Buffer.from(await fileResp.arrayBuffer());
              console.log(`[whisper] Downloaded audio via UAZAPI fileURL (${audioBuffer.length} bytes)`);
            }
          }
        } else {
          const errText = await response.text();
          console.error(`[whisper] UAZAPI /message/download failed: ${response.status} - ${errText}`);
        }
      } catch (err) {
        console.error('[whisper] UAZAPI /message/download error:', err);
      }
    }

    // Method 2: Fallback to direct URL download
    if (!audioBuffer && audioUrl) {
      const response = await fetch(audioUrl, {
        headers: { 'token': UAZAPI_TOKEN },
      });
      if (response.ok) {
        audioBuffer = Buffer.from(await response.arrayBuffer());
        console.log(`[whisper] Downloaded audio via direct URL (${audioBuffer.length} bytes)`);
      } else {
        console.error(`[whisper] Direct URL download failed: ${response.status}`);
      }
    }

    if (!audioBuffer || audioBuffer.length < 100) {
      console.error('[whisper] No valid audio data obtained');
      return null;
    }

    // Transcribe with Whisper (Groq or OpenAI)
    const transcription = await transcriptionClient.audio.transcriptions.create({
      model: WHISPER_MODEL,
      file: await toFile(audioBuffer, 'audio.ogg', { type: 'audio/ogg' }),
      language: 'pt',
    });

    const text = transcription.text?.trim();
    if (!text) return null;

    console.log(`[whisper] Transcribed audio: "${text.substring(0, 100)}..."`);
    return text;
  } catch (err) {
    console.error('[whisper] Transcription failed:', err);
    return null;
  }
}
