<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# please list out detail step by step instruction on build the app

Here is a concrete, end‑to‑end checklist you can follow to build the same app.

***

## 1. Set up Google Gemini

1. Go to Google AI Studio and sign in with your Google account.[^1]
2. Create a new project and generate a Gemini API key (Server key).[^1]
3. Save this key; you will put it into the backend `.env` file as `GEMINI_API_KEY`.[^1]

***

## 2. Backend project (Node + Express + TypeScript)

### 2.1 Initialize the project

1. Create a folder, for example `server`, and run:
    - `npm init -y`
2. Install runtime dependencies:
    - `npm install express cors dotenv @google/generative-ai` (or `google-genai` depending on SDK version used in the video).[^2][^1]
3. Install dev dependencies for TypeScript:
    - `npm install -D typescript ts-node nodemon @types/node @types/express @types/cors`.[^2]

### 2.2 Configure TypeScript and scripts

1. Run `npx tsc --init` and set:
    - `"target": "ES2020"`
    - `"module": "commonjs"`
    - `"rootDir": "src"` and `"outDir": "dist"`.[^2]
2. In `package.json`, add scripts:[^2]
    - `"dev": "nodemon src/index.ts"`
    - `"build": "tsc"`
    - `"start": "node dist/index.js"`.

### 2.3 Add environment variables

1. Create `.env` in `server` with:[^2]
    - `GEMINI_API_KEY=YOUR_KEY_HERE`
    - `PORT=5000`
    - `CLIENT_URL=http://localhost:5173` (Vite default).
2. Ensure `dotenv.config()` is called at the top of your server bootstrap file.[^2]

### 2.4 Implement Gemini File Search setup

1. Create `src/lib/gemini.ts` and:[^1][^2]
    - Import the Gemini SDK.
    - Read `GEMINI_API_KEY` from `process.env`, throw an error if missing.
    - Create a single `ai` client instance.
2. Implement:
    - `initializeFileSearchStore()`
        - If a cached `fileSearchStoreName` exists, return it.
        - Else call `ai.fileSearchStores.create({ config: { displayName: 'raglab-store' } })`.[^1]
        - Save and return `fileSearchStore.name`.[^1][^2]
    - `uploadFileToFileSearchStore(buffer, mimeType, displayName)`
        - Ensure store name from `initializeFileSearchStore()`.[^2][^1]
        - Write `buffer` to a temp file on disk.
        - Call `ai.fileSearchStores.uploadToFileSearchStore({ file, fileSearchStoreName, config: { displayName } })`.[^1]
        - Poll `ai.operations.get({ operation })` every 5 seconds until `operation.done` or timeout after ~60 attempts.[^2][^1]
        - Delete the temp file when finished.
        - If success, return `{ operationName: operation.name, displayName }`, otherwise throw an error.[^2]
    - `askQuestionWithRag(question: string)`
        - Get the store name.
        - Call `ai.models.generateContent({ model: 'gemini-2.5-flash', contents: [{ role: 'user', parts: [{ text: question }] }], config: { tools: [{ fileSearch: { fileSearchStoreNames: [storeName] } }] } })`.[^1][^2]
        - Extract `answer` text and grounding metadata: file names, pages, and snippets as `sources`.[^2]
        - Return `{ answer, sources, groundingMetadata }`.[^2]

### 2.5 Express server and routes

1. Create `src/index.ts`:[^2]
    - Import `express`, `cors`, and `dotenv`.
    - Call `dotenv.config()`.
    - Create `app`, read `PORT` and `CLIENT_URL`.
    - Use `cors({ origin: CLIENT_URL })`.
    - Use `express.json()` for JSON body parsing.
    - Mount routers at `/api`.
    - `app.listen(PORT)`.
2. Install Multer:
    - `npm install multer @types/multer -D`.[^2]
3. Create `src/routes/upload.ts`:[^2]
    - Configure Multer with `memoryStorage()`.
    - Set `limits: { fileSize: 100 * 1024 * 1024 }`.
    - Implement a `fileFilter` that allows:
        - MIME types: `application/pdf`, `text/plain`, `text/markdown`, `text/x-markdown`.
        - Extensions: `.pdf`, `.txt`, `.md`.[^2]
    - Create `POST /upload` handler:
        - If no file, return `{ success: false, error: 'No file uploaded' }`.[^2]
        - Get `buffer`, `originalname`, `mimetype`.
        - Call `uploadFileToFileSearchStore(buffer, mimetype, originalname)`.[^2]
        - Return `{ success: true, originalName, operationName, displayName }`.[^2]
4. Create `src/routes/ask.ts`:[^2]
    - `POST /ask` handler:
        - Read `question` from `req.body`.
        - If missing, return `{ success: false, error: 'Question is required' }`.[^2]
        - Call `askQuestionWithRag(question)`.
        - Return `{ success: true, answer, sources }`.[^2]
5. Create `src/routes/status.ts`:[^2]
    - Implement helper that, given the current store name, calls `ai.fileSearchStores.documents.list({ parent: fileSearchStoreName })`.[^1][^2]
    - `GET /status` returns `{ success: true, storeInitialized: true, fileCount, files }`.[^2]
6. In `src/index.ts`, wire routers:[^2]
    - `app.use('/api/upload', uploadRouter)`
    - `app.use('/api/ask', askRouter)`
    - `app.use('/api/status', statusRouter)`.

***

## 3. Frontend project (React + Vite + TS + Tailwind)

### 3.1 Initialize React app

1. In a separate folder `client`, run:
    - `npm create vite@latest` → select React + TypeScript.[^2]
