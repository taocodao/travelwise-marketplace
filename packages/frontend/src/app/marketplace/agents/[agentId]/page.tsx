'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

interface AgentDetails {
  id: string;
  name: string;
  description: string;
  walletAddress: string;
  isActive: boolean;
  onChainId: string;
  mcpServers: MCPServer[];
  reputation: {
    totalFeedback: number;
    averageScore: number;
    lastUpdated: string;
  };
  feedback: Feedback[];
}

interface MCPServer {
  id: string;
  name: string;
  endpoint: string;
  isActive: boolean;
  tools: Tool[];
}

interface Tool {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  baseCost: number;
  mcpServerId: string;
}

interface Feedback {
  reviewer: string;
  score: number;
  feedbackURI: string;
  timestamp: string;
  revoked: boolean;
}

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.agentId as string;

  const [agent, setAgent] = useState<AgentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);

  useEffect(() => {
    if (agentId) {
      fetchAgentDetails();
    }
  }, [agentId]);

  const fetchAgentDetails = async () => {
    try {
      setLoading(true);
      const data = await api.get(`/marketplace/agents/${agentId}`);
      setAgent(data.agent);
      setError(null);
    } catch (err) {
      setError('Failed to load agent details.');
      console.error('Error fetching agent:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading agent details...</p>
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Agent Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'The agent you are looking for does not exist.'}</p>
          <Link
            href="/marketplace"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            href="/marketplace"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Marketplace
          </Link>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{agent.name}</h1>
              <p className="mt-2 text-gray-600">{agent.description}</p>
            </div>
            {agent.isActive ? (
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                Active
              </span>
            ) : (
              <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
                Inactive
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Agent Info Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Agent Information</h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Wallet Address</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono">{agent.walletAddress}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">On-Chain ID</dt>
                  <dd className="mt-1 text-sm text-gray-900">{agent.onChainId}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">MCP Servers</dt>
                  <dd className="mt-1 text-sm text-gray-900">{agent.mcpServers.length} server(s)</dd>
                </div>
              </dl>
            </div>

            {/* Tools */}
            {agent.mcpServers.map((server) => (
              <div key={server.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">
                    {server.name}
                    {server.isActive && (
                      <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                        Active
                      </span>
                    )}
                  </h2>
                  <span className="text-sm text-gray-500">{server.tools.length} tools</span>
                </div>

                <div className="space-y-4">
                  {server.tools.map((tool) => (
                    <ToolCard
                      key={tool.id}
                      tool={tool}
                      onSelect={() => setSelectedTool(tool)}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Reviews */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Reviews & Feedback</h2>
              {agent.feedback.length === 0 ? (
                <p className="text-gray-500">No reviews yet.</p>
              ) : (
                <div className="space-y-4">
                  {agent.feedback.map((feedback, index) => (
                    <FeedbackCard key={index} feedback={feedback} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Reputation Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Reputation</h2>
              <div className="text-center mb-4">
                <div className="text-4xl font-bold text-blue-600">
                  {agent.reputation.averageScore.toFixed(1)}
                </div>
                <div className="text-sm text-gray-500 mt-1">out of 5</div>
                <div className="flex justify-center mt-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg
                      key={star}
                      className={`w-6 h-6 ${
                        star <= agent.reputation.averageScore
                          ? 'text-yellow-400 fill-current'
                          : 'text-gray-300'
                      }`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                      />
                    </svg>
                  ))}
                </div>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Reviews</span>
                  <span className="font-semibold">{agent.reputation.totalFeedback}</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-gray-600">Last Updated</span>
                  <span className="font-semibold">
                    {new Date(agent.reputation.lastUpdated).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Quick Stats</h2>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">Total Tools</dt>
                  <dd className="text-sm font-semibold">
                    {agent.mcpServers.reduce((acc, s) => acc + s.tools.length, 0)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">Active Servers</dt>
                  <dd className="text-sm font-semibold">
                    {agent.mcpServers.filter((s) => s.isActive).length}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Tool Booking Modal */}
      {selectedTool && (
        <ToolBookingModal
          tool={selectedTool}
          agentName={agent.name}
          onClose={() => setSelectedTool(null)}
        />
      )}
    </div>
  );
}

function ToolCard({ tool, onSelect }: { tool: Tool; onSelect: () => void }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{tool.name}</h3>
          <p className="text-sm text-gray-600 mt-1">{tool.description}</p>
        </div>
        <div className="text-right ml-4">
          <div className="text-lg font-bold text-blue-600">${tool.baseCost.toFixed(2)}</div>
          <div className="text-xs text-gray-500">USDC</div>
        </div>
      </div>
      <button
        onClick={onSelect}
        className="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
      >
        Book This Tool
      </button>
    </div>
  );
}

function FeedbackCard({ feedback }: { feedback: Feedback }) {
  return (
    <div className="border-b border-gray-200 pb-4 last:border-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          {[1, 2, 3, 4, 5].map((star) => (
            <svg
              key={star}
              className={`w-4 h-4 ${
                star <= feedback.score ? 'text-yellow-400 fill-current' : 'text-gray-300'
              }`}
              viewBox="0 0 24 24"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          ))}
        </div>
        <span className="text-xs text-gray-500">
          {new Date(feedback.timestamp).toLocaleDateString()}
        </span>
      </div>
      <p className="text-sm text-gray-600 font-mono truncate">{feedback.reviewer}</p>
      {feedback.revoked && (
        <span className="inline-block mt-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
          Revoked
        </span>
      )}
    </div>
  );
}

function ToolBookingModal({
  tool,
  agentName,
  onClose,
}: {
  tool: Tool;
  agentName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [inputs, setInputs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/marketplace/executions', {
        toolId: tool.id,
        input: inputs,
      });

      alert(`Execution created successfully! ID: ${response.execution.id}`);
      onClose();
      // Optionally redirect to execution status page
      // router.push(`/marketplace/executions/${response.execution.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create execution');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Book Tool</h2>
              <p className="text-gray-600 mt-1">
                {tool.name} by {agentName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Tool Description</h3>
              <p className="text-sm text-gray-600">{tool.description}</p>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold mb-3">Input Parameters</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <textarea
                  value={JSON.stringify(inputs, null, 2)}
                  onChange={(e) => {
                    try {
                      setInputs(JSON.parse(e.target.value));
                      setError(null);
                    } catch {
                      setError('Invalid JSON format');
                    }
                  }}
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded font-mono text-sm"
                  placeholder='{"key": "value"}'
                />
                <p className="text-xs text-gray-500 mt-2">
                  Enter parameters as JSON
                </p>
              </div>
            </div>

            <div className="mb-6 bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Total Cost</span>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">
                    ${tool.baseCost.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-600">USDC</div>
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : 'Confirm Booking'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
