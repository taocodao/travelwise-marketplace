# Agentic Workflows: The Complete Business Guide (Nick Saraev)

**Video:** "the n8n killer? AGENTIC WORKFLOWS: Full Beginner's Guide"  
**Creator:** Nick Saraev (Leftclick, Maker School)  
**Published:** November 25, 2025  
**Duration:** 1:52:13

---

## EXECUTIVE SUMMARY

Nick Saraev's agentic workflow framework represents the **most production-proven approach** to building reliable AI automation systems for real business revenue. Unlike theoretical agent frameworks, this uses the **DOE (Directive-Orchestration-Execution)** architecture to guarantee reliability, scalability, and continuous self-improvement.

**Key Finding:** Properly structured agentic workflows can replace 4-8 hours of manual work with 2-5 minute autonomous executions—with **99%+ reliability** (not 50-60% like naive AI automation).

**Core Innovation:** By separating *what to do* (directives), *how to coordinate* (orchestration), and *tool creation* (execution), the system forces LLMs to be deterministic while leveraging their true strength: code generation and reasoning.

---

## PART 1: WHAT MAKES AGENTIC WORKFLOWS DIFFERENT

### The Problem with Traditional Automation

**Traditional n8n/Make/Zapier:**
- Drag-and-drop nodes
- Rigid, predefined sequences
- Breaks when context changes
- Requires constant maintenance
- No learning/improvement

**Traditional AI Prompting (ChatGPT/Claude):**
- Flexible and adaptive
- Fails 40-50% of the time
- Hallucinations, loops, inconsistencies
- Can't be trusted in production
- No ability to use external tools reliably

### The Agentic Workflow Solution

**Agentic Workflows = Flexibility + Reliability**

```
Agentic Workflow = LLM + DOE Framework + Self-Annealing
                ↓
Result: Adapts like AI, reliable like code, improves over time
```

**Why This Works:**
1. LLM is given high-level directives (what to do)
2. LLM reasons and creates Python scripts to do it (leverages LLM strength)
3. Scripts handle execution deterministically (reliability)
4. System stores successful scripts, discards failures (self-annealing)
5. Next execution uses improved tools (continuous improvement)

---

## PART 2: REAL-WORLD EXAMPLES (Production Grade)

### Example 1: Lead Generation, Enrichment & Personalization (15 minutes)

**The Task:** Scrape 200 realtors in US → Enrich emails → Casualize company names

**Traditional Approach:**
- Manual research on LinkedIn: 4-6 hours
- Email finder tool: 30 minutes
- Spreadsheet cleanup: 1-2 hours
- Total: 6-8 hours of boring work

**Agentic Workflow Approach:**

```
User: "Scrape 200 realtors in the United States"
  ↓
Agent analyzes directives (what is a realtor? what filters?)
  ↓
Agent creates script to query Apify (scraping platform)
  ↓
First pass: 25 leads (test)
  ↓
Agent evaluates: "Are 85%+ real realtors?"
  ↓
If NO: Refine filters → Repeat (self-annealing in action)
If YES: Full scrape → 200 leads
  ↓
Agent creates script for email enrichment
  ↓
Result: 178/200 emails found (89% success)
  ↓
Agent enriches using secondary source → 193/200 (96% success)
  ↓
Agent creates "casual company name" column
  ↓
Formatted Google Sheet delivered in <10 minutes
```

**Actual Results:**
- Time taken: ~10 minutes (mostly watching)
- Quality: 193 valid emails from 200 prospects
- Accuracy: Company names properly casualized
- Cost: ~$2-5 in API calls
- ROI: 6-8 hours saved = $240-$480 value (at $40/hour)

**Key Insight:** Agent didn't just execute. It:
1. Created a test first (quality check)
2. Verified results against criteria (85% threshold)
3. Iterated when criteria not met (self-annealing)
4. Added enrichment layer
5. Formatted for immediate use

### Example 2: Post-Sales Call Proposal Generator (15 minutes)

**The Task:** Take sales call notes → Generate professional proposal + send follow-up email

**Inputs:**
- Company name
- Current pain points
- Budget constraints
- Timeline

**Outputs:**
- Professional PDF proposal (Pandoc)
- Follow-up email with 4-part implementation breakdown

**Agent Workflow:**

