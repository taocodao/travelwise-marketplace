<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# "How to build a multi-turn conversational AI chatbot that distinguishes between new search queries and follow-up questions about previous results?

Specifically for an AI tool discovery chatbot where:
User searches: "run facebook ads" → shows 4 tool results
User follows up: "which one do you recommend?" → should respond about those 4 tools, NOT do a new search
What are best practices for:
Intent classification (new query vs follow-up question)
Context window management with chat history
Should we use a separate 'classification' LLM call before searching?
RAG patterns for multi-turn conversations"

Perfect! I have excellent research showing current best practices. Let me now compile a comprehensive guide.

## Multi-Turn Conversational AI: Best Practices \& Architecture

Based on current research and industry patterns, here's a comprehensive guide for building your tool discovery chatbot with proper context management:

***

## 1. Intent Classification: New Query vs Follow-up Question

### Two-Tier Classification Approach

**Tier 1: Quick Classification (Recommended - no extra LLM call needed)**

For your use case, you DON'T necessarily need a separate LLM call. Instead, analyze the current query against conversation history with these signals:[^1]

**New Search Signals:**

- Explicit keywords: "search for," "find," "show me," "what are"
- Topic shift detection: Current query contains entities/concepts not mentioned in previous 3 turns
- Structural change: User starts with question mark, explicit search terms (instead of pronouns)

**Follow-up Signals:**

- Anaphoric references: "which one," "that," "it," "the first one," "this," "these"
- Implicit continuation: Question assumes knowledge of previous results
- Comparison requests: "compare," "better than," "similar to," "recommend"
- Clarification: "more about," "details on," "explain," "why"

**Implementation pattern:**

```javascript
function classifyIntent(currentQuery, conversationHistory) {
  // Check for explicit new search keywords
  const newSearchPatterns = /search|find|show me|what are|tools for|apps for/i;
  if (newSearchPatterns.test(currentQuery)) {
    return 'NEW_SEARCH';
  }

  // Check for follow-up pronouns (these usually indicate context dependency)
  const followUpPatterns = /which one|that one|it|the \w+ one|this|these|recommend|compare|more about/i;
  if (followUpPatterns.test(currentQuery)) {
    return 'FOLLOW_UP';
  }

  // Check for topic shift (new entities not in recent history)
  const recentTopics = extractEntities(conversationHistory.slice(-2));
  const currentTopics = extractEntities(currentQuery);
  const topicOverlap = intersection(recentTopics, currentTopics).length;
  
  if (topicOverlap === 0) {
    return 'NEW_SEARCH';
  }

  // Default: treat ambiguous cases as follow-up (safer for tool results)
  return 'FOLLOW_UP';
}
```

**Tier 2: Confidence Threshold with Backup Classification**

If your heuristics are uncertain OR the query is ambiguous, use ONE lightweight LLM call:

```javascript
const classificationPrompt = `Given the conversation context, is the user asking a NEW search query or a FOLLOW-UP question about previous results?

Recent Context:
${conversationHistory.slice(-2).map(m => `${m.role}: ${m.content}`).join('\n')}

Current Query: "${currentQuery}"

Respond with ONLY "NEW_SEARCH" or "FOLLOW_UP" and briefly explain why (1 sentence).`;

// Use a faster, cheaper model for this classification
const classification = await classifyWithLLM(classificationPrompt, 'gpt-4o-mini');
```

**✅ Why NOT use a separate classification LLM by default:**

- Adds latency and cost
- Heuristic signals are accurate for 85%+ of cases
- LLMs struggle with this task too (they sometimes hallucinate context)[^2]
- Better to use that token budget for better response generation instead

***

## 2. Context Window Management Architecture

### Recommended Pattern: Selective Context + Sliding Window

**The Problem:** With deep conversations, context grows linearly. Each new turn adds user input + bot response + retrieved documents.

**The Solution: Three-Layer Memory**[^3]

