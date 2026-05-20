'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Megaphone, Play, Pause, ChevronRight } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TopBar } from '@/components/shared/sidebar';
import { formatDate } from '@/lib/utils/index';
import type { Campaign, CampaignStatus } from '@orkesta/shared';

const statusConfig: Record<CampaignStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'secondary' | 'destructive' | 'info' | 'outline' }> = {
  draft: { label: 'Borrador', variant: 'secondary' },
  active: { label: 'Activa', variant: 'success' },
  paused: { label: 'Pausada', variant: 'warning' },
  completed: { label: 'Completada', variant: 'info' },
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<(Campaign & { agents: { name: string } | null; _count?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ name: '', description: '', agent_id: '' });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    const supabase = getSupabaseClient();
    const [{ data: camps }, { data: ag }] = await Promise.all([
      supabase.from('campaigns').select('*, agents(name)').order('created_at', { ascending: false }),
      supabase.from('agents').select('id, name').eq('is_active', true),
    ]);
    setCampaigns(camps ?? []);
    setAgents(ag ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const toggleStatus = async (id: string, current: CampaignStatus) => {
    const supabase = getSupabaseClient();
    const newStatus: CampaignStatus = current === 'active' ? 'paused' : 'active';
    await supabase.from('campaigns').update({ status: newStatus }).eq('id', id);
    setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, status: newStatus } : c));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user!.id).single();

    await supabase.from('campaigns').insert({
      name: form.name,
      description: form.description,
      agent_id: form.agent_id || null,
      organization_id: profile!.organization_id,
      status: 'draft',
    });

    setForm({ name: '', description: '', agent_id: '' });
    setShowForm(false);
    setSaving(false);
    fetchData();
  };

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Campañas" />
      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">Organiza y automatiza tus llamadas por campañas</p>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            Nueva campaña
          </Button>
        </div>

        {showForm && (
          <Card className="border-primary/30">
            <CardHeader><CardTitle className="text-lg">Nueva campaña</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Nombre *</label>
                    <input
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Agente</label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={form.agent_id}
                      onChange={(e) => setForm((f) => ({ ...f, agent_id: e.target.value }))}
                    >
                      <option value="">Sin asignar</option>
                      {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Descripción</label>
                  <textarea
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px]"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div className="flex gap-3">
                  <Button type="submit" disabled={saving}>{saving ? 'Creando...' : 'Crear campaña'}</Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
          </div>
        )}

        {!loading && campaigns.length === 0 && !showForm && (
          <div className="text-center py-20">
            <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-heading font-semibold text-lg mb-2">Sin campañas</h3>
            <p className="text-muted-foreground text-sm mb-4">Crea tu primera campaña para organizar tus llamadas</p>
            <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" />Crear campaña</Button>
          </div>
        )}

        <div className="space-y-3">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="border rounded-lg bg-white hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between p-5">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Megaphone className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{campaign.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={statusConfig[campaign.status].variant}>
                        {statusConfig[campaign.status].label}
                      </Badge>
                      {campaign.agents && (
                        <span className="text-xs text-muted-foreground">
                          Agente: {campaign.agents.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(campaign.status === 'active' || campaign.status === 'paused' || campaign.status === 'draft') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleStatus(campaign.id, campaign.status)}
                    >
                      {campaign.status === 'active'
                        ? <><Pause className="h-4 w-4" /> Pausar</>
                        : <><Play className="h-4 w-4" /> Activar</>
                      }
                    </Button>
                  )}
                  <Link href={`/campaigns/${campaign.id}`}>
                    <Button variant="ghost" size="sm">
                      Ver detalles
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
              {campaign.description && (
                <p className="px-5 pb-4 text-sm text-muted-foreground">{campaign.description}</p>
              )}
              <div className="px-5 pb-4 text-xs text-muted-foreground">
                Creada {formatDate(campaign.created_at)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
