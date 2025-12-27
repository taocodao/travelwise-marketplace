# Complete Implementation Plan for Agentic Workflow Creation

## Executive Summary

This document provides a production-grade, step-by-step implementation plan for building enterprise-ready agentic workflows based on the comprehensive course material provided. The plan bridges theory with actionable execution, drawing from Nick Sarif's proven framework and current industry best practices (2025).

**Key Outcome:** By following this plan, you will build a self-improving AI business operating system capable of automating complex tasks with 95%+ reliability, enabling 10-100x productivity gains for knowledge work.

---

## Part 1: Foundational Architecture

### 1.1 The DOE Framework (Directive-Orchestration-Execution)

The DOE framework is the architectural backbone that ensures reliability in probabilistic LLM systems.

#### Why DOE Matters
- **Problem:** LLMs are stochastic (probabilistic). Business logic is deterministic. When LLMs try to do everything (planning + tool use + formatting + execution), error rates compound exponentially.
- **Mathematical Reality:** If each step has 90% success, a 5-step task = 0.9^5 = 59% total success rate. Unacceptable for business operations.
- **Solution:** Separate concerns into layers, pushing heavy lifting to deterministic Python scripts, and letting the LLM be what it's actually good at: intelligent routing.

#### The Three Layers

**Layer 1: Directives (The WHAT)**
- Purpose: High-level intent and guardrails
- Format: Markdown files in `/directives` folder
- Content: SOPs (Standard Operating Procedures), workflow descriptions, error handling rules
- Owner: Humans + Agent (agent can refine over time)
- Example:
  ```markdown
  # Scrape Leads Workflow
  
  ## Goal
  Autonomously scrape leads from specified industry using Apify actors.
  
  ## Inputs
  - Industry name
  - Lead count (e.g., 100, 200)
  - Target accuracy threshold (e.g., 85%)
  
  ## Process
  1. Run test scrape (25 leads)
  2. Validate lead quality against target market
  3. If <85% match: retry with different filters (self-anneal)
  4. If ≥85% match: proceed with full scrape
  5. Enrich emails using third-party service
  6. Output to Google Sheet
  
  ## Outputs
  - Google Sheet with leads, emails, company names
  - Casual company names (e.g., "Bezac" instead of "The Bezac Group of AB & Co-Realtors")
  
  ## Edge Cases
  - If scraper timeout: retry with 50% batch size
  - If enrichment API rate-limited: implement backoff
  - If >10% invalid emails: flag for manual review
  ```

**Layer 2: Orchestration (The WHO)**
- Purpose: Intelligent routing and decision-making
- Format: LLM agent (typically Claude, Gemini, GPT-4)
- Role: Read directives → Choose action → Execute → Evaluate → Loop
- Key Capability: Can modify directives and execution scripts based on real-world feedback
- Example Loop:
  ```
  Agent reads: "Scrape leads with ≥85% target accuracy"
  Agent plans: "I'll start with test scrape of 25 leads"
  Agent executes: Calls scrape_leads.py with test_size=25
  Agent evaluates: "Only 70% match target market"
  Agent adapts: "I need to retry with different filters"
  Agent improves: Updates directive with lessons learned
  Agent executes: Runs full scrape with refined parameters
  ```

**Layer 3: Execution (The HOW)**
- Purpose: Deterministic, testable, fast code
- Format: Python scripts in `/execution` folder
- Properties: 
  - Runs the same every time (no hallucination)
  - Fast (10,000x faster than LLM doing the work)
  - Reliable error handling with meaningful error messages
- Examples:
  - `scrape_leads.py`: Calls Apify API, formats results, validates schema
  - `enrich_emails.py`: Batch API calls to email enrichment service
  - `create_google_sheet.py`: Uses Google Sheets API to populate data

#### Why This Works
1. **Separation of Concerns:** Each layer has a single responsibility
2. **Error Isolation:** Python errors are catchable; LLM errors cascade
3. **Speed:** Execution layer is 10,000x faster than asking LLM to do everything
4. **Reliability:** Deterministic scripts produce consistent output; LLM just routes
5. **Evolution:** Agent can improve both directives (what to do) and execution (how to do it)

