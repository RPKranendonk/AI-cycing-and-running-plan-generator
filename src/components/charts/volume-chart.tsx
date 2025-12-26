// ============================================================================
// VOLUME CHART
// Weekly training volume visualization
// ============================================================================

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

interface VolumeChartProps {
    data: Array<{
        week: string;
        planned: number;
        actual: number;
    }>;
    height?: number;
}

export function VolumeChart({ data, height = 300 }: VolumeChartProps) {
    return (
        <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id="colorPlanned" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                    dataKey="week"
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(v) => `${v}km`}
                />
                <Tooltip
                    contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.75rem',
                    }}
                    labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                />
                <Area
                    type="monotone"
                    dataKey="planned"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#colorPlanned)"
                    name="Planned"
                />
                <Area
                    type="monotone"
                    dataKey="actual"
                    stroke="hsl(142, 76%, 36%)"
                    strokeWidth={2}
                    fill="url(#colorActual)"
                    name="Actual"
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}
