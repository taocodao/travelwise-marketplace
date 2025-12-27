# Complete Node.js Gemini File Search Project Guide

## 1. Project Setup

### Installation

```bash
# Create project directory
mkdir gemini-file-search-app
cd gemini-file-search-app

# Initialize Node.js project
npm init -y

# Install dependencies
npm install @google/genai dotenv express cors multer
npm install --save-dev nodemon
```

### Environment Setup

Create `.env` file:
```
GEMINI_API_KEY=your_api_key_here
PORT=3000
NODE_ENV=development
```

Get your API key from: https://aistudio.google.com/api-keys

### Package.json Scripts

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

---

## 2. Backend Server Implementation

### File: `server.js`

```javascript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileSearchRoutes } from './routes/fileSearch.js';
import { chatRoutes } from './routes/chat.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/files', fileSearchRoutes);
app.use('/api/chat', chatRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ 
    error: err.message || 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err : undefined
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
```

### File: `config/geminiClient.js`

```javascript
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

// Store management
export const fileSearchStores = new Map();

/**
 * Initialize or get existing File Search Store
 */
export async function initializeFileSearchStore(displayName) {
  try {
    // Check if store already exists
    const stores = await ai.fileSearchStores.list();
    
    for await (const store of stores) {
      if (store.displayName === displayName) {
        console.log(`✓ Using existing store: ${store.name}`);
        fileSearchStores.set(displayName, store);
        return store;
      }
    }

    // Create new store
    const newStore = await ai.fileSearchStores.create({
      config: { displayName }
    });
    
    console.log(`✓ Created new store: ${newStore.name}`);
    fileSearchStores.set(displayName, newStore);
    return newStore;
  } catch (error) {
    console.error('Error initializing File Search Store:', error);
    throw error;
  }
}

/**
 * Get store by display name
 */
export async function getStoreByName(displayName) {
  if (fileSearchStores.has(displayName)) {
    return fileSearchStores.get(displayName);
  }

  const stores = await ai.fileSearchStores.list();
  for await (const store of stores) {
    if (store.displayName === displayName) {
      fileSearchStores.set(displayName, store);
      return store;
    }
  }
  
  return null;
}

/**
 * List all File Search Stores
 */
export async function listAllStores() {
  try {
    const stores = [];
    const list = await ai.fileSearchStores.list();
    
    for await (const store of list) {
      stores.push({
        name: store.name,
        displayName: store.displayName,
        createTime: store.createTime
      });
    }
    
    return stores;
  } catch (error) {
    console.error('Error listing stores:', error);
    throw error;
  }
}
```

### File: `routes/fileSearch.js`