```
User: "Create proposal. [brief details]"
  ↓
Agent reads directive "create_proposal.md" (high-level SOP)
  ↓
Agent reasons: "Need company info, call transcript, or quick details"
  ↓
Agent asks clarifying questions
  ↓
User provides: Company name, pain points, savings potential
  ↓
Agent creates script to:
  1. Expand pain points based on company context
  2. Research industry benchmarks
  3. Calculate ROI based on savings potential
  4. Generate value-based language
  5. Create Pandoc template
  ↓
Agent executes Pandoc to PDF
  ↓
Agent sends via email (using MCP email tool)
  ↓
Result: Professional proposal in inbox within 2 minutes
```

**Actual Results:**
- Input provided: 5 bullet points
- Output: Professional 3-page proposal
- Quality: Client-ready (filled template + AI-generated content)
- Accuracy: All details matched input context
- Tone: Matched company's brand voice

**Key Insight:** Unlike dumb templates:
- Proposal adapted to specific industry context
- ROI calculations based on actual numbers
- Language matched company's sales approach
- Not a fill-in-the-blanks template—genuine AI composition

---

## PART 3: THE DOE FRAMEWORK (Directive-Orchestration-Execution)

### The Problem: Stochasticity

**Stochasticity** = Non-deterministic outputs from LLMs

**Why It's A Problem:**
- LLM might succeed at task on first try, fail on second try
- Error rates compound exponentially
- Example: 5-step task, 90% success per step = 59% overall success
  - Formula: 0.9^5 = 0.59 (completely unacceptable for business)
- LLMs guess next token probabilistically (not deterministic)
- Business requires deterministic outputs (same input = same output)

**The Solution: Separate Concerns**

Instead of asking LLM to: Plan + Write + Execute + Format + Verify

**Ask LLM to:** Create code to do those things, then execute code

Why? Code is deterministic. Once written correctly, it runs the same way 1,000,000 times.

### The Three Layers

```
┌────────────────────────────────────────────────────┐
│ LAYER 1: DIRECTIVE (What to do)                   │
├────────────────────────────────────────────────────┤
│ • High-level SOPs (Standard Operating Procedures) │
│ • Natural language instructions                    │
│ • Guard rails and constraints                      │
│ • Formatted in Markdown (efficient tokens)         │
│                                                     │
│ Example:                                            │
│ "Scrape realtors using Apify. Test with 25 first. │
│  Only proceed if 85%+ match target market.        │
│  Enrich emails using secondary source.             │
│  Casualize company names."                         │
│                                                     │
│ This is literally just an SOP—the same thing      │
│ you'd write for a human employee.                  │
└────────────────────────────────────────────────────┘
           ↓
┌────────────────────────────────────────────────────┐
│ LAYER 2: ORCHESTRATION (How to coordinate)        │
├────────────────────────────────────────────────────┤
│ • The AI Agent (Claude, Gemini, etc.)             │
│ • Reads directives                                 │
│ • Reasons over them                                │
│ • Creates action plans                             │
│ • Chooses which execution scripts to run           │
│ • Evaluates results                                │
│ • Loops back and improves directives               │
│                                                     │
│ Loop: Read → Choose → Execute → Evaluate → Repeat │
│                                                     │
│ This is the "mid-level manager" of your system    │
└────────────────────────────────────────────────────┘
           ↓
┌────────────────────────────────────────────────────┐
│ LAYER 3: EXECUTION (How to do it)                 │
├────────────────────────────────────────────────────┤
│ • Python scripts (created by the AI agent)        │
│ • Each script does ONE thing very well             │
│ • Deterministic outputs                            │
│ • Example scripts:                                 │
│   - scrape_leads.py (calls Apify)                 │
│   - enrich_emails.py (calls email finder)         │
│   - casualize_names.py (string transformation)    │
│                                                     │
│ Scripts start simple, improve over time:           │
│ • Replace one-off endpoints with batch endpoints  │
│ • Optimize performance (O(N²) → O(N))             │
│ • Add error handling                               │
│ • Caching and memoization                         │
│                                                     │
│ This is like Minecraft: start with nothing,       │
│ build simple tools, then reinforce them.          │
└────────────────────────────────────────────────────┘
```

### Why This Architecture Works

| Aspect | Traditional Automation | Traditional AI | Agentic DOE |
|--------|----------------------|----------------|-------------|
| **Flexibility** | Low (rigid workflows) | High (unpredictable) | High (adaptive) |
| **Reliability** | High (deterministic) | Low (probabilistic) | High (code-based) |
| **Maintenance** | Constant (breaks often) | Constant (hallucinations) | Self-improving |
| **Business Use** | OK (but rigid) | Not trusted | Production-ready |
| **Learning** | None | None | Yes (self-annealing) |

---

