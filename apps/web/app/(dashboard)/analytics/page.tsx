'use client';

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Phone, TrendingUp, Clock, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn, formatDuration } from '@/lib/utils/index';
import { TopBar } from '@/components/shared/sidebar';

interface AnalyticsSummary {
  total_calls: number;
  completed_calls: number;
  conversion_rate: number;
  avg_duration_seconds: number;
  calls_by_outcome: Array<{ outcome: string; count: number }>;
  sentiment_distribution: Array<{ label: string; count: number }>;
}

const OUTCOME_LABELS: Record<string, string> = {
  interested: 'Interesado',
  not_interested: 'No interesado',
  callback: 'Callback',
  converted: 'Convertido',
  voicemail: 'Buzón',
  wrong_number: 'Núm. incorrecto',
  no_answer: 'Sin respuesta',
};

const OUTCOME_COLORS: Record<string, string> = {
  interested: '#4186ff',
  not_interested: '#ef4444',
  callback: '#f59e0b',
  converted: '#22c55e',
  voicemail: '#8b5cf6',
  wrong_number: '#6b7280',
  no_answer: '#94a3b8',
};

const SENTIMENT_COLORS = ['#22c55e', '#f59e0b', '#ef4444'];

const MOCK_DATA: AnalyticsSummary = {
  total_calls: 248,
  completed_calls: 201,
  conversion_rate: 12.5,
  avg_duration_seconds: 187,
  calls_by_outcome: [
    { outcome: 'interested', count: 42 },
    { outcome: 'not_interested', count: 89 },
    { outcome: 'callback', count: 31 },
    { outcome: 'converted', count: 18 },
    { outcome: 'voicemail', count: 24 },
    { outcome: 'no_answer', count: 44 },
  ],
  sentiment_distribution: [
    { label: 'Positivo', count: 71 },
    { label: 'Neutral', count: 98 },
    { label: 'Negativo', count: 32 },
  ],
};

interface StatCardProps {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
  trend?: string;
}

function StatCard({ title, value, description, icon: Icon, trend }: StatCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold font-heading text-foreground mt-1">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
            {trend && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 mt-2">
                <TrendingUp className="h-3 w-3" />
                {trend}
              </span>
            )}
          </div>
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/60 to-primary-light" />
    </Card>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/calls/analytics/summary`,
          { cache: 'no-store' }
        );
        if (!res.ok) throw new Error('fetch failed');
        const json = await res.json();
        setData(json.data ?? json);
      } catch {
        setData(MOCK_DATA);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  const outcomesForChart = (data?.calls_by_outcome ?? []).map((item) => ({
    ...item,
    label: OUTCOME_LABELS[item.outcome] ?? item.outcome,
    fill: OUTCOME_COLORS[item.outcome] ?? '#4186ff',
  }));

  return (
    <div className="min-h-screen bg-muted/30">
      <TopBar title="Analytics" />
      <div className="p-6 space-y-6 animate-fade-in">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Resumen de rendimiento de tus campañas y agentes
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded w-2/3 mb-3" />
                  <div className="h-8 bg-muted rounded w-1/2 mb-2" />
                  <div className="h-3 bg-muted rounded w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard
                title="Total de llamadas"
                value={data.total_calls.toLocaleString('es-MX')}
                description="En todos los períodos"
                icon={Phone}
                trend="+8% este mes"
              />
              <StatCard
                title="Tasa de conversión"
                value={`${data.conversion_rate.toFixed(1)}%`}
                description="Llamadas convertidas"
                icon={Target}
                trend="+2.3% vs mes anterior"
              />
              <StatCard
                title="Duración promedio"
                value={formatDuration(data.avg_duration_seconds)}
                description="Por llamada completada"
                icon={Clock}
              />
              <StatCard
                title="Completadas"
                value={data.completed_calls.toLocaleString('es-MX')}
                description={`de ${data.total_calls} totales`}
                icon={TrendingUp}
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle>Llamadas por resultado</CardTitle>
                  <CardDescription>Distribución de resultados en todas las llamadas</CardDescription>
                </CardHeader>
                <CardContent className="pb-6">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={outcomesForChart}
                      margin={{ top: 4, right: 8, left: -16, bottom: 40 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        angle={-30}
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        }}
                        formatter={(value: number) => [value, 'Llamadas']}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {outcomesForChart.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Distribución de sentimiento</CardTitle>
                  <CardDescription>Sentimiento detectado en las llamadas</CardDescription>
                </CardHeader>
                <CardContent className="pb-6">
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={data.sentiment_distribution}
                        dataKey="count"
                        nameKey="label"
                        cx="50%"
                        cy="45%"
                        outerRadius={90}
                        innerRadius={50}
                        paddingAngle={3}
                      >
                        {data.sentiment_distribution.map((_, index) => (
                          <Cell
                            key={index}
                            fill={SENTIMENT_COLORS[index % SENTIMENT_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                        }}
                        formatter={(value: number) => [value, 'Llamadas']}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        formatter={(value) => (
                          <span style={{ fontSize: 12, color: '#64748b' }}>{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Desglose por resultado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {outcomesForChart.map((item) => {
                    const pct =
                      data.total_calls > 0
                        ? Math.round((item.count / data.total_calls) * 100)
                        : 0;
                    return (
                      <div key={item.outcome} className="flex items-center gap-3">
                        <div
                          className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: item.fill }}
                        />
                        <span className="text-sm text-foreground w-36 flex-shrink-0">
                          {item.label}
                        </span>
                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, backgroundColor: item.fill }}
                          />
                        </div>
                        <span className="text-sm font-medium text-foreground w-10 text-right">
                          {item.count}
                        </span>
                        <span className="text-xs text-muted-foreground w-10 text-right">
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