```javascript
import express from 'express';
import fs from 'fs';
import path from 'path';
import { ai, initializeFileSearchStore, getStoreByName } from '../config/geminiClient.js';

export const fileSearchRoutes = express.Router();

const UPLOADS_DIR = './uploads';
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Upload file to File Search Store
 * POST /api/files/upload
 */
fileSearchRoutes.post('/upload', async (req, res) => {
  try {
    const { file, storeName, fileName } = req.body;

    if (!file || !storeName) {
      return res.status(400).json({ 
        error: 'Missing required fields: file, storeName' 
      });
    }

    // Convert base64 to Buffer
    const buffer = Buffer.from(file.split(',')[1] || file, 'base64');
    const displayFileName = fileName || 'uploaded-document';

    // Initialize store
    const store = await initializeFileSearchStore(storeName);

    // Upload to File Search Store
    console.log(`Uploading file: ${displayFileName} to store: ${storeName}`);
    
    const operation = await ai.fileSearchStores.uploadToFileSearchStore({
      fileSearchStoreName: store.name,
      file: buffer,
      config: {
        displayName: displayFileName,
        // Optional: Custom chunking config
        chunking_config: {
          white_space_config: {
            max_tokens_per_chunk: 200,
            max_overlap_tokens: 20
          }
        }
      }
    });

    // Poll for completion
    let completed = false;
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes with 5-second intervals

    while (!completed && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const result = await ai.operations.get({
        operation: operation.name
      });

      if (result.done) {
        completed = true;
        console.log(`✓ File uploaded successfully: ${displayFileName}`);
      }
      
      attempts++;
    }

    if (!completed) {
      return res.status(408).json({ 
        error: 'Upload timeout - file processing took too long' 
      });
    }

    res.json({ 
      success: true,
      message: 'File uploaded and indexed successfully',
      file: displayFileName,
      storeName: store.displayName
    });

  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ 
      error: 'Failed to upload file',
      details: error.message 
    });
  }
});

/**
 * List documents in a store
 * GET /api/files/documents/:storeName
 */
fileSearchRoutes.get('/documents/:storeName', async (req, res) => {
  try {
    const { storeName } = req.params;
    
    const store = await getStoreByName(storeName);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }

    const documents = [];
    const docList = await ai.fileSearchStores.documents.list({
      parent: store.name
    });

    for await (const doc of docList) {
      documents.push({
        name: doc.name,
        displayName: doc.displayName,
        createTime: doc.createTime
      });
    }

    res.json({ 
      storeName: store.displayName,
      documentCount: documents.length,
      documents 
    });

  } catch (error) {
    console.error('Error listing documents:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete document from store
 * DELETE /api/files/document/:storeName/:docId
 */
fileSearchRoutes.delete('/document/:storeName/:docId', async (req, res) => {
  try {
    const { storeName, docId } = req.params;
    
    const store = await getStoreByName(storeName);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }

    await ai.fileSearchStores.documents.delete({
      name: `${store.name}/documents/${docId}`
    });

    res.json({ 
      success: true,
      message: 'Document deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * List all File Search Stores
 * GET /api/files/stores
 */
fileSearchRoutes.get('/stores', async (req, res) => {
  try {
    const stores = [];
    const list = await ai.fileSearchStores.list();

    for await (const store of list) {
      stores.push({
        name: store.name,
        displayName: store.displayName,
        createTime: store.createTime
      });
    }

    res.json({ 
      storeCount: stores.length,
      stores 
    });

  } catch (error) {
    console.error('Error listing stores:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete a File Search Store
 * DELETE /api/files/store/:storeName
 */
fileSearchRoutes.delete('/store/:storeName', async (req, res) => {
  try {
    const { storeName } = req.params;
    
    const store = await getStoreByName(storeName);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }

    await ai.fileSearchStores.delete({
      name: store.name,
      config: { force: true }
    });

    res.json({ 
      success: true,
      message: `Store "${storeName}" deleted successfully`
    });

  } catch (error) {
    console.error('Error deleting store:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### File: `routes/chat.js`

```javascript
import express from 'express';
import { ai, getStoreByName } from '../config/geminiClient.js';

export const chatRoutes = express.Router();

/**
 * Query File Search Store with Q&A
 * POST /api/chat/ask
 * Body: { question, storeName }
 */
chatRoutes.post('/ask', async (req, res) => {
  try {
    const { question, storeName } = req.body;

    if (!question || !storeName) {
      return res.status(400).json({ 
        error: 'Missing required fields: question, storeName' 
      });
    }

    const store = await getStoreByName(storeName);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }

    // Generate content with File Search
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { text: question }
        ]
      },
      config: {
        tools: [
          {
            fileSearch: {
              fileSearchStoreNames: [store.name]
            }
          }
        ]
      }
    });

    // Extract answer and citations
    const answer = response.candidates[0].content.parts[0].text;
    
    res.json({
      success: true,
      question,
      answer,
      source: storeName,
      citations: extractCitations(answer)
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Failed to process question',
      details: error.message 
    });
  }
});

/**
 * Streaming chat response (Server-Sent Events)
 * POST /api/chat/stream
 */
