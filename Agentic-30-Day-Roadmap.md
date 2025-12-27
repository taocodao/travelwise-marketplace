# Agentic Workflows: 30-Day Implementation Roadmap

**Framework:** DOE (Directive-Orchestration-Execution)  
**IDE:** Antigravity (Google) or VS Code  
**Models:** Claude 3.5+, Gemini, or equivalent  
**Target:** $5K-$50K/month in automation value

---

## BEFORE YOU START: Core Concepts

### The Problem You're Solving

**Current Reality:**
- You spend 4-6 hours/week on repetitive tasks
- These tasks have clear patterns (lead gen, proposals, reports)
- They could be automated but traditional tools are too rigid
- AI automation is too unreliable for production use

**After 30 Days:**
- 80% of those hours automated
- Workflows improve automatically (self-annealing)
- Reliability: 95%+ (not 50%)
- Time investment: 5-10 hours/month maintenance

### DOE Architecture (Quick Version)

```
DIRECTIVES (What to do)         ← Write as Markdown SOPs
        ↓
ORCHESTRATION (How to coordinate) ← Claude/Gemini does this
        ↓
EXECUTION (How to do it)        ← Agent creates Python scripts
        ↓
RESULT (What you get)           ← Google Sheet, Email, PDF, etc.
        ↓
SELF-ANNEALING (Get better)     ← Agent improves scripts over time
```

---

## WEEK 1: Foundation & Setup (8 hours)

### Day 1-2: Choose Your Task (2 hours)

**Pick ONE task that:**
- Takes 4-6 hours/week
- Has clear inputs and outputs
- Involves research, formatting, or data processing
- You do at least 2x/month

**Examples:**
- Lead generation (scrape + enrich + personalize)
- Proposal writing (take brief → professional PDF)
- Email campaigns (topic → full email sequences)
- Data reports (raw data → formatted analysis)
- Content repurposing (blog post → LinkedIn/Twitter/email)

**Your Task:** ________________ (write it down)

### Day 2-3: Write Your SOP in Markdown (3 hours)

**Create a file:** `directives/your_task_name.md`

**Structure:**
```markdown
# [Task Name] Directive

## Objective
One sentence: What does this task accomplish?

## Success Criteria
- 5-7 measurable outcomes
- Example: "200 leads captured, 90%+ valid emails, all company names casualized"

## Process

### Phase 1: [First major step]
- Detailed substeps
- Tools to use
- Expected output

### Phase 2: [Second major step]
- Detailed substeps
- Tools to use
- Expected output

### Phase 3: [Etc.]

## Quality Gates
What to check? What's acceptable vs. not acceptable?

## Tools & APIs
List what tools/APIs the agent will need access to:
- Apify (scraping)
- Email finder (enrichment)
- Google Sheets (storage)
- Etc.

## Constraints
- Time limit?
- Data sensitivity?
- Privacy concerns?
```

**Example: Lead Generation**

```markdown
# Lead Generation Directive

## Objective
Scrape qualified real estate professionals and enrich with contact info.

## Success Criteria
- 200+ leads captured
- 90%+ valid email addresses
- Casual company names created
- Google Sheet formatted and deliverable

## Process

### Phase 1: Discovery
1. Use Apify to scrape target industry professionals
2. Test with 25 leads first
3. Verify at least 85% match our target market
4. If below 85%, adjust filters and retry (self-annealing)

### Phase 2: Full Scrape
1. Once test confirms quality, scrape full 200 leads
2. Extract: name, company, email, phone (if available)
3. Remove duplicates
4. Remove invalid records

### Phase 3: Enrichment
1. Identify missing emails
2. Use secondary email finder service
3. Target: 95%+ email coverage

### Phase 4: Formatting
1. Create "casual company name" column
   - Example: "The Baliserac Group" → "Baliserac"
   - Used for cold email personalization
2. Remove any remaining invalid data
3. Format as Google Sheet

## Quality Gates
- Email validation (must be proper format)
- Company name validation (must exist)
- No duplicate records
- All required fields populated

## Tools & APIs
- Apify (web scraping platform)
- Anymailfinder API (email enrichment)
- Google Sheets API (delivery format)

## Constraints
- No data older than 30 days
- Respect robots.txt on all domains
- Maximum 500 requests per hour to Apify
```

