'use client';

import React, { useState, useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';

interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  details: string[];
  status: 'pending' | 'running' | 'completed' | 'error';
}

interface ExecutionScript {
  name: string;
  version: string;
  runs: number;
  successRate: string;
  status: 'draft' | 'active';
}

interface RunHistory {
  id: string;
  timestamp: string;
  status: 'success' | 'failed';
  leadsFound: number;
  duration: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  { id: 'ai_discovery', name: '1. AI-Powered Discovery', description: 'Use Apollo MCP apollo_lead_search with natural language query', details: ['AI analyzes query and generates optimal search strategy', '+3 more steps'], status: 'pending' },
  { id: 'quality_check', name: '⚙ Quality Check', description: '85%+ match?', details: [], status: 'pending' },
  { id: 'improve_retry', name: '⚡ Improve & Retry', description: 'Self-improving', details: [], status: 'pending' },
  { id: 'icp_analysis', name: '2. ICP Analysis', description: 'Use Apollo MCP apollo_icp_mapping for market analysis', details: ['Get industry distribution breakdown', '+2 more steps'], status: 'pending' },
  { id: 'lead_capture', name: '3. Full Lead Capture', description: 'Once test confirms quality, search full 200 leads', details: ['Extract: name, title, company, email, LinkedIn', '+2 more steps'], status: 'pending' },
  { id: 'enrichment', name: '4. Contact Enrichment', description: 'Use Apollo MCP apollo_people_enrichment for missing data', details: ['Enrich with employment history and company details', '+1 more steps'], status: 'pending' },
  { id: 'formatting', name: '5. Formatting & Export', description: 'Create "casual company name" column', details: ['Example: "The Ballistic Group" → "Ballistic"', '+2 more steps'], status: 'pending' },
];

const EXECUTION_SCRIPTS: ExecutionScript[] = [
  { name: 'apollo_lead_search.ts', version: 'v1', runs: 0, successRate: '0%', status: 'draft' },
  { name: 'apollo_icp_mapping.ts', version: 'v1', runs: 0, successRate: '0%', status: 'draft' },
  { name: 'apollo_enrichment.ts', version: 'v1', runs: 0, successRate: '0%', status: 'draft' },
];

const SUCCESS_CRITERIA = [
  '200+ qualified leads captured',
  '90%+ verified email addresses',
  'ICP match score > 70%',
  'Casual company names created',
  'Delivered as Google Sheet',
];

const PROCESS_PHASES = [
  { name: '1. AI-Powered Discovery', steps: 5 },
  { name: '2. ICP Analysis', steps: 4 },
  { name: '3. Full Lead Capture', steps: 4 },
  { name: '4. Contact Enrichment', steps: 3 },
  { name: '5. Formatting & Export', steps: 3 },
];