chatRoutes.post('/stream', async (req, res) => {
  try {
    const { question, storeName } = req.body;

    if (!question || !storeName) {
      return res.status(400).json({ 
        error: 'Missing required fields: question, storeName' 
      });
    }

    const store = await getStoreByName(storeName);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Stream content generation
    const stream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { text: question }
        ]
      },
      config: {
        tools: [
          {
            fileSearch: {
              fileSearchStoreNames: [store.name]
            }
          }
        ]
      }
    });

    for await (const chunk of stream) {
      if (chunk.candidates && chunk.candidates[0]) {
        const text = chunk.candidates[0].content.parts[0].text;
        res.write(`data: ${JSON.stringify({ chunk: text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error('Stream error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

/**
 * Multi-turn conversation
 * POST /api/chat/conversation
 */
chatRoutes.post('/conversation', async (req, res) => {
  try {
    const { messages, storeName } = req.body;

    if (!messages || !Array.isArray(messages) || !storeName) {
      return res.status(400).json({ 
        error: 'Missing required fields: messages (array), storeName' 
      });
    }

    const store = await getStoreByName(storeName);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }

    // Convert message format
    const contents = messages.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }]
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        tools: [
          {
            fileSearch: {
              fileSearchStoreNames: [store.name]
            }
          }
        ]
      }
    });

    const answer = response.candidates[0].content.parts[0].text;

    res.json({
      success: true,
      answer,
      source: storeName
    });

  } catch (error) {
    console.error('Conversation error:', error);
    res.status(500).json({ 
      error: 'Failed to process conversation',
      details: error.message 
    });
  }
});

/**
 * Extract citations from response
 */
function extractCitations(text) {
  const citationPattern = /\[(\d+)\]/g;
  const citations = [];
  let match;

  while ((match = citationPattern.exec(text)) !== null) {
    citations.push(parseInt(match[1]));
  }

  return [...new Set(citations)];
}
```

---

## 3. Frontend Implementation (HTML + JavaScript)

### File: `public/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gemini File Search - Document Q&A</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="container">
    <header>
      <h1>📄 Document Q&A with Gemini</h1>
      <p>Upload documents and ask questions like NotebookLM</p>
    </header>

    <div class="main-content">
      <!-- Sidebar: File Management -->
      <aside class="sidebar">
        <div class="panel">
          <h2>📁 File Management</h2>
          
          <div class="store-section">
            <label for="storeName">Store Name:</label>
            <input type="text" id="storeName" placeholder="e.g., my-documents" value="my-knowledge-base">
          </div>

          <div class="file-upload">
            <label for="fileInput">Choose File:</label>
            <input type="file" id="fileInput" multiple accept=".pdf,.txt,.docx,.json,.md">
            <button id="uploadBtn" class="btn btn-primary">📤 Upload Files</button>
          </div>

          <div id="uploadStatus" class="status-message hidden"></div>

          <!-- File List -->
          <div class="files-list">
            <h3>📚 Uploaded Documents</h3>
            <button id="refreshBtn" class="btn btn-secondary">🔄 Refresh</button>
            <ul id="filesList" class="files"></ul>
          </div>

          <!-- Store Management -->
          <div class="store-management">
            <h3>⚙️ Stores</h3>
            <button id="listStoresBtn" class="btn btn-secondary">List Stores</button>
            <button id="deleteStoreBtn" class="btn btn-danger">🗑️ Delete Store</button>
            <div id="storesList" class="stores-container"></div>
          </div>
        </div>
      </aside>

      <!-- Main: Chat Area -->
      <main class="chat-area">
        <div class="chat-container">
          <div id="chatMessages" class="messages"></div>
          
          <div class="input-section">
            <textarea id="questionInput" placeholder="Ask a question about your documents..." rows="3"></textarea>
            <div class="button-group">
              <button id="sendBtn" class="btn btn-primary">Send ➤</button>
              <button id="clearBtn" class="btn btn-secondary">Clear Chat</button>
            </div>
          </div>

          <div id="chatStatus" class="status-message hidden"></div>
        </div>
      </main>
    </div>
  </div>

  <script src="app.js"></script>
</body>
</html>
```

### File: `public/styles.css`

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --primary-color: #4f46e5;
  --secondary-color: #6b7280;
  --success-color: #10b981;
  --danger-color: #ef4444;
  --border-color: #e5e7eb;
  --background: #f9fafb;
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  background-color: var(--background);
  color: var(--text-primary);
  line-height: 1.6;
}

.container {
  max-width: 1600px;
  margin: 0 auto;
  padding: 20px;
}

header {
  background: linear-gradient(135deg, var(--primary-color), #6366f1);
  color: white;
  padding: 30px;
  border-radius: 12px;
  margin-bottom: 30px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

header h1 {
  font-size: 2.5em;
  margin-bottom: 10px;
}

header p {
  font-size: 1.1em;
  opacity: 0.9;
}

.main-content {
  display: grid;
  grid-template-columns: 350px 1fr;
  gap: 20px;
}

/* Sidebar */
.sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.panel {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-color);
}

.panel h2 {
  font-size: 1.3em;
  margin-bottom: 20px;
  color: var(--text-primary);
  border-bottom: 2px solid var(--primary-color);
  padding-bottom: 10px;
}

.panel h3 {
  font-size: 1em;
  margin-top: 20px;
  margin-bottom: 15px;
  color: var(--text-primary);
}

.store-section,
.file-upload {
  margin-bottom: 20px;
}

label {
  display: block;
  font-weight: 500;
  margin-bottom: 8px;
  color: var(--text-primary);
}

input[type="text"],
input[type="file"],
textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-family: inherit;
  font-size: 0.95em;
}

textarea {
  resize: vertical;
  font-family: 'Monaco', 'Courier New', monospace;
}

input[type="file"] {
  padding: 8px 4px;
}

/* Buttons */
.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.95em;
  display: inline-block;
  text-align: center;
  width: 100%;
  margin-bottom: 8px;
}

.btn-primary {
  background-color: var(--primary-color);
  color: white;
}

.btn-primary:hover {
  background-color: #4338ca;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
}

.btn-secondary {
  background-color: var(--secondary-color);
  color: white;
}

.btn-secondary:hover {
  background-color: #4b5563;
}

.btn-danger {
  background-color: var(--danger-color);
  color: white;
}

.btn-danger:hover {
  background-color: #dc2626;
}

.button-group {
  display: flex;
  gap: 10px;
}

.button-group .btn {
  flex: 1;
  margin-bottom: 0;
}

/* Files List */
.files-list {
  margin-top: 20px;
}

.files {
  list-style: none;
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0;
}

.files li {
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
  font-size: 0.9em;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.files li:last-child {
  border-bottom: none;
}

.files li .file-name {
  flex: 1;
  word-break: break-word;
}

.files li .delete-icon {
  cursor: pointer;
  color: var(--danger-color);
  font-weight: bold;
}

/* Chat Area */
.chat-area {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 600px;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.message {
  display: flex;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message.user {
  justify-content: flex-end;
}

.message.assistant {
  justify-content: flex-start;
}

.message-content {
  max-width: 70%;
  padding: 12px 16px;
  border-radius: 12px;
  word-wrap: break-word;
  line-height: 1.5;
}

.message.user .message-content {
  background-color: var(--primary-color);
  color: white;
  border-bottom-right-radius: 4px;
}

.message.assistant .message-content {
  background-color: #f3f4f6;
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-bottom-left-radius: 4px;
}

.message.error .message-content {
  background-color: #fee2e2;
  color: #991b1b;
  border: 1px solid #fca5a5;
}

/* Input Section */
.input-section {
  padding: 20px;
  border-top: 1px solid var(--border-color);
  background-color: #fafafa;
}

.input-section textarea {
  margin-bottom: 12px;
}

/* Status Messages */
.status-message {
  padding: 12px 16px;
  border-radius: 6px;
  margin-top: 12px;
  font-size: 0.9em;
}

.status-message.success {
  background-color: #d1fae5;
  color: #065f46;
  border: 1px solid #6ee7b7;
}

.status-message.error {
  background-color: #fee2e2;
  color: #991b1b;
  border: 1px solid #fca5a5;
}

.status-message.info {
  background-color: #dbeafe;
  color: #0c4a6e;
  border: 1px solid #7dd3fc;
}

.status-message.hidden {
  display: none;
}

.status-message.loading {
  background-color: #fef3c7;
  color: #78350f;
  border: 1px solid #fcd34d;
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid #3f3f46;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-right: 8px;
  vertical-align: middle;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Stores Container */
.stores-container {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 10px;
  margin-top: 10px;
  font-size: 0.9em;
}

.store-item {
  padding: 8px;
  border-bottom: 1px solid var(--border-color);
  word-break: break-word;
}

.store-item:last-child {
  border-bottom: none;
}

/* Responsive */
@media (max-width: 1024px) {
  .main-content {
    grid-template-columns: 1fr;
  }

  .sidebar {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .panel {
    flex: 1;
    min-width: 280px;
  }

  .chat-area {
    height: 500px;
  }

  .message-content {
    max-width: 90%;
  }
}

@media (max-width: 768px) {
  header {
    padding: 20px;
  }

  header h1 {
    font-size: 1.8em;
  }

  .chat-container {
    height: 400px;
  }
}
```

### File: `public/app.js`

```javascript
const API_BASE = 'http://localhost:3000/api';

// DOM Elements
const storeName = document.getElementById('storeName');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const refreshBtn = document.getElementById('refreshBtn');
const listStoresBtn = document.getElementById('listStoresBtn');
const deleteStoreBtn = document.getElementById('deleteStoreBtn');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');
const questionInput = document.getElementById('questionInput');
const chatMessages = document.getElementById('chatMessages');
const filesList = document.getElementById('filesList');
const storesList = document.getElementById('storesList');
const uploadStatus = document.getElementById('uploadStatus');
const chatStatus = document.getElementById('chatStatus');

// State
let currentStore = 'my-knowledge-base';
let conversationHistory = [];

// Event Listeners
uploadBtn.addEventListener('click', handleFileUpload);
refreshBtn.addEventListener('click', loadFiles);
listStoresBtn.addEventListener('click', listStores);
deleteStoreBtn.addEventListener('click', deleteStore);
sendBtn.addEventListener('click', handleSendQuestion);
clearBtn.addEventListener('click', () => {
  chatMessages.innerHTML = '';
  conversationHistory = [];
});

questionInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && e.ctrlKey) {
    handleSendQuestion();
  }
});

storeName.addEventListener('change', (e) => {
  currentStore = e.target.value || 'my-knowledge-base';
  loadFiles();
});

// File Upload Handler
async function handleFileUpload() {
  const files = fileInput.files;
  
  if (!files.length) {
    showStatus(uploadStatus, 'Please select files to upload', 'error');
    return;
  }

  if (!currentStore.trim()) {
    showStatus(uploadStatus, 'Please enter a store name', 'error');
    return;
  }

  uploadBtn.disabled = true;
  showStatus(uploadStatus, `Uploading ${files.length} file(s)...`, 'loading');

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const base64 = await fileToBase64(file);
      
      const response = await fetch(`${API_BASE}/files/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: base64,
          storeName: currentStore,
          fileName: file.name
        })
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${file.name}`);
      }
    }

    showStatus(uploadStatus, `✓ Successfully uploaded ${files.length} file(s)!`, 'success');
    fileInput.value = '';
    await loadFiles();
  } catch (error) {
    showStatus(uploadStatus, `Error: ${error.message}`, 'error');
  } finally {
    uploadBtn.disabled = false;
  }
}

// Load Files List
async function loadFiles() {
  try {
    const response = await fetch(`${API_BASE}/files/documents/${currentStore}`);
    
    if (!response.ok) {
      filesList.innerHTML = '<li>No documents found</li>';
      return;
    }

    const data = await response.json();
    filesList.innerHTML = '';

    if (data.documents.length === 0) {
      filesList.innerHTML = '<li>No documents in this store</li>';
      return;
    }

    data.documents.forEach((doc) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="file-name">${doc.displayName}</span>
        <span class="delete-icon" onclick="deleteDocument('${currentStore}', '${doc.name.split('/').pop()}')">×</span>
      `;
      filesList.appendChild(li);
    });
  } catch (error) {
    console.error('Error loading files:', error);
    filesList.innerHTML = '<li>Error loading documents</li>';
  }
}