**Time:** Write clearly. This is your employee's job description.

### Day 3-4: Set Up Your IDE (3 hours)

**Option A: Antigravity (Recommended)**
1. Go to: Google Antigravity (cloud.google.com/agentic)
2. Create new workspace
3. Create folder structure:
   ```
   your-workspace/
   ├── directives/
   │   ├── task1.md
   │   ├── task2.md
   │   └── ...
   ├── execution/
   │   └── (empty for now)
   └── agent.md
   ```

4. Copy your directive file into `directives/`

**Option B: VS Code**
1. Download VS Code (free)
2. Install extensions: Claude, REST Client, Python
3. Create same folder structure locally
4. Open in VS Code

**Create agent.md (System Prompt):**

```markdown
# Your Business AI Agent

You are an autonomous business agent operating under the DOE framework.

## Your Job
Execute business tasks with high reliability and continuous improvement.

## Your Structure

### Directives Folder (/directives/)
Contains SOPs and high-level instructions for tasks.
Read these carefully. They define what you need to do.

### Execution Folder (/execution/)
Contains Python scripts you've created to do tasks.
Use these when appropriate. Improve them when needed.

## Your Process

1. **Read**: User request + relevant directive
2. **Plan**: Create step-by-step action plan
3. **Create**: Write Python scripts as needed (deterministic execution)
4. **Execute**: Run the scripts
5. **Evaluate**: Check results against success criteria
6. **Report**: Deliver formatted results to user
7. **Improve**: If anything failed, create better version of the script

## Important Rules

- Never hallucinate API responses
- Always validate data quality
- If you don't have a script, write one
- If a script fails, improve it (self-annealing)
- Store successful scripts for reuse
- Use Python for all execution scripts
- When in doubt, ask clarifying questions

## You Are an AI Employee

Act like one. Be reliable. Be thorough. Improve continuously.
```

Save this as `agent.md` in your workspace root.

---

## WEEK 2: First Workflow Build (10-15 hours)

### Day 5-6: Initialize & First Conversation (2 hours)

**In Antigravity or VS Code:**

1. Open agent.md in Claude or Gemini
2. Load agent.md (your system prompt)
3. Ask the agent:

```
I'm setting up my first agentic workflow using the DOE framework.

Here's my task:
[Copy your SOP from directives/task_name.md]

Here's my workspace structure:
directives/
├── task_name.md
execution/
(empty)

Please:
1. Acknowledge you understand the task
2. Ask me clarifying questions
3. Create an execution plan with specific Python scripts you'll need
4. List any APIs/tools I need to provide credentials for
```

**Agent will ask:**
- Which APIs can you access?
- What's your authentication?
- Any data sensitivity concerns?
- Etc.

**You answer with:**
- API keys (securely in environment variables)
- Tool access (Apify, Gmail, Sheets, etc.)
- Data constraints

### Day 6-8: Build & Test First Workflow (8-10 hours)

**Agent creates Python scripts for execution folder:**

```python
# Example: scrape_leads.py (agent creates this)
import os
import requests

def scrape_leads_initial():
    """Test scrape 25 leads to verify quality"""
    apify_token = os.getenv("APIFY_TOKEN")
    
    response = requests.post(
        "https://api.apify.com/v2/actor-tasks/YOUR_TASK_ID/runs",
        headers={"Authorization": f"Bearer {apify_token}"},
        json={
            "startUrls": ["realtor.com"],
            "filters": ["realtors", "USA"],
            "maxResults": 25
        }
    )
    
    return response.json().get("data", {}).get("output")
```

