import { Readable } from 'stream';

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

export async function synthesizeSpeech(
  text: string,
  voiceId: string = process.env.ELEVENLABS_VOICE_ID!
): Promise<Buffer> {
  const response = await fetch(
    `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}/stream?output_format=ulaw_8000`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
        language_code: 'es',
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ElevenLabs TTS error: ${response.status} ${err}`);
  }

  const chunks: Buffer[] = [];
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body from ElevenLabs');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks);
}

export async function streamSpeechToWritable(
  text: string,
  voiceId: string,
  onChunk: (chunk: Buffer) => void
): Promise<void> {
  const response = await fetch(
    `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}/stream?output_format=ulaw_8000`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
        language_code: 'es',
        optimize_streaming_latency: 3,
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ElevenLabs TTS error: ${response.status} ${err}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body from ElevenLabs');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(Buffer.from(value));
  }
}
