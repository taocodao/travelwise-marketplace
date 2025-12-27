<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# My Node.js Express server with Puppeteer running on AWS App Runner keeps crashing with "Container exit code: 1" after passing health checks. The pattern:

1. Container starts successfully
2. Health check on port 3005 passes
3. Traffic routes successfully
4. After 2-7 minutes, app crashes with "Container exit code: 1"
5. App Runner restarts it, same cycle repeats

Environment:

- Docker image based on ghcr.io/puppeteer/puppeteer:24.4.0
- Node.js Express server on port 3005
- Puppeteer for web scraping (--no-sandbox, --disable-setuid-sandbox)
- Prisma + PostgreSQL connection to AWS RDS
- 1 vCPU, 4GB memory on App Runner

Already tried:

- Increased memory from 2GB to 4GB
- Added NODE_OPTIONS="--max-old-space-size=1536"

What could cause repeated crashes with exit code 1 after running briefly? How do I debug this in AWS App Runner? Could it be:

- Database connection pool issues?
- Puppeteer browser not closing properly?
- Unhandled promise rejection?
- Something specific to App Runner's containerized environment?

Perfect. Now I have comprehensive research. Let me create a detailed diagnostic guide with code examples.

## Exit Code 1 with Puppeteer on AWS App Runner: Comprehensive Diagnostic Guide

Your symptoms point to **one of three primary culprits** (likely multiple interacting):

1. **Unhandled promise rejections or uncaught exceptions** (most common)
2. **Puppeteer/browser process leaks** (memory/file descriptor exhaustion)
3. **Prisma connection pool exhaustion** combined with event loop blocking

The 2-7 minute window is telling: it suggests requests are slowly accumulating resources that never release.

***

## Immediate Action: Enable Critical Logging

First, add comprehensive error handling that logs to stdout (visible in App Runner logs):

```javascript
// server.js or main.js
const express = require('express');
const app = express();

// CRITICAL: Catch unhandled errors BEFORE they cause exit code 1
process.on('uncaughtException', (error) => {
  console.error('[UNCAUGHT_EXCEPTION]', {
    message: error.message,
    stack: error.stack,
    code: error.code,
    timestamp: new Date().toISOString(),
  });
  // Give App Runner logs time to flush
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED_REJECTION]', {
    reason: reason?.message || String(reason),
    stack: reason?.stack,
    timestamp: new Date().toISOString(),
  });
  // DON'T exit on unhandled rejection - log and continue
});

// Monitor memory pressure
setInterval(() => {
  const mem = process.memoryUsage();
  console.log('[MEMORY_STATUS]', {
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + 'MB',
    rss: Math.round(mem.rss / 1024 / 1024) + 'MB',
    external: Math.round(mem.external / 1024 / 1024) + 'MB',
  });
}, 30000); // Every 30 seconds

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('[SIGTERM_RECEIVED]', {
    timestamp: new Date().toISOString(),
  });
  
  // Close server gracefully
  server.close(() => {
    console.log('[SERVER_CLOSED]', {
      timestamp: new Date().toISOString(),
    });
    // Close database connections
    prisma.$disconnect().then(() => {
      console.log('[PRISMA_DISCONNECTED]');
      process.exit(0);
    }).catch(err => {
      console.error('[PRISMA_DISCONNECT_ERROR]', err);
      process.exit(1);
    });
  });
  
  // Force exit after 25 seconds
  setTimeout(() => {
    console.error('[SIGTERM_TIMEOUT] Forcing exit after 25s');
    process.exit(1);
  }, 25000);
});

// Your Express app...
const server = app.listen(3005, '0.0.0.0', () => {
  console.log('[SERVER_STARTED]', {
    port: 3005,
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});
```


***

## Root Cause \#1: Puppeteer Browser Resource Leaks (Most Likely)

### The Problem

Browsers aren't closing properly, or pages accumulate without cleanup. Each browser instance is 100+ MB of RAM.

### Diagnostic Code

```javascript
// Add this to track browser lifecycle
const puppeteer = require('puppeteer');

let activePages = new Set();
let activeBrowsers = new Set();

// Track every page
const originalNewPage = puppeteer.Browser.prototype.newPage;
puppeteer.Browser.prototype.newPage = async function() {
  const page = await originalNewPage.call(this);
  activePages.add(page);
  console.log('[BROWSER_PAGE_CREATED]', {
    totalPages: activePages.size,
    timestamp: new Date().toISOString(),
  });
  
  page.once('close', () => {
    activePages.delete(page);
    console.log('[BROWSER_PAGE_CLOSED]', {
      remainingPages: activePages.size,
      timestamp: new Date().toISOString(),
    });
  });
  
  return page;
};

// Your scraping endpoint
app.post('/scrape', async (req, res) => {
  const page = await browser.newPage();
  
  try {
    // Set timeout for safety
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    const data = await page.evaluate(() => {
      // Your scraping logic
      return document.title;
    });
    
    res.json(data);
  } catch (error) {
    console.error('[SCRAPE_ERROR]', {
      message: error.message,
      url,
      timestamp: new Date().toISOString(),
    });
    res.status(500).json({ error: error.message });
  } finally {
    // CRITICAL: Always close page
    await page.close().catch(err => {
      console.error('[PAGE_CLOSE_ERROR]', err.message);
    });
  }
});

// Every 60 seconds, log resource status
setInterval(() => {
  console.log('[RESOURCE_STATUS]', {
    activePages: activePages.size,
    activeBrowsers: activeBrowsers.size,
    timestamp: new Date().toISOString(),
  });
}, 60000);
```


