'use client';

import { useEffect, useState, useRef } from 'react';
import { Plus, Package, Pencil, Trash2, Upload } from 'lucide-react';
import Papa from 'papaparse';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TopBar } from '@/components/shared/sidebar';
import { formatCurrency } from '@/lib/utils/index';
import type { Product } from '@orkesta/shared';

type ProductForm = Omit<Product, 'id' | 'organization_id' | 'created_at'> & { features_text: string };

function defaultForm(): ProductForm {
  return {
    name: '',
    description: '',
    price: null,
    currency: 'MXN',
    features: [],
    features_text: '',
    is_active: true,
  };
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(defaultForm());
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProducts = async () => {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    setProducts(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user!.id).single();

    const payload = {
      name: form.name,
      description: form.description,
      price: form.price ? Number(form.price) : null,
      currency: form.currency,
      features: form.features_text.split('\n').filter(Boolean),
      is_active: form.is_active,
    };

    if (editingId) {
      await supabase.from('products').update(payload).eq('id', editingId);
    } else {
      await supabase.from('products').insert({ ...payload, organization_id: profile!.organization_id });
    }

    setShowForm(false);
    setEditingId(null);
    setForm(defaultForm());
    setSaving(false);
    fetchProducts();
  };

  const startEdit = (p: Product) => {
    setForm({
      ...p,
      price: p.price,
      features_text: (p.features as string[]).join('\n'),
    });
    setEditingId(p.id);
    setShowForm(true);
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('¿Eliminar producto?')) return;
    const supabase = getSupabaseClient();
    await supabase.from('products').delete().eq('id', id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user!.id).single();

        const records = (results.data as Record<string, string>[]).map((row) => ({
          name: row.name || row.nombre || '',
          description: row.description || row.descripcion || '',
          price: row.price || row.precio ? Number(row.price || row.precio) : null,
          currency: row.currency || row.moneda || 'MXN',
          features: (row.features || row.caracteristicas || '').split('|').filter(Boolean),
          is_active: true,
          organization_id: profile!.organization_id,
        })).filter((r) => r.name);

        await supabase.from('products').insert(records);
        fetchProducts();
      },
    });

    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Catálogo de productos" />
      <div className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">Gestiona los productos y servicios que venden tus agentes</p>
          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx" onChange={handleExcelImport} className="hidden" />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Importar CSV
            </Button>
            <Button onClick={() => { setForm(defaultForm()); setEditingId(null); setShowForm(true); }}>
              <Plus className="h-4 w-4" />
              Nuevo producto
            </Button>
          </div>
        </div>

        {showForm && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="text-lg">{editingId ? 'Editar producto' : 'Nuevo producto'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Nombre *</Label>
                  <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Precio (MXN)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.price ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Descripción</Label>
                  <Textarea
                    value={form.description ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Características (una por línea)</Label>
                  <Textarea
                    value={form.features_text}
                    onChange={(e) => setForm((f) => ({ ...f, features_text: e.target.value }))}
                    placeholder="Característica 1&#10;Característica 2"
                    rows={3}
                  />
                </div>
                <div className="md:col-span-2 flex gap-3">
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear producto'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {loading && <div className="h-32 bg-muted animate-pulse rounded-lg" />}

        {!loading && products.length === 0 && !showForm && (
          <div className="text-center py-20">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-heading font-semibold text-lg mb-2">Sin productos</h3>
            <p className="text-muted-foreground text-sm mb-4">Agrega los productos que venden tus agentes</p>
            <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" />Agregar producto</Button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {products.map((product) => (
            <Card key={product.id} className="card-hover">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-base line-clamp-1">{product.name}</h3>
                  <Badge variant={product.is_active ? 'success' : 'secondary'}>
                    {product.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                {product.price != null && (
                  <p className="text-2xl font-bold text-primary mb-2">
                    {formatCurrency(product.price, product.currency)}
                  </p>
                )}
                {product.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{product.description}</p>
                )}
                {(product.features as string[]).length > 0 && (
                  <ul className="text-xs text-muted-foreground space-y-1 mb-4">
                    {(product.features as string[]).slice(0, 3).map((f, i) => (
                      <li key={i} className="flex items-center gap-1">
                        <span className="text-primary">•</span> {f}
                      </li>
                    ))}
                    {(product.features as string[]).length > 3 && (
                      <li className="text-xs">+{(product.features as string[]).length - 3} más</li>
                    )}
                  </ul>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => startEdit(product)}>
                    <Pencil className="h-3 w-3" />
                    Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteProduct(product.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
