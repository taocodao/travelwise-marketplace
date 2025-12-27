'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { WalletWidget } from '@/components/WalletWidget';
import { useSmartWallet } from '@/hooks/useSmartWallet';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  cost?: number;
  executionTime?: number;
  functionsUsed?: string[];
  mcpResults?: any[];
}

interface Transaction {
  id: string;
  timestamp: string;
  description: string;
  toolName: string;
  amount: number;
  status: 'completed' | 'pending';
}

interface MCPServer {
  id: string;
  name: string;
  provider: string;
  coverage: string;
  database: string;
  walletAddress: string;
  balance: number;
  status: 'connected' | 'disconnected';
  tools: MCPTool[];
  endpoint: string;
}

interface MCPTool {
  id: string;
  name: string;
  description: string;
  cost: number;
  callCount: number;
}

interface TestResult {
  id: string;
  query: string;
  success: boolean;
  cost: number;
  timestamp: Date;
}

const shortenAddress = (addr: string): string => {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

// Contract and RPC config
// Official Circle USDC on Base Sepolia
const USDC_CONTRACT = process.env.NEXT_PUBLIC_USDC_CONTRACT || '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const MCP_PAYMENT_PROCESSOR = process.env.NEXT_PUBLIC_MCP_PAYMENT_PROCESSOR || '0x473B2D40654F665E1cb0fa069922B64B69fFaE38';
const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';
const BASE_SEPOLIA_CHAIN_ID = 84532;

// DEMO MODE: Skip real blockchain payments (no approval dialogs, no gas needed)
// Set to false when you have testnet ETH and want real on-chain payments
const DEMO_MODE = true;

// Max approval amount (2^256 - 1) - approve once, never ask again
const MAX_APPROVAL = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

// ERC20 transfer function data encoder
function encodeTransferData(to: string, amount: bigint): string {
  // transfer(address,uint256) selector: 0xa9059cbb
  const selector = '0xa9059cbb';
  const toAddress = to.slice(2).padStart(64, '0');
  const amountHex = amount.toString(16).padStart(64, '0');
  return selector + toAddress + amountHex;
}

// ERC20 approve function data encoder
function encodeApproveData(spender: string, amount: bigint): string {
  // approve(address,uint256) selector: 0x095ea7b3
  const selector = '0x095ea7b3';
  const spenderAddress = spender.slice(2).padStart(64, '0');
  const amountHex = amount.toString(16).padStart(64, '0');
  return selector + spenderAddress + amountHex;
}

// Check USDC allowance for a spender
async function checkAllowance(owner: string, spender: string): Promise<bigint> {
  try {
    // allowance(address,address) selector: 0xdd62ed3e
    const selector = '0xdd62ed3e';
    const data = selector + owner.slice(2).padStart(64, '0') + spender.slice(2).padStart(64, '0');
    
    const response = await fetch(BASE_SEPOLIA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to: USDC_CONTRACT, data }, 'latest']
      })
    });
    const result = await response.json();
    if (result.result && result.result !== '0x') {
      return BigInt(result.result);
    }
    return BigInt(0);
  } catch (error) {
    console.error('Error checking allowance:', error);
    return BigInt(0);
  }
}

// Fetch USDC balance from blockchain
async function fetchUsdcBalance(address: string): Promise<number> {
  try {
    // balanceOf(address) function selector: 0x70a08231
    const data = '0x70a08231' + address.slice(2).padStart(64, '0');
    
    const response = await fetch(BASE_SEPOLIA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to: USDC_CONTRACT, data }, 'latest']
      })
    });
    const result = await response.json();
    if (result.result) {
      const balanceRaw = BigInt(result.result);
      return Number(balanceRaw) / 1e6; // USDC has 6 decimals
    }
    return 0;
  } catch (error) {
    console.error('Error fetching USDC balance:', error);
    return 0;
  }
}

// Fetch server earnings = USDC balance of the server wallet
// Since we do direct transfers, server earnings = wallet's USDC balance
async function fetchServerEarnings(serverAddress: string): Promise<number> {
  // Simply fetch the USDC balance of the server wallet
  return fetchUsdcBalance(serverAddress);
}