### Correct Puppeteer Pattern (Browser Pool)

Instead of launching a new browser per request, use a reusable pool:

```javascript
const puppeteer = require('puppeteer');

class BrowserPool {
  constructor(maxBrowsers = 2) {
    this.maxBrowsers = maxBrowsers;
    this.browsers = [];
    this.busyBrowsers = new Set();
  }

  async initialize() {
    // Pre-allocate browsers
    for (let i = 0; i < this.maxBrowsers; i++) {
      const browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process', // ⚠️ WARNING: Can cause issues, use only for App Runner
        ],
      });
      this.browsers.push(browser);
      console.log('[BROWSER_POOL_INIT]', { 
        poolSize: this.browsers.length 
      });
    }
  }

  async acquire() {
    // Find available browser
    const available = this.browsers.find(b => !this.busyBrowsers.has(b));
    if (available) {
      this.busyBrowsers.add(available);
      return available;
    }

    // Wait for release (max 5 seconds)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Browser pool timeout - all browsers busy'));
      }, 5000);

      const checkInterval = setInterval(() => {
        const free = this.browsers.find(b => !this.busyBrowsers.has(b));
        if (free) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          this.busyBrowsers.add(free);
          resolve(free);
        }
      }, 100);
    });
  }

  release(browser) {
    this.busyBrowsers.delete(browser);
  }

  async closeAll() {
    console.log('[BROWSER_POOL_CLOSING]');
    await Promise.all(
      this.browsers.map(b => 
        b.close().catch(err => 
          console.error('[BROWSER_CLOSE_ERROR]', err.message)
        )
      )
    );
    this.browsers = [];
    this.busyBrowsers.clear();
  }
}

const browserPool = new BrowserPool(2); // 2 browsers max
browserPool.initialize();

app.post('/scrape', async (req, res) => {
  const browser = await browserPool.acquire();
  const page = await browser.newPage();

  try {
    await page.setDefaultNavigationTimeout(30000);
    await page.goto(req.body.url, { waitUntil: 'networkidle2' });
    
    const result = await page.evaluate(() => document.title);
    res.json({ title: result });
  } catch (error) {
    console.error('[SCRAPE_ERROR]', error.message);
    res.status(500).json({ error: error.message });
  } finally {
    // Always cleanup
    await page.close().catch(err => 
      console.error('[PAGE_CLOSE_ERROR]', err.message)
    );
    browserPool.release(browser);
  }
});
```


***

## Root Cause \#2: Prisma Connection Pool Exhaustion

### The Problem

Default Prisma pool is only 5 connections. Your Express server needs proper pool configuration.

### Fix: Update `.env`

```bash
# Add explicit pool sizing
DATABASE_URL="postgresql://user:pass@rds-endpoint:5432/dbname?schema=public&connection_limit=15&pool_timeout=15"
```


### Diagnostic Connection Endpoint

```javascript
app.get('/health/db', async (req, res) => {
  try {
    const result = await prisma.$queryRaw`SELECT 1`;
    res.json({ 
      status: 'ok',
      poolActive: prisma._engine._client?._pool?.activeConnections || 'unknown'
    });
  } catch (error) {
    console.error('[DB_HEALTH_ERROR]', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Also add to main health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[HEALTH_CHECK_FAILED]', error.message);
    res.status(503).json({ error: 'Database unavailable' });
  }
});
```


***

## Root Cause \#3: Event Loop Blocking

### The Problem

Synchronous operations (heavy scraping, large data parsing) block the event loop, making App Runner think the app is dead.

### Detection \& Fix

