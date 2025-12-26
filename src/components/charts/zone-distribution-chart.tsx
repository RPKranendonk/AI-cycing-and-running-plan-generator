// ============================================================================
// ZONE DISTRIBUTION CHART
// Time in Zone pie/donut chart
// ============================================================================

import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Legend,
    Tooltip,
} from 'recharts';

interface ZoneData {
    name: string;
    value: number;
    color: string;
    [key: string]: string | number; // Index signature for Recharts
}

interface ZoneDistributionChartProps {
    data: ZoneData[];
    height?: number;
}

export function ZoneDistributionChart({ data, height = 250 }: ZoneDistributionChartProps) {
    return (
        <ResponsiveContainer width="100%" height={height}>
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                >
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                </Pie>
                <Tooltip
                    formatter={(value) => `${value} min`}
                    contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.75rem',
                    }}
                />
                <Legend />
            </PieChart>
        </ResponsiveContainer>
    );
}
