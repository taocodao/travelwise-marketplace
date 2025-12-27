
'use client';

import { useState } from 'react';
import { SparklesIcon, CheckCircleIcon, ArrowPathIcon } from '@heroicons/react/24/solid';

export default function McpGeneratorPage() {
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [success, setSuccess] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const GEN_API = 'http://localhost:3006';

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setSuccess(null);
    try {
      const res = await fetch(`${GEN_API}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiEndpoint })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setAnalysis(data.analysis);
    } catch (err: any) {
      setError(err.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerate = async () => {
    if (!analysis) return;
    setGenerating(true);
    setError(null);
    try {
        const res = await fetch(`${GEN_API}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiEndpoint,
                serverName: analysis.name.toLowerCase().replace(/\s+/g, '-'),
                selectedTools: analysis.endpoints
            })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        setSuccess(data);
    } catch (err: any) {
        setError(err.message || 'Generation failed');
    } finally {
        setGenerating(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
        <SparklesIcon className="w-8 h-8 text-yellow-500" />
        Agentic MCP Generator
      </h1>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">REST API Specification URL</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
              placeholder="https://petstore.swagger.io/v2/swagger.json"
              className="flex-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            />
            <button 
              onClick={handleAnalyze}
              disabled={analyzing || !apiEndpoint}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {analyzing ? <ArrowPathIcon className="w-5 h-5 animate-spin"/> : 'Analyze'}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-100 text-red-700 rounded border border-red-200">
            Error: {error}
          </div>
        )}

        {analysis && (
          <div className="mt-8 border-t pt-6">
            <h2 className="text-xl font-semibold mb-4">Analysis Result</h2>
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded mb-4">
              <p><strong>Name:</strong> {analysis.name}</p>
              <p><strong>Description:</strong> {analysis.description}</p>
            </div>

            <h3 className="font-medium mb-2">Detected Tools ({analysis.endpoints.length})</h3>
            <div className="max-h-60 overflow-y-auto border rounded divide-y dark:divide-gray-700">
              {analysis.endpoints.map((ep: any, i: number) => (
                <div key={i} className="p-3 text-sm flex justify-between items-center bg-white dark:bg-gray-800">
                   <div>
                     <span className={`font-mono font-bold uppercase mr-2 ${getMethodColor(ep.method)}`}>{ep.method}</span>
                     <span className="font-mono text-gray-600 dark:text-gray-400">{ep.path}</span>
                   </div>
                   <span className="text-gray-500">{ep.summary}</span>
                </div>
              ))}
            </div>

            <button 
              onClick={handleGenerate}
              disabled={generating}
              className="mt-6 w-full bg-green-600 text-white py-3 rounded text-lg font-semibold hover:bg-green-700 disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {generating ? <ArrowPathIcon className="w-6 h-6 animate-spin"/> : 'Generate & Deploy MCP Server'}
            </button>
          </div>
        )}

        {success && (
          <div className="mt-8 p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-lg text-center">
            <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-2">Deployed Successfully!</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              The MCP server <strong>{success.path.split(/[\\/]/).pop()}</strong> has been created.
            </p>
            <div className="bg-gray-800 text-gray-200 p-4 rounded text-left font-mono text-sm overflow-x-auto">
               To use this server, restart the main API (if not using hot-reload).
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getMethodColor(method: string) {
  switch (method.toUpperCase()) {
    case 'GET': return 'text-blue-600';
    case 'POST': return 'text-green-600';
    case 'DELETE': return 'text-red-600';
    case 'PUT': return 'text-orange-600';
    default: return 'text-gray-600';
  }
}
