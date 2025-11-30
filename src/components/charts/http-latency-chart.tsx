'use client';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface HttpLatencyChartProps {
  data: Array<{
    path: string;
    count: number;
    avgLatencyMs: number;
  }>;
}

export function HttpLatencyChart({ data }: HttpLatencyChartProps) {
  // Format path for display (truncate long paths)
  const chartData = data.map((item) => ({
    ...item,
    displayPath: item.path.length > 20 ? item.path.slice(0, 20) + '...' : item.path,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">HTTP Latency by Path</CardTitle>
        <CardDescription>Average response time per endpoint</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            No HTTP metrics available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20 }}>
              <XAxis
                type="number"
                tickFormatter={(value) => `${value}ms`}
                fontSize={12}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                type="category"
                dataKey="displayPath"
                width={100}
                fontSize={11}
                stroke="hsl(var(--muted-foreground))"
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload;
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-md">
                      <p className="text-xs font-medium">{item.path}</p>
                      <p className="text-xs text-muted-foreground">
                        Avg: {item.avgLatencyMs.toFixed(2)}ms
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Requests: {item.count.toLocaleString()}
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="avgLatencyMs" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
