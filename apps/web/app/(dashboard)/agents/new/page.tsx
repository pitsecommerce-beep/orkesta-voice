'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TopBar } from '@/components/shared/sidebar';

const DEFAULT_SYSTEM_PROMPT = `Eres un agente de ventas profesional mexicano. Tu objetivo es vender los productos y servicios de la empresa de manera consultiva y empática.

REGLAS IMPORTANTES:
- Habla siempre en español mexicano natural y profesional
- Escucha activamente las necesidades del prospecto
- No seas insistente ni agresivo
- Si el prospecto no está interesado, agradece su tiempo cortésmente
- Mantén respuestas cortas y naturales para una conversación fluida
- Nunca inventes información sobre productos o precios

MANEJO DE OBJECIONES:
- "Está muy caro": Enfócate en el valor y ROI
- "No me interesa": Pregunta sobre sus necesidades actuales
- "Ya tengo proveedor": Menciona diferenciadores clave
- "Necesito pensarlo": Ofrece más información o una demo`;

export default function NewAgentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    persona: '',
    system_prompt: DEFAULT_SYSTEM_PROMPT,
    greeting: 'Hola, buen día. ¿Me podría comunicar con el responsable de [área relevante]?',
    voice_id: '',
    language: 'es-MX',
    max_call_duration_seconds: 300,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile?.organization_id) {
      setError('No se encontró organización');
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from('agents').insert({
      ...form,
      organization_id: profile.organization_id,
      max_call_duration_seconds: Number(form.max_call_duration_seconds),
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push('/agents');
  };

  const update = (field: string, value: string | number) =>
    setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Nuevo agente" />
      <div className="flex-1 p-6 max-w-3xl">
        <Link href="/agents" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" />
          Volver a agentes
        </Link>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Identidad del agente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nombre del agente *</Label>
                <Input
                  id="name"
                  placeholder="ej. Carlos - Vendedor Senior"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="persona">Personalidad y tono *</Label>
                <Textarea
                  id="persona"
                  placeholder="Describe el perfil del agente: experiencia, tono, estilo de comunicación..."
                  value={form.persona}
                  onChange={(e) => update('persona', e.target.value)}
                  rows={3}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="greeting">Frase de apertura *</Label>
                <Input
                  id="greeting"
                  placeholder="Hola, buen día. ¿Me podría comunicar con...?"
                  value={form.greeting}
                  onChange={(e) => update('greeting', e.target.value)}
                  required
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">System Prompt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="system_prompt">Instrucciones del agente *</Label>
                <Textarea
                  id="system_prompt"
                  value={form.system_prompt}
                  onChange={(e) => update('system_prompt', e.target.value)}
                  rows={14}
                  className="font-mono text-xs"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Define el comportamiento, objetivos, reglas y manejo de objeciones del agente.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Voz y configuración</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="voice_id">ElevenLabs Voice ID</Label>
                <Input
                  id="voice_id"
                  placeholder="pNInz6obpgDQGcFmaJgB"
                  value={form.voice_id}
                  onChange={(e) => update('voice_id', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Deja vacío para usar la voz predeterminada de la plataforma
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="language">Idioma</Label>
                  <Input id="language" value={form.language} onChange={(e) => update('language', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="duration">Duración máxima (segundos)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min={30}
                    max={1800}
                    value={form.max_call_duration_seconds}
                    onChange={(e) => update('max_call_duration_seconds', Number(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Crear agente'}
            </Button>
            <Link href="/agents">
              <Button variant="outline" type="button">Cancelar</Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