---

### 1.2 Self-Annealing Mechanism

Self-annealing is the "living system" that improves itself over time without human intervention.

#### The Concept
Like metallurgy: heat metal → cool slowly → atoms reorganize → stronger structure

In agentic workflows:
- First run: ~40-60% success (rough)
- Error occurs → Agent reads error message
- Agent fixes execution script AND updates directive
- Next run: ~80% success (better)
- Continues until: ~95%+ success (production-ready)

#### Implementation
```
Error Detected
    ↓
[Read Error Message & Stack Trace]
    ↓
[Fix the Script]
    ↓
[Test the Script]
    ↓
[Update Directive with Lessons]
    ↓
[Retry the Task]
    ↓
[Success / Repeat]
```

#### Example
**Day 1 - Initial Directive:**
```markdown
Scrape leads for dentists in New York
```

**First Run:** Agent tries, API returns 429 (rate limited)

**Self-Anneal Response:**
- Fixes: Adds exponential backoff retry logic to script
- Updates: Directive now includes "Rate limit handling: exponential backoff, max 5 retries"

**Second Run:** Works, but slow (30 seconds per 10 leads)

**Agent Optimization:**
- Finds: Parallel requests 5x faster
- Updates: Script uses ThreadPoolExecutor
- New result: 10 leads in 6 seconds

This continuous improvement is what makes 24/7 automation feasible.

---

## Part 2: Technical Setup & Infrastructure

### 2.1 IDE Selection (2025 Landscape)

#### Tier 1: Recommended for New Users (2025)
| IDE | Best For | Setup Time | Cost |
|-----|----------|-----------|------|
| **Anthropic Codebase** (Claude Code) | VS Code integration, any model | 15 min | Free-$25/mo |
| **Google Gemini with Anti-Gravity** | Native agentic workflows, real-time browser | 10 min | Free tier available |
| **OpenAI Codex** | Cloud sandbox execution, PR generation | 20 min | Usage-based |

#### Tier 2: Production-Grade
| IDE | Architecture | Strengths |
|-----|--------------|-----------|
| **Cline (VS Code)** | Open-source agent | Full codebase reasoning, any model, local execution |
| **AWS Kiro** | Spec-driven | Structured workflows, compliance-friendly |
| **Continue IDE Extension** | Open-source | Fully local via Ollama, no API costs |

#### Tier 3: Specialized
| IDE | Use Case |
|-----|----------|
| **Firebase Studio** | Full-stack: backend, frontend, DB, deployment in one |
| **Replit Agent** | Browser-based, friendly for teams |

**Recommendation:** Start with **Google Anti-Gravity** (shown in course) or **Cline + VS Code** (more flexible).

---

### 2.2 Folder Structure & Initialization

#### Standard Workspace Layout
```
my-agentic-workspace/
├── gemini.md                  # System prompt (core agent instructions)
├── agents.md                  # Agent configuration (alternatives)
├── claude.md                  # For Claude-based setups
├── .env                       # API keys & credentials (never commit)
├── .gitignore                 # Exclude .env, logs, temp files
├── README.md                  # Workspace overview
│
├── directives/                # SOPs & workflows (natural language)
│   ├── scrape-leads.md
│   ├── enrich-leads.md
│   ├── create-proposal.md
│   ├── generate-content.md
│   └── ...
│
├── execution/                 # Deterministic Python scripts
│   ├── scrape_leads.py
│   ├── enrich_emails.py
│   ├── create_google_sheet.py
│   ├── send_email.py
│   ├── utils.py               # Shared helpers
│   ├── config.py              # Configuration
│   └── ...
│
├── tools/                     # MCP servers & integrations
│   ├── mcp.json               # Model Context Protocol config
│   └── ...
│
├── logs/                      # Agent execution logs (gitignored)
│   └── ...
│
└── tmp/                       # Temporary files (gitignored)
    └── ...
```

