import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Agent {
  agent_id: number;
  agent_name: string;
  spend_cents: number;
}

interface AgentSpendChartProps {
  agents: Agent[];
  loading?: boolean;
}

export function AgentSpendChart({ agents, loading }: AgentSpendChartProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-gray-80 bg-gray-90 p-6">
        <div className="h-80 bg-gray-80 rounded animate-pulse" />
      </div>
    );
  }

  // Sort by spend descending (already sorted from API, but ensure it)
  const sortedAgents = [...agents].sort((a, b) => b.spend_cents - a.spend_cents);

  // Prepare data for recharts (horizontal bar chart uses XAxis for values)
  const chartData = sortedAgents.map((agent) => ({
    name: agent.agent_name || `Agent ${agent.agent_id}`,
    spend: agent.spend_cents / 100, // Convert to dollars
    spend_cents: agent.spend_cents,
  }));

  return (
    <div className="rounded-lg border border-gray-80 bg-gray-90 p-6">
      <h3 className="text-sm font-medium text-gray-50 mb-4">Agent Spend Breakdown</h3>

      {sortedAgents.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-50">
          <p className="text-sm">No agent activity this month</p>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(82, 82, 82)" />
              <XAxis
                type="number"
                stroke="rgb(142, 142, 142)"
                tick={{ fill: 'rgb(142, 142, 142)', fontSize: 12 }}
                tickFormatter={(value) => `$${value.toFixed(2)}`}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="rgb(142, 142, 142)"
                tick={{ fill: 'rgb(142, 142, 142)', fontSize: 12 }}
                width={110}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgb(38, 38, 38)',
                  border: '1px solid rgb(82, 82, 82)',
                  borderRadius: '4px',
                  color: 'rgb(242, 242, 242)',
                }}
                formatter={(value: number) => [`$${value.toFixed(2)}`, 'Spend']}
                labelStyle={{ color: 'rgb(242, 242, 242)' }}
              />
              <Bar
                dataKey="spend"
                fill="rgb(15, 98, 254)" // IBM Carbon blue-60
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>

          {/* Agent List with Details */}
          <div className="mt-6 space-y-2">
            <h4 className="text-xs font-medium text-gray-50 uppercase tracking-wider mb-3">
              Detailed Breakdown
            </h4>
            {sortedAgents.map((agent) => (
              <div
                key={agent.agent_id}
                className="flex items-center justify-between p-3 rounded bg-gray-100 hover:bg-gray-90 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-30">
                    {agent.agent_name || `Agent ${agent.agent_id}`}
                  </p>
                  <p className="text-xs text-gray-50">ID: {agent.agent_id}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-10">
                    ${(agent.spend_cents / 100).toFixed(2)}
                  </p>
                  {agent.spend_cents === 0 && (
                    <p className="text-xs text-gray-50">No spend</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