**Your job:**
1. Review scripts the agent creates
2. Run them and report results
3. Tell agent: "Success: Got 25 leads, 88% matched criteria"
4. Agent improves as needed (self-annealing)

**Expected iteration:**
- Run 1: "Did this work?"
- Run 2: "Almost, but try using X instead"
- Run 3: "Perfect! Now scale to 200"
- Run 4: "Good, now add enrichment"
- Run 5: "Excellent, done!"

### Day 8-9: Document Success (1 hour)

Create a file: `workflows/task_name_success.md`

```markdown
# Lead Generation Workflow - First Success

## Date: [Date]
## Status: Production Ready

## Inputs
- None (all criteria baked into directive)

## Process
1. Scrape initial 25 leads
2. Verify 85%+ quality
3. If good, scale to 200 leads
4. Enrich emails using secondary source
5. Casualize company names
6. Deliver as Google Sheet

## Outputs
- Google Sheet with 200+ qualified leads
- 95%+ valid emails

## Success Metrics (Actual)
- Leads captured: 200
- Valid emails: 196 (98%)
- Execution time: 12 minutes
- Manual effort required: 0 (fully autonomous)
- Value created: ~6 hours saved = $240 at $40/hr

## Scripts Created
- scrape_leads.py (initial test + full scrape)
- enrich_emails.py (secondary enrichment)
- casualize_names.py (company name formatting)

## Next Improvements
- Add caching to avoid duplicate scrapes
- Implement webhook to auto-deliver to Slack
- Add email verification to improve deliverability
```

---

## WEEK 3: Deployment & Iteration (5-8 hours)

### Day 10-12: Run 3-5 Times & Document (4-6 hours)

**Run your workflow 5 times:**

| Run | Leads | Valid Emails | Issues | Improvements Made |
|-----|-------|-------------|--------|------------------|
| 1 | 178 | 156 (88%) | Casual names inconsistent | Refined naming logic |
| 2 | 200 | 189 (95%) | Some duplicate emails | Added deduplication |
| 3 | 200 | 196 (98%) | None | Stored successful version |
| 4 | 200 | 198 (99%) | None | System improving automatically |
| 5 | 200 | 199 (99.5%) | None | Approaching perfection |

**Watch self-annealing in action:**
- Each run, agent learns from previous mistakes
- Scripts improve automatically
- Success rate climbs from 88% → 99%
- You do zero manual work

### Day 12-14: Measure ROI (2 hours)

**Calculate your value:**

```
Task: Lead Generation

Old Way (Manual)
- Research: 2 hours × $40/hr = $80
- Scraping: 1 hour × $40/hr = $40
- Email enrichment: 1.5 hours × $40/hr = $60
- Formatting/QA: 1 hour × $40/hr = $40
Total: 5.5 hours = $220

New Way (Agentic)
- Setup: $0 (already done)
- Execution: 12 minutes = $8
- Quality: 99% (vs. 85% manual)
Total: $8

Savings per run: $212
Savings per month (4 runs): $848
Savings per year: $10,176

ROI from 15 hours setup: 
$10,176 / 15 hours = $678/hour return

Payback period: ~1 month
```

---

## WEEK 4: Build Second Workflow (8-10 hours)

### Day 15-21: Repeat Process

**Pick task #2** (should be easier now):
1. Write SOP in Markdown
2. Show agent the directive
3. Agent builds scripts
4. Test & iterate
5. Document success

**Second workflow builds 3x faster** because:
- You understand the process
- Agent learned from first workflow
- More confident in the pattern

**Expected outcome:**
- 2 production workflows
- 8-12 hours/week of work automated
- Both self-improving
- Combined ROI: $15K-$25K/year

---

## AFTER MONTH 1: Scale & Monetize

### Months 2-3: Build 3-5 More Workflows

**Topics to automate:**
1. Email sequences (2-3 hours saved/week)
2. Content repurposing (3-4 hours/week)
3. Sales proposals (1-2 hours/week)
4. Data reporting (2-3 hours/week)
5. Customer research (2-3 hours/week)