#### Initialization Steps
1. Create workspace folder: `mkdir my-agentic-workspace && cd my-agentic-workspace`
2. Create subdirectories: `mkdir directives execution tools logs tmp`
3. Create `.env` (keep secrets safe)
4. Create `gemini.md` with core instructions (see next section)

---

### 2.3 Core System Prompt (gemini.md / claude.md)

This is the injected prompt that guides all agent behavior. **Critical:** Inject this once, it shapes everything.

#### Template for Claude
```markdown
# Agentic Workflow Environment Configuration

## Three-Layer Architecture
You operate within a three-layer architecture designed for reliability and separation of concerns:

### Layer 1: Directives (WHAT to do)
- Location: `/directives` folder
- Format: Markdown files with goals, inputs, processes, outputs, edge cases
- Your role: Read and understand these SOPs as high-level intent
- Content: Workflow descriptions written in natural language (like a recipe)

### Layer 2: Orchestration (WHO routes tasks)
- That's you - the AI agent
- Your responsibilities:
  1. Read directives
  2. Understand intent
  3. Choose which execution scripts to run
  4. Handle errors gracefully
  5. Update directives & scripts based on failures (self-anneal)

### Layer 3: Execution (HOW to do it)
- Location: `/execution` folder
- Format: Deterministic Python scripts
- Properties: Run identically every time, no hallucination
- Your role: Call these scripts, don't try to replicate their logic

## Self-Annealing Protocol
When tasks fail:
1. Read error message & stack trace
2. Determine root cause
3. Fix the execution script (or create a new one)
4. Test the fix
5. Update the relevant directive with your learnings
6. Retry the task
7. Log the improvement

**Example:** If task fails due to rate limiting, add backoff logic to script AND document it in directive so future runs avoid the same issue.

## Best Practices
- Prefer tool use over manual work
- Call Python scripts from `/execution` rather than trying to do complex logic yourself
- Validate outputs match expected schema before marking as complete
- Ask for clarification only when genuinely ambiguous
- Treat directives as living documents - update them based on real-world results

## Environment Access
- API keys stored in `.env` (never expose)
- Use `os.environ.get('API_KEY_NAME')` to access in scripts
- Third-party services (Apify, Google Sheets, SendGrid) accessed via scripts
- Browser/web access available via Model Context Protocol (MCP) tools

## Workflow Execution Loop
```
Read User Request
    ↓
Search directives/ for relevant SOP
    ↓
Plan execution steps
    ↓
Call execution/ scripts with parameters
    ↓
Evaluate results
    ↓
If Error: Self-anneal → Update script & directive → Retry
If Success: Present results to user
```

## Responsible AI
- Never execute user code without review if untrusted
- Implement safeguards for sensitive operations (payment, deletion)
- Maintain audit logs of all agent actions
- Escalate to human for high-stakes decisions
```

#### Template for Gemini 3 Pro
```markdown
# Gemini Agentic Workflow Environment

## Core Principle
You are an AI employee. Your job is to:
1. Understand high-level instructions (directives)
2. Make intelligent decisions about what to do (orchestration)
3. Execute reliable, deterministic tasks (via Python scripts)

## Three-Layer Architecture

### Layer 1: Directives (`/directives` markdown files)
These are SOPs - high-level instructions describing WHAT to accomplish
- Read them to understand intent
- Follow them as guardrails
- Update them based on learnings

### Layer 2: You (Orchestration)
- Decision maker and router
- Read → Plan → Execute → Evaluate → Improve
- You have the autonomy to improve scripts and directives

### Layer 3: Execution Scripts (`/execution` Python files)
- Deterministic code that does the actual work
- Never hallucinate - scripts either work or fail
- Much faster than asking you to do the work

## Self-Improvement Loop
Workflow fails → Fix script → Update directive → Retry → Succeed → Never fail that way again

This is how you build production systems without constant babysitting.

## Action Flow
1. User gives task → Find relevant directive
2. Plan steps → Call execution scripts
3. Error? → Self-anneal: fix script, update directive, retry
4. Success? → Present results

Go build something valuable.
```

---

### 2.4 Essential API & Service Setup

