'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Bot, Phone, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TopBar } from '@/components/shared/sidebar';
import { formatDate } from '@/lib/utils/index';
import type { Agent } from '@orkesta/shared';

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAgents = async () => {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('agents')
      .select('*')
      .order('created_at', { ascending: false });
    setAgents(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAgents(); }, []);

  const toggleActive = async (id: string, current: boolean) => {
    const supabase = getSupabaseClient();
    await supabase.from('agents').update({ is_active: !current }).eq('id', id);
    setAgents((prev) => prev.map((a) => a.id === id ? { ...a, is_active: !current } : a));
  };

  const deleteAgent = async (id: string) => {
    if (!confirm('¿Eliminar este agente?')) return;
    const supabase = getSupabaseClient();
    await supabase.from('agents').delete().eq('id', id);
    setAgents((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Agentes de IA" />
      <div className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-sm">
              Configura los agentes de voz que harán tus llamadas
            </p>
          </div>
          <Link href="/agents/new">
            <Button>
              <Plus className="h-4 w-4" />
              Nuevo agente
            </Button>
          </Link>
        </div>

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        )}

        {!loading && agents.length === 0 && (
          <div className="text-center py-20">
            <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-heading font-semibold text-lg mb-2">Sin agentes</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Crea tu primer agente de IA para comenzar a hacer llamadas automáticas
            </p>
            <Link href="/agents/new">
              <Button>
                <Plus className="h-4 w-4" />
                Crear primer agente
              </Button>
            </Link>
          </div>
        )}

        {!loading && agents.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <Card key={agent.id} className="card-hover relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{agent.name}</CardTitle>
                        <Badge variant={agent.is_active ? 'success' : 'secondary'} className="mt-1">
                          {agent.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => toggleActive(agent.id, agent.is_active)}
                        className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title={agent.is_active ? 'Desactivar' : 'Activar'}
                      >
                        {agent.is_active ? <ToggleRight className="h-4 w-4 text-primary" /> : <ToggleLeft className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => deleteAgent(agent.id)}
                        className="p-1.5 rounded hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{agent.persona}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      Máx {Math.floor(agent.max_call_duration_seconds / 60)} min
                    </span>
                    <span>{agent.language}</span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Link href={`/agents/${agent.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        Editar
                      </Button>
                    </Link>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Creado {formatDate(agent.created_at)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