export default function SemanticSearchDemo(): JSX.Element {
  // Privy auth
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  
  // ZeroDev smart wallet for gasless transactions
  const { 
    isReady: smartWalletReady, 
    sendGaslessUSDCTransfer, 
    smartWalletAddress,
    isZeroDevConfigured 
  } = useSmartWallet();
  
  // PREFER EMBEDDED WALLET for gasless signing (no MetaMask popups!)
  // Privy embedded wallets can sign transactions without user confirmation
  const embeddedWallet = wallets.find((w: { walletClientType: string }) => w.walletClientType === 'privy');
  const externalWallet = wallets.find((w: { walletClientType: string }) => w.walletClientType !== 'privy');
  // Use embedded wallet if available, fallback to external
  const activeWallet = embeddedWallet || externalWallet || wallets[0];
  const isEmbeddedWallet = activeWallet?.walletClientType === 'privy';
  const walletAddress = activeWallet?.address || user?.wallet?.address;

  // User state - balance fetched from blockchain
  const [userBalance, setUserBalance] = useState<number>(0);
  const [totalSpent, setTotalSpent] = useState<number>(0);
  const [totalRequests, setTotalRequests] = useState<number>(0);
  // Use empty string initially to avoid hydration mismatch, set on client
  const [lastActivity, setLastActivity] = useState<string>('-');

  // MCP Servers
  const [googleMapsMCP, setGoogleMapsMCP] = useState<MCPServer>({
    id: 'google-maps',
    name: 'Google Maps MCP Server',
    provider: 'Google.io',
    coverage: 'Global Maps Database',
    database: '275M+ locations',
    walletAddress: '0x1111111111111111111111111111111111111111', // Google Maps Server Wallet
    balance: 0,
    status: 'connected',
    endpoint: 'http://localhost:3003',
    tools: [
      { id: 'get_route', name: 'get_route', description: 'ROUTE OPTIMIZATION: Calculate optimal travel routes with real-time traffic data and ETA calculations', cost: 0.05, callCount: 0 },
      { id: 'find_places', name: 'find_places', description: 'POI DISCOVERY: Find nearby attractions, restaurants, and points of interest with ratings and reviews', cost: 0.032, callCount: 0 },
      { id: 'get_place_details', name: 'get_place_details', description: 'LOCATION DETAILS: Get detailed information about specific places including hours, reviews, and contact info', cost: 0.017, callCount: 0 }
    ]
  });

  const [weatherMCP, setWeatherMCP] = useState<MCPServer>({
    id: 'weather',
    name: 'Google Weather API',
    provider: 'Google',
    coverage: 'Global Weather Data',
    database: 'AI-Powered Forecasting',
    walletAddress: '0x2222222222222222222222222222222222222222', // Weather API Server Wallet
    balance: 0,
    status: 'connected',
    endpoint: 'http://localhost:3001/mcp/semantic-location-mcp',
    tools: [
      { id: 'get_current_weather', name: 'get_current_weather', description: 'REAL-TIME CONDITIONS: Current weather via Google Weather API', cost: 0.01, callCount: 0 },
      { id: 'get_weather_forecast', name: 'get_weather_forecast', description: '10-DAY FORECAST: Daily forecast with AI-powered predictions', cost: 0.02, callCount: 0 }
    ]
  });

  // Semantic Location Search MCP (replaces Travel Agent)
  const [semanticMCP, setSemanticMCP] = useState<MCPServer>({
    id: 'semantic-location',
    name: 'Semantic Location Search',
    provider: 'AI-Powered',
    coverage: 'Self-Learning Location Discovery',
    database: 'Google Maps + AI Rankings',
    walletAddress: '0x3333333333333333333333333333333333333333', // Semantic Search Server Wallet
    balance: 0,
    status: 'connected',
    endpoint: 'http://localhost:3001/mcp/semantic-location-mcp',
    tools: [
      { id: 'semantic_search', name: 'semantic_search', description: 'SEMANTIC SEARCH: Find places using natural language with AI ranking and personalized results', cost: 0.03, callCount: 0 },
      { id: 'get_location_details', name: 'get_location_details', description: 'LOCATION DETAILS: Get comprehensive info with AI insights and real-time conditions', cost: 0.02, callCount: 0 },
      { id: 'submit_feedback', name: 'submit_feedback', description: 'LEARNING: Submit feedback to improve future recommendations', cost: 0.00, callCount: 0 },
      { id: 'get_suggestions', name: 'get_suggestions', description: 'SUGGESTIONS: Get personalized location recommendations based on history', cost: 0.02, callCount: 0 }
    ]
  });

  // Chat & UI state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isEditingPrices, setIsEditingPrices] = useState<boolean>(false);

  // Semantic Location Search specific queries
  const quickQueries: string[] = [
    '☕ Find a quiet cafe with WiFi near Times Square',
    '🍝 Romantic Italian restaurant in Manhattan',
    '🏨 Boutique hotel near Central Park with city views',
    '🍺 Lively craft beer bar in Brooklyn',
    '🌤️ Get current weather in New York',
    '📅 Weather forecast for Miami Beach',
    '🧘 Gym with yoga classes near downtown',
    '🍣 Best sushi restaurant near Wall Street'
  ];

  // Auto-popup login if not authenticated (only once when ready)
  useEffect(() => {
    if (ready && !authenticated) {
      // Small delay to prevent race conditions with Privy initialization
      const timer = setTimeout(() => {
        login();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [ready, authenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Set date on client side to avoid hydration mismatch
  useEffect(() => {
    setLastActivity(new Date().toLocaleDateString('en-US'));
  }, []);

  // Fetch USDC balance and server earnings when wallet connects or auth changes
  useEffect(() => {
    // Small delay to ensure wallet is fully initialized (especially for embedded wallets)
    const timer = setTimeout(() => {
      if (walletAddress) {
        console.log('🔄 Refreshing balances for wallet:', walletAddress);
        // Fetch user balance
        fetchUsdcBalance(walletAddress).then(balance => {
          console.log('💰 User balance:', balance);
          setUserBalance(balance);
        });
      }
      
      // Fetch server earnings for all MCP servers
      Promise.all([
        fetchServerEarnings(semanticMCP.walletAddress),
        fetchServerEarnings(googleMapsMCP.walletAddress),
        fetchServerEarnings(weatherMCP.walletAddress)
      ]).then(([semanticEarnings, mapsEarnings, weatherEarnings]) => {
        setSemanticMCP(prev => ({ ...prev, balance: semanticEarnings }));
        setGoogleMapsMCP(prev => ({ ...prev, balance: mapsEarnings }));
        setWeatherMCP(prev => ({ ...prev, balance: weatherEarnings }));
      });
    }, 500); // 500ms delay for wallet init
    
    return () => clearTimeout(timer);
  }, [walletAddress, ready, authenticated]); // Also trigger on auth state changes

  useEffect(() => {
    initializeChat();
  }, []);

  const initializeChat = (): void => {
    const welcomeMsg: Message = {
      id: 'sys-1',
      role: 'system',
      content: `🧪 **Semantic Location Search Demo**

**LLM Model:** GPT-4 Turbo (OpenAI)

**Connected MCP Servers:** 
- Google Maps MCP Server (Port 3003)
- Weather MCP Server (Port 3004)
- **🔍 Semantic Location Search** (Self-Learning AI)

**🎯 Semantic Search Features:**
• Natural language location queries
• AI-powered semantic ranking
• Self-learning from your selections
• Personalized recommendations
• Real-time location insights via Perplexity

**💳 Payment Model:**
• **X402 Protocol:** HTTP 402 Payment Required for each MCP call
• **ERC-8004 Standard:** On-chain agent and MCP server discovery
• **USDC Settlement:** Real-time payment in USDC stablecoin

**Available Functions & Live Pricing (USDC):**

**Semantic Location Search:**
• semantic_search: $0.03 - AI-powered location discovery
• get_location_details: $0.02 - Detailed place info
• submit_feedback: FREE - Train the learning system
• get_suggestions: $0.02 - Personalized recommendations

**Google Maps MCP:**
• get_route: $0.05 - Route optimization
• find_places: $0.032 - Place discovery

**Weather MCP:**
• get_current_weather: $0.01 - Current conditions
• get_forecast: $0.02 - 5-day forecast

🎯 Try natural language queries like "quiet cafe with good WiFi for working"!`,
      timestamp: new Date()
    };
    setMessages([welcomeMsg]);
  };

  // Refresh all balances from blockchain
  const refreshBalances = async (): Promise<void> => {
    if (walletAddress) {
      const balance = await fetchUsdcBalance(walletAddress);
      setUserBalance(balance);
    }
    
    // Refresh all server earnings in parallel
    const [semanticEarnings, mapsEarnings, weatherEarnings] = await Promise.all([
      fetchServerEarnings(semanticMCP.walletAddress),
      fetchServerEarnings(googleMapsMCP.walletAddress),
      fetchServerEarnings(weatherMCP.walletAddress)
    ]);
    
    setSemanticMCP(prev => ({ ...prev, balance: semanticEarnings }));
    setGoogleMapsMCP(prev => ({ ...prev, balance: mapsEarnings }));
    setWeatherMCP(prev => ({ ...prev, balance: weatherEarnings }));
  };

  const addTransaction = (description: string, toolName: string, amount: number): void => {
    const tx: Transaction = {
      id: `tx-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toLocaleTimeString(),
      description,
      toolName,
      amount,
      status: 'completed'
    };
    setTransactions(prev => [tx, ...prev].slice(0, 5));
  };

  // Call MCP tool with payment processing and auto-refresh
  // Call MCP tool with REAL payment processing
  const callMCPTool = async (
    serverEndpoint: string, 
    toolName: string, 
    params: any, 
    toolCost: number = 0,
    serverWalletAddress?: string
  ): Promise<any> => {
    try {
      // If tool has cost, process payment
      if (toolCost > 0 && serverWalletAddress && activeWallet) {
        console.log(`💰 Processing payment: $${toolCost} USDC to ${serverWalletAddress}`);
        
        // OPTION 1: Smart Wallet (ZeroDev) - Gasless, no approval popup!
        if (smartWalletReady && isZeroDevConfigured) {
          console.log('🚀 Using ZeroDev smart wallet for gasless payment');
          const result = await sendGaslessUSDCTransfer(
            serverWalletAddress as `0x${string}`,
            toolCost
          );
          
          if (result.success) {
            console.log('✅ Gasless payment successful:', result.txHash);
            // Update UI
            setUserBalance(prev => prev - toolCost);
            setTotalSpent(prev => prev + toolCost);
            setTotalRequests(prev => prev + 1);
            setLastActivity(new Date().toLocaleDateString('en-US'));
            addTransaction(`${toolName} (gasless)`, toolName, toolCost);
            
            // Update server balance
            if (serverEndpoint.includes('semantic-location')) {
              setSemanticMCP(prev => ({ ...prev, balance: prev.balance + toolCost }));
            } else if (serverEndpoint.includes('weather') || serverEndpoint.includes('3001')) {
              setWeatherMCP(prev => ({ ...prev, balance: prev.balance + toolCost }));
            }
          } else {
            console.error('❌ Gasless payment failed:', result.error);
            return { success: false, error: result.error, tool: toolName };
          }
        }
        // OPTION 2: DEMO MODE - Simulate payment (for testing without ZeroDev)
        else if (DEMO_MODE) {
          console.log('🎮 DEMO MODE: Simulating payment (no real transaction)');
          // Update UI as if payment was made
          setUserBalance(prev => prev - toolCost);
          setTotalSpent(prev => prev + toolCost);
          setTotalRequests(prev => prev + 1);
          setLastActivity(new Date().toLocaleDateString('en-US'));
          addTransaction(`${toolName} (DEMO)`, toolName, toolCost);
          
          // Update server balance
          if (serverEndpoint.includes('semantic-location')) {
            setSemanticMCP(prev => ({ ...prev, balance: prev.balance + toolCost }));
          } else if (serverEndpoint.includes('weather') || serverEndpoint.includes('3001')) {
            setWeatherMCP(prev => ({ ...prev, balance: prev.balance + toolCost }));
          }
        }
        // OPTION 3: Regular mode - uses Privy wallet (requires manual approval)
        else {
          // REAL MODE: Process blockchain payment
          // Convert to USDC units (6 decimals)
          const amountInUnits = BigInt(Math.round(toolCost * 1e6));
          
          // Encode transfer data
          const transferData = encodeTransferData(serverWalletAddress, amountInUnits);
        
          try {
            // Get the wallet provider
            const provider = await activeWallet.getEthereumProvider();
            
            // Check if on correct network
            const chainId = await provider.request({ method: 'eth_chainId' });
            if (parseInt(chainId as string, 16) !== BASE_SEPOLIA_CHAIN_ID) {
              console.warn('⚠️ Wrong network - switching to Base Sepolia');
              await provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x14A34' }] // 84532 in hex
              });
            }
            
            // Send USDC transfer transaction
            const txHash = await provider.request({
              method: 'eth_sendTransaction',
              params: [{
                from: walletAddress,
                to: USDC_CONTRACT,
                data: transferData,
                gas: '0x15F90' // 90000 gas
              }]
            });
            
            console.log('✅ Payment TX:', txHash);
            
            // Update UI immediately after TX sent
            setUserBalance(prev => prev - toolCost);
            setTotalSpent(prev => prev + toolCost);
            setTotalRequests(prev => prev + 1);
            setLastActivity(new Date().toLocaleDateString('en-US'));
            addTransaction(`${toolName} call (TX: ${(txHash as string).slice(0, 10)}...)`, toolName, toolCost);
            
            // Update server balance
            if (serverEndpoint.includes('semantic-location')) {
              setSemanticMCP(prev => ({ ...prev, balance: prev.balance + toolCost }));
            } else if (serverEndpoint.includes('3003')) {
              setGoogleMapsMCP(prev => ({ ...prev, balance: prev.balance + toolCost }));
            } else if (serverEndpoint.includes('3004')) {
              setWeatherMCP(prev => ({ ...prev, balance: prev.balance + toolCost }));
            }
            
          } catch (paymentError: any) {
            console.error('❌ Payment failed:', paymentError);
            // If user rejected or payment failed, don't proceed with tool call
            if (paymentError.code === 4001) {
              return { success: false, error: 'Payment rejected by user', tool: toolName };
            }
            return { success: false, error: `Payment failed: ${paymentError.message}`, tool: toolName };
          }
        }
      }

      // Execute MCP tool call
      const response = await fetch(`${serverEndpoint}/tools/${toolName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // After successful call, refresh balances from blockchain
      setTimeout(() => refreshBalances(), 3000); // Wait 3s for blockchain confirmation
      
      return { ...data, tool: toolName };
    } catch (error: any) {
      console.error(`MCP call failed for ${toolName}:`, error);
      
      // Revert optimistic updates if call failed
      if (toolCost > 0) {
        setUserBalance(prev => prev + toolCost);
        setTotalSpent(prev => prev - toolCost);
        setTotalRequests(prev => prev - 1);
      }
      
      return {
        success: false,
        error: error.message,
        tool: toolName
      };
    }
  };

  const formatMCPResponse = (result: any): string => {
    if (!result.success) {
      return `❌ **Error:** ${result.error || 'Unknown error'}`;
    }

    let formatted = '';

    switch (result.tool) {
      case 'semantic_search':
        formatted += `### 🔍 Semantic Search Results\n\n`;
        if (result.parsedQuery) {
          formatted += `**Understood:** Looking for **${result.parsedQuery.placeType}**`;
          if (result.parsedQuery.vibes?.length > 0) {
            formatted += ` with vibes: ${result.parsedQuery.vibes.join(', ')}`;
          }
          formatted += `\n\n`;
        }
        if (result.results && result.results.length > 0) {
          result.results.slice(0, 5).forEach((place: any, idx: number) => {
            formatted += `**${idx + 1}. ${place.name}** (${place.semanticScore}% match)\n`;
            formatted += `   - 📍 ${place.address}\n`;
            formatted += `   - ⭐ Rating: ${place.rating}/5.0\n`;
            if (place.explanation) {
              formatted += `   - 💡 *"${place.explanation}"*\n`;
            }
            if (place.matchedFeatures?.length > 0) {
              formatted += `   - ✅ Matched: ${place.matchedFeatures.join(', ')}\n`;
            }
            formatted += `\n`;
          });
        } else {
          formatted += `No places found matching your criteria.\n`;
        }
        break;

      case 'get_location_details':
        formatted += `### 📍 Location Details\n\n`;
        if (result.details) {
          const d = result.details;
          formatted += `**${d.name}**\n\n`;
          formatted += `📍 ${d.address}\n`;
          if (d.phone) formatted += `📞 ${d.phone}\n`;
          if (d.website) formatted += `🌐 ${d.website}\n`;
          formatted += `⭐ Rating: ${d.rating}/5.0\n`;
          if (d.priceLevel) formatted += `💰 Price: ${'$'.repeat(d.priceLevel)}\n`;
          if (d.openingHours) {
            formatted += `\n**Hours:**\n`;
            d.openingHours.forEach((h: string) => {
              formatted += `   ${h}\n`;
            });
          }
          if (d.aiInsights) {
            formatted += `\n**🤖 AI Insights:**\n${d.aiInsights}\n`;
          }
        }
        break;

      case 'get_suggestions':
        formatted += `### 💡 Personalized Suggestions\n\n`;
        if (result.suggestions && result.suggestions.length > 0) {
          result.suggestions.forEach((s: any, idx: number) => {
            formatted += `${idx + 1}. **${s.type}** - ${s.reason}\n`;
          });
        }
        if (result.personalized) {
          formatted += `\n_Based on your preferences and history_`;
        }
        break;

      case 'find_places':
        formatted += `### 📍 Places Found\n\n`;
        if (result.places && result.places.length > 0) {
          result.places.forEach((place: any, idx: number) => {
            formatted += `**${idx + 1}. ${place.name}**\n`;
            formatted += `   - ⭐ Rating: ${place.rating}/5.0 (${place.user_ratings_total || 0} reviews)\n`;
            formatted += `   - 📍 Location: ${place.vicinity}\n\n`;
          });
        }
        break;

      case 'get_current_weather':
        formatted += `### 🌤️ Current Weather\n\n`;
        if (result.current) {
          formatted += `**Location:** ${result.current.location}\n\n`;
          formatted += `**Temperature:** ${result.current.temperature}°F (Feels like ${result.current.feelsLike}°F)\n\n`;
          formatted += `**Conditions:** ${result.current.condition?.description || 'N/A'}\n\n`;
          formatted += `**Humidity:** ${result.current.humidity}%\n`;
          formatted += `**Wind:** ${result.current.windSpeed} mph ${result.current.windDirection}\n`;
          formatted += `**UV Index:** ${result.current.uvIndex}\n`;
          formatted += `**Cloud Cover:** ${result.current.cloudCover}%\n`;
          if (result.current.precipitationProbability > 0) {
            formatted += `**Rain Chance:** ${result.current.precipitationProbability}%\n`;
          }
        }
        break;

      case 'get_weather_forecast':
        formatted += `### 📅 ${result.days}-Day Weather Forecast\n\n`;
        if (result.forecast && result.forecast.length > 0) {
          result.forecast.forEach((day: any, idx: number) => {
            const dateStr = day.displayDate ? `${day.displayDate.month}/${day.displayDate.day}` : `Day ${idx + 1}`;
            formatted += `**${dateStr}** - ${day.condition?.description || 'N/A'}\n`;
            formatted += `   🌡️ ${day.minTemperature}°F - ${day.maxTemperature}°F\n`;
            formatted += `   💧 Rain: ${day.precipitationProbability}% | ☁️ Cloud: ${day.cloudCover}%\n\n`;
          });
        }
        break;

      default:
        formatted += JSON.stringify(result, null, 2);
    }

    if (result.meta?.cost) {
      formatted += `\n---\n**💰 Cost:** $${result.meta.cost.toFixed(3)} USDC`;
    }

    return formatted;
  };

  const processQuery = async (query: string): Promise<void> => {
    setIsProcessing(true);

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);

    const startTime = Date.now();
    let totalCost = 0;
    const functionsUsed: string[] = [];
    const mcpResults: any[] = [];
    let responseText = '';

    try {
      const lowerQuery = query.toLowerCase();
      
      // FAST-PATH for WEATHER queries - direct call with payment
      const isWeatherQuery = 
        lowerQuery.includes('weather') ||
        lowerQuery.includes('forecast') ||
        lowerQuery.includes('temperature') ||
        lowerQuery.includes('rain') ||
        lowerQuery.includes('sunny');
      
      if (isWeatherQuery) {
        console.log('⚡ Fast path: Direct weather API');
        
        // Determine which weather tool to use
        const isForecast = lowerQuery.includes('forecast') || lowerQuery.includes('week') || lowerQuery.includes('tomorrow');
        const toolName = isForecast ? 'get_weather_forecast' : 'get_current_weather';
        const weatherTool = weatherMCP.tools.find(t => t.id === toolName);
        const toolCost = weatherTool?.cost || (isForecast ? 0.02 : 0.01);
        
        // Extract location from query
        const locationMatch = query.match(/(?:in|at|for|near)\s+([^,\?\.]+)/i);
        const location = locationMatch ? locationMatch[1].trim() : 'New York';
        
        // Call with REAL payment
        const result = await callMCPTool(
          weatherMCP.endpoint,
          toolName,
          { location, days: isForecast ? 5 : 1 },
          toolCost,
          weatherMCP.walletAddress  // Weather server wallet for payment
        );
        
        mcpResults.push(result);
        responseText = formatMCPResponse(result);
        totalCost = result.meta?.cost || toolCost;
        functionsUsed.push(toolName);
        
        // Update tool call count
        setWeatherMCP(prev => ({
          ...prev,
          tools: prev.tools.map(t => t.id === toolName ? { ...t, callCount: t.callCount + 1 } : t)
        }));
      }
      
      // FAST-PATH: Direct call to semantic search for obvious place queries
      // This bypasses the slow MCPRouter (saves ~60 seconds!)
      else if (
        lowerQuery.includes('cafe') ||
        lowerQuery.includes('coffee') ||
        lowerQuery.includes('restaurant') ||
        lowerQuery.includes('hotel') ||
        lowerQuery.includes('bar') ||
        lowerQuery.includes('gym') ||
        lowerQuery.includes('park') ||
        lowerQuery.includes('find') ||
        lowerQuery.includes('near') ||
        lowerQuery.includes('quiet') ||
        lowerQuery.includes('cozy')
      ) {
        // FAST PATH: Direct to semantic search (skip Perplexity + GPT-4 routing)
        console.log('⚡ Fast path: Direct semantic search');
        
        // Get tool cost from server definition
        const searchTool = semanticMCP.tools.find(t => t.id === 'semantic_search');
        const toolCost = searchTool?.cost || 0.03;
        
        // Call with REAL payment - passes wallet address for on-chain transfer
        const result = await callMCPTool(
          semanticMCP.endpoint, 
          'semantic_search', 
          { query, limit: 5 },
          toolCost,
          semanticMCP.walletAddress  // Server wallet for payment
        );

        mcpResults.push(result);
        responseText = formatMCPResponse(result);
        totalCost = result.meta?.cost || toolCost;
        functionsUsed.push('semantic_search');
        
        // Update tool call count (balance already updated by callMCPTool)
        setSemanticMCP(prev => ({
          ...prev,
          tools: prev.tools.map(t => t.id === 'semantic_search' ? { ...t, callCount: t.callCount + 1 } : t)
        }));

      } else {
        // SLOW PATH: Use intelligent MCPRouter for complex queries
        // (travel planning, advice, multi-tool queries)
        console.log('🧠 Smart path: MCPRouter');
        
        const routerResponse = await fetch('http://localhost:3001/api/ai-agent/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            query,
            userId: walletAddress || 'anonymous'
          }),
        });

        const routerResult = await routerResponse.json();

        if (routerResult.success) {
          responseText = routerResult.response || '';
          totalCost = routerResult.totalCost || 0;
          
          for (const route of (routerResult.routes || [])) {
            functionsUsed.push(`${route.server}.${route.tool}`);
          }
          
          mcpResults.push(...(routerResult.results || []));
          
          for (const route of (routerResult.routes || [])) {
            if (route.server === 'weather') {
              setWeatherMCP(prev => ({
                ...prev,
                balance: prev.balance + (route.tool === 'get_weather_forecast' ? 0.02 : 0.01),
                tools: prev.tools.map(t => t.id === route.tool ? { ...t, callCount: t.callCount + 1 } : t)
              }));
              addTransaction(`Weather: ${route.tool}`, route.tool, 0.02);
            } else if (route.server === 'semantic-location' || route.server === 'semantic_search') {
              setSemanticMCP(prev => ({
                ...prev,
                balance: prev.balance + 0.03,
                tools: prev.tools.map(t => t.id === 'semantic_search' ? { ...t, callCount: t.callCount + 1 } : t)
              }));
              addTransaction(`Semantic search`, 'semantic_search', 0.03);
            } else if (route.server === 'perplexity') {
              addTransaction(`Web search: "${query.substring(0, 20)}..."`, 'web_search', 0.02);
            }
          }
        } else {
          responseText = `❌ **Error:** ${routerResult.error || 'Routing failed'}`;
        }
      }

    } catch (error: any) {
      responseText = `❌ **Error:** ${error.message}`;
    }

    const executionTime = Date.now() - startTime;
    setUserBalance(prev => prev - totalCost);
    setTotalSpent(prev => prev + totalCost);
    setTotalRequests(prev => prev + 1);

    const assistantMsg: Message = {
      id: `msg-${Date.now()}-assistant`,
      role: 'assistant',
      content: responseText + `\n\n---\n\n💰 **Total cost:** $${totalCost.toFixed(2)} USDC (X402)\n⏱️ **Execution time:** ${(executionTime / 1000).toFixed(1)}s\n🔗 **Protocol:** ERC-8004 + X402 payment\n🛠️ **Functions used:** ${functionsUsed.join(', ') || 'None'}`,
      timestamp: new Date(),
      cost: totalCost,
      executionTime,
      functionsUsed,
      mcpResults
    };

    setMessages(prev => [...prev, assistantMsg]);

    const testResult: TestResult = {
      id: `test-${Date.now()}`,
      query,
      success: true,
      cost: totalCost,
      timestamp: new Date()
    };
    setTestResults(prev => [testResult, ...prev].slice(0, 10));

    setIsProcessing(false);
  };

  // Send feedback to improve routing learning
  const sendFeedback = async (query: string, feedback: 'positive' | 'negative'): Promise<void> => {
    try {
      await fetch('http://localhost:3001/api/ai-agent/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, feedback }),
      });
      console.log(`📊 Recorded ${feedback} feedback for routing`);
    } catch (error) {
      console.error('Failed to send feedback:', error);
    }
  };

  const handleSendMessage = async (): Promise<void> => {
    if (!inputMessage.trim() || isProcessing) return;
    const query = inputMessage;
    setInputMessage('');
    await processQuery(query);
  };

  const handleQuickQuery = async (query: string): Promise<void> => {
    await processQuery(query);
  };

  const refreshServer = (): void => {
    setGoogleMapsMCP(prev => ({ ...prev, status: 'connected' }));
    setWeatherMCP(prev => ({ ...prev, status: 'connected' }));
    setSemanticMCP(prev => ({ ...prev, status: 'connected' }));
  };

  const clearChat = (): void => {
    setMessages(prev => [prev[0]]);
  };

  const clearResults = (): void => {
    setTestResults([]);
  };

  const updateToolPrice = (serverId: string, toolId: string, newCost: number): void => {
    if (serverId === 'google-maps') {
      setGoogleMapsMCP(prev => ({
        ...prev,
        tools: prev.tools.map(t => t.id === toolId ? { ...t, cost: newCost } : t)
      }));
    } else if (serverId === 'weather') {
      setWeatherMCP(prev => ({
        ...prev,
        tools: prev.tools.map(t => t.id === toolId ? { ...t, cost: newCost } : t)
      }));
    } else if (serverId === 'semantic-location') {
      setSemanticMCP(prev => ({
        ...prev,
        tools: prev.tools.map(t => t.id === toolId ? { ...t, cost: newCost } : t)
      }));
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'white' }}>
      {/* Header */}
      <header style={{ backgroundColor: '#000', color: '#fff', padding: '20px 32px', borderBottom: '2px solid #333' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '48px' }}>🔍</span>
            <div>
              <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: 0 }}>Semantic Location Search Demo</h1>
              <p style={{ color: '#aaa', margin: '4px 0 0 0' }}>AI-Powered Self-Learning Location Discovery • X402 + ERC-8004</p>
            </div>
          </div>
          
          {/* Wallet Widget */}
          <WalletWidget />
        </div>
      </header>

      {/* Main Content */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
        {/* Upper Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Semantic Location Search MCP Server */}
            <div style={{ backgroundColor: '#fff', border: '2px solid #8b5cf6', borderRadius: '16px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '36px' }}>🔍</span>
                  <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#1f2937' }}>{semanticMCP.name}</h2>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ padding: '4px 16px', backgroundColor: semanticMCP.status === 'connected' ? '#10b981' : '#ef4444', color: '#fff', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                    {semanticMCP.status.toUpperCase()}
                  </span>
                  <button onClick={refreshServer} style={{ padding: '8px 16px', backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                    🔄 Refresh
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '24px', fontSize: '14px' }}>
                <div><p style={{ color: '#6b7280', fontWeight: '600', margin: '0 0 4px 0' }}>Provider:</p><p style={{ margin: 0, color: '#1f2937' }}>{semanticMCP.provider}</p></div>
                <div><p style={{ color: '#6b7280', fontWeight: '600', margin: '0 0 4px 0' }}>Coverage:</p><p style={{ margin: 0, color: '#1f2937' }}>{semanticMCP.coverage}</p></div>
                <div><p style={{ color: '#6b7280', fontWeight: '600', margin: '0 0 4px 0' }}>Database:</p><p style={{ margin: 0, color: '#1f2937' }}>{semanticMCP.database}</p></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px', fontSize: '14px' }}>
                <div><p style={{ color: '#6b7280', fontWeight: '600', margin: '0 0 4px 0' }}>Endpoint:</p><p style={{ margin: 0, fontFamily: 'monospace', fontSize: '12px', color: '#1f2937' }}>{semanticMCP.endpoint}</p></div>
                <div><p style={{ color: '#6b7280', fontWeight: '600', margin: '0 0 4px 0' }}>Protocol:</p><p style={{ margin: 0, color: '#8b5cf6', fontWeight: '600' }}>🧠 Self-Learning AI + X402</p></div>
              </div>

              <div style={{ background: 'linear-gradient(to right, #ddd6fe, #c4b5fd)', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
                <p style={{ fontSize: '14px', color: '#374151', fontWeight: '600', margin: '0 0 8px 0' }}>Server Earnings (USDC)</p>
                <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#7c3aed', margin: 0 }}>${semanticMCP.balance.toFixed(2)} USDC</p>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>🔧</span>
                    <h3 style={{ fontWeight: 'bold', margin: 0, color: '#1f2937' }}>Available Tools & Pricing</h3>
                  </div>
                  <button 
                    onClick={() => setIsEditingPrices(!isEditingPrices)}
                    style={{ padding: '4px 16px', backgroundColor: '#f59e0b', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    ✏️ Edit Prices
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {semanticMCP.tools.map((tool) => (
                    <div key={tool.id} style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ fontWeight: 'bold', margin: '0 0 4px 0', color: '#1f2937' }}>{tool.name}</h4>
                          <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{tool.description}</p>
                        </div>
                        {isEditingPrices ? (
                          <input
                            type="number"
                            value={tool.cost}
                            onChange={(e) => updateToolPrice('semantic-location', tool.id, parseFloat(e.target.value))}
                            style={{ width: '90px', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '6px', marginLeft: '16px' }}
                            step="0.001"
                            min="0"
                            max="1.00"
                          />
                        ) : (
                          <span style={{ marginLeft: '16px', padding: '4px 12px', backgroundColor: tool.cost === 0 ? '#fef3c7' : '#d1fae5', color: tool.cost === 0 ? '#92400e' : '#065f46', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', whiteSpace: 'nowrap' }}>
                            {tool.cost === 0 ? 'FREE' : `$${tool.cost.toFixed(3)} USDC`}
                          </span>
                        )}
                      </div>
                      {tool.callCount > 0 && (
                        <p style={{ fontSize: '12px', color: '#7c3aed', fontWeight: '600', margin: '8px 0 0 0' }}>
                          ✓ Called {tool.callCount} time{tool.callCount > 1 ? 's' : ''} via X402
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Google Maps MCP Server */}
            <div style={{ backgroundColor: '#fff', border: '2px solid #e5e7eb', borderRadius: '16px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '36px' }}>🗺️</span>
                  <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#1f2937' }}>{googleMapsMCP.name}</h2>
                </div>
                <span style={{ padding: '4px 16px', backgroundColor: googleMapsMCP.status === 'connected' ? '#10b981' : '#ef4444', color: '#fff', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                  {googleMapsMCP.status.toUpperCase()}
                </span>
              </div>

              <div style={{ background: 'linear-gradient(to right, #dbeafe, #bfdbfe)', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
                <p style={{ fontSize: '14px', color: '#374151', fontWeight: '600', margin: '0 0 8px 0' }}>Server Earnings (USDC)</p>
                <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#2563eb', margin: 0 }}>${googleMapsMCP.balance.toFixed(2)} USDC</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {googleMapsMCP.tools.map((tool) => (
                  <div key={tool.id} style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontWeight: 'bold', margin: '0 0 4px 0', color: '#1f2937' }}>{tool.name}</h4>
                        <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{tool.description}</p>
                      </div>
                      <span style={{ marginLeft: '16px', padding: '4px 12px', backgroundColor: '#d1fae5', color: '#065f46', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', whiteSpace: 'nowrap' }}>
                        ${tool.cost.toFixed(3)} USDC
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Weather MCP Server */}
            <div style={{ backgroundColor: '#fff', border: '2px solid #e5e7eb', borderRadius: '16px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '36px' }}>🌤️</span>
                  <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#1f2937' }}>{weatherMCP.name}</h2>
                </div>
                <span style={{ padding: '4px 16px', backgroundColor: weatherMCP.status === 'connected' ? '#10b981' : '#ef4444', color: '#fff', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                  {weatherMCP.status.toUpperCase()}
                </span>
              </div>

              <div style={{ background: 'linear-gradient(to right, #fed7aa, #fdba74)', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
                <p style={{ fontSize: '14px', color: '#374151', fontWeight: '600', margin: '0 0 8px 0' }}>Server Earnings (USDC)</p>
                <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#ea580c', margin: 0 }}>${weatherMCP.balance.toFixed(2)} USDC</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {weatherMCP.tools.map((tool) => (
                  <div key={tool.id} style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontWeight: 'bold', margin: '0 0 4px 0', color: '#1f2937' }}>{tool.name}</h4>
                        <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{tool.description}</p>
                      </div>
                      <span style={{ marginLeft: '16px', padding: '4px 12px', backgroundColor: '#d1fae5', color: '#065f46', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', whiteSpace: 'nowrap' }}>
                        ${tool.cost.toFixed(2)} USDC
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* USDC Balance */}
            <div style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 50%, #06b6d4 100%)', borderRadius: '16px', padding: '32px', color: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '40px' }}>💰</span>
                  <h2 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0 }}>USDC Balance</h2>
                </div>
                <div style={{ fontSize: '48px', fontWeight: 'bold' }}>${userBalance.toFixed(2)} USDC</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                {[
                  { label: 'Available Balance', value: `$${userBalance.toFixed(2)}` },
                  { label: 'Total Spent', value: `$${totalSpent.toFixed(2)}` },
                  { label: 'Total Requests', value: totalRequests },
                  { label: 'Last Activity', value: lastActivity }
                ].map((item, idx) => (
                  <div key={idx} style={{ backgroundColor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', borderRadius: '12px', padding: '16px' }}>
                    <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', margin: '0 0 4px 0' }}>{item.label}</p>
                    <p style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>{item.value}</p>
                  </div>
                ))}
              </div>

              <div style={{ backgroundColor: 'rgba(109, 40, 217, 0.5)', backdropFilter: 'blur(10px)', borderRadius: '12px', padding: '20px' }}>
                <p style={{ fontWeight: 'bold', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>🧠</span>
                  SEMANTIC SEARCH + SELF-LEARNING AI
                </p>
                <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)', margin: 0 }}>
                  AI-powered location discovery that learns from your selections. Get better recommendations over time!
                </p>
              </div>
            </div>

            {/* Transaction History */}
            <div style={{ backgroundColor: '#fff', border: '2px solid #e5e7eb', borderRadius: '16px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span style={{ fontSize: '24px' }}>📊</span>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, color: '#1f2937' }}>Recent Transactions</h2>
              </div>

              {transactions.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#6b7280', padding: '32px 0' }}>
                  No transactions yet. Start searching to see X402 payment flow.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {transactions.map((tx) => (
                    <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                        <span style={{ fontSize: '20px' }}>✅</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: '600', fontSize: '14px', margin: '0 0 4px 0', color: '#1f2937' }}>{tx.description}</p>
                          <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>({tx.toolName})</p>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', marginLeft: '16px' }}>
                        <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#dc2626', margin: '0 0 4px 0' }}>-${tx.amount.toFixed(2)} USDC</p>
                        <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{tx.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Test Controls */}
            <div style={{ backgroundColor: '#fff', border: '2px solid #e5e7eb', borderRadius: '16px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span style={{ fontSize: '24px' }}>🎮</span>
                <h3 style={{ fontWeight: 'bold', margin: 0, color: '#1f2937' }}>Test Controls</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button onClick={refreshServer} style={{ width: '100%', backgroundColor: '#8b5cf6', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
                  🔄 Refresh Servers
                </button>
                <button onClick={clearChat} style={{ width: '100%', backgroundColor: '#e5e7eb', color: '#1f2937', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
                  💬 Clear Chat
                </button>
                <button onClick={clearResults} style={{ width: '100%', backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
                  🗑️ Clear Results
                </button>
              </div>
            </div>

            {/* Quick Test Queries */}
            <div style={{ backgroundColor: '#fff', border: '2px solid #8b5cf6', borderRadius: '16px', padding: '20px' }}>
              <h3 style={{ fontWeight: 'bold', marginBottom: '16px', color: '#1f2937' }}>🔍 Quick Semantic Searches:</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {quickQueries.map((query, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickQuery(query)}
                    disabled={isProcessing}
                    style={{ textAlign: 'left', padding: '12px', backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '8px', fontSize: '13px', color: '#374151', cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.5 : 1 }}
                  >
                    {query}
                  </button>
                ))}
              </div>
            </div>

            {/* Test Results */}
            <div style={{ backgroundColor: '#fff', border: '2px solid #e5e7eb', borderRadius: '16px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span style={{ fontSize: '24px' }}>📊</span>
                <h3 style={{ fontWeight: 'bold', margin: 0, color: '#1f2937' }}>Test Results ({testResults.length})</h3>
              </div>
              {testResults.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#6b7280', padding: '32px 0', fontSize: '14px' }}>
                  No test results yet.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '256px', overflowY: 'auto' }}>
                  {testResults.map((result) => (
                    <div key={result.id} style={{ padding: '12px', backgroundColor: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: '8px', fontSize: '12px', color: '#065f46' }}>
                      ✓ {result.query.substring(0, 40)}... - ${result.cost.toFixed(2)} USDC
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chat Interface - Full Width Bottom */}
        <div style={{ backgroundColor: '#000', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
          <div style={{ backgroundColor: '#1f2937', padding: '16px 24px', borderBottom: '1px solid #374151' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '32px' }}>💬</span>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff', margin: 0 }}>Semantic Location Search Chat</h2>
                <p style={{ fontSize: '14px', color: '#9ca3af', margin: '4px 0 0 0' }}>Natural Language Location Discovery with Self-Learning AI</p>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: '#fff', padding: '24px', maxHeight: '500px', overflowY: 'auto' }}>
            {messages.map((msg) => (
              <div key={msg.id} style={{ marginBottom: '20px', backgroundColor: msg.role === 'system' ? '#f5f3ff' : 'transparent', borderLeft: msg.role === 'system' ? '4px solid #8b5cf6' : 'none', padding: msg.role === 'system' ? '16px' : '0', borderRadius: msg.role === 'system' ? '0 8px 8px 0' : '0' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <span style={{ fontSize: '24px', flexShrink: 0 }}>
                    {msg.role === 'system' ? '🔍' : msg.role === 'user' ? '👤' : '🤖'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 'bold', color: '#1f2937' }}>
                        {msg.role === 'system' ? 'Semantic Search AI' : msg.role === 'user' ? 'You' : 'AI Assistant'}
                      </span>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>{msg.timestamp.toLocaleTimeString()}</span>
                      {msg.cost !== undefined && msg.cost > 0 && (
                        <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 'bold', color: '#dc2626' }}>
                          -${msg.cost.toFixed(2)} USDC
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '14px', color: '#374151', lineHeight: '1.6' }}>
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {isProcessing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px' }}>
                <span style={{ fontSize: '24px', animation: 'pulse 1.5s ease-in-out infinite' }}>🔍</span>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Searching with AI...</span>
              </div>
            )}
          </div>

          <div style={{ backgroundColor: '#f3f4f6', padding: '16px', borderTop: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Try: quiet cafe with WiFi near Times Square..."
                style={{ flex: 1, padding: '12px 16px', border: '2px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
                disabled={isProcessing}
              />
              <button
                onClick={handleSendMessage}
                disabled={isProcessing || !inputMessage.trim()}
                style={{ backgroundColor: isProcessing || !inputMessage.trim() ? '#9ca3af' : '#8b5cf6', color: '#fff', border: 'none', padding: '12px 32px', borderRadius: '8px', fontWeight: 'bold', cursor: isProcessing || !inputMessage.trim() ? 'not-allowed' : 'pointer' }}
              >
                {isProcessing ? '⏳' : '🔍'} Search
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
