'use client';

import { useEffect, useState, useRef } from 'react';
import { Plus, Users, Upload, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import Papa from 'papaparse';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TopBar } from '@/components/shared/sidebar';
import { formatPhone, formatDate } from '@/lib/utils/index';
import type { Prospect, ProspectStatus } from '@orkesta/shared';

const statusColors: Record<ProspectStatus, 'default' | 'secondary' | 'success' | 'warning' | 'info' | 'destructive' | 'outline'> = {
  new: 'info',
  contacted: 'secondary',
  interested: 'warning',
  qualified: 'default',
  converted: 'success',
  lost: 'destructive',
};

const statusLabels: Record<ProspectStatus, string> = {
  new: 'Nuevo',
  contacted: 'Contactado',
  interested: 'Interesado',
  qualified: 'Calificado',
  converted: 'Convertido',
  lost: 'Perdido',
};

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', company: '', title: '' });
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const LIMIT = 20;

  const fetchProspects = async () => {
    setLoading(true);
    const supabase = getSupabaseClient();
    let query = supabase
      .from('prospects')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * LIMIT, page * LIMIT - 1);

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,company.ilike.%${search}%`);
    }

    const { data, count } = await query;
    setProspects(data ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  };

  useEffect(() => { fetchProspects(); }, [page, search]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user!.id).single();

    await supabase.from('prospects').insert({
      ...form,
      organization_id: profile!.organization_id,
      status: 'new',
      tags: [],
      custom_fields: {},
    });

    setForm({ full_name: '', phone: '', email: '', company: '', title: '' });
    setShowForm(false);
    setSaving(false);
    fetchProspects();
  };

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user!.id).single();

        const records = (results.data as Record<string, string>[])
          .filter((r) => r.full_name || r.nombre)
          .map((r) => ({
            full_name: r.full_name || r.nombre || '',
            phone: r.phone || r.telefono || r.tel || '',
            email: r.email || r.correo || null,
            company: r.company || r.empresa || null,
            title: r.title || r.puesto || null,
            notes: r.notes || r.notas || null,
            organization_id: profile!.organization_id,
            status: 'new' as ProspectStatus,
            tags: [],
            custom_fields: {},
          }))
          .filter((r) => r.full_name && r.phone);

        if (records.length > 0) {
          await supabase.from('prospects').insert(records);
          fetchProspects();
        }
      },
    });

    e.target.value = '';
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Prospectos" />
      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">{total} prospectos en total</p>
          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCSVImport} className="hidden" />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Importar CSV
            </Button>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              Agregar prospecto
            </Button>
          </div>
        </div>

        {showForm && (
          <Card className="border-primary/30">
            <CardContent className="pt-6">
              <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Nombre *</Label>
                  <Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Teléfono *</Label>
                  <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} required placeholder="+52..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Empresa</Label>
                  <Input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Puesto</Label>
                  <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="flex items-end gap-2">
                  <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Agregar'}</Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, teléfono o empresa..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
          </div>
        ) : prospects.length === 0 ? (
          <div className="text-center py-20">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-heading font-semibold text-lg mb-2">Sin prospectos</h3>
            <p className="text-muted-foreground text-sm">Importa un CSV o agrega prospectos manualmente</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="text-left py-3 px-4 font-medium">Nombre</th>
                  <th className="text-left py-3 px-4 font-medium">Teléfono</th>
                  <th className="text-left py-3 px-4 font-medium">Empresa</th>
                  <th className="text-left py-3 px-4 font-medium">Estado</th>
                  <th className="text-left py-3 px-4 font-medium">Creado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {prospects.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/50 transition-colors">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium">{p.full_name}</p>
                        {p.title && <p className="text-xs text-muted-foreground">{p.title}</p>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{formatPhone(p.phone)}</td>
                    <td className="py-3 px-4 text-muted-foreground">{p.company ?? '—'}</td>
                    <td className="py-3 px-4">
                      <Badge variant={statusColors[p.status]}>{statusLabels[p.status]}</Badge>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">{formatDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