#### APIs You'll Likely Need (By Use Case)

**Lead Generation Workflow**
- [nav_link:Apify] (web scraping): Create account, generate API key
- [nav_link:Hunter.io] (email enrichment): API key
- [nav_link:Clearbit] (company data): API key
- Google Sheets: OAuth2 service account (download JSON)
- Gmail: OAuth2 service account (for sending emails)

**Content & Analysis**
- OpenAI / Anthropic / Google APIs
- YouTube Data API (if scraping YouTube)
- Firecrawl (web scraping alternative)

**Execution Environment**
- Python 3.11+ with libraries: `requests`, `google-auth`, `pandas`, `dotenv`

#### .env File Template
```bash
# External APIs
APIFY_API_KEY=xxx
HUNTER_API_KEY=xxx
CLEARBIT_API_KEY=xxx
OPENAI_API_KEY=xxx
ANTHROPIC_API_KEY=xxx
GOOGLE_API_KEY=xxx

# Google Services (store JSON path or paste content)
GOOGLE_SHEETS_CREDENTIALS_PATH=./credentials/google-sheets.json
GMAIL_CREDENTIALS_PATH=./credentials/gmail.json

# Internal Configuration
LOG_LEVEL=INFO
RETRY_ATTEMPTS=5
TIMEOUT_SECONDS=30
```

---

## Part 3: Building Your First Workflow

### 3.1 The Lead Scraping & Enrichment Workflow (From Course)

This is the exact workflow demonstrated in the course. Follow it step-by-step.

#### Step 1: Create Directive
File: `/directives/scrape-leads.md`

```markdown
# Lead Scraping & Enrichment Workflow

## Goal
Autonomously scrape leads from a specified industry using Apify, validate quality, and enrich with email addresses.

## Inputs
- `industry`: Industry to scrape (e.g., "dentists", "real estate agents", "SaaS founders")
- `location`: Geographic target (e.g., "New York", "United States")
- `lead_count`: Number of leads to scrape (e.g., 100, 200)
- `target_accuracy`: Minimum percentage of leads that must match industry (default: 85%)

## Process

### Phase 1: Test Scrape & Validation
1. Run test scrape for 25 leads using Apify
2. Store results in temporary JSON
3. Validate each lead against industry criteria
4. Calculate accuracy percentage

### Phase 2: Self-Annealing Logic
- If accuracy >= target_accuracy: Go to Phase 3
- If accuracy < target_accuracy: 
  - Refine Apify filters
  - Retry Phase 1
  - (Max 3 attempts to avoid infinite loops)

### Phase 3: Full Scrape
1. Run full scrape for `lead_count` leads
2. Store in temporary JSON

### Phase 4: Email Enrichment
1. Extract leads without emails
2. Batch call to Hunter.io (or similar) for enrichment
3. Merge enriched emails back to lead list

### Phase 5: Output
1. Create Google Sheet
2. Populate with: name, email, company, title, LinkedIn, phone
3. Add "casual_company_name" column (simplified version)
4. Share link with user

## Outputs
- Google Sheet URL with full lead list
- Enrichment success rate (X/100 emails found)
- Execution time

## Edge Cases & Error Handling
- **Scraper timeout**: Retry with smaller batch size
- **API rate limit (429)**: Exponential backoff, max 5 retries
- **Invalid email format**: Log and skip (human review later)
- **Google Sheets API error**: Retry once, then fail gracefully
- **>10% missing emails after enrichment**: Flag for manual review

## Performance Targets
- Test scrape: <30 seconds
- Full scrape (100 leads): <2 minutes
- Email enrichment: <1 minute
- Total: <5 minutes
```

#### Step 2: Create Execution Script
File: `/execution/scrape_leads.py`