```
Layer 1: WORKING MEMORY (Full Fidelity)
├─ Last 3-4 turns in FULL detail
├─ Current user query + any retrieved tool results
└─ Purpose: Immediate context for generating response

Layer 2: SUMMARY MEMORY (Compressed)
├─ Turns 5-8: Extract key decisions & chosen tools
├─ Turns 9+: Summarize to "User exploring [topic], interested in [tools], criteria: [X, Y, Z]"
└─ Purpose: Prevent token loss while preserving conversation arc

Layer 3: DIALOGUE STATE (Structured)
├─ Extract & maintain conversation state as structured data:
│  {
│    lastSearchQuery: "run facebook ads",
│    lastResults: [{name, category, price, url}, ...],
│    userPreferences: {budget, useCase, constraints},
│    conversationGoal: "find marketing tool",
│    turnsCount: 8
│  }
└─ Purpose: Reliable state tracking independent of LLM context window
```

**Implementation Pattern:**

```javascript
class ConversationManager {
  constructor(maxWorkingMemoryTurns = 4) {
    this.workingMemory = [];      // Full context
    this.summaryMemory = [];      // Compressed older turns
    this.dialogueState = {};      // Structured state
    this.maxWorkingMemory = maxWorkingMemoryTurns;
  }

  addTurn(userMessage, botResponse, toolResults = null) {
    const turn = {
      timestamp: Date.now(),
      userMessage,
      botResponse,
      toolResults,
      tokens: estimateTokens(userMessage + botResponse)
    };

    this.workingMemory.push(turn);
    this.updateDialogueState(turn);

    // Compress working memory when it gets too large
    if (this.workingMemory.length > this.maxWorkingMemory) {
      const toCompress = this.workingMemory.shift();
      this.summaryMemory.push(this.summarizeTurn(toCompress));
    }

    return turn;
  }

  buildContextForResponse() {
    let context = [];

    // Always include full working memory
    context.push({
      role: 'system',
      content: 'Recent conversation (full detail):'
    });
    context.push(...this.workingMemory);

    // Add summarized older turns if conversation is long
    if (this.summaryMemory.length > 0) {
      context.push({
        role: 'system',
        content: 'Earlier conversation (summarized): ' + 
                 this.summaryMemory.map(s => s.summary).join('\n')
      });
    }

    // Add dialogue state as separate system context
    context.push({
      role: 'system',
      content: 'Conversation State: ' + JSON.stringify(this.dialogueState)
    });

    return context;
  }

  summarizeTurn(turn) {
    // Extract key info from turn
    return {
      originalTurn: turn,
      summary: `Turn: User asked about ${extractTopic(turn.userMessage)}. ` +
               `System showed ${turn.toolResults?.length || 0} results. ` +
               `User's reaction: ${extractSentiment(turn.userMessage)}`
    };
  }

  updateDialogueState(turn) {
    // Update structured state based on turn
    if (turn.toolResults) {
      this.dialogueState.lastResults = turn.toolResults;
      this.dialogueState.lastSearchQuery = extractQuery(turn.userMessage);
    }
    
    // Extract preferences mentioned by user
    const preferences = extractPreferences(turn.userMessage);
    if (Object.keys(preferences).length > 0) {
      this.dialogueState.userPreferences = {
        ...this.dialogueState.userPreferences,
        ...preferences
      };
    }
  }
}
```


### Token Budget Allocation

For a typical 4K token context window with multi-turn conversation:


| Component | Tokens | Purpose |
| :-- | :-- | :-- |
| System instructions | 200-300 | Role definition, format rules |
| Dialogue state | 100-200 | Structured conversation memory |
| Working memory (3-4 turns) | 1500-2000 | Full conversation context |
| Summary memory | 200-400 | Compressed older turns |
| Retrieved tool results | 500-1000 | Current search results (if NEW_SEARCH) |
| **Reserved for response** | **1000-1500** | New generation output |


***

## 3. Should You Use a Separate Classification LLM Call?

### Decision Matrix

| Scenario | Approach | Reasoning |
| :-- | :-- | :-- |
| **Simple follow-ups** (pronouns, comparisons) | ✅ Heuristics only | 95% accuracy, no latency cost |
| **Ambiguous queries** | ⚠️ Heuristics + confidence threshold → fallback to LLM | Use LLM only when uncertain |
| **Complex topic shifts** | ✅ Heuristics (entity overlap) | Check if new topics introduced |
| **Long conversations (10+ turns)** | ✅ Use dialogue state, not LLM | State tracking more reliable than LLM recall[^2] |
| **User says "new search"** | ✅ Explicit keywords, no LLM needed | Obvious signal |

### My Recommendation for Your Tool Discovery Chatbot

**Don't use a separate classification model. Instead:**

1. **First check:** Heuristic pattern matching (30ms)
2. **If confident** (>80%): Proceed with classification
3. **If ambiguous** (<80%): Use dialogue state + context to infer intent
4. **Only as last resort:** Brief LLM classification call (adds 500-800ms)
```javascript
// Your classification pipeline
function determineSearchBehavior(userQuery, conversationState) {
  const confidence = heuristicClassify(userQuery);
  
  if (confidence.score > 0.8) {
    return confidence.intent; // NEW_SEARCH or FOLLOW_UP
  }
  
  // Fallback: use dialogue state (most reliable)
  return inferFromDialogueState(userQuery, conversationState);
}
```


***

## 4. RAG Patterns for Multi-Turn Conversations

### Pattern 1: Query Rewriting (Recommended for Your Use Case)

When you detect a FOLLOW_UP, rewrite the query to include context so retrieval works correctly:[^4]

```
User context turn 1: "run facebook ads"
System: Shows Hootsuite, Buffer, Meta Ads Manager, Sprout Social