```javascript
// Install: npm install blocked-at
const blockedAt = require('blocked-at');

// Monitor event loop blocking
blockedAt((time, stack) => {
  if (time > 100) { // Log blocks > 100ms
    console.error('[EVENT_LOOP_BLOCKED]', {
      blockedForMs: time,
      location: stack[^0],
      timestamp: new Date().toISOString(),
    });
  }
});

// For CPU-heavy scraping, use Worker Threads
const { Worker } = require('worker_threads');

async function heavyScraping(html) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./scraper-worker.js');
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker exited with code ${code}`));
      }
    });
    worker.postMessage({ html });
  });
}
```


***

## Docker Configuration Fix

Update your Dockerfile to handle signals properly:

```dockerfile
FROM ghcr.io/puppeteer/puppeteer:24.4.0

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Use dumb-init to properly handle signals
RUN apt-get update && apt-get install -y dumb-init && rm -rf /var/lib/apt/lists/*

EXPOSE 3005

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048"

# dumb-init ensures signals are properly forwarded to Node
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]
```


***

## AWS App Runner Configuration

1. **Increase memory buffer** (already done - good)
2. **Increase timeout**:
    - Set health check timeout to **10 seconds** (default is 3-5)
    - Set health check interval to **15 seconds**
    - Set health check success threshold to **2** (requires 2 consecutive successes)
3. **Enable detailed logging**: Check App Runner service logs in CloudWatch for the actual exit reason

***

## Debugging Checklist

Run these checks in sequence:

```bash
# 1. Check logs for exit reason (this is your #1 priority)
aws apprunner list-services --region us-east-1  # Find service ARN
aws apprunner describe-service --service-arn <ARN> --query 'service.serviceSummary' 

# 2. Check CloudWatch logs for actual error
aws logs tail /aws/apprunner/<service-name>/application.log --follow

# 3. Check container memory limits
# In App Runner console: Settings → Configure → Memory & CPU

# 4. Enable detailed health check logging
```


***

## Most Likely Culprit Summary

**Based on the 2-7 minute window pattern:**

1. \#1 Probability: Puppeteer pages leaking → Each `await browser.newPage()` that doesn't `await page.close()` in finally block
2. \#2 Probability: Prisma pool exhaustion → Connection timeouts after accumulating requests
3. \#3 Probability: Both above + unhandled error → Silent crash on P2024 connection pool error

**Start with the error logging code above**, deploy it, and check CloudWatch logs. The actual error message will tell you exactly what's failing.

Would you like me to help you:

- Set up more detailed monitoring/tracing?
- Create a production-ready Puppeteer manager class?
- Debug the Prisma pool configuration further?
<span style="display:none">[^1][^10][^11][^12][^13][^14][^15][^16][^17][^18][^19][^2][^20][^21][^22][^23][^24][^25][^26][^27][^28][^29][^3][^30][^31][^32][^33][^34][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://stackoverflow.com/questions/74000275/aws-app-runner-health-check-fails-even-though-appropriate-port-is-exposed

[^2]: https://www.reddit.com/r/aws/comments/xz45kg/aws_app_runner_health_check_fails_even_though/

[^3]: https://github.com/puppeteer/puppeteer/issues/9149

[^4]: https://www.youtube.com/watch?v=y5NPElKPKv0

[^5]: https://github.com/aws/apprunner-roadmap/issues/210

[^6]: https://community.n8n.io/t/error-ecs-exit-code-1/29077

[^7]: https://webscraping.ai/faq/puppeteer/how-to-handle-memory-leaks-in-puppeteer

[^8]: https://stackoverflow.com/questions/78922303/how-to-increase-prisma-connection-pool-size-on-a-rds-instance

[^9]: https://docs.aws.amazon.com/apprunner/latest/dg/manage-configure-healthcheck.html

[^10]: https://stackoverflow.com/questions/71972239/how-to-debug-node-process-that-exits-unexpectedly-with-code-1-but-no-apparent-e

[^11]: https://github.com/puppeteer/puppeteer/issues/12186

[^12]: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy-connections.html

[^13]: https://dev.to/mathew/debugging-node-js-applications-running-on-ecs-fargate-56cn

[^14]: https://stackoverflow.com/questions/53939503/puppeteer-doesnt-close-browser

[^15]: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-pool

[^16]: https://komodor.com/learn/how-to-fix-container-terminated-with-exit-code-1/

[^17]: https://www.reddit.com/r/programming/comments/ve7mww/how_to_fix_ramleaking_libraries_like_puppeteer/

[^18]: https://github.com/prisma/prisma/discussions/20537

[^19]: https://betterstack.com/community/guides/scaling-nodejs/nodejs-errors/

[^20]: https://blog.appsignal.com/2023/02/08/puppeteer-in-nodejs-common-mistakes-to-avoid.html

[^21]: https://aws.amazon.com/blogs/containers/graceful-shutdowns-with-ecs/

[^22]: https://stackoverflow.com/questions/54836746/puppeteer-fails-in-docker-container-browser-has-disconnected

[^23]: https://www.techdots.dev/blog/optimizing-node-js-performance-memory-management-event-loop-and-async-best-practices

[^24]: https://aws.amazon.com/blogs/hpc/understanding-the-aws-batch-termination-process/

[^25]: https://www.webshare.io/academy-article/puppeteer-docker

[^26]: https://javascript.plainenglish.io/why-your-node-js-app-is-slower-than-you-think-8da4894df95c

[^27]: https://stackoverflow.com/questions/77526481/what-happens-when-a-net-application-is-scaled-down-in-aws-app-runner

[^28]: https://github.com/puppeteer/puppeteer/issues/10855

[^29]: https://www.reddit.com/r/node/comments/1e28tkm/facing_random_slowdown_of_all_apis_event_loop_is/

[^30]: https://jonbarnett.hashnode.dev/handling-sigterm-in-scalable-microservices

[^31]: https://station.railway.com/questions/puppeteer-crashing-inside-docker-contain-c95f050f

[^32]: https://trigger.dev/blog/event-loop-lag

[^33]: https://aws.amazon.com/about-aws/whats-new/2025/12/amazon-ecs-custom-container-stop-signals-fargate/

[^34]: https://github.com/puppeteer/puppeteer/issues/803