```python
"""
Lead scraping and enrichment execution module.
Handles Apify scraping, validation, and email enrichment.
"""

import os
import json
import time
import requests
from typing import List, Dict, Tuple
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

APIFY_API_KEY = os.getenv('APIFY_API_KEY')
HUNTER_API_KEY = os.getenv('HUNTER_API_KEY')
APIFY_BASE_URL = "https://api.apify.com/v2"
HUNTER_BASE_URL = "https://api.hunter.io/v2"

# Apify actor for scraping (example: LinkedIn-like profiles)
APIFY_ACTOR_ID = "helix-scraper~linkedin-scraper"  # Adjust per your use case


def scrape_leads_apify(
    industry: str,
    location: str,
    lead_count: int,
    test_mode: bool = False
) -> Tuple[List[Dict], float]:
    """
    Scrape leads using Apify.
    
    Returns: (leads_list, success_rate)
    """
    query = f"{industry} in {location}"
    count = 25 if test_mode else lead_count
    
    payload = {
        "searchStringsArray": [query],
        "maxResults": count,
        "useCheerio": False,
    }
    
    try:
        logger.info(f"Starting {'test' if test_mode else 'full'} scrape: {query} ({count} leads)")
        
        # Call Apify
        response = requests.post(
            f"{APIFY_BASE_URL}/acts/{APIFY_ACTOR_ID}/runs?token={APIFY_API_KEY}",
            json=payload,
            timeout=60
        )
        response.raise_for_status()
        run_data = response.json()
        run_id = run_data['data']['id']
        
        # Poll for completion
        while True:
            check = requests.get(
                f"{APIFY_BASE_URL}/acts/{APIFY_ACTOR_ID}/runs/{run_id}?token={APIFY_API_KEY}",
                timeout=30
            )
            check.raise_for_status()
            status = check.json()['data']['status']
            
            if status in ['SUCCEEDED', 'FAILED']:
                break
            time.sleep(5)  # Poll every 5 seconds
        
        # Fetch results
        results_url = f"{APIFY_BASE_URL}/acts/{APIFY_ACTOR_ID}/runs/{run_id}/dataset/items?token={APIFY_API_KEY}"
        results_response = requests.get(results_url, timeout=30)
        results_response.raise_for_status()
        leads = results_response.json()
        
        logger.info(f"Scraped {len(leads)} leads")
        return leads, 1.0
        
    except Exception as e:
        logger.error(f"Apify scrape error: {e}")
        raise


def validate_leads(leads: List[Dict], target_industry: str) -> float:
    """
    Simple validation: check if lead titles/companies match industry.
    Returns: success_rate (0.0 - 1.0)
    """
    if not leads:
        return 0.0
    
    match_count = 0
    for lead in leads:
        title = lead.get('title', '').lower()
        company = lead.get('company', '').lower()
        combined = f"{title} {company}"
        
        # Simple keyword matching
        if target_industry.lower() in combined:
            match_count += 1
    
    rate = match_count / len(leads)
    logger.info(f"Validation: {match_count}/{len(leads)} leads match industry ({rate*100:.1f}%)")
    return rate


def enrich_emails_batch(leads: List[Dict]) -> List[Dict]:
    """
    Enrich leads with emails using Hunter.io API.
    """
    leads_needing_email = [l for l in leads if not l.get('email')]
    
    if not leads_needing_email:
        logger.info("All leads already have emails")
        return leads
    
    logger.info(f"Enriching {len(leads_needing_email)} leads with emails")
    
    def enrich_single(lead):
        try:
            domain = lead.get('company_domain') or extract_domain(lead.get('company', ''))
            if not domain:
                return lead
            
            response = requests.get(
                f"{HUNTER_BASE_URL}/domain-search",
                params={
                    'domain': domain,
                    'type': 'personal',
                    'limit': 10,
                },
                headers={'Authorization': f'Bearer {HUNTER_API_KEY}'},
                timeout=10
            )
            response.raise_for_status()
            emails = response.json().get('data', {}).get('emails', [])
            
            if emails:
                lead['email'] = emails[0]['value']
                lead['email_source'] = 'hunter.io'
            
        except Exception as e:
            logger.warning(f"Enrichment failed for {lead}: {e}")
        
        return lead
    
    # Parallel enrichment
    with ThreadPoolExecutor(max_workers=5) as executor:
        enriched = list(executor.map(enrich_single, leads_needing_email))
    
    # Merge back
    result = [l for l in leads if l.get('email')] + enriched
    
    enriched_count = sum(1 for l in result if l.get('email'))
    logger.info(f"Enrichment complete: {enriched_count}/{len(leads)} emails found")
    
    return result


def extract_domain(company_name: str) -> str:
    """Extract domain from company name (simple heuristic)."""
    return f"{company_name.lower().replace(' ', '')}.com"


def casualize_company_names(leads: List[Dict]) -> List[Dict]:
    """Simplify company names for cold email."""
    for lead in leads:
        company = lead.get('company', '')
        # Simple: take first 2-3 words, remove legal suffixes
        parts = company.split()[:2]
        casual = ' '.join(parts).replace('LLC', '').replace('Inc', '').replace('Co.', '').strip()
        lead['casual_company_name'] = casual or company
    
    return leads


def scrape_and_enrich_leads(
    industry: str,
    location: str,
    lead_count: int,
    target_accuracy: float = 0.85,
    max_retries: int = 3
) -> Dict:
    """
    Main orchestration function.
    """
    
    # Phase 1: Test scrape
    for attempt in range(max_retries):
        test_leads, _ = scrape_leads_apify(industry, location, lead_count, test_mode=True)
        accuracy = validate_leads(test_leads, industry)
        
        if accuracy >= target_accuracy:
            logger.info(f"Test passed on attempt {attempt + 1}")
            break
        else:
            logger.info(f"Test failed: {accuracy*100:.1f}% < {target_accuracy*100:.1f}%. Retrying...")
    else:
        raise Exception("Failed to achieve target accuracy after max retries")
    
    # Phase 3: Full scrape
    full_leads, _ = scrape_leads_apify(industry, location, lead_count, test_mode=False)
    
    # Phase 4: Email enrichment
    enriched_leads = enrich_emails_batch(full_leads)
    
    # Phase 5: Format & casualize
    enriched_leads = casualize_company_names(enriched_leads)
    
    return {
        'leads': enriched_leads,
        'total_count': len(enriched_leads),
        'emails_found': sum(1 for l in enriched_leads if l.get('email')),
        'industry': industry,
        'location': location,
    }


# Entry point for agent to call
if __name__ == "__main__":
    result = scrape_and_enrich_leads("dentists", "New York", 100)
    print(json.dumps(result, indent=2))
```