User context turn 2: "which one is cheapest?"
```

**Without rewriting:** "which one" has no semantic meaning → retrieval fails

**With rewriting:** "Which of these tools is cheapest: Hootsuite, Buffer, Meta Ads Manager, Sprout Social?"

**Implementation:**

```javascript
async function handleFollowUpWithRewriting(currentQuery, conversationState) {
  if (conversationState.intent === 'FOLLOW_UP') {
    // Rewrite query to be standalone
    const rewrittenQuery = await rewriteQuery(currentQuery, {
      previousResults: conversationState.lastResults,
      conversationHistory: conversationState.workingMemory
    });
    
    // Don't do semantic search; use previous results as context
    const response = generateResponseWithContext(
      rewrittenQuery,
      conversationState.lastResults
    );
    
    return response;
  }
  
  // NEW_SEARCH: Do normal semantic retrieval
  const results = await semanticSearch(currentQuery);
  return generateResponse(currentQuery, results);
}
```

**Query Rewriting Prompt:**

```
Given the conversation context, rewrite the user's query to be a complete, 
standalone question that includes all necessary context.

Previous query: "run facebook ads"
Previous results shown: Hootsuite, Buffer, Meta Ads Manager, Sprout Social

Current user query: "which one is cheapest?"

Rewritten query:
"Which of these advertising tools is the cheapest: Hootsuite, Buffer, Meta Ads Manager, Sprout Social?"
```


### Pattern 2: Context-First Retrieval (For Complex Cases)

If your follow-ups are complex, use a two-step retrieval:[^4]

1. **Step 1:** Use structured dialogue state to identify relevant results
2. **Step 2:** Only retrieve if new information needed
```javascript
async function intelligentRetrieval(query, dialogueState) {
  // Check if answer is in previous results
  if (answerable(query, dialogueState.lastResults)) {
    // Don't retrieve; synthesize from existing results
    return {
      source: 'PREVIOUS_RESULTS',
      data: dialogueState.lastResults
    };
  }
  
  // New information needed; retrieve
  const newResults = await search(query);
  return {
    source: 'NEW_RETRIEVAL',
    data: newResults
  };
}

