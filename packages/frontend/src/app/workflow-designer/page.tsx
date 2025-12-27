'use client';

/**
 * DOE Workflow Designer
 * 
 * Based on Nick Saraev's DOE (Directive-Orchestration-Execution) Framework:
 * - DIRECTIVE: Markdown SOPs (what to do)
 * - ORCHESTRATION: AI Agent flow (how to coordinate)
 * - EXECUTION: Python scripts with self-annealing (how to do it)
 */

import React, { useState, useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { usePrivy } from '@privy-io/react-auth';
import { WalletWidget } from '@/components/WalletWidget';

// =============================================================================
// TYPES
// =============================================================================

interface DirectiveData {
  objective: string;
  successCriteria: string[];
  process: ProcessPhase[];
  qualityGates: string[];
  tools: string[];
  constraints: string[];
}

interface ProcessPhase {
  id: string;
  name: string;
  steps: string[];
}

interface ExecutionScript {
  id: string;
  name: string;
  code: string;
  version: number;
  successRate: number;
  runs: number;
  status: 'draft' | 'testing' | 'production' | 'deprecated';
}

interface WorkflowRun {
  id: string;
  timestamp: Date;
  success: boolean;
  duration: number;
  scriptsUsed: string[];
  improvements: string[];
}

// =============================================================================
// WORKFLOW TEMPLATES
// =============================================================================

const WORKFLOW_TEMPLATES = {
  lead_generation: {
    name: 'Lead Generation',
    icon: '📊',
    roi: '6-8 hrs saved',
    directive: {
      objective: 'Find qualified B2B leads using Apollo.io AI-powered search and enrich with verified contact info for outreach campaigns.',
      successCriteria: [
        '200+ qualified leads captured',
        '90%+ verified email addresses',
        'ICP match score > 70%',
        'Casual company names created',
        'Delivered as Google Sheet',
      ],
      process: [
        { id: 'discovery', name: 'AI-Powered Discovery', steps: [
          'Use Apollo MCP apollo_lead_search with natural language query',
          'AI analyzes query and generates optimal search strategy',
          'Test with 25 leads first',
          'Verify at least 85% match our ICP (Ideal Customer Profile)',
          'If below 85%, AI refines filters and retries (self-annealing)',
        ]},
        { id: 'icp_analysis', name: 'ICP Analysis', steps: [
          'Use Apollo MCP apollo_icp_mapping for market analysis',
          'Get industry distribution breakdown',
          'Get company size distribution',
          'Receive AI recommendations for targeting',
        ]},
        { id: 'full_scrape', name: 'Full Lead Capture', steps: [
          'Once test confirms quality, search full 200 leads',
          'Extract: name, title, company, email, LinkedIn',
          'Apollo returns verified emails automatically',
          'Remove duplicates and invalid records',
        ]},
        { id: 'enrichment', name: 'Contact Enrichment', steps: [
          'Use Apollo MCP apollo_people_enrichment for missing data',
          'Enrich with employment history and company details',
          'Target: 95%+ email coverage',
        ]},
        { id: 'formatting', name: 'Formatting & Export', steps: [
          'Create "casual company name" column',
          'Example: "The Baliserac Group" → "Baliserac"',
          'Add ICP match scores per lead',
          'Format as Google Sheet',
        ]},
      ],
      qualityGates: [
        'Email validation (verified status from Apollo)',
        'ICP match score > 70%',
        'Company name validation (must exist)',
        'No duplicate records',
        'All required fields populated',
      ],
      tools: ['Apollo MCP (apollo_lead_search)', 'Apollo MCP (apollo_icp_mapping)', 'Apollo MCP (apollo_people_enrichment)', 'Google Sheets API'],
      constraints: ['Only verified emails', 'Max 100 leads per API call', 'Respect Apollo rate limits'],
    },
  },
  proposal_writing: {
    name: 'Proposal Writing',
    icon: '📝',
    roi: '4-5 hrs saved',
    directive: {
      objective: 'Generate professional sales proposal from brief details and send follow-up email.',
      successCriteria: [
        'Professional PDF proposal generated',
        'Customized to company context',
        'ROI calculations included',
        'Follow-up email sent',
      ],
      process: [
        { id: 'gather', name: 'Gather Info', steps: [
          'Extract company name and industry',
          'Identify pain points from brief',
          'Note budget and timeline constraints',
        ]},
        { id: 'research', name: 'Research', steps: [
          'Research industry benchmarks',
          'Find comparable case studies',
          'Calculate potential ROI',
        ]},
        { id: 'generate', name: 'Generate Proposal', steps: [
          'Create Markdown proposal content',
          'Include executive summary',
          'Add ROI calculations',
          'Convert to PDF via Pandoc',
        ]},
        { id: 'deliver', name: 'Deliver', steps: [
          'Send proposal via email',
          'Include 4-part implementation breakdown',
          'Schedule follow-up reminder',
        ]},
      ],
      qualityGates: [
        'All numbers verified',
        'Brand voice matched',
        'PDF renders correctly',
      ],
      tools: ['Pandoc (PDF)', 'Gmail API', 'Perplexity (research)'],
      constraints: ['Match company brand voice', 'Under 5 pages'],
    },
  },
  email_sequence: {
    name: 'Email Sequence',
    icon: '✉️',
    roi: '3-4 hrs saved',
    directive: {
      objective: 'Create personalized 5-email cold outreach sequence for target audience.',
      successCriteria: [
        '5 unique emails generated',
        'Varying CTAs per email',
        'Personalization tokens included',
        'Ready for automation tool import',
      ],
      process: [
        { id: 'audience', name: 'Audience Analysis', steps: [
          'Define target persona',
          'Identify key pain points',
          'Research industry language',
        ]},
        { id: 'structure', name: 'Sequence Structure', steps: [
          'Email 1: Problem awareness',
          'Email 2: Solution introduction',
          'Email 3: Social proof',
          'Email 4: Urgency/scarcity',
          'Email 5: Final call to action',
        ]},
        { id: 'write', name: 'Write Emails', steps: [
          'Generate each email with unique angle',
          'Include personalization: {{first_name}}, {{company}}',
          'Vary subject lines',
          'Add clear CTAs',
        ]},
        { id: 'export', name: 'Export', steps: [
          'Format for automation tool (Instantly, Smartlead)',
          'Create CSV or JSON export',
          'Validate all tokens present',
        ]},
      ],
      qualityGates: [
        'No duplicate phrases across emails',
        'Each email under 150 words',
        'Subject lines under 50 chars',
      ],
      tools: ['Perplexity (research)', 'GPT-4o-mini (writing)', 'CSV export'],
      constraints: ['B2B tone', 'No spam words', 'CAN-SPAM compliant'],
    },
  },
};

// =============================================================================
// CUSTOM NODES
// =============================================================================

const PhaseNode = ({ data }: { data: { label: string; steps: string[]; status: string } }) => (
  <div style={{
    padding: '16px',
    borderRadius: '12px',
    background: data.status === 'active' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' :
                data.status === 'complete' ? 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' :
                'linear-gradient(135deg, #2d3748 0%, #1a202c 100%)',
    color: 'white',
    minWidth: '220px',
    boxShadow: data.status === 'active' ? '0 8px 25px rgba(102, 126, 234, 0.5)' : '0 4px 15px rgba(0,0,0,0.3)',
    border: data.status === 'active' ? '2px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.1)',
  }}>
    <Handle type="target" position={Position.Top} style={{ background: '#667eea' }} />
    <Handle type="source" position={Position.Bottom} style={{ background: '#667eea' }} />
    <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>{data.label}</div>
    <div style={{ fontSize: '11px', opacity: 0.9 }}>
      {data.steps.slice(0, 2).map((step, i) => (
        <div key={i} style={{ marginBottom: '4px' }}>• {step}</div>
      ))}
      {data.steps.length > 2 && (
        <div style={{ opacity: 0.7 }}>+{data.steps.length - 2} more steps</div>
      )}
    </div>
  </div>
);

const SelfAnnealingNode = ({ data }: { data: { label: string } }) => (
  <div style={{
    padding: '12px 20px',
    borderRadius: '20px',
    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    color: 'white',
    textAlign: 'center',
    boxShadow: '0 4px 15px rgba(240, 147, 251, 0.4)',
  }}>
    <Handle type="target" position={Position.Top} style={{ background: '#f5576c' }} />
    <Handle type="source" position={Position.Bottom} style={{ background: '#f5576c' }} />
    <div style={{ fontWeight: 'bold', fontSize: '13px' }}>🔄 {data.label}</div>
    <div style={{ fontSize: '10px', opacity: 0.9 }}>Self-Improving</div>
  </div>
);

const EvaluateNode = ({ data }: { data: { label: string; criteria: string } }) => (
  <div style={{
    padding: '12px 20px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    color: 'white',
    textAlign: 'center',
    minWidth: '180px',
    boxShadow: '0 4px 15px rgba(79, 172, 254, 0.4)',
  }}>
    <Handle type="target" position={Position.Top} style={{ background: '#00f2fe' }} />
    <Handle type="source" position={Position.Bottom} id="pass" style={{ left: '30%', background: '#38ef7d' }} />
    <Handle type="source" position={Position.Bottom} id="fail" style={{ left: '70%', background: '#f5576c' }} />
    <div style={{ fontWeight: 'bold', fontSize: '13px' }}>⚖️ {data.label}</div>
    <div style={{ fontSize: '10px', opacity: 0.9, marginTop: '4px' }}>{data.criteria}</div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '10px' }}>
      <span style={{ color: '#38ef7d' }}>✓ Pass</span>
      <span style={{ color: '#f5576c' }}>✗ Retry</span>
    </div>
  </div>
);

