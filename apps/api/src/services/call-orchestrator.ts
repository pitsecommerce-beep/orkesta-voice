import WebSocket from 'ws';
import { createDeepgramSession } from './deepgram';
import { generateAgentResponse, generateCallSummary } from './claude';
import { streamSpeechToWritable } from './elevenlabs';
import { searchKnowledge } from './rag';
import { getServiceClient } from '../utils/supabase';
import { TranscriptEntry } from '@orkesta/shared';
import pino from 'pino';

const log = pino({ name: 'call-orchestrator', redact: ['token', 'apiKey'] });

interface AgentConfig {
  id: string;
  name: string;
  system_prompt: string;
  greeting: string;
  voice_id: string | null;
  max_call_duration_seconds: number;
}

interface ProspectInfo {
  id: string;
  full_name: string;
  company: string | null;
  phone: string;
}

interface CallSession {
  callId: string;
  orgId: string;
  agent: AgentConfig;
  prospect: ProspectInfo;
  twilioWs: WebSocket;
  streamSid: string | null;
  transcript: TranscriptEntry[];
  isProcessing: boolean;
  callTimer: NodeJS.Timeout | null;
}

export class CallOrchestrator {
  private sessions = new Map<string, CallSession>();

  async handleMediaStream(twilioWs: WebSocket, callId: string): Promise<void> {
    const supabase = getServiceClient();

    // Load call details
    const { data: call, error: callErr } = await supabase
      .from('calls')
      .select('*, agents(*), prospects(*)')
      .eq('id', callId)
      .single();

    if (callErr || !call) {
      log.error({ callId }, 'Call not found for media stream');
      twilioWs.close();
      return;
    }

    const session: CallSession = {
      callId,
      orgId: call.organization_id,
      agent: call.agents,
      prospect: call.prospects,
      twilioWs,
      streamSid: null,
      transcript: [],
      isProcessing: false,
      callTimer: null,
    };

    this.sessions.set(callId, session);

    // Deepgram STT session
    const dgSession = createDeepgramSession({
      onPartial: () => {}, // Ignore partials for now
      onFinal: async (text: string) => {
        if (!text.trim() || session.isProcessing) return;
        await this.handleProspectUtterance(session, text);
      },
      onError: (err: Error) => {
        log.error({ callId, err: err.message }, 'Deepgram error');
      },
    });

    // Max call duration enforcement
    session.callTimer = setTimeout(
      async () => {
        log.info({ callId }, 'Max call duration reached, ending call');
        await this.endCall(session, 'completed');
      },
      session.agent.max_call_duration_seconds * 1000
    );

    // Handle incoming Twilio Media Stream messages
    twilioWs.on('message', async (raw: WebSocket.RawData) => {
      const msg = JSON.parse(raw.toString());

      switch (msg.event) {
        case 'start':
          session.streamSid = msg.start.streamSid;
          await supabase.from('calls').update({ status: 'in_progress', started_at: new Date().toISOString() }).eq('id', callId);
          // Send agent greeting
          await this.speakAgentText(session, session.agent.greeting);
          break;

        case 'media':
          // Forward audio to Deepgram
          const audioBuffer = Buffer.from(msg.media.payload, 'base64');
          dgSession.send(audioBuffer);
          break;

        case 'stop':
          await this.endCall(session, 'completed');
          dgSession.close();
          break;
      }
    });

    twilioWs.on('close', async () => {
      if (this.sessions.has(callId)) {
        await this.endCall(session, 'completed');
        dgSession.close();
      }
    });

    twilioWs.on('error', (err: Error) => {
      log.error({ callId, err: err.message }, 'Twilio WebSocket error');
    });
  }

  private async handleProspectUtterance(session: CallSession, text: string): Promise<void> {
    session.isProcessing = true;

    try {
      // Record prospect utterance
      session.transcript.push({
        role: 'prospect',
        content: text,
        timestamp: new Date().toISOString(),
      });

      // RAG context search
      const ragContext = await searchKnowledge(text, session.orgId);

      // Generate agent response via Claude
      const agentText = await generateAgentResponse(text, {
        systemPrompt: session.agent.system_prompt,
        history: session.transcript.slice(-10), // Keep last 10 turns for context
        ragContext,
        prospectName: session.prospect.full_name,
        prospectCompany: session.prospect.company ?? undefined,
      });

      if (!agentText) return;

      await this.speakAgentText(session, agentText);

      // Check for call termination signals
      if (this.shouldEndCall(agentText)) {
        setTimeout(() => this.endCall(session, 'completed'), 3000);
      }
    } catch (err) {
      log.error({ callId: session.callId, err }, 'Error processing utterance');
    } finally {
      session.isProcessing = false;
    }
  }

  private async speakAgentText(session: CallSession, text: string): Promise<void> {
    session.transcript.push({
      role: 'agent',
      content: text,
      timestamp: new Date().toISOString(),
    });

    try {
      await streamSpeechToWritable(
        text,
        session.agent.voice_id || process.env.ELEVENLABS_VOICE_ID!,
        (chunk: Buffer) => {
          if (session.twilioWs.readyState === WebSocket.OPEN && session.streamSid) {
            const mediaMsg = {
              event: 'media',
              streamSid: session.streamSid,
              media: { payload: chunk.toString('base64') },
            };
            session.twilioWs.send(JSON.stringify(mediaMsg));
          }
        }
      );
    } catch (err) {
      log.error({ callId: session.callId, err }, 'TTS error');
    }
  }

  private shouldEndCall(agentText: string): boolean {
    const endPhrases = [
      'hasta luego', 'adiós', 'que tenga buen día', 'que tenga buena tarde',
      'fue un placer', 'nos comunicamos', 'le voy a marcar',
    ];
    const lower = agentText.toLowerCase();
    return endPhrases.some((phrase) => lower.includes(phrase));
  }

  private async endCall(session: CallSession, finalStatus: string): Promise<void> {
    if (!this.sessions.has(session.callId)) return;
    this.sessions.delete(session.callId);

    if (session.callTimer) clearTimeout(session.callTimer);

    const supabase = getServiceClient();
    const now = new Date().toISOString();

    try {
      // Generate AI summary of the call
      const analysis = session.transcript.length > 2
        ? await generateCallSummary(session.transcript, session.agent.name)
        : { summary: 'Llamada muy corta', outcome: 'no_answer', sentiment_score: 0, extracted_data: {} };

      // Update call record
      await supabase.from('calls').update({
        status: finalStatus,
        ended_at: now,
        transcript: session.transcript,
        summary: analysis.summary,
        outcome: analysis.outcome,
        sentiment_score: analysis.sentiment_score,
        extracted_data: analysis.extracted_data,
      }).eq('id', session.callId);

      // Update prospect status
      if (analysis.outcome === 'interested' || analysis.outcome === 'converted') {
        await supabase
          .from('prospects')
          .update({ status: analysis.outcome === 'converted' ? 'converted' : 'interested' })
          .eq('id', session.prospect.id);
      }

      log.info({ callId: session.callId, outcome: analysis.outcome }, 'Call ended successfully');
    } catch (err) {
      log.error({ callId: session.callId, err }, 'Error finalizing call');
      await supabase.from('calls').update({ status: 'failed', ended_at: now }).eq('id', session.callId);
    }

    if (session.twilioWs.readyState === WebSocket.OPEN) {
      session.twilioWs.close();
    }
  }
}

export const callOrchestrator = new CallOrchestrator();
