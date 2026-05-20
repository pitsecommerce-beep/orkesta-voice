'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TopBar } from '@/components/shared/sidebar';
import type { Agent } from '@orkesta/shared';

export default function EditAgentPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<Partial<Agent>>({});

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.from('agents').select('*').eq('id', id as string).single().then(({ data }) => {
      if (data) setForm(data);
      setLoading(false);
    });
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const supabase = getSupabaseClient();
    const { error: updateError } = await supabase
      .from('agents')
      .update({
        name: form.name,
        persona: form.persona,
        system_prompt: form.system_prompt,
        greeting: form.greeting,
        voice_id: form.voice_id,
        language: form.language,
        max_call_duration_seconds: form.max_call_duration_seconds,
        is_active: form.is_active,
      })
      .eq('id', id as string);

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      router.push('/agents');
    }
  };

  const update = (field: keyof Agent, value: unknown) =>
    setForm((f) => ({ ...f, [field]: value }));

  if (loading) return <div className="p-6 text-muted-foreground">Cargando...</div>;

  return (
    <div className="flex flex-col h-full">
      <TopBar title={`Editar: ${form.name ?? ''}`} />
      <div className="flex-1 p-6 max-w-3xl">
        <Link href="/agents" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" />
          Volver a agentes
        </Link>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-4">{error}</div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">Identidad</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input value={form.name ?? ''} onChange={(e) => update('name', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Personalidad y tono</Label>
                <Textarea value={form.persona ?? ''} onChange={(e) => update('persona', e.target.value)} rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label>Frase de apertura</Label>
                <Input value={form.greeting ?? ''} onChange={(e) => update('greeting', e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">System Prompt</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                value={form.system_prompt ?? ''}
                onChange={(e) => update('system_prompt', e.target.value)}
                rows={14}
                className="font-mono text-xs"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Configuración</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>ElevenLabs Voice ID</Label>
                <Input value={form.voice_id ?? ''} onChange={(e) => update('voice_id', e.target.value)} placeholder="pNInz6obpgDQGcFmaJgB" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Idioma</Label>
                  <Input value={form.language ?? 'es-MX'} onChange={(e) => update('language', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Duración máxima (s)</Label>
                  <Input
                    type="number"
                    min={30}
                    max={1800}
                    value={form.max_call_duration_seconds ?? 300}
                    onChange={(e) => update('max_call_duration_seconds', Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active ?? true}
                  onChange={(e) => update('is_active', e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                <Label htmlFor="is_active">Agente activo</Label>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
            <Link href="/agents"><Button variant="outline" type="button">Cancelar</Button></Link>
          </div>
        </form>
      </div>
    </div>
  );
}