#### Step 3: Connect to Agent
In your IDE (Anti-Gravity, Claude Code, or Cline):
1. Ensure gemini.md / claude.md is set as system prompt
2. Create `/directives/scrape-leads.md` (Step 1)
3. Create `/execution/scrape_leads.py` (Step 2)
4. Simply ask the agent: "Scrape 100 dentists in New York"
5. The agent will:
   - Read directives/scrape-leads.md
   - Call execution/scrape_leads.py
   - Handle errors with self-annealing
   - Return Google Sheet

---

### 3.2 Post-Execution: Stress Testing & Optimization

#### Initial Run Expectations
- **First run:** 40-70% success rate (expects errors)
- **Issues to anticipate:**
  - Rate limiting
  - Timeout errors
  - Invalid data format
  - Missing API keys

#### Self-Annealing in Practice
When the agent encounters errors, guide it:

```
User → Agent: "It's taking too long. Can you go faster?"
Agent → Reads error logs, sees sequential API calls
Agent → Fixes: Adds parallel batch requests using ThreadPoolExecutor
Agent → Updates: Directive notes batch API usage
Result: 5-10x speed improvement

User → Agent: "Some leads missing emails. Can you find more?"
Agent → Realizes: Only checking one email source
Agent → Fixes: Adds fallback to Clearbit if Hunter fails
Agent → Updates: Directive documents fallback strategy
Result: 15-20% more email matches
```

#### Optimization Loop
Ask for incremental improvements:
1. "Make this faster" (triggers parallelization, batch APIs)
2. "Make this more accurate" (adds validation, fallback sources)
3. "Make this cheaper" (consolidates API calls, caches results)
4. "Make this more reliable" (adds retry logic, error handling)