## PART 4: SELF-ANNEALING (The Secret Sauce)

### What Is Self-Annealing?

**Self-annealing** = Agents learn from mistakes and rewrite their own tools to improve

**Analogy: Minecraft Progression**

```
Day 1: Player has nothing
       → Punches tree → Gets wood → Makes wooden pickaxe

Day 2: Player needs stone
       → Uses wooden pickaxe → Gets stone → Makes stone pickaxe

Day 3: Player needs iron
       → Uses stone pickaxe → Gets iron → Makes iron pickaxe

Day 4: Player needs diamond
       → Uses iron pickaxe → Gets diamond → Makes diamond pickaxe + armor

Each iteration builds on previous tools. Tools get stronger over time.
```

**Agentic Workflow Analogy:**

```
Run 1: Agent creates basic lead scraping script
       → Executes
       → 25 leads found
       → Evaluates: Not good enough

Run 2: Agent improves script (refines filters)
       → Executes
       → 200 leads found, 89% valid
       → Evaluates: Good, but can improve email enrichment

Run 3: Agent creates secondary enrichment script
       → Executes
       → 200 leads, 96% valid emails
       → Evaluates: Excellent, store this version

Run 4: Next time same task runs
       → Uses improved version from Run 3 automatically
       → Gets better results immediately
```

### How Self-Annealing Works

**The agent has four responsibilities:**

1. **Read** directives (what needs to be done)
2. **Choose** which script to use (or create new one)
3. **Execute** the script
4. **Evaluate** the results
   - If success: Store the script, use again next time
   - If failure: Ask "why?" and refine the script
   - If partial success: Ask "how can I improve?" and iterate

**The beautiful part:** Agent doesn't need human approval to improve. It just keeps getting better.

**Example from Nick's workflow:**

```
Directive: "Scrape realtors. Only proceed if 85%+ match target."

Run 1:
- Agent creates initial filter
- Scrapes 25 test leads
- Evaluates: 78% match (below 85% threshold)
- Decision: Refine filters and retry

Run 2:
- Agent adjusts filters based on failure analysis
- Scrapes 25 test leads
- Evaluates: 92% match (above 85% threshold)
- Decision: Proceed to full 200-lead scrape

Run 3:
- Full scrape with refined filters
- Results: 200 high-quality leads
- Agent stores this filter logic for future use

Run 4 (Next week, same task):
- Agent immediately uses stored, proven filter
- Gets 200 leads in half the time
- System improved automatically without human intervention
```

---

## PART 5: THE PRACTICAL SETUP (Antigravity IDE)

### Workspace Structure

```
your-business-workspace/
├── directives/              # Your SOPs (what to do)
│   ├── scrape_leads.md
│   ├── create_proposal.md
│   ├── enrich_emails.md
│   └── personalize_content.md
│
├── execution/               # Your tools (how to do it)
│   ├── scrape_leads.py
│   ├── enrich_emails.py
│   ├── casualize_names.py
│   └── create_proposal.py
│
└── agent.md                 # System prompt (initializes framework)
```

### What Goes in Directives?

**Example: scrape_leads.md**

```markdown
# Scrape Leads Directive

## Objective
Scrape a list of high-quality real estate professionals from web sources.

## Process

1. **Quality Check Phase**
   - Scrape 25 initial leads
   - Verify at least 85% match our target criteria
   - If below 85%, refine filters and retry
   - If above 85%, proceed to full scrape

2. **Data Collection**
   - Scrape 200 qualified leads
   - Extract: name, company, email, phone

3. **Enrichment**
   - Use secondary source to find missing emails
   - Target: 95%+ email coverage

4. **Formatting**
   - Create casual company name (for cold email use)
   - Example: "The Baliserac Group" → "Baliserac"

5. **Validation**
   - Remove duplicates
   - Remove invalid emails
   - Ensure data quality

## Success Criteria
- 200 leads captured
- 90%+ valid emails
- All company names casualized
- Delivered as Google Sheet

## Tools Available
- Apify (web scraping platform)
- Email finder service
- Google Sheets API
```

This is literally just an SOP. Same thing you'd write for a human employee.

### What Goes in Execution?

The agent *creates* these as needed. Examples:

**scrape_leads.py** (created by agent)
```python
import apify_client

def scrape_realtors(count=25):
    client = ApifyClient("API_KEY")
    results = client.actor("web-scraper").call(
        input={
            "startUrls": ["realtor.com"],
            "filters": ["realtor", "US"],
            "maxResults": count
        }
    )
    return results
```

