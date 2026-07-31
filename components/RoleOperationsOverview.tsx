"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Users,
  UserCheck,
  CreditCard,
  Armchair,
  Shirt,
  PackageCheck,
  Camera,
  Mail,
  Crown,
} from "lucide-react";

export type OperationMetric = {
  key: string;
  label: string;
  value: number;
  total: number;
};

export type OperationGroup = {
  key: "students" | "staff" | "guests" | "vip";
  title: string;
  subtitle: string;
  metrics: OperationMetric[];
};

const iconByKey: Record<string, React.ComponentType<{ size?: number }>> = {
  total: Users,
  registered: UserCheck,
  paid: CreditCard,
  assigned: Armchair,
  entered: UserCheck,
  fitted: Shirt,
  collected: PackageCheck,
  photographed: Camera,
  invited: Mail,
  vip_total: Crown,
};

function percentage(value: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}

function OperationsTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as OperationMetric | undefined;
  if (!row) return null;
  const pct = percentage(row.value, row.total);
  return (
    <div className="operations-tooltip">
      <strong>{label}</strong>
      <span>{row.value.toLocaleString()} / {row.total.toLocaleString()}</span>
      <small>{pct}% complete</small>
    </div>
  );
}

function MetricCard({ metric, groupKey }: { metric: OperationMetric; groupKey: string }) {
  const Icon = iconByKey[metric.key] || Users;
  const pct = percentage(metric.value, metric.total);
  return (
    <a href={`#${groupKey}`} className="card operations-metric-card metric-link">
      <div className="operations-metric-head">
        <span className="metric-icon"><Icon size={19} /></span>
        <span className="operations-metric-label">{metric.label}</span>
      </div>
      <strong>{metric.value.toLocaleString()} <small>/ {metric.total.toLocaleString()}</small></strong>
      <div className="operations-progress" aria-label={`${pct}%`}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <span className="operations-percent">{pct}%</span>
    </a>
  );
}

export function RoleOperationsOverview({ groups }: { groups: OperationGroup[] }) {
  if (!groups.length) return null;
  return (
    <div className="role-operations-overview">
      {groups.map((group) => (
        <section className="operations-group" id={group.key} key={group.key}>
          <div className="section-title operations-group-title">
            <div>
              <span className="eyebrow">{group.title.toUpperCase()}</span>
              <h2>{group.title} operations</h2>
              <p>{group.subtitle}</p>
            </div>
          </div>

          <div className="operations-card-grid">
            {group.metrics.map((metric) => (
              <MetricCard key={`${group.key}-${metric.key}`} metric={metric} groupKey={group.key} />
            ))}
          </div>

          <div className="card operations-chart-card">
            <div className="section-title">
              <div>
                <h3>{group.title} status</h3>
                <p>Current completed count compared with the applicable total.</p>
              </div>
            </div>
            <div className="operations-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={group.metrics} margin={{ top: 14, right: 18, left: 0, bottom: 54 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,.22)" />
                  <XAxis dataKey="label" interval={0} angle={-24} textAnchor="end" height={72} tick={{ fontSize: 10, fill: "var(--muted)" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted)" }} />
                  <Tooltip
                    content={<OperationsTooltip />}
                    cursor={{ fill: "transparent" }}
                    wrapperStyle={{ outline: "none" }}
                  />
                  <Bar dataKey="value" radius={[7, 7, 0, 0]} fill="var(--gold)" activeBar={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