Each iteration improves the code and directives.

---

## Part 4: Advanced Workflows

### 4.1 Multi-Workflow Architecture

Once your first workflow is solid, scale by composing workflows.

#### Example: Lead → Research → Proposal → Email
```
scrape-leads.md
    ↓
enrich-leads.md (deep research, website scraping, social profiles)
    ↓
create-proposal.md (Pandoc template, custom copy)
    ↓
send-email.md (personalized cold email with PDF)
```

Each workflow is a separate directive + execution pair. The agent chains them together.

**Agent Instruction:**
```
I want you to: 
1. Scrape 100 real estate agents in Florida
2. Research each one (website, social, recent deals)
3. Create a custom PDF proposal for each
4. Send personalized cold emails with the PDFs

Use the workflows in /directives to do this.
```

The agent will automatically:
- Call scrape_leads.py
- Call enrich_deep.py on each lead
- Template proposal using create_proposal.py
- Send via send_email.py
- Handle failures with self-annealing

---

### 4.2 Multi-Agent Collaboration

For complex tasks, spawn specialized agents:

**Agent 1: "Research Agent"**
- Directives: web research, data scraping
- Execution: browser automation, API calls

**Agent 2: "Writing Agent"**
- Directives: copywriting, proposal generation
- Execution: template filling, formatting

**Agent 3: "Distribution Agent"**
- Directives: email sending, contact verification
- Execution: Email API, CRM integration

**Orchestrator:**
```
Research Agent: "Find 100 leads in SaaS"
Writing Agent: "Create 100 custom proposals"
Distribution Agent: "Send 100 emails"
```

All happen in parallel if execution scripts support concurrency.

---

## Part 5: Production Deployment

### 5.1 Reliability Requirements

For production (especially revenue-generating), implement:

#### 1. Audit Logging
```python
def log_action(action: str, inputs: Dict, outputs: Dict, status: str, error: str = None):
    """Log all agent actions for compliance & debugging."""
    record = {
        'timestamp': datetime.now().isoformat(),
        'action': action,
        'inputs': inputs,
        'outputs': outputs,
        'status': status,
        'error': error,
    }
    # Write to file or database
    logger.info(json.dumps(record))
```

#### 2. Error Escalation
```
Agent tries task
    ↓
If retriable error: Retry with backoff
    ↓
If max retries reached: Escalate to human
    ↓
Human approves → Agent continues
Human rejects → Task terminates
```

#### 3. Health Checks
```python
def health_check():
    """Verify all critical services are available."""
    checks = {
        'apify': check_apify_api(),
        'google_sheets': check_google_auth(),
        'hunter': check_hunter_api(),
    }
    if all(checks.values()):
        return True
    else:
        logger.error(f"Health check failed: {checks}")
        return False
```

#### 4. Performance Monitoring
Track and alert on:
- Execution time per workflow
- Error rate per script
- API cost per lead
- Success rate over 7 days

---

### 5.2 Deployment Options

#### Option 1: Local Development (Start Here)
- Run on laptop/desktop
- Good for: Building, testing, small-scale (<1000 items/day)
- Tools: VS Code + any IDE from Part 2

#### Option 2: Cloud Deployment (Recommended for Production)
- Run on cloud VM or container
- Good for: 24/7 automation, scaling
- Platforms:
  - Google Cloud Run (cheapest for bursty)
  - AWS Lambda + EventBridge
  - Azure Functions
  - Self-hosted Docker on VPS

#### Option 3: Scheduled Execution
```
Set up cron job or cloud scheduler:
- Daily: "Run morning outlier detector"
- Weekly: "Generate proposal reports"
- Real-time: "Trigger on form submission"
```

#### Example: Google Cloud Run Deployment
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT 8080

CMD exec gunicorn --bind :$PORT main:app
```

```python
# main.py
from flask import Flask, request
import execute_workflow

app = Flask(__name__)

