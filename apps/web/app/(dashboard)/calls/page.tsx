'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Phone, ChevronLeft, ChevronRight } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TopBar } from '@/components/shared/sidebar';
import { cn, formatDate, formatDuration, sentimentLabel } from '@/lib/utils/index';
import type { Call, CallStatusType, CallOutcome } from '@orkesta/shared';

const PAGE_SIZE = 20;

interface CallRow extends Call {
  prospect_name?: string | null;
  agent_name?: string | null;
}

const STATUS_CONFIG: Record<CallStatusType, { label: string; variant: string; pulse?: boolean }> = {
  initiated: { label: 'Iniciada', variant: 'info' },
  ringing: { label: 'Llamando', variant: 'info', pulse: true },
  in_progress: { label: 'En curso', variant: 'info', pulse: true },
  completed: { label: 'Completada', variant: 'success' },
  failed: { label: 'Fallida', variant: 'destructive' },
  no_answer: { label: 'Sin respuesta', variant: 'secondary' },
  busy: { label: 'Ocupado', variant: 'warning' },
  voicemail: { label: 'Buzón', variant: 'secondary' },
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

const OUTCOME_VARIANTS: Record<CallOutcome, string> = {
  interested: 'info',
  not_interested: 'secondary',
  callback: 'warning',
  converted: 'success',
  voicemail: 'secondary',
  wrong_number: 'secondary',
  no_answer: 'secondary',
};

function StatusBadge({ status }: { status: CallStatusType }) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: 'secondary' };
  return (
    <Badge
      variant={config.variant as 'info' | 'success' | 'destructive' | 'secondary' | 'warning'}
      className={cn(config.pulse && 'animate-pulse')}
    >
      {config.label}
    </Badge>
  );
}

export default function CallsPage() {
  const router = useRouter();
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const fetchCalls = useCallback(async (searchTerm: string, currentPage: number) => {
    setLoading(true);
    const supabase = getSupabaseClient();
    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('calls')
      .select(
        `
        *,
        prospects(full_name),
        agents(name)
        `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (searchTerm.trim()) {
      query = query.ilike('prospects.full_name', `%${searchTerm.trim()}%`);
    }

    const { data, count } = await query;

    const rows: CallRow[] = (data ?? []).map((row: Record<string, unknown>) => ({
      ...(row as unknown as Call),
      prospect_name: (row.prospects as { full_name?: string } | null)?.full_name ?? null,
      agent_name: (row.agents as { name?: string } | null)?.name ?? null,
    }));

    setCalls(rows);
    setTotal(count ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCalls(search, page);
  }, [fetchCalls, search, page]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Llamadas" />
      <div className="flex-1 p-6 space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Historial de llamadas</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {total.toLocaleString('es-MX')} llamadas registradas
            </p>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por prospecto..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Prospecto</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Agente</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Duración</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Resultado</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Sentimiento</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 7 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-muted animate-pulse rounded w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                )}

                {!loading && calls.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center">
                      <Phone className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground font-medium">Sin llamadas registradas</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Las llamadas aparecerán aquí cuando tus campañas comiencen
                      </p>
                    </td>
                  </tr>
                )}

                {!loading && calls.map((call) => {
                  const sentiment = sentimentLabel(call.sentiment_score);
                  return (
                    <tr
                      key={call.id}
                      className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => router.push(`/calls/${call.id}`)}
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        {call.prospect_name ?? (
                          <span className="text-muted-foreground italic">Sin nombre</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {call.agent_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">
                        {call.duration_seconds != null
                          ? formatDuration(call.duration_seconds)
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={call.status} />
                      </td>
                      <td className="px-4 py-3">
                        {call.outcome ? (
                          <Badge
                            variant={OUTCOME_VARIANTS[call.outcome] as 'info' | 'success' | 'warning' | 'secondary'}
                          >
                            {OUTCOME_LABELS[call.outcome]}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs font-medium', sentiment.color)}>
                          {sentiment.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                        {formatDate(call.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <CardContent className="flex items-center justify-between border-t py-3 px-4">
              <p className="text-xs text-muted-foreground">
                Página {page + 1} de {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
