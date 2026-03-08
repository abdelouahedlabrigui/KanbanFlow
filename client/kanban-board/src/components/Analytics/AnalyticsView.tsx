import React, { useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { Clock, Zap, TrendingUp, AlertTriangle, RotateCcw, Users, Calendar } from 'lucide-react';
import { useBoardStore } from '../../store/boardStore';

interface Props { boardId: string; }

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: '#ff4757',
  HIGH: '#f59e0b',
  MEDIUM: '#00d4ff',
  LOW: '#10e080',
};

export function AnalyticsView({ boardId }: Props) {
  const { analytics, fetchAnalytics } = useBoardStore();

  useEffect(() => {
    fetchAnalytics(boardId);
    const interval = setInterval(() => fetchAnalytics(boardId), 30000);
    return () => clearInterval(interval);
  }, [boardId]);

  if (!analytics) {
    return <div className="loading-full"><div className="spinner" /><span>Loading metrics...</span></div>;
  }

  const fmtHours = (h: number) => h < 24 ? `${Math.round(h)}h` : `${Math.round(h / 24)}d`;

  return (
    <div className="analytics-view">
      {/* KPI Cards */}
      <div className="analytics-grid">
        <div className="metric-card metric-accent-cyan">
          <div className="metric-label"><Clock size={12} style={{ display: 'inline', marginRight: 4 }} />Avg Lead Time</div>
          <div className="metric-value">{fmtHours(analytics.leadTime.average || 0)}</div>
          <div className="metric-sub">
            Min: {fmtHours(analytics.leadTime.min || 0)} · Max: {fmtHours(analytics.leadTime.max || 0)}
          </div>
        </div>

        <div className="metric-card metric-accent-green">
          <div className="metric-label"><Zap size={12} style={{ display: 'inline', marginRight: 4 }} />Avg Cycle Time</div>
          <div className="metric-value">{fmtHours(analytics.cycleTime.average || 0)}</div>
          <div className="metric-sub">Time in "Doing" stages</div>
        </div>

        <div className="metric-card metric-accent-amber">
          <div className="metric-label"><TrendingUp size={12} style={{ display: 'inline', marginRight: 4 }} />Throughput / Week</div>
          <div className="metric-value">{analytics.throughput.averagePerWeek}</div>
          <div className="metric-sub">This week: {analytics.throughput.completedThisWeek} cards</div>
        </div>

        <div className="metric-card metric-accent-red">
          <div className="metric-label"><AlertTriangle size={12} style={{ display: 'inline', marginRight: 4 }} />Overdue Cards</div>
          <div className="metric-value">{analytics.overdueCount}</div>
          <div className="metric-sub">Past due date</div>
        </div>

        <div className="metric-card">
          <div className="metric-label"><RotateCcw size={12} style={{ display: 'inline', marginRight: 4 }} />Recycle Rate</div>
          <div className="metric-value" style={{ color: analytics.recycleRate.rate > 20 ? 'var(--accent-red)' : 'var(--text-0)' }}>
            {analytics.recycleRate.rate}%
          </div>
          <div className="metric-sub">{analytics.recycleRate.recycles} of {analytics.recycleRate.totalMoves} moves</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Bottlenecks</div>
          <div className="metric-value" style={{ color: analytics.bottleneckColumns.length ? 'var(--accent-red)' : 'var(--accent-green)' }}>
            {analytics.bottleneckColumns.length}
          </div>
          <div className="metric-sub">{analytics.bottleneckColumns.length ? 'Columns at WIP limit' : 'No bottlenecks'}</div>
        </div>
      </div>

      {/* WIP Utilization */}
      <div className="chart-section">
        <div className="chart-title">WIP Utilization</div>
        {analytics.wipUtilization.map((col) => {
          const pct = col.limit ? Math.min((col.count / col.limit) * 100, 100) : 0;
          const color = col.isBottleneck ? 'var(--accent-red)' : col.color;
          return (
            <div key={col.columnId} className="wip-bar-row">
              <span className="wip-col-label" style={{ color: col.isBottleneck ? 'var(--accent-red)' : 'var(--text-1)' }}>
                {col.isBottleneck && '⚠ '}{col.title}
              </span>
              <div className="wip-bar-track">
                <div className="wip-bar-fill" style={{ width: `${pct}%`, background: color }} />
              </div>
              <span className="wip-bar-count">
                {col.count}{col.limit ? `/${col.limit}` : ''}
              </span>
            </div>
          );
        })}
      </div>

      {/* Throughput Chart */}
      {analytics.throughput.weekly.length > 0 && (
        <div className="chart-section">
          <div className="chart-title"><TrendingUp size={13} style={{ display: 'inline', marginRight: 5 }} />Weekly Throughput</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={analytics.throughput.weekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="WEEK_START" tick={{ fill: 'var(--text-2)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-2)', fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6 }} />
              <Bar dataKey="COMPLETED" fill="var(--accent-cyan)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, margin: '0 20px 20px' }}>
        {/* Priority Distribution */}
        {analytics.priorityDistribution.length > 0 && (
          <div className="chart-section" style={{ margin: 0 }}>
            <div className="chart-title">Open by Priority</div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={analytics.priorityDistribution}
                  dataKey="CNT"
                  nameKey="PRIORITY"
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  label={({ PRIORITY, CNT }) => `${PRIORITY}: ${CNT}`}
                  labelLine={{ stroke: 'var(--text-2)' }}
                >
                  {analytics.priorityDistribution.map((entry) => (
                    <Cell key={entry.PRIORITY} fill={PRIORITY_COLORS[entry.PRIORITY] ?? '#6B7280'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Owner Workload */}
        {analytics.ownerWorkload.length > 0 && (
          <div className="chart-section" style={{ margin: 0 }}>
            <div className="chart-title"><Users size={13} style={{ display: 'inline', marginRight: 5 }} />Team Workload</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={analytics.ownerWorkload} layout="vertical">
                <XAxis type="number" tick={{ fill: 'var(--text-2)', fontSize: 10 }} allowDecimals={false} />
                <YAxis dataKey="OWNER" type="category" tick={{ fill: 'var(--text-1)', fontSize: 11 }} width={80} />
                <Tooltip contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }} />
                <Bar dataKey="IN_PROGRESS" name="In Progress" fill="var(--accent-violet)" stackId="a" radius={0} />
                <Bar dataKey="DONE" name="Done" fill="var(--accent-green)" stackId="a" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Aging Cards */}
      {analytics.agingCards.length > 0 && (
        <div className="chart-section" style={{ marginBottom: 24 }}>
          <div className="chart-title"><Calendar size={13} style={{ display: 'inline', marginRight: 5 }} />Oldest Open Cards</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ color: 'var(--text-2)', borderBottom: '1px solid var(--border)' }}>
                {['Card', 'Column', 'Owner', 'Priority', 'Age'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analytics.agingCards.map((card, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-1)' }}>
                  <td style={{ padding: '7px 8px' }}>{card.CARD_TITLE}</td>
                  <td style={{ padding: '7px 8px', color: 'var(--text-2)' }}>{card.COL_TITLE}</td>
                  <td style={{ padding: '7px 8px', color: 'var(--text-2)' }}>{card.OWNER}</td>
                  <td style={{ padding: '7px 8px' }}>
                    <span style={{ color: PRIORITY_COLORS[card.PRIORITY] ?? 'var(--text-2)', fontSize: '0.72rem', fontWeight: 700 }}>
                      {card.PRIORITY}
                    </span>
                  </td>
                  <td style={{ padding: '7px 8px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: card.DAYS_OLD > 14 ? 'var(--accent-red)' : 'var(--text-2)' }}>
                    {card.DAYS_OLD}d
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
