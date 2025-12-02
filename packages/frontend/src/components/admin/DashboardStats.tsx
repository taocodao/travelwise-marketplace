'use client';

import { DollarSign, Users, Activity, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Execution {
  id: string;
  agent?: {
    name: string;
  } | null;
  tool?: {
    name: string;
  } | null;
  totalCost: number | string;
  paymentStatus: string;
  createdAt: string | Date;
}

interface DashboardStatsProps {
  stats: {
    totalAgents: number;
    totalExecutions: number;
    totalRevenue: number | string;
    recentExecutions: Execution[];
  };
  onRefresh: () => void;
}

export function DashboardStats({ stats, onRefresh }: DashboardStatsProps) {
  // Safely convert totalRevenue to number
  const revenue = typeof stats.totalRevenue === 'string' 
    ? parseFloat(stats.totalRevenue) || 0
    : Number(stats.totalRevenue) || 0;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Total Agents"
          value={stats.totalAgents}
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Total Executions"
          value={stats.totalExecutions}
          icon={Activity}
          color="green"
        />
        <StatCard
          title="Total Revenue"
          value={`$${revenue.toFixed(2)}`}
          icon={DollarSign}
          color="purple"
        />
        <StatCard
          title="Active Now"
          value="3"
          icon={TrendingUp}
          color="orange"
        />
      </div>

      {/* Recent Executions Table */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">
            Recent Executions
          </h2>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-gray-400 font-medium">
                  Agent
                </th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">
                  Tool
                </th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">
                  Cost
                </th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">
                  Status
                </th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.recentExecutions && stats.recentExecutions.length > 0 ? (
                stats.recentExecutions.map((execution) => (
                  <tr
                    key={execution.id}
                    className="border-b border-gray-700 hover:bg-gray-750 transition"
                  >
                    <td className="py-3 px-4 text-white">
                      {execution.agent?.name || 'Unknown'}
                    </td>
                    <td className="py-3 px-4 text-gray-300">
                      {execution.tool?.name || 'Unknown'}
                    </td>
                    <td className="py-3 px-4 text-green-400">
                      ${formatCost(execution.totalCost)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={execution.paymentStatus} />
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-sm">
                      {formatDate(execution.createdAt)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">
                    No executions yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

function StatCard({ title, value, icon: Icon, color }: StatCardProps) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400',
    green: 'bg-green-500/10 text-green-400',
    purple: 'bg-purple-500/10 text-purple-400',
    orange: 'bg-orange-500/10 text-orange-400',
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm mb-1">{title}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

interface StatusBadgeProps {
  status: string;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const colors: Record<string, string> = {
    PENDING: 'bg-yellow-500/10 text-yellow-400',
    AUTHORIZED: 'bg-blue-500/10 text-blue-400',
    SETTLED: 'bg-green-500/10 text-green-400',
    FAILED: 'bg-red-500/10 text-red-400',
  };

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${
        colors[status] || 'bg-gray-500/10 text-gray-400'
      }`}
    >
      {status}
    </span>
  );
}

// Helper functions
function formatCost(cost: number | string): string {
  const numCost = typeof cost === 'string' ? parseFloat(cost) : cost;
  return (numCost || 0).toFixed(4);
}

function formatDate(date: string | Date): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return formatDistanceToNow(dateObj, { addSuffix: true });
  } catch (error) {
    return 'Unknown';
  }
}