// Delete Document
async function deleteDocument(store, docId) {
  if (!confirm('Are you sure you want to delete this document?')) return;

  try {
    const response = await fetch(`${API_BASE}/files/document/${store}/${docId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      showStatus(uploadStatus, '✓ Document deleted', 'success');
      await loadFiles();
    }
  } catch (error) {
    showStatus(uploadStatus, `Error: ${error.message}`, 'error');
  }
}

// List Stores
async function listStores() {
  try {
    const response = await fetch(`${API_BASE}/files/stores`);
    const data = await response.json();

    storesList.innerHTML = '';
    data.stores.forEach((store) => {
      const div = document.createElement('div');
      div.className = 'store-item';
      div.textContent = `📦 ${store.displayName}`;
      storesList.appendChild(div);
    });

    if (data.stores.length === 0) {
      storesList.innerHTML = '<div class="store-item">No stores found</div>';
    }
  } catch (error) {
    storesList.innerHTML = `<div class="store-item" style="color:red;">Error: ${error.message}</div>`;
  }
}

// Delete Store
async function deleteStore() {
  if (!confirm(`Delete store "${currentStore}"? This cannot be undone.`)) return;

  try {
    const response = await fetch(`${API_BASE}/files/store/${currentStore}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      showStatus(uploadStatus, `✓ Store "${currentStore}" deleted`, 'success');
      filesList.innerHTML = '';
      await listStores();
    }
  } catch (error) {
    showStatus(uploadStatus, `Error: ${error.message}`, 'error');
  }
}

