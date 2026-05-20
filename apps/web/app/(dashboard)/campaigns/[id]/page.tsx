'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Play, Pause, Phone, Users, CheckCircle, XCircle, Clock } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TopBar } from '@/components/shared/sidebar';
import { formatDate, formatPhone } from '@/lib/utils/index';
import type { CampaignStatus } from '@orkesta/shared';

interface CampaignDetail {
  id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  created_at: string;
  agents: { id: string; name: string } | null;
  campaign_prospects: Array<{
    id: string;
    call_status: string;
    prospects: { id: string; full_name: string; phone: string; company: string | null };
  }>;
}

export default function CampaignDetailPage() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [initiating, setInitiating] = useState<string | null>(null);

  const fetchCampaign = async () => {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('campaigns')
      .select('*, agents(id, name), campaign_prospects(id, call_status, prospects(id, full_name, phone, company))')
      .eq('id', id as string)
      .single();
    setCampaign(data as CampaignDetail);
    setLoading(false);
  };

  useEffect(() => { fetchCampaign(); }, [id]);

  const toggleStatus = async () => {
    if (!campaign) return;
    const supabase = getSupabaseClient();
    const newStatus: CampaignStatus = campaign.status === 'active' ? 'paused' : 'active';
    await supabase.from('campaigns').update({ status: newStatus }).eq('id', id as string);
    setCampaign((c) => c ? { ...c, status: newStatus } : c);
  };

  const initiateCall = async (prospectId: string) => {
    if (!campaign?.agents) {
      alert('Asigna un agente a esta campaña primero');
      return;
    }
    setInitiating(prospectId);

    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    await fetch(`${apiUrl}/calls/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        agent_id: campaign.agents.id,
        prospect_id: prospectId,
        campaign_id: campaign.id,
      }),
    });

    setInitiating(null);
    fetchCampaign();
  };

  const stats = campaign ? {
    total: campaign.campaign_prospects.length,
    pending: campaign.campaign_prospects.filter((cp) => cp.call_status === 'pending').length,
    completed: campaign.campaign_prospects.filter((cp) => cp.call_status === 'completed').length,
    failed: campaign.campaign_prospects.filter((cp) => ['failed', 'no_answer'].includes(cp.call_status)).length,
  } : null;

  const callStatusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'success' | 'destructive' | 'secondary' | 'warning' | 'info' | 'outline' }> = {
      pending: { label: 'Pendiente', variant: 'secondary' },
      in_progress: { label: 'En curso', variant: 'info' },
      completed: { label: 'Completada', variant: 'success' },
      failed: { label: 'Fallida', variant: 'destructive' },
      no_answer: { label: 'Sin respuesta', variant: 'warning' },
      scheduled: { label: 'Programada', variant: 'outline' },
    };
    const cfg = map[status] ?? { label: status, variant: 'secondary' as const };
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <TopBar />
        <div className="p-6 space-y-4">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-32 bg-muted animate-pulse rounded-lg" />
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex flex-col h-full">
        <TopBar />
        <div className="p-6">
          <p className="text-muted-foreground">Campaña no encontrada</p>
          <Link href="/campaigns"><Button variant="outline" className="mt-4">Volver</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar title={campaign.name} />
      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="flex items-center justify-between">
          <Link href="/campaigns" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Volver a campañas
          </Link>
          {campaign.status !== 'completed' && (
            <Button variant="outline" onClick={toggleStatus}>
              {campaign.status === 'active'
                ? <><Pause className="h-4 w-4" /> Pausar campaña</>
                : <><Play className="h-4 w-4" /> Activar campaña</>
              }
            </Button>
          )}
        </div>

        {/* Summary cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <Users className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Clock className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pendientes</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                <p className="text-xs text-muted-foreground">Completadas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <XCircle className="h-6 w-6 text-red-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-red-500">{stats.failed}</p>
                <p className="text-xs text-muted-foreground">Fallidas</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Campaign info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalles</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Estado</p>
              <Badge variant={campaign.status === 'active' ? 'success' : campaign.status === 'completed' ? 'info' : 'secondary'}>
                {campaign.status}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Agente asignado</p>
              <p className="font-medium">{campaign.agents?.name ?? 'Sin asignar'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Creada</p>
              <p>{formatDate(campaign.created_at)}</p>
            </div>
            {campaign.description && (
              <div className="col-span-2">
                <p className="text-muted-foreground text-xs">Descripción</p>
                <p>{campaign.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Prospects table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prospectos ({campaign.campaign_prospects.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {campaign.campaign_prospects.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">
                No hay prospectos en esta campaña aún
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs uppercase tracking-wider">
                      <th className="text-left py-3 px-3 font-medium">Nombre</th>
                      <th className="text-left py-3 px-3 font-medium">Teléfono</th>
                      <th className="text-left py-3 px-3 font-medium">Empresa</th>
                      <th className="text-left py-3 px-3 font-medium">Estado</th>
                      <th className="text-left py-3 px-3 font-medium">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {campaign.campaign_prospects.map((cp) => (
                      <tr key={cp.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3 px-3 font-medium">{cp.prospects.full_name}</td>
                        <td className="py-3 px-3 text-muted-foreground">{formatPhone(cp.prospects.phone)}</td>
                        <td className="py-3 px-3 text-muted-foreground">{cp.prospects.company ?? '—'}</td>
                        <td className="py-3 px-3">{callStatusBadge(cp.call_status)}</td>
                        <td className="py-3 px-3">
                          {cp.call_status === 'pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!!initiating || !campaign.agents}
                              onClick={() => initiateCall(cp.prospects.id)}
                            >
                              <Phone className="h-3 w-3" />
                              {initiating === cp.prospects.id ? 'Llamando...' : 'Llamar'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