2. Install dependencies:
    - `npm install` (from Vite).
    - `npm install tailwindcss postcss autoprefixer` then `npx tailwindcss init -p`.[^2]
3. Configure Tailwind in `tailwind.config` to scan `src/**/*.{ts,tsx}` and add a basic Tailwind setup.[^2]

### 3.2 API helper

1. Create `src/api.ts` with:[^2]
    - `const BASE_URL = 'http://localhost:5000/api';`
    - `uploadFile(file)` that creates `FormData`, appends `"file"`, and `fetch`es `POST ${BASE_URL}/upload` returning JSON.[^2]
    - `askQuestion(question)` that `fetch`es `POST ${BASE_URL}/ask` with `Content-Type: application/json` and body `{ question }`.[^2]

***

## 4. React hooks and components

### 4.1 `useFileUpload` hook

1. In `src/hooks/useFileUpload.ts`:[^2]
    - State: `uploadedFiles`, `isUploading`, `error`.
    - `handleFileUpload(file)`:
        - Set `isUploading = true`.
        - Call `uploadFile(file)` from `api.ts`.
        - On success, push `{ name: originalName, displayName, operationName }` into `uploadedFiles`.[^2]
        - On error, set `error`.
        - Finally, `isUploading = false`.

### 4.2 `useChat` hook

1. In `src/hooks/useChat.ts`:[^2]
    - State:
        - `messages`: array with `{ id, role: 'user' | 'assistant' | 'error', text, sources? }`.
        - `question`: string.
        - `isLoading`: boolean.
    - `setQuestion` to control the input value.[^2]
    - `handleAsk()`:
        - If `!question` return.
        - Push user message into `messages`.
        - Clear question.
        - Set `isLoading = true`.
        - Call `askQuestion(questionText)`.[^2]
        - If success, push an assistant message with `answer` and `sources`.
        - If error, push an error message.
        - Set `isLoading = false`.

### 4.3 Upload component

1. Create `src/components/UploadArea.tsx`:[^2]
    - Props: `uploadedFiles`, `isUploading`, `onUpload(file)`.
    - Render:
        - A file input that accepts `.pdf,.txt,.md`.
        - On change, call `onUpload` with the selected file.
        - Show upload progress if `isUploading`.
        - List of uploaded file names.[^2]

### 4.4 Chat component

1. Create `src/components/Chat.tsx`:[^2]
    - Props: `messages`, `question`, `setQuestion`, `isLoading`, `onAsk`.
    - Render:
        - A list of messages. For assistant messages, also show the sources (file name, page, snippet).[^2]
        - A text input bound to `question` and a button or Enter key to trigger `onAsk`.
        - Disable input or show a spinner while `isLoading`.[^2]

### 4.5 App entry

1. In `src/App.tsx`:[^2]
    - Call `useFileUpload()` and `useChat()`.
    - Pass their values into `UploadArea` and `Chat` components.
    - Simple layout: hero text at top, upload on left/top, chat on right/bottom.[^2]

***

## 5. Run and test the app

1. Start backend:
    - In `server`: `npm run dev` (Express with ts-node and nodemon).[^2]
2. Start frontend:
    - In `client`: `npm run dev` (Vite on `5173`).[^2]
3. In the browser at `http://localhost:5173`:[^2]
    - Upload a sample PDF/TXT/MD; ensure the upload succeeds.
    - Ask questions like “What is this document about?” and verify answers plus sources are returned.[^2]
4. Check browser DevTools → Network for `/api/upload` and `/api/ask` calls and confirm the JSON structure.[^2]

If you tell which parts you want code snippets for (backend routes, Gemini setup, or React hooks), step‑by‑step TypeScript examples can be added next.
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^17][^18][^19][^20][^3][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://ai.google.dev/gemini-api/docs/file-search

[^2]: https://www.youtube.com/watch?v=py9jeBiHDtc

[^3]: https://github.com/google-gemini/cookbook

[^4]: https://developer.couchbase.com/tutorial-gemini-langchain-pdf-chat/

[^5]: https://docs.cloud.google.com/kubernetes-engine/docs/tutorials/build-rag-chatbot

[^6]: https://dev.to/timmydee/teach-your-free-ai-chatbot-with-reports-web-data-rag-basics-2k52

[^7]: https://github.com/devanandk/document-chat

[^8]: https://www.facebook.com/groups/698593531630485/posts/1427534622069702/

[^9]: https://github.com/DorGetter/Chat_On_PDFs

[^10]: https://www.youtube.com/watch?v=0yboGn8errU

[^11]: https://www.youtube.com/watch?v=zuBhmYDYfNc

[^12]: https://www.youtube.com/channel/UCkwiOoCZhWh9oHaozA-o7uw

[^13]: https://dev.to/tahrim_bilal/how-to-integrate-gemini-api-with-reactjs-a-step-by-step-guide-341b

[^14]: https://www.reddit.com/r/Rag/comments/1lq8cks/aidocumentrag_fullstack_document_management_and/

[^15]: https://github.com/matyaszednicek/ai-doc-chat

[^16]: https://ai.google.dev/gemini-api/docs/quickstart

[^17]: https://cloud.google.com/blog/products/ai-machine-learning/top-gen-ai-how-to-guides-for-enterprise

[^18]: https://github.com/thedreamydev/pdf-chat-app

[^19]: https://www.linkedin.com/pulse/how-build-react-agent-nodejs-langchain-gemini-25-tavily-reis-neto-0aa3f

[^20]: https://www.reddit.com/r/FlutterDev/comments/18r92ax/googles_gemini_ai_building_a_complete_chat/