// Send Question
async function handleSendQuestion() {
  const question = questionInput.value.trim();

  if (!question) {
    showStatus(chatStatus, 'Please enter a question', 'error');
    return;
  }

  if (!currentStore.trim()) {
    showStatus(chatStatus, 'Please select or create a store', 'error');
    return;
  }

  // Add user message
  addMessage(question, 'user');
  questionInput.value = '';
  sendBtn.disabled = true;
  showStatus(chatStatus, 'Thinking...', 'loading');

  try {
    conversationHistory.push({ role: 'user', content: question });

    const response = await fetch(`${API_BASE}/chat/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        storeName: currentStore
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get response');
    }

    const data = await response.json();
    addMessage(data.answer, 'assistant');
    conversationHistory.push({ role: 'assistant', content: data.answer });
    showStatus(chatStatus, '', '');
  } catch (error) {
    addMessage(`Error: ${error.message}`, 'error');
  } finally {
    sendBtn.disabled = false;
  }
}

// Add Message to Chat
function addMessage(text, role) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${role}`;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.textContent = text;

  msgDiv.appendChild(contentDiv);
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Utility Functions
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function showStatus(element, message, type) {
  element.textContent = message;
  element.className = `status-message ${type}`;
  
  if (type === 'success' || type === 'error') {
    setTimeout(() => {
      element.classList.add('hidden');
    }, 5000);
  }
}

// Initialize
async function init() {
  currentStore = storeName.value || 'my-knowledge-base';
  await loadFiles();
  await listStores();
}

init();
```

---

## 4. Usage Instructions

### Start the Server

```bash
npm run dev
```

Server runs at: `http://localhost:3000`

### Using the Application

1. **Create/Select Store**: Enter a store name in the sidebar
2. **Upload Files**: Select PDF, TXT, DOCX, JSON files
3. **Wait for Processing**: Files are chunked and indexed
4. **Ask Questions**: Type questions in the chat
5. **Get Answers**: Responses are grounded in your documents
6. **Manage Files**: Delete files or entire stores as needed

### Supported File Types

- **Documents**: PDF, DOCX, PPTX, TXT, ODT, RTF, EPUB
- **Data**: JSON, CSV, XML
- **Code**: Python, JavaScript, Java, C++, etc.

---

## 5. Advanced Features

### Custom Chunking Config

```javascript
chunking_config: {
  white_space_config: {
    max_tokens_per_chunk: 500,      // Larger chunks
    max_overlap_tokens: 50           // More overlap
  }
}
```

### Metadata Filtering

```javascript
const response = await ai.models.generateContent({
  // ... content config
  config: {
    tools: [{
      fileSearch: {
        fileSearchStoreNames: [store.name],
        metadataFilter: {
          key: 'category',
          stringValue: 'technical-docs'
        }
      }
    }]
  }
});
```

### Streaming Responses

Use `/api/chat/stream` endpoint for real-time chat responses

---

## 6. Production Deployment

### Environment Variables
- `GEMINI_API_KEY`: Your API key
- `PORT`: Server port
- `NODE_ENV`: Set to 'production'

### Performance Tips
- Keep File Search stores under 20 GB
- Use optimal chunking (200 tokens default)
- Implement caching for repeated questions
- Monitor API rate limits
- Use streaming for better UX

### Security
- Never expose API key in frontend
- Use HTTPS in production
- Implement rate limiting
- Add authentication for file management
- Validate file types server-side