export default function LeadGenerationDemo() {
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<WorkflowStep[]>(WORKFLOW_STEPS);
  const [successRate, setSuccessRate] = useState(0);
  const [totalRuns, setTotalRuns] = useState(0);
  const [recentRuns, setRecentRuns] = useState<RunHistory[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('lead-generation');

  const walletAddress = wallets[0]?.address || '0xc58a...A89C';

  const runWorkflow = useCallback(async () => {
    if (!authenticated) {
      login();
      return;
    }

    setIsRunning(true);
    setSteps(WORKFLOW_STEPS.map(s => ({ ...s, status: 'pending' })));

    const stepOrder = [0, 1, 2, 3, 4, 5, 6];
    const durations = [3000, 1500, 1000, 2500, 4000, 3500, 2000];

    for (let i = 0; i < stepOrder.length; i++) {
      const stepIdx = stepOrder[i];
      
      setSteps(prev => prev.map((s, idx) => 
        idx === stepIdx ? { ...s, status: 'running' } : s
      ));

      await new Promise(resolve => setTimeout(resolve, durations[i]));

      setSteps(prev => prev.map((s, idx) => 
        idx === stepIdx ? { ...s, status: 'completed' } : s
      ));
    }

    setIsRunning(false);
    setTotalRuns(prev => prev + 1);
    setSuccessRate(100);
    
    setRecentRuns(prev => [{
      id: `run-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      status: 'success' as const,
      leadsFound: 247,
      duration: '17.5s'
    }, ...prev].slice(0, 5));
  }, [authenticated, login]);

  const getStepStyle = (status: string): React.CSSProperties => {
    switch (status) {
      case 'completed':
        return { background: 'rgba(16, 185, 129, 0.2)', border: '2px solid #10b981' };
      case 'running':
        return { background: 'rgba(6, 182, 212, 0.3)', border: '2px solid #06b6d4', animation: 'pulse 2s infinite' };
      case 'error':
        return { background: 'rgba(239, 68, 68, 0.2)', border: '2px solid #ef4444' };
      default:
        return { background: 'rgba(31, 41, 55, 0.5)', border: '2px solid #4b5563' };
    }
  };

  // Styles
  const containerStyle: React.CSSProperties = {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    background: '#0d0d1a',
    color: 'white',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  };

  const leftPanelStyle: React.CSSProperties = {
    width: '280px',
    background: 'linear-gradient(180deg, #12121f 0%, #0a0f1a 100%)',
    borderRight: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
  };

  const centerPanelStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  };

  const rightPanelStyle: React.CSSProperties = {
    width: '280px',
    background: 'linear-gradient(180deg, #12121f 0%, #0a0f1a 100%)',
    borderLeft: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
  };

  const sectionStyle: React.CSSProperties = {
    padding: '16px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  };

  const templateButtonStyle = (isSelected: boolean): React.CSSProperties => ({
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: '8px',
    marginBottom: '8px',
    border: 'none',
    cursor: 'pointer',
    background: isSelected ? 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)' : 'rgba(255,255,255,0.05)',
    color: 'white',
    fontSize: '13px',
  });

  const criteriaStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: 'rgba(59, 130, 246, 0.15)',
    borderRadius: '8px',
    marginBottom: '6px',
    fontSize: '12px',
    color: '#93c5fd',
  };

  const phaseCardStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderRadius: '12px',
    marginBottom: '12px',
    minWidth: '280px',
  };

  const runButtonStyle: React.CSSProperties = {
    padding: '12px 32px',
    borderRadius: '12px',
    border: 'none',
    cursor: isRunning ? 'not-allowed' : 'pointer',
    background: isRunning ? '#4b5563' : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    color: 'white',
    fontSize: '14px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const exportButtonStyle: React.CSSProperties = {
    padding: '12px 24px',
    borderRadius: '12px',
    border: 'none',
    cursor: 'pointer',
    background: 'rgba(255,255,255,0.1)',
    color: 'white',
    fontSize: '14px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const scriptItemStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '8px',
    marginBottom: '8px',
    fontSize: '12px',
  };

  const runHistoryItemStyle: React.CSSProperties = {
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '8px',
    marginBottom: '8px',
    fontSize: '12px',
  };

  return (
    <div style={containerStyle}>
      {/* Add pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
      
      {/* LEFT SIDEBAR - DIRECTIVE */}
      <div style={leftPanelStyle}>
        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ color: '#60a5fa' }}>📋</span>
            <span style={{ fontWeight: 700, fontSize: '16px' }}>DIRECTIVE</span>
          </div>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>What to do (SOP)</span>
        </div>

        {/* Workflow Templates */}
        <div style={sectionStyle}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '10px' }}>Workflow Template</div>
          <button 
            style={templateButtonStyle(selectedTemplate === 'lead-generation')}
            onClick={() => setSelectedTemplate('lead-generation')}
          >
            <span>⚡ Lead Generation</span>
            <span style={{ fontSize: '10px', opacity: 0.7 }}>6-8 hrs saved</span>
          </button>
          <button 
            style={templateButtonStyle(selectedTemplate === 'proposal')}
            onClick={() => setSelectedTemplate('proposal')}
          >
            <span>📝 Proposal Writing</span>
            <span style={{ fontSize: '10px', opacity: 0.7 }}>4-5 hrs saved</span>
          </button>
          <button 
            style={templateButtonStyle(selectedTemplate === 'email')}
            onClick={() => setSelectedTemplate('email')}
          >
            <span>✉️ Email Sequence</span>
            <span style={{ fontSize: '10px', opacity: 0.7 }}>3-4 hrs saved</span>
          </button>
        </div>

        {/* Objective */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>
            <span>🎯</span> Objective
          </div>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, margin: 0 }}>
            Find qualified B2B leads using Apollo.io AI-powered search and enrich with verified contact info for outreach campaigns.
          </p>
        </div>

        {/* Success Criteria */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500, marginBottom: '10px' }}>
            <span>✅</span> Success Criteria
          </div>
          {SUCCESS_CRITERIA.map((criteria, idx) => (
            <div key={idx} style={criteriaStyle}>
              <span style={{ color: '#60a5fa' }}>•</span>
              {criteria}
            </div>
          ))}
        </div>

        {/* Process Phases */}
        <div style={{ ...sectionStyle, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500, marginBottom: '10px' }}>
            <span>📋</span> Process Phases
          </div>
          {PROCESS_PHASES.map((phase, idx) => (
            <div key={idx} style={{ marginBottom: '8px' }}>
              <div style={{ fontWeight: 500, fontSize: '13px', color: 'rgba(255,255,255,0.9)' }}>{phase.name}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{phase.steps} steps</div>
            </div>
          ))}
        </div>
      </div>

      {/* CENTER - ORCHESTRATION */}
      <div style={centerPanelStyle}>
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <span style={{ color: '#22d3ee' }}>⚙️</span>
          <span style={{ fontWeight: 700, fontSize: '16px', marginLeft: '8px' }}>ORCHESTRATION</span>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginLeft: '12px' }}>AI Agent coordinates the flow</span>
        </div>

        {/* Flow Diagram */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Start Node */}
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '20px' }}>▶</span>
          </div>
          
          {/* Connection Line */}
          <div style={{ width: '2px', height: '20px', background: '#4ade80', marginBottom: '8px' }} />

          {/* Step 1: AI-Powered Discovery */}
          <div style={{ ...phaseCardStyle, ...getStepStyle(steps[0].status) }}>
            <div style={{ fontWeight: 700, color: '#22d3ee', marginBottom: '6px' }}>1. AI-Powered Discovery</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>• Use Apollo MCP apollo_lead_search with natural language query</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>• AI analyzes query and generates optimal search strategy</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>+3 more steps</div>
          </div>

          <div style={{ width: '2px', height: '16px', background: '#4ade80' }} />

          {/* Quality Check + Improve Loop */}
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ ...phaseCardStyle, ...getStepStyle(steps[1].status), minWidth: '160px', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <span style={{ color: '#22d3ee' }}>⚙</span>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>Quality Check</span>
              </div>
              <div style={{ fontSize: '11px', color: '#22d3ee', marginTop: '4px' }}>85%+ match?</div>
            </div>
            <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(236, 72, 153, 0.2)', border: '2px solid #ec4899' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#f472b6' }}>⚡</span>
                <span style={{ fontWeight: 600, fontSize: '13px', color: '#f9a8d4' }}>Improve & Retry</span>
              </div>
              <div style={{ fontSize: '10px', color: '#f472b6', marginTop: '4px' }}>Self-improving</div>
            </div>
          </div>

          <div style={{ width: '2px', height: '16px', background: '#4ade80' }} />

          {/* Step 2: ICP Analysis */}
          <div style={{ ...phaseCardStyle, ...getStepStyle(steps[3].status) }}>
            <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: '6px' }}>2. ICP Analysis</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>• Use Apollo MCP apollo_icp_mapping for market analysis</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>• Get industry distribution breakdown</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>+2 more steps</div>
          </div>

          <div style={{ width: '2px', height: '16px', background: '#4ade80' }} />

          {/* Step 3: Full Lead Capture */}
          <div style={{ ...phaseCardStyle, ...getStepStyle(steps[4].status) }}>
            <div style={{ fontWeight: 700, color: '#4ade80', marginBottom: '6px' }}>3. Full Lead Capture</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>• Once test confirms quality, search full 200 leads</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>• Extract: name, title, company, email, LinkedIn</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>+2 more steps</div>
          </div>

          <div style={{ width: '2px', height: '16px', background: '#4ade80' }} />

          {/* Step 4: Contact Enrichment */}
          <div style={{ ...phaseCardStyle, ...getStepStyle(steps[5].status) }}>
            <div style={{ fontWeight: 700, color: '#a78bfa', marginBottom: '6px' }}>4. Contact Enrichment</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>• Use Apollo MCP apollo_people_enrichment for missing data</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>• Enrich with employment history and company details</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>+1 more steps</div>
          </div>

          <div style={{ width: '2px', height: '16px', background: '#4ade80' }} />

          {/* Step 5: Formatting & Export */}
          <div style={{ ...phaseCardStyle, ...getStepStyle(steps[6].status) }}>
            <div style={{ fontWeight: 700, color: '#60a5fa', marginBottom: '6px' }}>5. Formatting & Export</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>• Create "casual company name" column</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>• Example: "The Ballistic Group" → "Ballistic"</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>+2 more steps</div>
          </div>

          <div style={{ width: '2px', height: '16px', background: '#4ade80' }} />

          {/* Output */}
          <div style={{ padding: '12px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', marginTop: '8px' }}>
            📊 Google Sheet Output
          </div>
        </div>

        {/* Bottom Controls */}
        <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer' }}>+</button>
            <button style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer' }}>−</button>
            <button style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer' }}>⟳</button>
          </div>
          <button onClick={runWorkflow} disabled={isRunning} style={runButtonStyle}>
            <span>▶</span> {isRunning ? 'Running...' : 'Run Workflow'}
          </button>
          <button style={exportButtonStyle}>
            <span>📥</span> Export
          </button>
        </div>
      </div>

      {/* RIGHT SIDEBAR - EXECUTION */}
      <div style={rightPanelStyle}>
        <div style={{ ...sectionStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 700, fontSize: '16px' }}>EX</span>
            <span style={{ color: '#facc15' }}>⚡</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
            <span style={{ fontSize: '10px', background: 'rgba(59, 130, 246, 0.3)', color: '#93c5fd', padding: '2px 8px', borderRadius: '4px' }}>Base Sepolia</span>
          </div>
        </div>

        {/* Self-Annealing Progress */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500, marginBottom: '12px' }}>
            <span>✅</span> Self-Annealing Progress
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 700 }}>{successRate}%</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Success Rate</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 700 }}>{totalRuns}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Total Runs</div>
            </div>
          </div>
        </div>

        {/* Execution Scripts */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500, marginBottom: '10px' }}>
            <span>📜</span> Execution Scripts
          </div>
          {EXECUTION_SCRIPTS.map((script, idx) => (
            <div key={idx} style={scriptItemStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#a78bfa' }}>📄</span>
                <span style={{ color: 'rgba(255,255,255,0.8)' }}>{script.name}</span>
              </div>
              <span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px', color: 'rgba(255,255,255,0.6)' }}>{script.status}</span>
            </div>
          ))}
        </div>

        {/* Recent Runs */}
        <div style={{ ...sectionStyle, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500, marginBottom: '10px' }}>
            <span>📊</span> Recent Runs
          </div>
          {recentRuns.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '12px', padding: '24px 0' }}>
              No runs yet. Click "Run Workflow" to start.
            </div>
          ) : (
            recentRuns.map((run) => (
              <div key={run.id} style={runHistoryItemStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    background: run.status === 'success' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: run.status === 'success' ? '#86efac' : '#fca5a5',
                  }}>
                    {run.status}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>{run.timestamp}</span>
                </div>
                <div style={{ marginTop: '6px', color: 'rgba(255,255,255,0.6)' }}>
                  {run.leadsFound} leads • {run.duration}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