**enrich_emails.py** (created by agent)
```python
import requests

def enrich_emails(leads):
    enriched = []
    for lead in leads:
        if not lead.get("email"):
            response = requests.get(
                "https://api.anymailfinder.com/search",
                params={"name": lead["name"], "company": lead["company"]}
            )
            lead["email"] = response.json().get("email")
        enriched.append(lead)
    return enriched
```

The agent creates these scripts. Once created and proven, it reuses them. This is where self-annealing happens—scripts get better over time.

### The Agent Initialization Prompt

One simple prompt gets everything started:

```markdown
# Agent System Prompt

You are an autonomous business agent operating under the DOE framework.

## Your Structure
- Directives (what to do) are in /directives/
- Execution tools (how to do it) are in /execution/
- You are the orchestrator

## Your Process
1. Read the user's request
2. Load relevant directives from /directives/
3. Create or select execution scripts from /execution/
4. Execute the scripts
5. Evaluate results
6. Improve scripts if needed (self-annealing)
7. Return results

## Important Rules
- Never modify directives without explicit user request
- Always evaluate results against success criteria
- If execution script fails, create a better version
- Store successful scripts for reuse
- Use Python for all execution scripts

You are an AI employee. Act like one.
```

That's it. Drop this into Claude or Gemini, and you have a functioning business automation system.

---

## PART 6: WHEN AGENTIC WORKFLOWS WIN

### ✅ Perfect Use Cases

| Use Case | Why It Works | Expected ROI |
|----------|-------------|--------------|
| **Lead Generation** | Scraping + enrichment + personalization | 6-8 hrs saved = $240-$480 per run |
| **Proposal Writing** | Adapts to company context, saves 4-6 hours | $160-$240 per proposal |
| **Email Sequences** | Creates context-aware campaigns | 3-4 hours saved per campaign |
| **Data Analysis** | Aggregates + analyzes + formats reports | 2-4 hours saved per report |
| **Content Repurposing** | Blog → LinkedIn → Twitter → Email | 2-3 hours saved per piece |
| **Customer Research** | Pulls data from multiple sources | 3-5 hours saved per customer |
| **Sales Workflows** | CRM → Research → Outreach → Follow-up | 8-12 hours saved per customer |

### ❌ When NOT to Use

- **Ultra-low latency** (<100ms response): Agentic overhead too high
- **Financial/Legal**: Risk too high (even 0.1% error = disaster)
- **One-time tasks**: Setup cost not worth it
- **Simple tasks**: Just use a script directly

---

## PART 7: FINANCIAL IMPACT

### For Agencies

**Nick's Real Numbers (Leftclick + Dental Marketing):**
- Leftclick: Agentic workflows handle lead gen, outreach, follow-up → 2+ FTE equivalents
- Dental Marketing: $2M/year business, ~40% of operations automated via agentic workflows
- Result: $160K+ combined agency revenue directly attributable to agentic automation

### For Freelancers/Consultants

**Conservative Model:**
```
Build 5 agentic workflows (50-100 hours)
Each workflow saves 4-6 hours/week for clients
Sell access: $297-$997/month per workflow
Example: 10 clients × $497/month × 5 workflows = $24,850/month
Year 1 Revenue: $100K-$298K
Effort: 10-15 hours/month (maintenance + improvements)
Margin: 85%+
```

### For Your Own Business

**What Nick Uses:**
- Lead generation workflow: Replaces 2 VAs ($4K/month savings)
- Proposal generation: Replaces 40 hours/month ($1,600 savings)
- Email personalization: Replaces 30 hours/month ($1,200 savings)
- Content repurposing: Replaces 20 hours/month ($800 savings)
- **Total: ~$7,600/month in labor savings**
- One-time setup: 40-60 hours

---

## PART 8: HOW TO START (30-Day Plan)

### Week 1: Learn the Framework

**Tasks:**
- Understand DOE architecture (read this guide)
- Study examples (lead scraping, proposal generation)
- Understand self-annealing concept
- Set up Antigravity IDE (free)

**Time:** 8 hours

### Week 2: Build First Workflow

**Task:** Choose ONE repetitive 4-6 hour task in your business
- Options: Lead gen, proposal writing, email sequences, data reports
- Write its SOP in Markdown (your directive)
- Let Claude/Gemini + Antigravity build the execution scripts
- Test extensively

**Time:** 10-15 hours

**Example:** If you're in sales, automate lead scraping + enrichment + personalization

### Week 3: Deploy & Iterate