@app.route('/run-workflow', methods=['POST'])
def run_workflow_endpoint():
    data = request.json
    result = execute_workflow.scrape_and_enrich_leads(**data)
    return {'status': 'success', 'data': result}

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 8080)))
```

---

## Part 6: Business Implementation Strategy

### 6.1 Quick Wins (Week 1)
Start with high-ROI, low-risk workflows:

| Workflow | Time to Build | ROI | Risk |
|----------|------|-----|------|
| Lead scraping & enrichment | 2-4 hours | High | Low |
| Proposal generation | 4-6 hours | High | Medium |
| Email template personalization | 2-3 hours | Medium | Low |
| Social media content calendar | 4-8 hours | Medium | Medium |

---

### 6.2 Scaling Path (Months 2-3)

**Month 1:** 1-2 core workflows, manual oversight
**Month 2:** 3-5 workflows, 80% automated, 20% human review
**Month 3:** 10+ workflows, 95% automated, exception-based human review

---

### 6.3 Measuring Success

#### Tier 1: Volume Metrics
- Leads processed: X/day (vs Y baseline)
- Proposals generated: X/day (vs Y baseline)
- Emails sent: X/day (vs Y baseline)

#### Tier 2: Quality Metrics
- Lead accuracy: X% (target: 90%+)
- Email open rate: X% (baseline: 20-30%)
- Proposal win rate: X% (baseline: 20-40%)

#### Tier 3: Economic Metrics
- Cost per lead: $X (vs $Y before)
- Revenue per workflow: $X (calculate ROI)
- Staff time freed: X hours/week
- Payback period: X months

---

## Part 7: Common Pitfalls & Solutions

| Pitfall | Problem | Solution |
|---------|---------|----------|
| **Too many API calls** | Rate limits, high costs | Batch APIs, implement caching, use bulk endpoints |
| **No error handling** | Silent failures, data corruption | Add try-catch, log all errors, escalate to human |
| **Deterministic scripts as LLM hallucinations** | "Let the LLM do everything" | Force script generation, validate outputs against schema |
| **Ignored edge cases** | 5% of runs fail quietly | Self-anneal: update directive when edge case found |
| **No audit trail** | Compliance issues, debugging hard | Log every action, decision, output |
| **Skipping human review** | False positives, legal liability | Implement approval workflows for high-stakes actions |
| **Not optimizing after v1** | Slow, expensive, unreliable | Ask agent "faster/cheaper/better" → self-anneal |

---

## Part 8: Tools & Resources

### Essential Reading
- [nav_link:A Practical Guide for Designing, Developing, and Deploying Production-Grade Agentic AI Workflows] (ArXiv paper, Dec 2024) – 9 core best practices
- [nav_link:The 2026 Guide to AI Agent Workflows] (Vellum AI) – Architecture patterns
- [nav_link:Agentic AI Implementation Guide] (Sketch Development) – Step-by-step implementation

### Frameworks & Platforms
- [nav_link:AutoGen] (Microsoft) – Multi-agent framework
- [nav_link:CrewAI] – Workflow orchestration
- [nav_link:LangGraph] (LangChain) – Deterministic workflow graphs
- [nav_link:MCP (Model Context Protocol)] (Anthropic) – Standard for tool integration

### APIs & Services
- [nav_link:Apify] – Web scraping actors
- [nav_link:Hunter.io] – Email enrichment
- [nav_link:Clearbit] – B2B data enrichment
- [nav_link:Google Sheets API] – Data storage & reporting
- [nav_link:SendGrid] or [nav_link:Mailgun] – Email delivery

---

## Conclusion

This implementation plan translates the course material into actionable steps:

1. **Week 1:** Set up IDE, create first directive + script pair, test locally
2. **Week 2-3:** Build 2-3 core workflows, stress-test for reliability
3. **Week 4:** Deploy to cloud, implement monitoring & logging
4. **Month 2+:** Scale to 10+ workflows, measure ROI, optimize continuously

**Key Principle:** Start simple, measure everything, let the agent self-anneal, and scale when you have reliability.

The future is agentic. Build it.

---

**Last Updated:** December 18, 2025
**Source:** Nick Sarif's "Agentic Workflows" course + 2025 industry best practices
**Status:** Production-ready implementation plan