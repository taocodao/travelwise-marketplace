export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">
          🌍 TravelWise Marketplace
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          AI-Powered Travel Agent Marketplace with MCP Integration
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <a 
            href="/admin" 
            className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition"
          >
            <h2 className="text-2xl font-semibold mb-2">🔧 Admin Panel</h2>
            <p className="text-gray-600">Manage agents, tools, and pricing</p>
          </a>
          
          <a 
            href="/marketplace" 
            className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition"
          >
            <h2 className="text-2xl font-semibold mb-2">🛒 Marketplace</h2>
            <p className="text-gray-600">Browse and book AI agents</p>
          </a>
          
          <a 
            href="/api-docs" 
            className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition"
          >
            <h2 className="text-2xl font-semibold mb-2">📚 API Docs</h2>
            <p className="text-gray-600">Explore API endpoints</p>
          </a>
        </div>

        <div className="mt-12 text-sm text-gray-500">
          <p>Backend: <a href="http://localhost:3001/health" className="text-blue-600 hover:underline">http://localhost:3001</a></p>
          <p>Database: PostgreSQL (localhost:5432) | Redis (localhost:6379)</p>
        </div>
      </div>
    </div>
  );
}
