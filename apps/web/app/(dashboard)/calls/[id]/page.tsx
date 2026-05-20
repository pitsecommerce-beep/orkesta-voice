'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Phone,
  Clock,
  Calendar,
  Play,
  User,
  Bot,
  FileText,
  Info,
} from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TopBar } from '@/components/shared/sidebar';
import { cn, formatDate, formatDuration, sentimentLabel } from '@/lib/utils/index';
import type { Call, TranscriptEntry, CallStatusType, CallOutcome } from '@orkesta/shared';

interface CallDetail extends Call {
  prospect_name?: string | null;
  prospect_phone?: string | null;
  agent_name?: string | null;
}

const STATUS_LABELS: Record<CallStatusType, string> = {
  initiated: 'Iniciada',
  ringing: 'Llamando',
  in_progress: 'En curso',
  completed: 'Completada',
  failed: 'Fallida',
  no_answer: 'Sin respuesta',
  busy: 'Ocupado',
  voicemail: 'Buzón',
};

const OUTCOME_LABELS: Record<CallOutcome, string> = {
  interested: 'Interesado',
  not_interested: 'No interesado',
  callback: 'Callback',
  converted: 'Convertido',
  voicemail: 'Buzón',
  wrong_number: 'Núm. incorrecto',
  no_answer: 'Sin respuesta',
};

const OUTCOME_VARIANTS: Record<CallOutcome, 'info' | 'success' | 'warning' | 'secondary' | 'destructive'> = {
  interested: 'info',
  not_interested: 'secondary',
  callback: 'warning',
  converted: 'success',
  voicemail: 'secondary',
  wrong_number: 'secondary',
  no_answer: 'secondary',
};

function TranscriptMessage({ entry }: { entry: TranscriptEntry }) {
  const isAgent = entry.role === 'agent';
  return (
    <div className={cn('flex gap-3', isAgent ? 'justify-start' : 'justify-end')}>
      {isAgent && (
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      <div className={cn('max-w-[70%] space-y-1', !isAgent && 'items-end flex flex-col')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            isAgent
              ? 'bg-primary text-white rounded-tl-none'
              : 'bg-muted text-foreground rounded-tr-none'
          )}
        >
          {entry.content}
        </div>
        <span className="text-[10px] text-muted-foreground px-1">
          {entry.timestamp
            ? new Date(entry.timestamp).toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })
            : ''}
        </span>
      </div>
      {!isAgent && (
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function MetaItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm font-medium text-foreground mt-0.5">{value}</div>
      </div>
    </div>
  );
}

export default function CallDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [call, setCall] = useState<CallDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadCall() {
      const supabase = getSupabaseClient();
      const { data, error: err } = await supabase
        .from('calls')
        .select(
          `
          *,
          prospects(full_name, phone),
          agents(name)
          `
        )
        .eq('id', id)
        .single();

      if (err || !data) {
        setError('No se pudo cargar la llamada.');
      } else {
        const row = data as Record<string, unknown>;
        setCall({
          ...(row as unknown as Call),
          prospect_name: (row.prospects as { full_name?: string } | null)?.full_name ?? null,
          prospect_phone: (row.prospects as { phone?: string } | null)?.phone ?? null,
          agent_name: (row.agents as { name?: string } | null)?.name ?? null,
        });
      }
      setLoading(false);
    }
    loadCall();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <TopBar title="Detalle de llamada" />
        <div className="p-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !call) {
    return (
      <div className="flex flex-col h-full">
        <TopBar title="Detalle de llamada" />
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
            {error || 'Llamada no encontrada.'}
          </div>
          <Link href="/calls" className="mt-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Volver a llamadas
          </Link>
        </div>
      </div>
    );
  }

  const sentiment = sentimentLabel(call.sentiment_score);
  const transcript: TranscriptEntry[] = Array.isArray(call.transcript) ? call.transcript : [];
  const extractedKeys = Object.keys(call.extracted_data ?? {});

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Detalle de llamada" />
      <div className="flex-1 p-6 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <Link
            href="/calls"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a llamadas
          </Link>
          {call.recording_url && (
            <a href={call.recording_url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <Play className="h-4 w-4" />
                Reproducir grabación
              </Button>
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-1 space-y-4">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  Información de la llamada
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <MetaItem
                  icon={User}
                  label="Prospecto"
                  value={call.prospect_name ?? 'Sin nombre'}
                />
                {call.prospect_phone && (
                  <MetaItem
                    icon={Phone}
                    label="Teléfono"
                    value={call.prospect_phone}
                  />
                )}
                <MetaItem
                  icon={Bot}
                  label="Agente"
                  value={call.agent_name ?? '—'}
                />
                <MetaItem
                  icon={Clock}
                  label="Duración"
                  value={
                    call.duration_seconds != null
                      ? formatDuration(call.duration_seconds)
                      : '—'
                  }
                />
                <MetaItem
                  icon={Calendar}
                  label="Fecha"
                  value={formatDate(call.created_at)}
                />
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Estado</span>
                    <Badge variant="info">
                      {STATUS_LABELS[call.status] ?? call.status}
                    </Badge>
                  </div>
                  {call.outcome && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Resultado</span>
                      <Badge variant={OUTCOME_VARIANTS[call.outcome]}>
                        {OUTCOME_LABELS[call.outcome]}
                      </Badge>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Sentimiento</span>
                    <span className={cn('text-xs font-semibold', sentiment.color)}>
                      {sentiment.label}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {call.summary && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Resumen
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{call.summary}</p>
                </CardContent>
              </Card>
            )}

            {extractedKeys.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    Datos extraídos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {extractedKeys.map((key) => (
                    <div key={key} className="flex items-start justify-between gap-4">
                      <span className="text-xs text-muted-foreground capitalize">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs font-medium text-foreground text-right">
                        {String(call.extracted_data[key])}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="xl:col-span-2 flex flex-col">
            <CardHeader className="pb-4 border-b">
              <CardTitle className="text-base">Transcripción</CardTitle>
              <p className="text-xs text-muted-foreground">
                {transcript.length} mensajes — Agente a la izquierda, Prospecto a la derecha
              </p>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto max-h-[600px] py-4">
              {transcript.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Sin transcripción disponible</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {transcript.map((entry, index) => (
                    <TranscriptMessage key={index} entry={entry} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
