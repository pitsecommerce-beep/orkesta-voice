import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';

const deepgram = createClient(process.env.DEEPGRAM_API_KEY!);

export interface TranscriptHandler {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (err: Error) => void;
}

export function createDeepgramSession(handlers: TranscriptHandler) {
  const connection = deepgram.listen.live({
    model: 'nova-3',
    language: 'es-419', // Latin American Spanish (closest to MX)
    smart_format: true,
    interim_results: true,
    utterance_end_ms: 1000,
    vad_events: true,
    encoding: 'mulaw',
    sample_rate: 8000, // Twilio mulaw 8kHz
  });

  connection.on(LiveTranscriptionEvents.Open, () => {
    // Connection ready
  });

  connection.on(LiveTranscriptionEvents.Transcript, (data) => {
    const alt = data.channel?.alternatives?.[0];
    if (!alt?.transcript) return;

    if (data.is_final) {
      handlers.onFinal(alt.transcript);
    } else {
      handlers.onPartial(alt.transcript);
    }
  });

  connection.on(LiveTranscriptionEvents.Error, (err) => {
    handlers.onError(err instanceof Error ? err : new Error(String(err)));
  });

  return {
    send: (audioChunk: Buffer) => {
      if (connection.getReadyState() === 1) {
        connection.send(audioChunk);
      }
    },
    close: () => connection.requestClose(),
  };
}
