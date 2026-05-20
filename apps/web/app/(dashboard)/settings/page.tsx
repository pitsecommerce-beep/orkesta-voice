'use client';

import { useEffect, useState } from 'react';
import { User, Key, CreditCard, Save, Building2, Eye, EyeOff } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { TopBar } from '@/components/shared/sidebar';
import { cn } from '@/lib/utils/index';
import type { Profile, Organization } from '@orkesta/shared';

type Tab = 'profile' | 'api_keys' | 'billing';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Perfil', icon: User },
  { id: 'api_keys', label: 'API Keys', icon: Key },
  { id: 'billing', label: 'Facturación', icon: CreditCard },
];

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
}

function ProfileTab() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setProfile(profileData as Profile);
        setFullName(profileData.full_name ?? '');

        const { data: orgData } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', profileData.organization_id)
          .single();

        if (orgData) setOrg(orgData as Organization);
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', user.id);

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}
      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 text-sm">
          Cambios guardados correctamente.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información personal</CardTitle>
          <CardDescription>Actualiza tu nombre en la plataforma</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nombre completo</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Tu nombre"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                value={profile?.id ? '' : ''}
                disabled
                placeholder="email@ejemplo.com"
                className="bg-muted text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">El email no puede modificarse desde aquí</p>
            </div>
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <div className="pt-1">
                <Badge variant="info" className="capitalize">
                  {profile?.role ?? '—'}
                </Badge>
              </div>
            </div>
            <Button type="submit" disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {org && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Organización
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Nombre</span>
              <span className="text-sm font-medium">{org.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Slug</span>
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{org.slug}</code>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ApiKeysTab() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleKey, setVisibleKey] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('api_keys')
        .select('id, name, prefix, created_at, last_used_at')
        .order('created_at', { ascending: false });
      setKeys((data as ApiKeyRow[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  function maskKey(prefix: string) {
    return `${prefix}${'•'.repeat(32)}`;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">API Keys</CardTitle>
          <CardDescription>
            Usa estas claves para autenticarte con la API de Orkesta desde tu backend
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : keys.length === 0 ? (
            <div className="text-center py-10">
              <Key className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No hay API keys generadas</p>
              <p className="text-xs text-muted-foreground mt-1">
                Contacta al administrador para obtener acceso a la API
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-muted/30"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{key.name}</p>
                    <code className="text-xs text-muted-foreground font-mono truncate block">
                      {visibleKey === key.id ? key.prefix : maskKey(key.prefix)}
                    </code>
                  </div>
                  <button
                    onClick={() => setVisibleKey(visibleKey === key.id ? null : key.id)}
                    className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    {visibleKey === key.id ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Key className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Integración con la API</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Usa tu API key en el header <code className="bg-muted px-1 rounded font-mono">Authorization: Bearer {'<key>'}</code> para
                autenticarte con el backend de Orkesta.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BillingTab() {
  return (
    <div className="space-y-6 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan actual</CardTitle>
          <CardDescription>Gestiona tu suscripción y métodos de pago</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div>
              <p className="font-semibold text-foreground">Plan Profesional</p>
              <p className="text-xs text-muted-foreground mt-0.5">Hasta 5,000 llamadas / mes</p>
            </div>
            <Badge variant="success">Activo</Badge>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Próxima factura</span>
              <span className="font-medium">1 Jun 2026</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Monto</span>
              <span className="font-medium">$2,999 MXN / mes</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Método de pago</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            <div className="h-8 w-12 bg-muted rounded flex items-center justify-center">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">•••• •••• •••• 4242</p>
              <p className="text-xs text-muted-foreground">Vence 12/2027</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="mt-3">
            Actualizar método de pago
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Configuración" />
      <div className="flex-1 p-6 animate-fade-in">
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold text-foreground">Configuración</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Administra tu cuenta, claves y facturación
          </p>
        </div>

        <div className="flex gap-1 mb-6 border-b">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'api_keys' && <ApiKeysTab />}
        {activeTab === 'billing' && <BillingTab />}
      </div>
    </div>
  );
}