**By Month 3:**
- 5-8 workflows running
- 20-30 hours/week automated
- Systems improving automatically
- Time investment: 5-10 hours/week

### Month 4+: Monetize (Optional)

**If you want to make money from this:**

**Option 1: Agency Service**
- Offer "AI automation consulting"
- Build workflows for clients
- Charge $2K-$10K per workflow
- Recurring: $297-$997/month per client

**Option 2: Freelance Efficiency**
- Automate your own business
- Do more work in less time
- Increase revenue without hiring

**Option 3: Employee Replacement**
- Replace 2-3 FTEs with workflows
- Redeploy payroll to other areas
- Same output, lower cost

---

## REAL WORKFLOW EXAMPLES (Copy These)

### Workflow Template: Lead Generation

```markdown
# [Your Industry] Lead Generation

## Directive: lead_gen.md
Goal: Scrape [industry] professionals, enrich emails, personalize

## Expected Outcome
- 200 leads
- 95%+ valid emails
- Casual company names
- Time saved: 5-6 hours
- Delivery time: <15 minutes automated
```

### Workflow Template: Proposal Writing

```markdown
# Proposal Generator

## Directive: create_proposal.md
Goal: Sales brief → Professional 3-page proposal → PDF + email

## Expected Outcome
- Professional PDF proposal
- Customized to company context
- Includes ROI calculations
- Time saved: 4-5 hours
- Delivery time: <5 minutes automated
```

### Workflow Template: Email Sequence

```markdown
# Cold Email Sequence Generator

## Directive: email_sequence.md
Goal: Industry + target audience → 5-email sequence

## Expected Outcome
- 5 personalized emails
- Varying CTAs
- Ready to send
- Time saved: 3-4 hours
- Delivery time: <10 minutes automated
```

---

## TROUBLESHOOTING

### Issue: Workflow succeeds sometimes, fails other times

**Cause:** Scripts lack error handling

**Fix:** Ask agent to add try/except blocks
```python
try:
    result = call_api()
except APIError as e:
    log_error(e)
    # Fallback logic
    result = retry_with_backup_api()
```

### Issue: Agent creates overly complex scripts

**Cause:** You didn't constrain the task

**Fix:** Add to directive:
```
## Constraints
- Scripts must be <50 lines
- No external dependencies except [list]
- Must complete in <30 seconds
```

### Issue: Output formatting is inconsistent

**Cause:** No output specification in directive

**Fix:** Add to directive:
```
## Output Format
Deliver as:
- Google Sheet with columns: [list]
- Email to [address]
- JSON file in S3
```

### Issue: Agent keeps using old, broken scripts

**Cause:** Self-annealing not working

**Fix:** Ask agent:
"The previous version of [script] is failing. Create a completely new version from scratch."

---

## SUCCESS METRICS

### By Week 4, You Should Have

✅ 2 working workflows  
✅ 80%+ automation rate on your chosen tasks  
✅ 95%+ success rate (much better than AI alone)  
✅ Clear ROI documented  
✅ Both workflows improving automatically  
✅ Minimal ongoing maintenance (<5 hours/month)

### By Month 3, You Could Have

✅ 5-8 workflows  
✅ 20-30 hours/week automated  
✅ $20K-$40K/year in saved labor  
✅ First customer (if selling)  
✅ $2K-$5K/month side income  

---

## FINAL CHECKLIST

- [ ] Picked your first task
- [ ] Wrote SOP in Markdown (directives/)
- [ ] Set up IDE (Antigravity or VS Code)
- [ ] Created agent.md system prompt
- [ ] First agent conversation
- [ ] Scripts created and tested
- [ ] First successful workflow run
- [ ] Documented ROI
- [ ] Running workflow weekly
- [ ] Iterating based on feedback
- [ ] Planning second workflow

**If you check all boxes above, you've got an agentic automation system running.**

What's next? Keep building.

