'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { usePrivy } from '@privy-io/react-auth';

interface Source {
  id: string;
  type: 'file' | 'website' | 'youtube' | 'text';
  name: string;
  url?: string;
  contentLength: number;
  uploadedAt: string;
  selected: boolean;
}

interface Store {
  name: string;
  displayName: string;
  sourceCount: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sourceCount?: number;
  queryId?: string;      // For feedback
  fromCache?: boolean;   // If answer came from cache
  confidence?: number;   // Response confidence
  feedbackGiven?: 'up' | 'down' | 'edited'; // Track if user gave feedback or edited
  isEditing?: boolean;   // Track if user is editing
  editText?: string;     // Text being edited
}

const MCP_ENDPOINT = 'http://localhost:3005';

const SOURCE_ICONS: Record<string, string> = {
  file: '📄',
  website: '🔗',
  youtube: '📺',
  text: '📋',
  github: '🐙',
  gdrive: '📁',
};

export default function FileSearchDemo(): JSX.Element {
  const { ready, authenticated, user, login } = usePrivy();
  const walletAddress = user?.wallet?.address || '';
  
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [currentStoreName, setCurrentStoreName] = useState<string>('');
  const [sources, setSources] = useState<Source[]>([]);
  const [question, setQuestion] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [serverStatus, setServerStatus] = useState<'connected' | 'disconnected'>('disconnected');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [addType, setAddType] = useState<'file' | 'website' | 'text' | 'github' | 'gdrive'>('file');
  const [modalUrl, setModalUrl] = useState<string>('');
  const [modalText, setModalText] = useState<string>('');
  const [modalTitle, setModalTitle] = useState<string>('');
  const [showNewNotebook, setShowNewNotebook] = useState<boolean>(false);
  const [newNotebookName, setNewNotebookName] = useState<string>('');
  
  // OAuth connection states
  const [connections, setConnections] = useState<{provider: string, accountName: string}[]>([]);
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [repoFiles, setRepoFiles] = useState<any[]>([]);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [selectedDriveFiles, setSelectedDriveFiles] = useState<{id: string, name: string}[]>([]);
  const [driveFolderId, setDriveFolderId] = useState<string>('root');
  const [driveFolderStack, setDriveFolderStack] = useState<{id: string, name: string}[]>([]);
  
  // Authenticated website scraping
  const [requiresLogin, setRequiresLogin] = useState<boolean>(false);
  const [authSessionId, setAuthSessionId] = useState<string>('');
  const [authStatus, setAuthStatus] = useState<'idle' | 'waiting' | 'ready'>('idle');
  
  // Multi-page crawling
  const [enableCrawl, setEnableCrawl] = useState<boolean>(false);
  const [maxPages, setMaxPages] = useState<number>(10);
  const [crawlProgress, setCrawlProgress] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkServerHealth();
  }, []);

  useEffect(() => {
    if (selectedStore) {
      refreshSources();
      const store = stores.find(s => s.name === selectedStore);
      setCurrentStoreName(store?.displayName || '');
    }
  }, [selectedStore, stores]);

  const checkServerHealth = async () => {
    try {
      const response = await fetch(`${MCP_ENDPOINT}/health`);
      if (response.ok) {
        setServerStatus('connected');
        await refreshStores();
      }
    } catch {
      setServerStatus('disconnected');
    }
  };

  const refreshStores = async () => {
    try {
      const res = await fetch(`${MCP_ENDPOINT}/tools/list_stores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userWallet: walletAddress }),
      });
      const data = await res.json();
      if (data.success) {
        const newStores = data.stores || [];
        setStores(newStores);
        if (selectedStore && !newStores.some((s: Store) => s.name === selectedStore)) {
          setSelectedStore('');
          setSources([]);
        }
      }
    } catch (e) { console.error(e); }
  };

  const refreshSources = async () => {
    if (!selectedStore) return;
    try {
      const res = await fetch(`${MCP_ENDPOINT}/tools/list_sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName: selectedStore }),
      });
      const data = await res.json();
      if (data.success) {
        // Use isSelected from database, default to true if not present
        setSources((data.sources || []).map((s: any) => ({ ...s, selected: s.isSelected ?? true })));
      } else if (data.error?.includes('not found')) {
        setSelectedStore('');
        setSources([]);
        await refreshStores();
      }
    } catch (e) { console.error(e); }
  };

  // Toggle source selection (persists to database)
  const toggleSourceSelection = async (sourceId: string, newSelected: boolean) => {
    // Update local state immediately for responsiveness
    setSources(prev => prev.map(s => s.id === sourceId ? { ...s, selected: newSelected } : s));
    
    // Persist to database
    try {
      await fetch(`${MCP_ENDPOINT}/tools/toggle_source_selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, isSelected: newSelected }),
      });
    } catch (e) { console.error(e); }
  };

  // OAuth Helper Functions
  const fetchConnections = async () => {
    try {
      const res = await fetch(`${MCP_ENDPOINT}/connections`, {
        headers: { 'X-Wallet-Address': walletAddress },
      });
      const data = await res.json();
      if (data.success) setConnections(data.connections || []);
    } catch (e) { console.error(e); }
  };

  const isConnected = (provider: string) => connections.some(c => c.provider === provider);

  const startOAuth = (provider: string) => {
    const returnUrl = encodeURIComponent(window.location.href);
    const url = `${MCP_ENDPOINT}/auth/${provider}?userWallet=${walletAddress}&returnUrl=${returnUrl}`;
    window.location.href = url;
  };

  const fetchGithubRepos = async () => {
    try {
      const res = await fetch(`${MCP_ENDPOINT}/github/repos`, {
        headers: { 'X-Wallet-Address': walletAddress },
      });
      const data = await res.json();
      if (data.success) setGithubRepos(data.repos || []);
    } catch (e) { console.error(e); }
  };

  const fetchRepoFiles = async (owner: string, repo: string, path: string = '') => {
    try {
      const res = await fetch(`${MCP_ENDPOINT}/github/files/${owner}/${repo}?path=${path}`, {
        headers: { 'X-Wallet-Address': walletAddress },
      });
      const data = await res.json();
      if (data.success) {
        setRepoFiles(data.files || []);
        setCurrentPath(path);
      }
    } catch (e) { console.error(e); }
  };

  const addGithubFile = async (owner: string, repo: string, path: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch(`${MCP_ENDPOINT}/tools/add_github_source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Wallet-Address': walletAddress },
        body: JSON.stringify({ storeName: selectedStore, owner, repo, path }),
      });
      const data = await res.json();
      if (data.success) {
        await refreshSources();
        setShowAddModal(false);
      }
    } catch (e) { console.error(e); }
    setIsProcessing(false);
  };

  const fetchDriveFiles = async (folderId: string = 'root') => {
    try {
      const res = await fetch(`${MCP_ENDPOINT}/drive/files?folderId=${folderId}`, {
        headers: { 'X-Wallet-Address': walletAddress },
      });
      const data = await res.json();
      if (data.success) {
        setDriveFiles(data.files || []);
        setDriveFolderId(folderId);
      }
    } catch (e) { console.error(e); }
  };

  const navigateToFolder = (folderId: string, folderName: string) => {
    setDriveFolderStack(prev => [...prev, { id: driveFolderId, name: folderName }]);
    setSelectedDriveFiles([]);
    fetchDriveFiles(folderId);
  };

  const navigateBack = () => {
    if (driveFolderStack.length > 0) {
      const stack = [...driveFolderStack];
      const parent = stack.pop();
      setDriveFolderStack(stack);
      setSelectedDriveFiles([]);
      fetchDriveFiles(parent?.id || 'root');
    }
  };

  const toggleDriveFileSelect = (file: {id: string, name: string}) => {
    setSelectedDriveFiles(prev => {
      const exists = prev.some(f => f.id === file.id);
      if (exists) return prev.filter(f => f.id !== file.id);
      return [...prev, file];
    });
  };

  const addSelectedDriveFiles = async () => {
    setIsProcessing(true);
    console.log('Adding Drive files:', { storeName: selectedStore, files: selectedDriveFiles });
    for (const file of selectedDriveFiles) {
      try {
        const res = await fetch(`${MCP_ENDPOINT}/tools/add_drive_source`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Wallet-Address': walletAddress },
          body: JSON.stringify({ storeName: selectedStore, fileId: file.id, fileName: file.name }),
        });
        const data = await res.json();
        if (!data.success) {
          console.error(`Failed to add ${file.name}:`, data.error);
          alert(`Error adding ${file.name}: ${data.error}`);
        }
      } catch (e) { 
        console.error(`Error adding ${file.name}:`, e); 
        alert(`Failed to add ${file.name}: ${e}`);
      }
    }
    await refreshSources();
    setSelectedDriveFiles([]);
    setShowAddModal(false);
    setIsProcessing(false);
  };

  const addDriveFile = async (fileId: string, fileName: string) => {
    setIsProcessing(true);
    try {
      console.log('Adding Drive file:', { storeName: selectedStore, fileId, fileName });
      const res = await fetch(`${MCP_ENDPOINT}/tools/add_drive_source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Wallet-Address': walletAddress },
        body: JSON.stringify({ storeName: selectedStore, fileId, fileName }),
      });
      const data = await res.json();
      console.log('Drive file response:', data);
      if (data.success) {
        await refreshSources();
        setShowAddModal(false);
      } else {
        alert(`Error adding Drive file: ${data.error}`);
      }
    } catch (e) { 
      console.error('Drive file error:', e); 
      alert(`Failed to add Drive file: ${e}`);
    }
    setIsProcessing(false);
  };

  // Load connections on mount
  useEffect(() => {
    if (walletAddress) fetchConnections();
  }, [walletAddress]);

  // Authenticated website scraping functions
  const startAuthSession = async () => {
    if (!modalUrl.trim()) return;
    setIsProcessing(true);
    setAuthStatus('waiting');
    try {
      const res = await fetch(`${MCP_ENDPOINT}/tools/start_auth_session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginUrl: modalUrl }),
      });
      const data = await res.json();
      if (data.success) {
        setAuthSessionId(data.sessionId);
        setAuthStatus('ready');
      }
    } catch (e) { console.error(e); setAuthStatus('idle'); }
    setIsProcessing(false);
  };

  const completeAuthScrape = async (targetUrl?: string) => {
    if (!authSessionId) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`${MCP_ENDPOINT}/tools/complete_auth_scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: authSessionId, targetUrl, storeName: selectedStore }),
      });
      const data = await res.json();
      if (data.success) {
        await refreshSources();
        setShowAddModal(false);
        setAuthSessionId('');
        setAuthStatus('idle');
        setRequiresLogin(false);
        setModalUrl('');
      }
    } catch (e) { console.error(e); }
    setIsProcessing(false);
  };

  // Authenticated crawl function (login + crawl combined)
  const completeAuthCrawl = async () => {
    if (!authSessionId) return;
    setIsProcessing(true);
    setCrawlProgress('Starting authenticated crawl...');
    try {
      const res = await fetch(`${MCP_ENDPOINT}/tools/complete_auth_crawl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: authSessionId, storeName: selectedStore, maxPages, maxDepth: 2 }),
      });
      const data = await res.json();
      if (data.success) {
        setCrawlProgress(`✅ Crawled ${data.source?.pagesCrawled || 0} pages into 1 source`);
        await refreshSources();
        setTimeout(() => {
          setShowAddModal(false);
          setAuthSessionId('');
          setAuthStatus('idle');
          setRequiresLogin(false);
          setEnableCrawl(false);
          setCrawlProgress('');
          setModalUrl('');
        }, 1500);
      } else {
        setCrawlProgress(`❌ Error: ${data.error}`);
      }
    } catch (e: any) { 
      setCrawlProgress(`❌ Error: ${e.message}`);
    }
    setIsProcessing(false);
  };

  const cancelAuthSession = async () => {
    if (authSessionId) {
      await fetch(`${MCP_ENDPOINT}/tools/cancel_auth_session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: authSessionId }),
      });
    }
    setAuthSessionId('');
    setAuthStatus('idle');
  };

  // Crawl website function
  const crawlWebsite = async () => {
    if (!modalUrl.trim() || !selectedStore) return;
    setIsProcessing(true);
    setCrawlProgress('Starting crawl...');
    try {
      const res = await fetch(`${MCP_ENDPOINT}/tools/crawl_website`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName: selectedStore, url: modalUrl, maxPages, maxDepth: 2 }),
      });
      const data = await res.json();
      if (data.success) {
        setCrawlProgress(`✅ Crawled ${data.source?.pagesCrawled || 0} pages into 1 source`);
        await refreshSources();
        setTimeout(() => {
          setShowAddModal(false);
          setCrawlProgress('');
          setEnableCrawl(false);
          setModalUrl('');
        }, 1500);
      } else {
        setCrawlProgress(`❌ Error: ${data.error}`);
      }
    } catch (e: any) { 
      setCrawlProgress(`❌ Error: ${e.message}`);
    }
    setIsProcessing(false);
  };

  const createNotebook = async () => {
    if (!newNotebookName.trim()) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`${MCP_ENDPOINT}/tools/create_store`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newNotebookName, userWallet: walletAddress }),
      });
      const data = await res.json();
      if (data.success) {
        await refreshStores();
        setSelectedStore(data.store.name);
        setNewNotebookName('');
        setShowNewNotebook(false);
      }
    } catch (e) { console.error(e); }
    setIsProcessing(false);
  };

  const addSource = async () => {
    if (!selectedStore) return;
    setIsProcessing(true);
    
    try {
      let endpoint = '';
      let body: any = { storeName: selectedStore };
      
      if (addType === 'file') {
        // File input handled separately
        return;
      } else if (addType === 'website') {
        const isYouTube = modalUrl.includes('youtube.com') || modalUrl.includes('youtu.be');
        endpoint = isYouTube ? '/tools/add_youtube' : '/tools/add_website';
        body.url = modalUrl;
      } else if (addType === 'text') {
        endpoint = '/tools/add_text';
        body.content = modalText;
        body.title = modalTitle || 'Pasted Text';
      }
      
      const res = await fetch(`${MCP_ENDPOINT}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      
      if (data.success) {
        await refreshSources();
        await refreshStores();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
    
    setShowAddModal(false);
    setModalUrl('');
    setModalText('');
    setModalTitle('');
    setIsProcessing(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !selectedStore) return;
    
    setIsProcessing(true);
    for (const file of Array.from(files)) {
      try {
        const content = await file.text();
        await fetch(`${MCP_ENDPOINT}/tools/add_file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storeName: selectedStore,
            fileName: file.name,
            content,
          }),
        });
      } catch (e) { console.error(e); }
    }
    await refreshSources();
    await refreshStores();
    setIsProcessing(false);
    e.target.value = '';
  };

  const toggleSource = (id: string) => {
    const source = sources.find(s => s.id === id);
    if (source) {
      toggleSourceSelection(id, !source.selected);
    }
  };

  const toggleAllSources = async () => {
    const allSelected = sources.every(s => s.selected);
    const newSelected = !allSelected;
    setSources(prev => prev.map(s => ({ ...s, selected: newSelected })));
    // Persist all changes
    for (const source of sources) {
      try {
        await fetch(`${MCP_ENDPOINT}/tools/toggle_source_selection`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceId: source.id, isSelected: newSelected }),
        });
      } catch (e) { console.error(e); }
    }
  };

  const deleteSource = async (sourceId: string) => {
    try {
      await fetch(`${MCP_ENDPOINT}/tools/delete_source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName: selectedStore, sourceId }),
      });
      await refreshSources();
    } catch (e) { console.error(e); }
  };

  const refreshSource = async (sourceId: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch(`${MCP_ENDPOINT}/tools/refresh_source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName: selectedStore, sourceId }),
      });
      const data = await res.json();
      if (data.success) {
        await refreshSources();
      } else {
        alert(`Error refreshing: ${data.error}`);
      }
    } catch (e: any) { 
      alert(`Error: ${e.message}`);
    }
    setIsProcessing(false);
  };

  const queryStore = async () => {
    if (!selectedStore || !question.trim()) return;
    const selectedSources = sources.filter(s => s.selected);
    if (selectedSources.length === 0) {
      alert('Please select at least one source');
      return;
    }
    
    setIsProcessing(true);
    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: new Date(),
    }]);
    
    try {
      const selectedSourceIds = selectedSources.map(s => s.id);
      const res = await fetch(`${MCP_ENDPOINT}/tools/query_store`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName: selectedStore, question, sourceIds: selectedSourceIds }),
      });
      const data = await res.json();
      
      setMessages(prev => [...prev, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.success ? data.answer : `Error: ${data.error}`,
        timestamp: new Date(),
        sourceCount: selectedSources.length,
        queryId: data.queryId,
        fromCache: data.fromCache,
        confidence: data.confidence,
      }]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${e.message}`,
        timestamp: new Date(),
      }]);
    }
    
    setQuestion('');
    setIsProcessing(false);
  };

  // Submit feedback for self-learning
  const submitFeedback = async (messageId: string, queryId: string, helpful: boolean) => {
    try {
      await fetch(`${MCP_ENDPOINT}/tools/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queryId, helpful }),
      });
      // Update message to show feedback was given
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, feedbackGiven: helpful ? 'up' : 'down' } : msg
      ));
    } catch (e) {
      console.error('Feedback error:', e);
    }
  };

  // Update/edit an answer (for user improvements)
  const updateAnswer = async (messageId: string, queryId: string, newAnswer: string) => {
    try {
      const res = await fetch(`${MCP_ENDPOINT}/tools/update_answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queryId, newAnswer }),
      });
      const data = await res.json();
      if (data.success) {
        // Update message with new answer and show it was saved
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? { ...msg, content: newAnswer, feedbackGiven: 'edited', isEditing: false } : msg
        ));
      }
    } catch (e) {
      console.error('Update error:', e);
    }
  };

  const selectedCount = sources.filter(s => s.selected).length;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', color: '#fff' }}>
      {/* Header */}
      <header style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '12px 24px', 
        backgroundColor: '#1a1a1a', 
        borderBottom: '1px solid #333' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>📚</span>
          <h1 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
            {currentStoreName || 'Gemini File Search'}
          </h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ 
            padding: '4px 10px', 
            backgroundColor: serverStatus === 'connected' ? '#10b981' : '#ef4444', 
            borderRadius: '12px', 
            fontSize: '11px' 
          }}>
            {serverStatus === 'connected' ? '● Online' : '○ Offline'}
          </span>
          <button
            onClick={() => setShowNewNotebook(true)}
            style={{ 
              padding: '8px 16px', 
              backgroundColor: '#8b5cf6', 
              color: '#fff', 
              border: 'none', 
              borderRadius: '20px', 
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            + Create notebook
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', height: 'calc(100vh - 57px)' }}>
        
        {/* Left Panel - Sources */}
        <div style={{ 
          width: '320px', 
          borderRight: '1px solid #333', 
          display: 'flex', 
          flexDirection: 'column',
          backgroundColor: '#141414'
        }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #333' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontWeight: '600', fontSize: '14px' }}>Sources</span>
              <button
                onClick={() => setShowAddModal(true)}
                disabled={!selectedStore}
                style={{ 
                  background: 'none', 
                  border: '1px solid #444', 
                  color: '#888', 
                  padding: '4px 8px',
                  borderRadius: '4px',
                  cursor: selectedStore ? 'pointer' : 'not-allowed',
                  fontSize: '12px',
                  opacity: selectedStore ? 1 : 0.5
                }}
              >
                + Add
              </button>
            </div>
            
            {/* Notebook Selector */}
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: '#222',
                border: '1px solid #444',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '13px',
                marginBottom: '12px'
              }}
            >
              <option value="">Select a notebook...</option>
              {stores.map(store => (
                <option key={store.name} value={store.name}>{store.displayName}</option>
              ))}
            </select>
            
            {sources.length > 0 && (
              <div 
                onClick={toggleAllSources}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  padding: '8px 0',
                  cursor: 'pointer',
                  color: '#888',
                  fontSize: '13px'
                }}
              >
                <input 
                  type="checkbox" 
                  checked={sources.every(s => s.selected)} 
                  onChange={toggleAllSources}
                  style={{ accentColor: '#8b5cf6' }}
                />
                Select all sources
              </div>
            )}
          </div>
          
          {/* Sources List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {!selectedStore ? (
              <p style={{ color: '#666', fontSize: '13px', textAlign: 'center', padding: '24px' }}>
                Select or create a notebook
              </p>
            ) : sources.length === 0 ? (
              <p style={{ color: '#666', fontSize: '13px', textAlign: 'center', padding: '24px' }}>
                No sources yet. Click "+ Add" to add sources.
              </p>
            ) : (
              sources.map(src => (
                <div 
                  key={src.id}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px',
                    padding: '10px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: src.selected ? '#1f1f3a' : 'transparent',
                    marginBottom: '2px'
                  }}
                  onClick={() => toggleSource(src.id)}
                >
                  <input 
                    type="checkbox" 
                    checked={src.selected}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleSource(src.id)}
                    style={{ accentColor: '#8b5cf6', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '18px' }}>{SOURCE_ICONS[src.type]}</span>
                  <span style={{ 
                    flex: 1, 
                    fontSize: '13px', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    whiteSpace: 'nowrap',
                    color: src.selected ? '#fff' : '#999'
                  }}>
                    {src.name}
                  </span>
                  {/* Refresh button - only for website/youtube */}
                  {(src.type === 'website' || src.type === 'youtube') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); refreshSource(src.id); }}
                      title="Refresh content"
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        color: '#60a5fa', 
                        cursor: 'pointer',
                        padding: '4px 6px',
                        fontSize: '14px',
                        borderRadius: '4px'
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#3f3f46')}
                      onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      🔄
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSource(src.id); }}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: '#ef4444', 
                      cursor: 'pointer',
                      padding: '4px 6px',
                      fontSize: '14px',
                      borderRadius: '4px'
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#3f3f46')}
                    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel - Chat */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#0f0f0f' }}>
          
          {/* Chat Header */}
          <div style={{ padding: '12px 24px', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: '600' }}>Chat</span>
          </div>
          
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#666' }}>
                <p style={{ fontSize: '14px' }}>Ask questions about your selected sources</p>
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} style={{ marginBottom: '24px' }}>
                  {msg.role === 'user' ? (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{ 
                        backgroundColor: '#374151', 
                        padding: '12px 16px', 
                        borderRadius: '16px',
                        maxWidth: '70%',
                        fontSize: '14px'
                      }}>
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '14px', lineHeight: '1.7', color: '#e5e5e5' }}>
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                      <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        {/* Cache indicator */}
                        {msg.fromCache && (
                          <span style={{ 
                            backgroundColor: '#22c55e', 
                            color: '#fff', 
                            padding: '2px 8px', 
                            borderRadius: '12px', 
                            fontSize: '11px',
                            fontWeight: '500'
                          }}>
                            ⚡ Cached
                          </span>
                        )}
                        {/* Confidence badge */}
                        {msg.confidence && (
                          <span style={{ 
                            backgroundColor: msg.confidence > 0.85 ? '#22c55e' : '#f59e0b', 
                            color: '#fff', 
                            padding: '2px 8px', 
                            borderRadius: '12px', 
                            fontSize: '11px',
                            fontWeight: '500'
                          }}>
                            {Math.round(msg.confidence * 100)}% confidence
                          </span>
                        )}
                        {msg.sourceCount && (
                          <span style={{ fontSize: '12px', color: '#888' }}>
                            Based on {msg.sourceCount} source{msg.sourceCount > 1 ? 's' : ''}
                          </span>
                        )}
                        {/* Feedback buttons */}
                        {msg.queryId && !msg.feedbackGiven && (
                          <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                            <button
                              onClick={() => submitFeedback(msg.id, msg.queryId!, true)}
                              style={{ 
                                background: 'none', 
                                border: '1px solid #333', 
                                borderRadius: '6px', 
                                padding: '4px 10px', 
                                cursor: 'pointer',
                                fontSize: '16px'
                              }}
                              title="Good answer - save for future"
                            >
                              👍
                            </button>
                            <button
                              onClick={() => submitFeedback(msg.id, msg.queryId!, false)}
                              style={{ 
                                background: 'none', 
                                border: '1px solid #333', 
                                borderRadius: '6px', 
                                padding: '4px 10px', 
                                cursor: 'pointer',
                                fontSize: '16px'
                              }}
                              title="Bad answer"
                            >
                              👎
                            </button>
                            <button
                              onClick={() => setMessages(prev => prev.map(m => 
                                m.id === msg.id ? { ...m, isEditing: true, editText: m.content } : m
                              ))}
                              style={{ 
                                background: 'none', 
                                border: '1px solid #333', 
                                borderRadius: '6px', 
                                padding: '4px 10px', 
                                cursor: 'pointer',
                                fontSize: '16px'
                              }}
                              title="Edit answer to improve it"
                            >
                              ✏️
                            </button>
                          </div>
                        )}
                        {msg.isEditing && (
                          <div style={{ marginTop: '10px', width: '100%' }}>
                            <textarea
                              value={(msg as any).editText || msg.content}
                              onChange={(e) => setMessages(prev => prev.map(m => 
                                m.id === msg.id ? { ...m, editText: e.target.value } : m
                              ))}
                              style={{ 
                                width: '100%', 
                                minHeight: '100px', 
                                padding: '10px', 
                                backgroundColor: '#1a1a2e', 
                                border: '1px solid #444', 
                                borderRadius: '6px', 
                                color: '#fff',
                                fontSize: '14px',
                                resize: 'vertical'
                              }}
                            />
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                              <button
                                onClick={() => updateAnswer(msg.id, msg.queryId!, (msg as any).editText)}
                                style={{ padding: '6px 16px', backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                              >
                                💾 Save Improvement
                              </button>
                              <button
                                onClick={() => setMessages(prev => prev.map(m => 
                                  m.id === msg.id ? { ...m, isEditing: false } : m
                                ))}
                                style={{ padding: '6px 16px', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                        {msg.feedbackGiven && (
                          <span style={{ fontSize: '12px', color: '#888', marginLeft: 'auto' }}>
                            {msg.feedbackGiven === 'up' ? '✅ Saved to cache' : msg.feedbackGiven === 'edited' ? '✏️ Answer improved & cached' : '📝 Feedback recorded'}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
            
            {isProcessing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#888' }}>
                <span>Thinking...</span>
              </div>
            )}
          </div>
          
          {/* Input */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid #333' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              backgroundColor: '#1a1a1a',
              borderRadius: '24px',
              padding: '4px 4px 4px 20px',
              border: '1px solid #333'
            }}>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && queryStore()}
                placeholder="Start typing..."
                disabled={!selectedStore || sources.length === 0}
                style={{ 
                  flex: 1, 
                  background: 'none', 
                  border: 'none', 
                  color: '#fff', 
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              <span style={{ fontSize: '12px', color: '#888' }}>
                {selectedCount} source{selectedCount !== 1 ? 's' : ''}
              </span>
              <button
                onClick={queryStore}
                disabled={isProcessing || !question.trim() || selectedCount === 0}
                style={{ 
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: question.trim() && selectedCount > 0 ? '#8b5cf6' : '#333',
                  border: 'none',
                  color: '#fff',
                  cursor: question.trim() && selectedCount > 0 ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Source Modal */}
      {showAddModal && (
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            backgroundColor: 'rgba(0,0,0,0.8)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 50 
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div 
            style={{ 
              backgroundColor: '#1a1a1a', 
              borderRadius: '16px', 
              padding: '24px', 
              width: '480px',
              border: '1px solid #333'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>Add Source</h3>
            
            {/* Type Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {[
                { type: 'file', label: '📤 Upload File' },
                { type: 'website', label: '🔗 Website' },
                { type: 'text', label: '📋 Text' },
                { type: 'github', label: '🐙 GitHub' },
                { type: 'gdrive', label: '📁 Drive' },
              ].map(t => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => {
                    setAddType(t.type as any);
                    if (t.type === 'github' && isConnected('github')) fetchGithubRepos();
                    if (t.type === 'gdrive' && isConnected('google')) fetchDriveFiles();
                  }}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: addType === t.type ? '#8b5cf6' : '#222',
                    border: '1px solid',
                    borderColor: addType === t.type ? '#8b5cf6' : '#444',
                    borderRadius: '8px',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            
            {/* Content based on type */}
            {addType === 'file' && (
              <div>
                <div
                  style={{
                    width: '100%',
                    padding: '40px',
                    backgroundColor: '#222',
                    border: '2px dashed #444',
                    borderRadius: '12px',
                    color: '#888',
                    fontSize: '14px',
                    textAlign: 'center',
                    position: 'relative',
                    cursor: 'pointer',
                    marginBottom: '12px'
                  }}
                >
                  <input 
                    type="file"
                    multiple
                    onChange={(e) => { handleFileUpload(e); setShowAddModal(false); }}
                    accept=".txt,.pdf,.doc,.docx,.md,.json,.csv"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      opacity: 0,
                      cursor: 'pointer'
                    }}
                  />
                  📄 Click or drag files here
                </div>
                {/* Fallback visible file input */}
                <div style={{ textAlign: 'center' }}>
                  <label style={{ 
                    display: 'inline-block',
                    padding: '10px 20px', 
                    backgroundColor: '#8b5cf6', 
                    color: '#fff', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}>
                    Browse Files
                    <input 
                      type="file"
                      multiple
                      onChange={(e) => { handleFileUpload(e); setShowAddModal(false); }}
                      accept=".txt,.pdf,.doc,.docx,.md,.json,.csv"
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>
            )}
            
            {addType === 'website' && (
              <div>
                <input
                  type="text"
                  value={modalUrl}
                  onChange={(e) => setModalUrl(e.target.value)}
                  placeholder={requiresLogin ? "Enter login page URL..." : "Enter website URL or YouTube link..."}
                  disabled={authStatus !== 'idle'}
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: '#222',
                    border: '1px solid #444',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    opacity: authStatus !== 'idle' ? 0.6 : 1
                  }}
                  autoFocus
                />
                
                {/* Options Row */}
                <div style={{ display: 'flex', gap: '20px', marginTop: '12px' }}>
                  {/* Login Required Checkbox */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={requiresLogin}
                      onChange={(e) => { setRequiresLogin(e.target.checked); cancelAuthSession(); }}
                      disabled={authStatus !== 'idle'}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <span style={{ fontSize: '13px', color: '#ccc' }}>🔐 Login required</span>
                  </label>
                  
                  {/* Crawl Checkbox */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={enableCrawl}
                      onChange={(e) => setEnableCrawl(e.target.checked)}
                      disabled={authStatus !== 'idle'}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <span style={{ fontSize: '13px', color: '#ccc' }}>🕸️ Crawl entire site</span>
                  </label>
                </div>

                {/* Crawl UI */}
                {enableCrawl && (
                  <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#1a2e1a', borderRadius: '8px', border: '1px solid #2d4a2d' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '13px', color: '#ccc' }}>Max pages:</span>
                      <select
                        value={maxPages}
                        onChange={(e) => setMaxPages(Number(e.target.value))}
                        style={{ padding: '6px 10px', backgroundColor: '#222', border: '1px solid #444', borderRadius: '4px', color: '#fff' }}
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                      </select>
                    </div>
                    <button
                      onClick={crawlWebsite}
                      disabled={isProcessing || !modalUrl.trim()}
                      style={{ padding: '10px 20px', backgroundColor: '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', width: '100%' }}
                    >
                      {isProcessing ? '🕸️ Crawling...' : '🕸️ Start Crawl'}
                    </button>
                    {crawlProgress && (
                      <p style={{ marginTop: '8px', fontSize: '12px', color: crawlProgress.includes('✅') ? '#22c55e' : crawlProgress.includes('❌') ? '#ef4444' : '#888' }}>
                        {crawlProgress}
                      </p>
                    )}
                  </div>
                )}

                {/* Auth Flow UI */}
                {requiresLogin && (
                  <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#1a1a2e', borderRadius: '8px', border: '1px solid #333' }}>
                    {authStatus === 'idle' && (
                      <div>
                        <p style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>
                          A browser window will open. Login to the site, then click "Capture Page" to save the content.
                        </p>
                        <button
                          onClick={startAuthSession}
                          disabled={isProcessing || !modalUrl.trim()}
                          style={{ padding: '10px 20px', backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                        >
                          🌐 Open Browser & Login
                        </button>
                      </div>
                    )}
                    
                    {authStatus === 'waiting' && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
                        <p style={{ color: '#888' }}>Opening browser...</p>
                      </div>
                    )}
                    
                    {authStatus === 'ready' && (
                      <div>
                        <p style={{ fontSize: '12px', color: '#22c55e', marginBottom: '12px' }}>
                          ✅ Browser is open. {enableCrawl ? 'Navigate to your starting page, then:' : 'Navigate to the page you want to save, then:'}
                        </p>
                        
                        {enableCrawl ? (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                              <span style={{ fontSize: '13px', color: '#ccc' }}>Max pages:</span>
                              <select
                                value={maxPages}
                                onChange={(e) => setMaxPages(Number(e.target.value))}
                                style={{ padding: '6px 10px', backgroundColor: '#222', border: '1px solid #444', borderRadius: '4px', color: '#fff' }}
                              >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                              </select>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={completeAuthCrawl}
                                disabled={isProcessing}
                                style={{ flex: 1, padding: '10px', backgroundColor: '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                              >
                                {isProcessing ? '🕸️ Crawling...' : '🕸️ Start Crawl'}
                              </button>
                              <button
                                onClick={cancelAuthSession}
                                style={{ padding: '10px 16px', backgroundColor: '#444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                              >
                                Cancel
                              </button>
                            </div>
                            {crawlProgress && (
                              <p style={{ marginTop: '8px', fontSize: '12px', color: crawlProgress.includes('✅') ? '#22c55e' : crawlProgress.includes('❌') ? '#ef4444' : '#888' }}>
                                {crawlProgress}
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            <input
                              type="text"
                              placeholder="Target page URL (optional - leave empty for current page)"
                              onChange={(e) => setModalUrl(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '10px',
                                backgroundColor: '#222',
                                border: '1px solid #444',
                                borderRadius: '6px',
                                color: '#fff',
                                fontSize: '13px',
                                marginBottom: '12px',
                                boxSizing: 'border-box'
                              }}
                            />
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => completeAuthScrape()}
                                disabled={isProcessing}
                                style={{ flex: 1, padding: '10px', backgroundColor: '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                              >
                                {isProcessing ? 'Capturing...' : '📸 Capture Current Page'}
                              </button>
                              <button
                                onClick={cancelAuthSession}
                                style={{ padding: '10px 16px', backgroundColor: '#444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                              >
                                Cancel
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {!requiresLogin && (
                  <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                    Supports websites and YouTube videos (transcripts will be extracted)
                  </p>
                )}
              </div>
            )}
            
            {addType === 'text' && (
              <div>
                <input
                  type="text"
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  placeholder="Title (optional)"
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: '#222',
                    border: '1px solid #444',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '14px',
                    marginBottom: '8px',
                    boxSizing: 'border-box'
                  }}
                />
                <textarea
                  value={modalText}
                  onChange={(e) => setModalText(e.target.value)}
                  placeholder="Paste your text here..."
                  style={{
                    width: '100%',
                    height: '150px',
                    padding: '12px',
                    backgroundColor: '#222',
                    border: '1px solid #444',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '14px',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                  autoFocus
                />
              </div>
            )}

            {/* GitHub Content */}
            {addType === 'github' && (
              <div>
                {!isConnected('github') ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🐙</div>
                    <p style={{ color: '#888', marginBottom: '16px' }}>Connect your GitHub account to import files from repositories</p>
                    <button
                      onClick={() => startOAuth('github')}
                      style={{ padding: '12px 24px', backgroundColor: '#24292e', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
                    >
                      Connect GitHub
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ marginBottom: '12px', fontSize: '12px', color: '#22c55e' }}>✅ Connected to GitHub</div>
                    {!selectedRepo ? (
                      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        <p style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Select a repository:</p>
                        {githubRepos.map(repo => (
                          <div
                            key={repo.id}
                            onClick={() => {
                              setSelectedRepo(repo.fullName);
                              fetchRepoFiles(repo.fullName.split('/')[0], repo.name);
                            }}
                            style={{ padding: '10px', backgroundColor: '#222', borderRadius: '6px', marginBottom: '4px', cursor: 'pointer', fontSize: '13px' }}
                          >
                            <strong>{repo.name}</strong>
                            {repo.description && <span style={{ color: '#888', marginLeft: '8px' }}>{repo.description.substring(0, 50)}</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div>
                        <button onClick={() => { setSelectedRepo(''); setRepoFiles([]); }} style={{ marginBottom: '8px', background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer' }}>← Back to repos</button>
                        {currentPath && <button onClick={() => fetchRepoFiles(selectedRepo.split('/')[0], selectedRepo.split('/')[1], currentPath.split('/').slice(0, -1).join('/'))} style={{ marginLeft: '8px', background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>📁 Up</button>}
                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          {repoFiles.map(file => (
                            <div
                              key={file.path}
                              onClick={() => {
                                if (file.type === 'dir') {
                                  fetchRepoFiles(selectedRepo.split('/')[0], selectedRepo.split('/')[1], file.path);
                                } else {
                                  addGithubFile(selectedRepo.split('/')[0], selectedRepo.split('/')[1], file.path);
                                }
                              }}
                              style={{ padding: '8px', backgroundColor: '#222', borderRadius: '4px', marginBottom: '4px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                              <span>{file.type === 'dir' ? '📁' : '📄'}</span>
                              <span>{file.name}</span>
                              {file.type !== 'dir' && <span style={{ marginLeft: 'auto', color: '#888', fontSize: '11px' }}>{Math.round(file.size / 1024)}KB</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Google Drive Content */}
            {addType === 'gdrive' && (
              <div>
                {!isConnected('google') ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
                    <p style={{ color: '#888', marginBottom: '16px' }}>Connect your Google account to import files from Drive</p>
                    <button
                      onClick={() => startOAuth('google')}
                      style={{ padding: '12px 24px', backgroundColor: '#4285f4', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
                    >
                      Connect Google Drive
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '12px', color: '#22c55e' }}>✅ Connected to Google Drive</div>
                      {selectedDriveFiles.length > 0 && (
                        <span style={{ fontSize: '12px', color: '#8b5cf6' }}>{selectedDriveFiles.length} selected</span>
                      )}
                    </div>
                    {/* Navigation */}
                    {driveFolderStack.length > 0 && (
                      <button 
                        onClick={navigateBack}
                        style={{ marginBottom: '8px', background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer', fontSize: '13px' }}
                      >
                        ← Back
                      </button>
                    )}
                    <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                      {driveFiles.length === 0 ? (
                        <p style={{ color: '#888', textAlign: 'center' }}>No files found</p>
                      ) : (
                        driveFiles.map((file: any) => {
                          const isFolder = file.mimeType?.includes('folder');
                          const isSelected = selectedDriveFiles.some(f => f.id === file.id);
                          return (
                            <div
                              key={file.id}
                              style={{ padding: '10px', backgroundColor: isSelected ? '#2d2d4a' : '#222', borderRadius: '6px', marginBottom: '4px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', border: isSelected ? '1px solid #8b5cf6' : '1px solid transparent' }}
                            >
                              {!isFolder && (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleDriveFileSelect({ id: file.id, name: file.name })}
                                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                />
                              )}
                              <span 
                                onClick={() => isFolder ? navigateToFolder(file.id, file.name) : toggleDriveFileSelect({ id: file.id, name: file.name })}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}
                              >
                                <span>{isFolder ? '📁' : file.mimeType?.includes('document') ? '📝' : file.mimeType?.includes('spreadsheet') ? '📊' : '📄'}</span>
                                <span>{file.name}</span>
                                {isFolder && <span style={{ marginLeft: 'auto', color: '#888', fontSize: '11px' }}>→</span>}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                    {/* Add Selected Button */}
                    {selectedDriveFiles.length > 0 && (
                      <button
                        onClick={addSelectedDriveFiles}
                        disabled={isProcessing}
                        style={{ marginTop: '12px', width: '100%', padding: '12px', backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
                      >
                        {isProcessing ? 'Adding...' : `Add ${selectedDriveFiles.length} File${selectedDriveFiles.length > 1 ? 's' : ''}`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button 
                onClick={() => setShowAddModal(false)}
                style={{ padding: '10px 20px', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              {addType !== 'file' && (
                <button
                  onClick={addSource}
                  disabled={isProcessing || (addType === 'website' ? !modalUrl.trim() : !modalText.trim())}
                  style={{ 
                    padding: '10px 20px', 
                    backgroundColor: '#8b5cf6', 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    opacity: (addType === 'website' ? modalUrl.trim() : modalText.trim()) ? 1 : 0.5
                  }}
                >
                  Add Source
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Notebook Modal */}
      {showNewNotebook && (
        <div 
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={() => setShowNewNotebook(false)}
        >
          <div 
            style={{ backgroundColor: '#1a1a1a', borderRadius: '16px', padding: '24px', width: '400px', border: '1px solid #333' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0' }}>Create Notebook</h3>
            <input
              type="text"
              value={newNotebookName}
              onChange={(e) => setNewNotebookName(e.target.value)}
              placeholder="Notebook name..."
              style={{ width: '100%', padding: '12px', backgroundColor: '#222', border: '1px solid #444', borderRadius: '8px', color: '#fff', marginBottom: '16px', boxSizing: 'border-box' }}
              autoFocus
              onKeyPress={(e) => e.key === 'Enter' && createNotebook()}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNewNotebook(false)} style={{ padding: '10px 20px', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={createNotebook} disabled={!newNotebookName.trim()} style={{ padding: '10px 20px', backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', opacity: newNotebookName.trim() ? 1 : 0.5 }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