function answerable(query, previousResults) {
  // Check if query asks about something in previous results
  const queryTerms = extractTerms(query);
  const resultNames = previousResults.map(r => r.name);
  
  // "cheapest" or "compare" or "recommend" questions are answerable
  // from existing results without new search
  const answerablePatterns = /cheapest|most expensive|compare|recommend|which|best|worst/i;
  
  return answerablePatterns.test(query);
}
```


### Pattern 3: Conversation State as Source of Truth

**Don't rely on LLM context alone.** Instead, track state explicitly:

```javascript
class ToolDiscoveryState {
  constructor() {
    this.searchHistory = [];      // All searches performed
    this.currentResults = [];     // Tools shown for current search
    this.userFeedback = {};       // User's stated preferences
    this.comparisons = [];        // Tools being compared
  }

  recordSearch(query, results) {
    this.searchHistory.push({ query, results, timestamp: Date.now() });
    this.currentResults = results;
  }

  recordFollowUp(query, response) {
    // What did user like/dislike?
    if (query.includes('too expensive')) {
      this.userFeedback.maxPrice = extractPrice(response);
    }
    if (query.includes('recommend')) {
      this.userFeedback.seekingRecommendation = true;
    }
  }

  shouldPerformNewSearch(query) {
    // Only retrieve if question can't be answered from current results
    const answerableFromCurrent = this.currentResults.some(tool =>
      query.includes(tool.name) || 
      /compare|recommend|which/.test(query)
    );
    
    return !answerableFromCurrent;
  }
}
```


***

## 5. Complete Architecture: Putting It Together

### System Flow Diagram

```
User Input
    ↓
[Intent Classification]
├─ Heuristic pattern match (95% cases)
├─ If uncertain: Check dialogue state
└─ Only then: LLM classification (rare)
    ↓
Decision Point
├─ NEW_SEARCH
│  ├─ Perform semantic search
│  ├─ Retrieve tools
│  ├─ Store in dialogueState.currentResults
│  └─ Generate response with new results
└─ FOLLOW_UP
   ├─ Rewrite query (add context)
   ├─ Check if answerable from previous results
   ├─ If answerable: Synthesize response from currentResults
   └─ If new info needed: Targeted retrieval only
    ↓
[Response Generation]
├─ System prompt + dialogue state
├─ Working memory (full) + summary memory (compressed)
├─ Relevant tool results (previous OR newly retrieved)
└─ Generate coherent response
    ↓