**Tasks:**
- Run workflow 5 times
- Evaluate results each time
- Let agent improve scripts (self-annealing)
- Document what worked, what didn't
- Refine directives based on learnings

**Time:** 5-8 hours

### Week 4: Build Next Workflow

**Task:** Repeat process for second workflow
- First workflow improved from 70% → 95% success rate
- Second workflow learns from first
- Faster to build (reusing patterns)

**Time:** 8-10 hours

### By End of Month

- 2 production workflows handling 8-12 hours/week of work
- Self-improving (better each week)
- Ready to scale to 3-5 workflows

---

## PART 9: KEY INSIGHTS FROM NICK

### Insight 1: Error Rates Compound Exponentially

**If each step has 90% success rate:**
- 1 step: 90% overall success
- 2 steps: 81% overall
- 3 steps: 73% overall
- 5 steps: 59% overall ← This is the default with naive AI

**With DOE framework (each step is deterministic code):**
- Each step: 99%+ success
- 5 steps: 95%+ overall

**Conclusion:** Architecture matters more than model choice.

### Insight 2: Flexibility vs. Determinism

**Traditional automation:** Deterministic but rigid
**Traditional AI:** Flexible but unreliable
**Agentic DOE:** Flexible AND deterministic

By forcing LLM to *create code* rather than *execute directly*, you get both.

### Insight 3: Agents Are Better at Code Than Reasoning

**Don't ask agent to:** "Sort this list alphabetically"
**Ask agent to:** "Write me a Python script to sort this list"

Why? LLMs are trained on millions of Python examples. Sorting code is trivial. But asking LLM to reason through sorting requires matrix calculations in token space (100,000x slower).

### Insight 4: SOPs Are Universal

Your existing company SOPs don't need to change. Just drop them into `/directives/` as Markdown files. The agent understands them because they're written for humans—and LLMs are good at understanding human language.

### Insight 5: Self-Annealing is the Moat

**Week 1:** Workflow works 70% of the time
**Week 2:** Agent improved scripts, now 80%
**Week 3:** Now 88%
**Week 4:** Now 95%

Meanwhile, competitors using static automation still at 70%. You've built a competitive advantage that gets better automatically.

---

## PART 10: COMPARISON TO ALTERNATIVES

| Tool | Flexibility | Reliability | Maintenance | Cost | Learning Curve |
|------|-------------|------------|-------------|------|-----------------|
| **Make.com** | Low | High | High | High | Low |
| **n8n** | Low | High | High | Medium | Low |
| **Zapier** | Very Low | High | High | High | Very Low |
| **Naive AI (ChatGPT)** | High | Very Low | Very High | Low | Very Low |
| **Agentic DOE** | High | High | Low | Low | Medium |

**Why Agentic DOE Wins:**
- Can handle variable inputs (flexible like AI)
- Reliable for business-critical workflows (deterministic like code)
- Self-improving (unlike traditional automation)
- Cheaper than hiring people (unlike consultants)
- Actually works in production (unlike naive AI)

---

## PART 11: NEXT STEPS

### If You Want to Build This

1. **This Week:**
   - Set up Antigravity or VS Code (both free)
   - Write one SOP for a repetitive task
   - Initialize with agent.md system prompt

2. **Next Week:**
   - Let Claude/Gemini create the execution scripts
   - Test your first workflow
   - Document results

3. **Month 2:**
   - Deploy 3-5 workflows
   - Measure ROI
   - Start charging clients or customers

4. **Quarter 2:**
   - Have 10-20 working workflows
   - Self-annealing improving each one
   - $5K-$50K/month in revenue

### Resources Mentioned

- **Antigravity:** Google's agentic IDE (free, best for this)
- **VS Code:** Alternative IDE (free, more technical)
- **Maker School:** Nick's community (paid, but has accountability model)
- **Apify:** Web scraping (paid, but essential)
- **Anymailfinder:** Email enrichment
- **n8n:** Integration hub
- **MCP (Model Context Protocol):** For tool access (Gmail, Slack, etc.)

---

## CONCLUSION

**Agentic workflows are not the future. They are today.**

The framework Nick presents—DOE architecture + self-annealing—is the most mature, battle-tested approach to reliable AI automation in production.

**Key Takeaway:** Instead of asking "How do I make AI more intelligent?", ask "How do I make AI more reliable while keeping it flexible?"

The answer: Structure (DOE) + Tools (Scripts) + Learning (Self-annealing).

Start with one workflow. Measure ROI. Scale to 5-10. By Month 3, you'll have automated 30-50% of your operational workload and possibly discovered a new revenue stream.

