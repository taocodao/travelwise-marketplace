'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';

interface Tool {
  name: string;
  description?: string;
  method?: string;
  path?: string;
}

interface TestResult {
  tool: string;
  success: boolean;
  response: any;
  timestamp: Date;
}

export default function MCPTestPage() {
  const searchParams = useSearchParams();
  const serverName = searchParams.get('server') || '';
  const initialApiKey = searchParams.get('apiKey') || '';
  
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [inputParams, setInputParams] = useState<Record<string, string>>({});
  const [selectedTool, setSelectedTool] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<{role: string; content: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (serverName) {
      loadServerTools();
    }
  }, [serverName]);

  const loadServerTools = async () => {
    setLoading(true);
    try {
      // Fetch tools directly from the generated MCP server
      const res = await fetch(`http://localhost:3001/mcp/${serverName}/tools`);
      
      if (res.ok) {
        const toolsData = await res.json();
        // toolsData is an array of tool objects with path, method, summary, toolName, toolDescription
        setTools(toolsData.map((t: any) => ({
          name: t.toolName || t.name,
          description: t.toolDescription || t.summary || t.description,
          method: t.method || 'POST',
          path: t.path
        })));
        
        // Add welcome message showing available tools
        setChatMessages([{
          role: 'assistant',
          content: `**🔧 ${serverName}** loaded successfully!\n\n**Available Tools:**\n${toolsData.map((t: any) => `- \`${t.toolName || t.name}\`: ${t.toolDescription || t.summary || ''}`).join('\n')}\n\nEnter parameters as JSON and click Test to try each tool.`
        }]);
      } else {
        // Fallback to generated servers API
        const fallbackRes = await fetch(`/api/mcp/generated`);
        const data = await fallbackRes.json();
        
        if (data.success && data.servers) {
          const server = data.servers.find((s: any) => s.name === serverName);
          if (server) {
            setTools(server.tools.map((t: string) => ({ name: t, description: '' })));
          }
        }
      }
    } catch (err) {
      console.error('Failed to load tools:', err);
      setChatMessages([{
        role: 'assistant',
        content: `❌ Failed to connect to MCP server **${serverName}**.\n\nMake sure the API server is running on http://localhost:3001`
      }]);
    } finally {
      setLoading(false);
    }
  };

  const testTool = async (toolName: string) => {
    setIsProcessing(true);
    try {
      let params: any = {};
      try {
        params = inputParams[toolName] ? JSON.parse(inputParams[toolName]) : {};
      } catch (e) {
        // If parsing fails, use as-is
      }
      
      // Add API key to params if provided
      if (apiKey) {
        params.apiKey = apiKey;
      }
      
      const res = await fetch(`http://localhost:3001/mcp/${serverName}/tools/${toolName}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-API-Key': apiKey || ''
        },
        body: JSON.stringify(params)
      });
      
      const data = await res.json();
      
      setTestResults(prev => [{
        tool: toolName,
        success: data.success !== false,
        response: data,
        timestamp: new Date()
      }, ...prev]);
      
      setChatMessages(prev => [...prev, 
        { role: 'user', content: `Testing tool: ${toolName} with params: ${JSON.stringify(params)}` },
        { role: 'assistant', content: `**Result:**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`` }
      ]);
      
    } catch (err: any) {
      setTestResults(prev => [{
        tool: toolName,
        success: false,
        response: { error: err.message },
        timestamp: new Date()
      }, ...prev]);
      
      setChatMessages(prev => [...prev,
        { role: 'user', content: `Testing tool: ${toolName}` },
        { role: 'assistant', content: `❌ **Error:** ${err.message}` }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const sendChat = async () => {
    if (!chatInput.trim() || isProcessing) return;
    
    const message = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: message }]);
    setIsProcessing(true);
    
    try {
      // Simple keyword matching to call tools
      const lowerMsg = message.toLowerCase();
      const matchedTool = tools.find(t => lowerMsg.includes(t.name.toLowerCase()));
      
      if (matchedTool) {
        await testTool(matchedTool.name);
      } else {
        setChatMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `Available tools: ${tools.map(t => `\`${t.name}\``).join(', ')}\n\nType a tool name to test it, or use the buttons below.`
        }]);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (!serverName) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#1a1a2e', color: 'white', padding: '48px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '16px' }}>🧪 MCP Server Test Page</h1>
        <p style={{ color: '#aaa' }}>No server specified. Add ?server=server-name to the URL.</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#1a1a2e', color: 'white' }}>
      {/* Header */}
      <header style={{ backgroundColor: '#000', padding: '20px 32px', borderBottom: '2px solid #333' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '36px' }}>🧪</span>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0 }}>MCP Server Test: {serverName}</h1>
              <p style={{ color: '#aaa', margin: '4px 0 0 0' }}>Generated by Agentic MCP Generator</p>
            </div>
          </div>
          
          {/* API Key Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: '#aaa', fontSize: '14px' }}>🔑 API Key:</span>
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter API key..."
              style={{
                width: '250px',
                padding: '10px 16px',
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px'
              }}
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              style={{
                padding: '10px 16px',
                backgroundColor: '#374151',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              {showApiKey ? '🙈 Hide' : '👁️ Show'}
            </button>
            {apiKey && (
              <span style={{ color: '#10b981', fontSize: '12px' }}>✓ Set</span>
            )}
          </div>
        </div>
      </header>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        
        {/* Left: Tools Panel */}
        <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🔧</span> Available Tools
          </h2>
          
          {loading ? (
            <p style={{ color: '#aaa' }}>Loading tools...</p>
          ) : tools.length === 0 ? (
            <p style={{ color: '#aaa' }}>No tools found. Make sure the API server is running.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {tools.map((tool) => (
                <div key={tool.name} style={{ backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 'bold', color: '#60a5fa' }}>{tool.name}</span>
                        {tool.method && (
                          <span style={{ 
                            fontSize: '10px', 
                            padding: '2px 6px', 
                            borderRadius: '4px',
                            backgroundColor: tool.method === 'GET' ? '#3b82f6' : tool.method === 'POST' ? '#10b981' : '#f59e0b',
                            color: 'white',
                            fontWeight: 'bold'
                          }}>
                            {tool.method}
                          </span>
                        )}
                      </div>
                      {tool.description && (
                        <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0, lineHeight: 1.4 }}>
                          {tool.description}
                        </p>
                      )}
                    </div>
                    <button 
                      onClick={() => testTool(tool.name)}
                      disabled={isProcessing}
                      style={{ 
                        padding: '6px 16px', 
                        backgroundColor: '#10b981', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '6px', 
                        cursor: 'pointer',
                        opacity: isProcessing ? 0.5 : 1,
                        flexShrink: 0
                      }}
                    >
                      ▶ Test
                    </button>
                  </div>
                  <textarea
                    placeholder='{"param": "value"}'
                    value={inputParams[tool.name] || ''}
                    onChange={(e) => setInputParams(prev => ({ ...prev, [tool.name]: e.target.value }))}
                    style={{
                      width: '100%',
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      border: '1px solid #444',
                      borderRadius: '6px',
                      padding: '8px',
                      color: 'white',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      minHeight: '60px',
                      resize: 'vertical'
                    }}
                  />
                </div>
              ))}
            </div>
          )}
          
          {/* Test Results Summary */}
          {testResults.length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>📊 Test Results</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {testResults.slice(0, 10).map((r, i) => (
                  <span 
                    key={i} 
                    style={{ 
                      padding: '4px 12px', 
                      borderRadius: '12px', 
                      fontSize: '12px',
                      backgroundColor: r.success ? '#10b981' : '#ef4444',
                      color: 'white'
                    }}
                  >
                    {r.tool}: {r.success ? '✓' : '✗'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Chat/Output Panel */}
        <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>💬</span> Test Output
          </h2>
          
          {/* Messages */}
          <div style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '16px', marginBottom: '16px', overflowY: 'auto', minHeight: '400px', maxHeight: '500px' }}>
            {chatMessages.length === 0 ? (
              <p style={{ color: '#aaa', textAlign: 'center', marginTop: '40px' }}>
                Click "Test" on any tool to see the output here.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {chatMessages.map((msg, i) => (
                  <div 
                    key={i} 
                    style={{ 
                      padding: '12px', 
                      borderRadius: '8px',
                      backgroundColor: msg.role === 'user' ? 'rgba(99,102,241,0.3)' : 'rgba(16,185,129,0.2)',
                      maxWidth: '90%',
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Input */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendChat()}
              placeholder="Type tool name to test..."
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: 'rgba(0,0,0,0.5)',
                border: '1px solid #444',
                borderRadius: '8px',
                color: 'white'
              }}
            />
            <button 
              onClick={sendChat}
              disabled={isProcessing}
              style={{ 
                padding: '12px 24px', 
                backgroundColor: '#6366f1', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                cursor: 'pointer',
                opacity: isProcessing ? 0.5 : 1
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