const nodeTypes: NodeTypes = {
  phase: PhaseNode,
  selfAnnealing: SelfAnnealingNode,
  evaluate: EvaluateNode,
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function DOEWorkflowDesigner() {
  // Privy Authentication
  const { ready, authenticated, user, login } = usePrivy();
  
  // State
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof WORKFLOW_TEMPLATES>('lead_generation');
  const [directive, setDirective] = useState<DirectiveData>(WORKFLOW_TEMPLATES.lead_generation.directive);
  const [activePhase, setActivePhase] = useState<string | null>(null);
  const [executionScripts, setExecutionScripts] = useState<ExecutionScript[]>([
    { id: 'lead_search', name: 'apollo_lead_search.ts', code: '// Apollo MCP call', version: 1, successRate: 0, runs: 0, status: 'draft' },
    { id: 'icp_mapping', name: 'apollo_icp_mapping.ts', code: '// Apollo MCP call', version: 1, successRate: 0, runs: 0, status: 'draft' },
    { id: 'enrichment', name: 'apollo_enrichment.ts', code: '// Apollo MCP call', version: 1, successRate: 0, runs: 0, status: 'draft' },
  ]);
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  
  // New state for real execution
  const [showSettings, setShowSettings] = useState(false);
  const [apolloApiKey, setApolloApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  // Use wallet address as userId
  const userId = user?.wallet?.address || 'not-connected';
  const [workflowResults, setWorkflowResults] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [showQueryInput, setShowQueryInput] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Generate nodes from directive
  const generateNodes = useCallback((): Node[] => {
    const nodes: Node[] = [];
    let y = 50;
    
    // Start node
    nodes.push({
      id: 'start',
      type: 'input',
      position: { x: 250, y },
      data: { label: '📥 User Request' },
      style: {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '12px 20px',
        borderRadius: '8px',
        border: 'none',
      },
    });
    y += 100;

    // Phase nodes
    directive.process.forEach((phase, index) => {
      nodes.push({
        id: phase.id,
        type: 'phase',
        position: { x: 200, y },
        data: { 
          label: `${index + 1}. ${phase.name}`, 
          steps: phase.steps,
          status: activePhase === phase.id ? 'active' : 'pending',
        },
      });
      y += 160;

      // Add evaluation node after certain phases
      if (phase.id === 'discovery' || phase.id === 'gather') {
        nodes.push({
          id: `eval-${phase.id}`,
          type: 'evaluate',
          position: { x: 220, y },
          data: { label: 'Quality Check', criteria: '85%+ match?' },
        });
        y += 120;

        // Self-annealing loop
        nodes.push({
          id: `anneal-${phase.id}`,
          type: 'selfAnnealing',
          position: { x: 480, y: y - 180 },
          data: { label: 'Improve & Retry' },
        });
      }
    });

    // Output node
    nodes.push({
      id: 'output',
      type: 'output',
      position: { x: 250, y },
      data: { label: '📤 Delivered Result' },
      style: {
        background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
        color: 'white',
        padding: '12px 20px',
        borderRadius: '8px',
        border: 'none',
      },
    });

    return nodes;
  }, [directive, activePhase]);

  const generateEdges = useCallback((): Edge[] => {
    const edges: Edge[] = [];
    const nodes = generateNodes();
    
    for (let i = 0; i < nodes.length - 1; i++) {
      const current = nodes[i];
      const next = nodes[i + 1];
      
      if (current.type === 'evaluate') {
        // Connect pass to next, fail to self-annealing
        edges.push({
          id: `${current.id}-pass`,
          source: current.id,
          sourceHandle: 'pass',
          target: next.id,
          animated: true,
          style: { stroke: '#38ef7d', strokeWidth: 2 },
        });
        
        // Find self-annealing node
        const annealNode = nodes.find(n => n.id === `anneal-${current.id.replace('eval-', '')}`);
        if (annealNode) {
          edges.push({
            id: `${current.id}-fail`,
            source: current.id,
            sourceHandle: 'fail',
            target: annealNode.id,
            animated: true,
            style: { stroke: '#f5576c', strokeWidth: 2 },
          });
          // Self-annealing back to phase
          const phaseId = current.id.replace('eval-', '');
          edges.push({
            id: `${annealNode.id}-back`,
            source: annealNode.id,
            target: phaseId,
            animated: true,
            style: { stroke: '#f093fb', strokeWidth: 2, strokeDasharray: '5,5' },
          });
        }
      } else if (current.type !== 'selfAnnealing') {
        edges.push({
          id: `${current.id}-${next.id}`,
          source: current.id,
          target: next.id,
          animated: current.type === 'phase',
          style: { stroke: '#667eea', strokeWidth: 2 },
        });
      }
    }
    
    return edges;
  }, [generateNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(generateNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState(generateEdges());

  // Update nodes when template changes
  const handleTemplateChange = (templateKey: keyof typeof WORKFLOW_TEMPLATES) => {
    setSelectedTemplate(templateKey);
    setDirective(WORKFLOW_TEMPLATES[templateKey].directive);
    const newNodes = generateNodes();
    const newEdges = generateEdges();
    setNodes(newNodes);
    setEdges(newEdges);
  };

  // Check for API key on mount
  React.useEffect(() => {
    checkApiKey();
  }, []);

  // Check if user has API key
  const checkApiKey = async () => {
    if (!userId ||  userId === 'not-connected') return;
    
    try {
      const response = await fetch(`http://localhost:3001/api/apollo-keys/${userId}/APOLLO`);
      const data = await response.json();
      setHasApiKey(data.hasKey);
    } catch (error) {
      console.error('Error checking API key:', error);
    }
  };

  // Save API key
  const saveApiKey = async () => {
    if (!apolloApiKey.trim()) {
      alert('Please enter an API key');
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/apollo-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userWalletAddress: userId,
          mcpServerKey: 'APOLLO',
          apiKey: apolloApiKey,
          keyName: 'Apollo API Key',
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setHasApiKey(true);
        setShowSettings(false);
        setApolloApiKey('');
        alert('API key saved successfully!');
      } else {
        alert('Failed to save API key: ' + data.message);
      }
    } catch (error: any) {
      console.error('Error saving API key:', error);
      alert('Error saving API key: ' + error.message);
    }
  };

  // Real workflow execution
  const runWorkflow = async () => {
    // Check if user is authenticated
    if (!authenticated) {
      login();
      return;
    }
    
    // Check if user has API key
    if (!hasApiKey) {
      setShowSettings(true);
      return;
    }

    // Show query input modal
    setSearchQuery(directive.objective); // Pre-fill with directive objective
    setShowQueryInput(true);
  };

  // Execute workflow with custom query
  const executeWorkflowWithQuery = async () => {
    if (!searchQuery.trim()) {
      alert('Please enter a search query');
      return;
    }

    setShowQueryInput(false);
    setIsRunning(true);
    setExecutionError(null);
    setWorkflowResults(null);
    
    // Animate phases
    for (const phase of directive.process) {
      setActivePhase(phase.id);
      await new Promise(r => setTimeout(r, 800));
    }
    
    try {
      // Call backend API
      const response = await fetch('http://localhost:3001/api/workflows/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userWalletAddress: userId,
          template: selectedTemplate,
          query: searchQuery, // Use custom search query
          resultLimit: 25,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setWorkflowResults(result);
        setShowResults(true);
        
        // Add to run history
        const newRun: WorkflowRun = {
          id: Date.now().toString(),
          timestamp: new Date(),
          success: true,
          duration: result.totalDuration,
          scriptsUsed: result.steps.map((s: any) => s.stepName),
          improvements: [],
        };
        setWorkflowRuns(prev => [newRun, ...prev].slice(0, 5));
        
        // Update script stats
        setExecutionScripts(prev => prev.map(s => ({
          ...s,
          runs: s.runs + 1,
          successRate: Math.min(99, s.successRate + 8),
          status: s.runs > 2 ? 'production' : s.runs > 0 ? 'testing' : 'draft',
        })));
      } else {
        setExecutionError(result.error || 'Workflow execution failed');
        
        // Add failed run
        const newRun: WorkflowRun = {
          id: Date.now().toString(),
          timestamp: new Date(),
          success: false,
          duration: 0,
          scriptsUsed: [],
          improvements: [],
        };
        setWorkflowRuns(prev => [newRun, ...prev].slice(0, 5));
      }
    } catch (error: any) {
      console.error('Error executing workflow:', error);
      setExecutionError(error.message);
    } finally {
      setActivePhase(null);
      setIsRunning(false);
    }
  };

  // Calculate overall success rate
  const overallSuccessRate = useMemo(() => {
    if (workflowRuns.length === 0) return 0;
    return Math.round((workflowRuns.filter(r => r.success).length / workflowRuns.length) * 100);
  }, [workflowRuns]);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', background: '#0a0f1a' }}>
      
      {/* WALLET WIDGET */}
      <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 999 }}>
        <WalletWidget />
      </div>
      
      {/* LEFT PANEL: DIRECTIVE EDITOR */}
      <div style={{
        width: '320px',
        background: 'linear-gradient(180deg, #111827 0%, #0a0f1a 100%)',
        borderRight: '1px solid rgba(255,255,255,0.1)',
        padding: '20px',
        color: 'white',
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <span style={{ fontSize: '24px' }}>📋</span>
          <div>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>DIRECTIVE</h2>
            <div style={{ fontSize: '11px', opacity: 0.6 }}>What to do (SOP)</div>
          </div>
        </div>

        {/* Template Selector */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '8px' }}>
            Workflow Template
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Object.entries(WORKFLOW_TEMPLATES).map(([key, template]) => (
              <button
                key={key}
                onClick={() => handleTemplateChange(key as keyof typeof WORKFLOW_TEMPLATES)}
                style={{
                  padding: '12px',
                  background: selectedTemplate === key 
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    : 'rgba(255,255,255,0.05)',
                  border: selectedTemplate === key 
                    ? 'none'
                    : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{template.icon} {template.name}</span>
                  <span style={{ fontSize: '11px', opacity: 0.7 }}>{template.roi}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Objective */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', opacity: 0.7 }}>📎 Objective</label>
          <textarea
            value={directive.objective}
            onChange={(e) => setDirective(prev => ({ ...prev, objective: e.target.value }))}
            style={{
              width: '100%',
              height: '80px',
              marginTop: '6px',
              padding: '10px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: 'white',
              fontSize: '12px',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Success Criteria */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', opacity: 0.7 }}>✅ Success Criteria</label>
          <div style={{ marginTop: '6px', fontSize: '12px' }}>
            {directive.successCriteria.map((criteria, i) => (
              <div key={i} style={{
                padding: '8px 10px',
                background: 'rgba(56, 239, 125, 0.1)',
                border: '1px solid rgba(56, 239, 125, 0.2)',
                borderRadius: '6px',
                marginBottom: '4px',
              }}>
                • {criteria}
              </div>
            ))}
          </div>
        </div>

        {/* Process Phases */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', opacity: 0.7 }}>🔄 Process Phases</label>
          <div style={{ marginTop: '6px' }}>
            {directive.process.map((phase, i) => (
              <div key={phase.id} style={{
                padding: '10px',
                background: activePhase === phase.id 
                  ? 'rgba(102, 126, 234, 0.2)'
                  : 'rgba(255,255,255,0.03)',
                border: activePhase === phase.id 
                  ? '1px solid rgba(102, 126, 234, 0.5)'
                  : '1px solid rgba(255,255,255,0.05)',
                borderRadius: '8px',
                marginBottom: '6px',
                transition: 'all 0.3s',
              }}>
                <div style={{ fontWeight: 500, fontSize: '13px', marginBottom: '6px' }}>
                  {i + 1}. {phase.name}
                </div>
                <div style={{ fontSize: '11px', opacity: 0.7 }}>
                  {phase.steps.length} steps
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tools */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', opacity: 0.7 }}>🔧 Tools & APIs</label>
          <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {directive.tools.map((tool, i) => (
              <span key={i} style={{
                padding: '4px 10px',
                background: 'rgba(102, 126, 234, 0.2)',
                borderRadius: '12px',
                fontSize: '11px',
              }}>
                {tool}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* CENTER PANEL: ORCHESTRATION FLOW */}
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          style={{ background: '#0a0f1a' }}
        >
          <Controls style={{ background: '#1e293b', borderRadius: '8px' }} />
          <MiniMap 
            style={{ background: '#1e293b', borderRadius: '8px' }}
            nodeColor={() => '#667eea'}
          />
          <Background color="#1e3a5f" gap={20} />
        </ReactFlow>
        
        {/* Header */}
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(17, 24, 39, 0.95)',
          padding: '12px 24px',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'white',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>🤖 ORCHESTRATION</div>
          <div style={{ fontSize: '11px', opacity: 0.6 }}>AI Agent coordinates the flow</div>
        </div>

        {/* Run Button */}
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '12px',
        }}>
          <button
            onClick={runWorkflow}
            disabled={isRunning}
            style={{
              padding: '14px 32px',
              background: isRunning 
                ? 'rgba(102, 126, 234, 0.5)'
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontSize: '14px',
              fontWeight: 600,
              cursor: isRunning ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)',
            }}
          >
            {isRunning ? '⏳ Running...' : '▶️ Run Workflow'}
          </button>
          <button
            style={{
              padding: '14px 24px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '12px',
              color: 'white',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            📥 Export
          </button>
        </div>
      </div>

      {/* RIGHT PANEL: EXECUTION & SELF-ANNEALING */}
      <div style={{
        width: '300px',
        background: 'linear-gradient(180deg, #111827 0%, #0a0f1a 100%)',
        borderLeft: '1px solid rgba(255,255,255,0.1)',
        padding: '20px',
        color: 'white',
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <span style={{ fontSize: '24px' }}>⚡</span>
          <div>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>EXECUTION</h2>
            <div style={{ fontSize: '11px', opacity: 0.6 }}>Python scripts + Self-annealing</div>
          </div>
        </div>

        {/* Self-Annealing Stats */}
        <div style={{
          padding: '16px',
          background: 'linear-gradient(135deg, rgba(240, 147, 251, 0.1) 0%, rgba(245, 87, 108, 0.1) 100%)',
          border: '1px solid rgba(240, 147, 251, 0.2)',
          borderRadius: '12px',
          marginBottom: '20px',
        }}>
          <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '8px' }}>🔄 Self-Annealing Progress</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{overallSuccessRate}%</div>
              <div style={{ fontSize: '11px', opacity: 0.7 }}>Success Rate</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{workflowRuns.length}</div>
              <div style={{ fontSize: '11px', opacity: 0.7 }}>Total Runs</div>
            </div>
          </div>
          <div style={{ marginTop: '12px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
            <div style={{
              width: `${overallSuccessRate}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #f093fb, #38ef7d)',
              borderRadius: '2px',
              transition: 'width 0.5s',
            }} />
          </div>
        </div>

        {/* Scripts */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '10px' }}>📜 Execution Scripts</div>
          {executionScripts.map(script => (
            <div key={script.id} style={{
              padding: '12px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '8px',
              marginBottom: '8px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 500 }}>🐍 {script.name}</span>
                <span style={{
                  padding: '2px 8px',
                  background: script.status === 'production' ? 'rgba(56, 239, 125, 0.2)' :
                             script.status === 'testing' ? 'rgba(251, 191, 36, 0.2)' :
                             'rgba(255,255,255,0.1)',
                  color: script.status === 'production' ? '#38ef7d' :
                         script.status === 'testing' ? '#fbbf24' : '#999',
                  borderRadius: '10px',
                  fontSize: '10px',
                }}>
                  {script.status}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', opacity: 0.7 }}>
                <span>v{script.version} • {script.runs} runs</span>
                <span style={{ color: script.successRate > 80 ? '#38ef7d' : '#fbbf24' }}>
                  {Math.round(script.successRate)}% success
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Run History */}
        <div>
          <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '10px' }}>📊 Recent Runs</div>
          {workflowRuns.length === 0 ? (
            <div style={{ fontSize: '12px', opacity: 0.5, textAlign: 'center', padding: '20px' }}>
              No runs yet. Click "Run Workflow" to start.
            </div>
          ) : (
            workflowRuns.map(run => (
              <div key={run.id} style={{
                padding: '10px',
                background: run.success ? 'rgba(56, 239, 125, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${run.success ? 'rgba(56, 239, 125, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                borderRadius: '8px',
                marginBottom: '6px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px' }}>
                    {run.success ? '✅' : '❌'} {run.timestamp.toLocaleTimeString()}
                  </span>
                  <span style={{ fontSize: '11px', opacity: 0.7 }}>{run.duration}s</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* QUERY INPUT MODAL */}
      {showQueryInput && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
            padding: '32px',
            borderRadius: '16px',
            width: '600px',
            maxWidth: '90%',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: 'white', marginBottom: '8px' }}>🔍 Enter Your Search Query</h2>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
                Describe the leads you want to find (e.g., "VP of Sales at fintech startups in NYC")
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <textarea
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Example: Find marketing directors at SaaS companies in California with Series A funding"
                autoFocus
                style={{
                  width: '100%',
                  height: '120px',
                  padding: '16px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '2px solid rgba(102, 126, 234, 0.3)',
                  borderRadius: '12px',
                  color: 'white',
                  fontSize: '15px',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ padding: '16px', background: 'rgba(102, 126, 234, 0.1)', border: '1px solid rgba(102, 126, 234, 0.2)', borderRadius: '8px', marginBottom: '24px' }}>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)' }}>
                <strong>💡 Tips:</strong><br />
                • Be specific: Include job titles, industries, and locations<br />
                • Mention company characteristics: funding stage, size, tech stack<br />
                • AI will optimize your query for the best results
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={executeWorkflowWithQuery}
                disabled={!searchQuery.trim()}
                style={{
                  flex: 1,
                  padding: '14px 28px',
                  background: searchQuery.trim() 
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    : 'rgba(102, 126, 234, 0.3)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: searchQuery.trim() ? 'pointer' : 'not-allowed',
                  boxShadow: searchQuery.trim() ? '0 4px 20px rgba(102, 126, 234, 0.4)' : 'none',
                }}
              >
                ▶️ Run Workflow
              </button>
              <button
                onClick={() => setShowQueryInput(false)}
                style={{
                  padding: '14px 28px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '15px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
            padding: '32px',
            borderRadius: '16px',
            width: '500px',
            maxWidth: '90%',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: 'white' }}>⚙️ Apollo API Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >×</button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>
                Apollo API Key
              </label>
              <input
                type="password"
                value={apolloApiKey}
                onChange={(e) => setApolloApiKey(e.target.value)}
                placeholder="Enter your Apollo.io API key"
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                }}
              />
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '8px' }}>
                Get your API key from <a href="https://app.apollo.io/settings/integrations/api" target="_blank" style={{ color: '#667eea' }}>Apollo.io Settings</a>
              </div>
            </div>

            <div style={{ marginBottom: '20px', padding: '12px', background: 'rgba(102, 126, 234, 0.1)', border: '1px solid rgba(102, 126, 234, 0.2)', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>
                <strong>🔒 Secure Storage</strong><br />
                Your API key is encrypted with AES-256 and stored securely.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={saveApiKey}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Save API Key
              </button>
              <button
                onClick={() => setShowSettings(false)}
                style={{
                  padding: '12px 24px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESULTS MODAL */}
      {showResults && workflowResults && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
            padding: '32px',
            borderRadius: '16px',
            width: '900px',
            maxWidth: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            color: 'white',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>🎯 Workflow Results</h2>
              <button
                onClick={() => setShowResults(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >×</button>
            </div>

            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
              <div style={{ padding: '16px', background: 'rgba(56, 239, 125, 0.1)', border: '1px solid rgba(56, 239, 125, 0.2)', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '4px' }}>Status</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold' }}>✅ Success</div>
              </div>
              <div style={{ padding: '16px', background: 'rgba(102, 126, 234, 0.1)', border: '1px solid rgba(102, 126, 234, 0.2)', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '4px' }}>Duration</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{Math.round(workflowResults.totalDuration / 1000)}s</div>
              </div>
              <div style={{ padding: '16px', background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '4px' }}>Cost</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold' }}>${workflowResults.totalCost.toFixed(2)}</div>
              </div>
            </div>

            {/* Steps */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>📋 Execution Steps</h3>
              {workflowResults.steps.map((step: any, index: number) => (
                <div key={index} style={{
                  padding: '12px',
                  background: step.status === 'success' ? 'rgba(56, 239, 125, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                  border: `1px solid ${step.status === 'success' ? 'rgba(56, 239, 125, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                  borderRadius: '8px',
                  marginBottom: '8px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>
                      {step.status === 'success' ? '✅' : '❌'} {step.stepName}
                    </span>
                    <span style={{ fontSize: '12px', opacity: 0.7 }}>{step.duration}ms</span>
                  </div>
                {step.error && (
                    <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '8px' }}>{step.error}</div>
                  )}
                </div>
              ))}
            </div>

            {/* Leads Data */}
            {workflowResults.finalResult?.lead_search?.leads && (
              <div>
                <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>👥 Leads Found ({workflowResults.finalResult.lead_search.leads.length})</h3>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {workflowResults.finalResult.lead_search.leads.slice(0, 10).map((lead: any, index: number) => (
                    <div key={index} style={{
                      padding: '12px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: '8px',
                      marginBottom: '8px',
                    }}>
                      <div style={{ fontWeight: 500, marginBottom: '4px' }}>{lead.name || `${lead.first_name} ${lead.last_name}`}</div>
                      <div style={{ fontSize: '12px', opacity: 0.7 }}>
                        {lead.title} at {lead.organization?.name}<br />
                        {lead.email && <span>✉️ {lead.email}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setShowResults(false)}
              style={{
                width: '100%',
                marginTop: '24px',
                padding: '12px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ERROR TOAST */}
      {executionError && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          padding: '16px 24px',
          background: 'linear-gradient(135deg rgba(239, 68, 68, 0.9) 0%, rgba(220, 38, 38, 0.9) 100%)',
          borderRadius: '12px',
          color: 'white',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          zIndex: 1001,
          maxWidth: '400px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>❌ Workflow Failed</div>
              <div style={{ fontSize: '13px', opacity: 0.9 }}>{executionError}</div>
            </div>
            <button
              onClick={() => setExecutionError(null)}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '0',
              }}
            >×</button>
          </div>
        </div>
      )}
    </div>
  );
}