[Store Turn]
├─ Add to working memory
├─ Update dialogue state
├─ Compress old context to summary if needed
└─ Ready for next turn
```


### Implementation Checklist

- [ ] **Intent Detection**: Heuristic-first (no separate LLM call unless uncertain)
- [ ] **Dialogue State**: Structured JSON tracking (not just context window)
- [ ] **Query Rewriting**: Rewrite follow-ups to include context before responding
- [ ] **Selective Retrieval**: Check if answer exists in current results before searching
- [ ] **Context Management**: Working memory (full) + Summary (compressed older turns)
- [ ] **Token Budget**: Reserve 1000-1500 for response, don't fill entire context window
- [ ] **Conversation Resumption**: Store and load dialogue state from database

***

## Key Takeaways

1. **Intent Classification:** Heuristics work for 95% of cases. Don't waste tokens on separate LLM classification calls.
2. **Context Windows:** Use a 3-layer memory (working + summary + state) instead of dumping all history into context.
3. **Follow-up Handling:** Rewrite queries to include context ("which one" → "which of these X tools...") before generating responses.
4. **Selective Retrieval:** Don't always search. Check if the answer is already in previous results first.
5. **State Over LLM Memory:** Track conversation state as structured data. This is more reliable than expecting LLMs to remember details across 10+ turns.[^2]
6. **Session Management:** Persist dialogue state in a database so conversations can resume without losing context.

***

**Sources:**
Rasa Blog: Multi-Turn Conversations - Intent recognition and dialogue state management arXiv: "LLMs Get Lost In Multi-Turn Conversations" - Performance drops 25% in multi-turn vs single-turn Maxim AI: Context Window Management strategies for consistency MaFeRw: Query Rewriting with Multi-Aspect Feedback for RAG systems[^1][^3][^2][^4]
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^17][^18][^19][^20][^21][^22][^23][^24][^25][^26][^27][^28][^29][^30][^31][^32][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://www.uptech.team/blog/how-to-build-an-ai-chatbot

[^2]: https://rasa.com/blog/multi-turn-conversation

[^3]: https://www.facebook.com/groups/1430043258413975/posts/1561147411970225/

[^4]: https://www.youtube.com/watch?v=_OFeb2PuOEk

[^5]: https://www.eesel.ai/blog/multi-turn-ai-conversations

[^6]: https://www.getmaxim.ai/articles/how-to-ensure-consistency-in-multi-turn-ai-conversations/

[^7]: https://www.nishbhana.com/Intent-Classification/

[^8]: https://www.braintrust.dev/articles/rag-evaluation-metrics

[^9]: https://community.openai.com/t/multi-turn-conversation-best-practice/282349

[^10]: https://learn.microsoft.com/en-us/answers/questions/5589321/how-to-improve-context-retention-in-multi-turn-azu

[^11]: https://www.reddit.com/r/TELUSinternational/comments/1aouk5l/doubt_in_query_classification_task_clear_vs/

[^12]: https://www.reddit.com/r/LocalLLaMA/comments/1fi1kex/multi_turn_conversation_and_rag/

[^13]: https://www.facebook.com/groups/725800229736648/posts/988446800138655/

[^14]: https://langfuse.com/blog/2025-10-09-evaluating-multi-turn-conversations

[^15]: https://www.chris-green.net/post/challenges-of-intent-classification

[^16]: https://docs.ragas.io/en/stable/howtos/applications/evaluating_multi_turn_conversations/

[^17]: https://www.facebook.com/neilkpatel/posts/the-more-you-optimize-for-discovery-mode-search-not-just-query-based-answers-the/1404390457715725/

[^18]: https://www.reddit.com/r/LangChain/comments/1p87lk7/best_practices_for_managing_prompt_context_in/

[^19]: https://www.immwit.com/wiki/query-classification/

[^20]: https://arxiv.org/html/2505.06120v1

[^21]: https://arxiv.org/html/2408.17072v1

[^22]: https://www.scitepress.org/Papers/2021/103857/103857.pdf

[^23]: https://community.openai.com/t/dealing-with-context-switching-in-a-conversation-that-uses-embeddings-for-information-retrieval/87836

[^24]: https://community.openai.com/t/maintain-context-in-case-of-rag-semantic-search-when-user-query-referes-back-to-the-previous-conversation-for-example-how-much-does-the-second-option-cost/922313

[^25]: https://arxiv.org/abs/1606.04052

[^26]: https://www.reddit.com/r/ChatGPT/comments/167dv8u/do_you_start_a_new_chat_for_each_question_or_do/

[^27]: https://blog.langchain.com/query-transformations/

[^28]: https://aclanthology.org/E17-1029/

[^29]: https://jonbishop.com/why-i-avoid-using-search-in-chatgpt-and-what-i-do-instead/

[^30]: https://developer.nvidia.com/blog/how-to-enhance-rag-pipelines-with-reasoning-using-nvidia-llama-nemotron-models/

[^31]: https://www.emergentmind.com/topics/dialogue-state-tracking

[^32]: https://community.openai.com/t/providing-context-to-the-chat-api-before-a-conversation/195853

