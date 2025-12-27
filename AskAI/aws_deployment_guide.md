# Node.js Express + Puppeteer + Prisma + PostgreSQL on AWS: Deployment Guide 2024

**Last Updated:** December 2024 | **AWS Region:** US East (N. Virginia)

---

## Executive Summary

For your tech stack (Express + Puppeteer + Prisma + PostgreSQL), **Elastic Beanstalk is the recommended choice** for most scenarios, followed by **ECS Fargate** for microservices needs. Plain EC2 is not recommended without additional orchestration due to operational overhead.

**With $5,000 AWS credits**, you can run a production-ready system for 6–12 months depending on configuration and traffic patterns.

---

## 1. Architecture Comparison: EC2 vs Fargate vs Elastic Beanstalk

### Feature Comparison Matrix

| Feature | EC2 | ECS Fargate | Elastic Beanstalk |
|---------|-----|-------------|-------------------|
| **Setup Complexity** | High (manual) | Medium (Docker) | Low (upload & go) |
| **Auto-scaling** | Manual or ASG | Yes, built-in | Yes, built-in |
| **Puppeteer Support** | ✅ Excellent | ✅ Good (headless mode) | ✅ Good |
| **Database Connection** | ✅ Direct | ✅ VPC networking | ✅ Built-in |
| **SSL/HTTPS** | Manual cert + nginx | Via ALB + ACM | ALB + free ACM |
| **DevOps Effort** | High (ongoing) | Medium (CI/CD) | Low (automated) |
| **Cost Efficiency** | Best for persistent load | Good for variable load | Medium |
| **Monitoring** | CloudWatch manual | CloudWatch built-in | CloudWatch built-in |
| **Load Balancer Cost** | Separate ($15–20/mo) | Included | Included |

---

## 2. Detailed Cost Analysis ($5,000 Budget Breakdown)

### A. Elastic Beanstalk (Recommended)

**Minimal Production Setup:**

```
EC2 Instance:       t3.small (2 vCPU, 2 GB RAM)       $17.93/mo
EBS Storage:        30 GB (gp3)                       $2.40/mo
RDS PostgreSQL:     db.t3.micro (1 vCPU, 1 GB)      $11.50/mo
RDS Storage:        100 GB                            $10.00/mo
ALB (load balancer): Built-in                         $16.20/mo
ACM SSL Certificate: Free
Data Transfer:      First 1 GB free, then $0.09/GB    ~$5.00/mo (estimate)
CloudWatch Logs:    Minimal                           ~$1.00/mo
────────────────────────────────────────────────────
TOTAL MONTHLY:      ~$63.03
12-MONTH COST:      ~$756.36
REMAINING CREDITS:  $4,243.64 (for traffic spikes, overages)
```

**Scaling Setup (for higher traffic):**

```
EC2 Instance:       t3.medium (2 vCPU, 4 GB RAM) x 2–4   $33.44/mo (base)
  + ASG scaling up to 4 instances during peak
RDS PostgreSQL:     db.t3.small (2 vCPU, 2 GB)          $23.04/mo
RDS Storage:        500 GB                              $50.00/mo
ALB + CloudWatch:                                       $21.20/mo
Data Transfer:      Assume 5 TB/month (heavy usage)     $450.00/mo
────────────────────────────────────────────────────
PEAK MONTHLY:       ~$577.68
AVERAGE MONTHLY:    ~$200–350/mo
12-MONTH COST:      ~$2,400–4,200/mo
```

---

### B. ECS Fargate (Good for microservices, variable load)

**Configuration: 1 vCPU + 2 GB RAM task:**

```
Compute (1 vCPU):   $0.04048 × 730 hours            $29.55/mo
Memory (2 GB):      $0.004445 × 730 hours           $3.24/mo
Task Storage:       20 GB ephemeral                 ~$1.46/mo
RDS PostgreSQL:     db.t3.micro                    $11.50/mo
RDS Storage:        100 GB                         $10.00/mo
ALB (required):     For load balancing             $16.20/mo
CloudWatch Logs:                                   ~$2.00/mo
Data Transfer:      First 1 GB free                ~$5.00/mo
────────────────────────────────────────────────────
TOTAL MONTHLY:      ~$79.00
12-MONTH COST:      ~$948.00
REMAINING CREDITS:  $4,052.00
```

**Scaling with 5 concurrent tasks:**

```
Compute (5 tasks):  5 × $0.04048 × 730              $147.76/mo
Memory (10 GB):     10 × $0.004445 × 730            $32.41/mo
RDS PostgreSQL:     db.t3.small (2 vCPU)           $23.04/mo
RDS Storage:        500 GB                         $50.00/mo
ALB + networking:                                  $16.20/mo
Data Transfer (5TB):                               $450.00/mo
────────────────────────────────────────────────────
PEAK MONTHLY:       ~$719.41
AVERAGE (2–3 tasks): ~$250–350/mo
```

---

### C. Raw EC2 (NOT recommended—high operational burden)

**Minimal setup:**

```
EC2 Instance:       t3.small                       $17.93/mo
Elastic IP:         1 static IP                     $3.60/mo (2024 pricing)
EBS Storage:        50 GB (gp3)                     $4.00/mo
RDS PostgreSQL:     db.t3.micro                    $11.50/mo
RDS Storage:        100 GB                         $10.00/mo
Security groups/VPC: Free                          $0.00
Manual SSL cert:    Let's Encrypt (free)           $0.00
CloudWatch Logs:    Minimal                        ~$1.00/mo
────────────────────────────────────────────────────
TOTAL MONTHLY:      ~$48.03
12-MONTH COST:      ~$576.36
```

**BUT: No load balancing, no auto-scaling, manual patching, no HTTPS termination. Operational cost is high.**

---

## 3. Puppeteer-Specific Deployment Considerations

### Memory Requirements

```javascript
// Standard Puppeteer configuration for headless AWS environments
const browser = await puppeteer.launch({
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',  // Critical for AWS to avoid /dev/shm limits
    '--single-process'           // Optional: trade memory for stability in containers
  ]
});
```

### Minimum Instance Sizes

| Workload | Recommended | Min Memory | Reason |
|----------|-------------|-----------|---------|
| Light (< 10 pages/min) | t3.small | 2 GB | Single Puppeteer instance |
| Medium (10–50 pages/min) | t3.medium | 4 GB | Multiple concurrent browsers |
| Heavy (50–200 pages/min) | t3.large | 8 GB | Heavy caching + concurrent |
| Auto-scaling needed? | t3.medium + ASG | 4 GB | Peak load handling |

**Note:** Puppeteer + Chromium = ~250–400 MB per browser instance. With Node overhead, minimum 2 GB RAM.

---

## 4. Elastic Beanstalk: Step-by-Step Setup

### Prerequisites

```bash
# Install AWS CLI and EB CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install

npm install -g @aws-amplify/cli
# For Elastic Beanstalk:
pip install awsebcli --upgrade --user
```

### Step 1: Initialize Beanstalk Environment

```bash
# Create project directory
mkdir my-express-app && cd my-express-app

# Initialize EB (creates .ebextensions/)
eb init -p "Node.js 22 running on 64bit Amazon Linux 2023" --region us-east-1

# Set environment name
eb create production-env --instance-type t3.small --envvars NODE_ENV=production
```

### Step 2: Application Code Setup

**`package.json`:**

```json
{
  "name": "express-puppeteer-app",
  "version": "1.0.0",
  "description": "Node.js + Puppeteer + Prisma on AWS",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "puppeteer": "^21.1.1",
    "@prisma/client": "^5.4.1",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "prisma": "^5.4.1"
  }
}
```

**`server.js`:**

```javascript
const express = require('express');
const puppeteer = require('puppeteer');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
let browser;

// Initialize Puppeteer on startup
(async () => {
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    console.log('Puppeteer initialized');
  } catch (error) {
    console.error('Failed to initialize Puppeteer:', error);
    process.exit(1);
  }
})();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Example: Screenshot endpoint
app.get('/screenshot', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL required' });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    const screenshot = await page.screenshot({ encoding: 'base64' });
    
    // Store in database via Prisma
    await prisma.screenshot.create({
      data: {
        url,
        timestamp: new Date(),
        data: screenshot
      }
    });

    await page.close();
    res.json({ message: 'Screenshot captured', screenshot });
  } catch (error) {
    console.error('Screenshot error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing browser...');
  if (browser) await browser.close();
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(process.env.PORT || 8081, () => {
  console.log(`Server running on port ${process.env.PORT || 8081}`);
});
```

### Step 3: Database Configuration

**`.env` (local):**

```env
DATABASE_URL="postgresql://username:password@your-rds-endpoint:5432/dbname?sslmode=no-verify&schema=public"
NODE_ENV=production
```

**`.ebextensions/database.config`:**

```yaml
option_settings:
  aws:elasticbeanstalk:application:environment:
    DATABASE_URL: !Sub "postgresql://${RDSUser}:${RDSPass}@${RDSEndpoint}:5432/${RDSDbName}?sslmode=no-verify&schema=public"
    NODE_ENV: production

Resources:
  RDSDatabase:
    Type: AWS::RDS::DBInstance
    Properties:
      DBInstanceIdentifier: express-puppeteer-db
      Engine: postgres
      DBInstanceClass: db.t3.micro
      AllocatedStorage: '100'
      StorageType: gp3
      MasterUsername: postgres
      MasterUserPassword: !Ref RDSPassword
      VPCSecurityGroups:
        - !Ref RDSSecurityGroup
      AvailabilityZone: us-east-1a
      BackupRetentionPeriod: 7
      PubliclyAccessible: false
```

### Step 4: Puppeteer Configuration in Beanstalk

**`.ebextensions/puppeteer.config`:**

```yaml
commands:
  01_install_chromium_deps:
    command: |
      yum install -y chromium fontconfig fonts-liberation xorg-x11-fonts-100dpi xorg-x11-fonts-75dpi xorg-x11-utils xorg-x11-font-utils libxss1 libnss3 libappindicator1 libindicator7

option_settings:
  aws:elasticbeanstalk:container:nodejs:
    ProxyServer: nginx
    GzipCompression: true

  aws:autoscaling:launchconfiguration:
    RootVolumeType: gp3
    RootVolumeSize: '30'
    RootVolumeThroughput: '125'
    RootVolumeIops: '3000'
```

### Step 5: Auto-Scaling Configuration

**`.ebextensions/autoscaling.config`:**

```yaml
option_settings:
  aws:autoscaling:asg:
    MinSize: 1
    MaxSize: 4
    HealthCheckType: ELB
    HealthCheckGracePeriod: 300

  aws:autoscaling:trigger:
    MeasureName: CPUUtilization
    Statistic: Average
    Unit: Percent
    UpperThreshold: 70
    UpperBreachScaleIncrement: 1
    LowerThreshold: 30
    LowerBreachScaleIncrement: -1
    BreachDuration: 300  # 5 minutes
```

### Step 6: SSL/HTTPS Setup with ACM

**`.ebextensions/https.config`:**

```yaml
option_settings:
  aws:elasticbeanstalk:environment:process:default:
    HealthCheckPath: /health
    HealthyThresholdCount: 3
    Port: 80
    Protocol: HTTP

  aws:elbv2:listener:default:
    Protocol: HTTP

  aws:elbv2:listener:443:
    Protocol: HTTPS
    SSLPolicy: ELBSecurityPolicy-TLS-1-2-2017-01
    SSLCertificateArns: !Ref SSLCertificateArn

commands:
  01_request_acm_certificate:
    command: |
      aws acm request-certificate \
        --domain-name yourdomain.com \
        --subject-alternative-names www.yourdomain.com \
        --validation-method DNS \
        --region us-east-1
```

**Manual SSL via AWS Console:**

1. Go to AWS Certificate Manager (ACM)
2. Click "Request certificate"
3. Enter your domain (e.g., `yourdomain.com`)
4. Select DNS validation
5. Add CNAME record to your DNS provider
6. Copy ARN from ACM
7. In Elastic Beanstalk → Configuration → Load Balancer → Add HTTPS listener
8. Paste ACM certificate ARN
9. Deploy

---

## 5. ECS Fargate: Step-by-Step Setup

### Step 1: Create Docker Image

**`Dockerfile`:**

```dockerfile
FROM node:18-slim

# Install Chromium dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-l10n \
    fonts-liberation \
    libappindicator1 \
    libnss3 \
    libxss1 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install --production

# Copy application
COPY . .

# Prisma setup
RUN npx prisma generate

EXPOSE 8081

CMD ["node", "server.js"]
```

**`.dockerignore`:**

```
node_modules
.env
.env.local
.git
.gitignore
npm-debug.log
dist
build
```

### Step 2: Push to ECR

```bash
# Create ECR repository
aws ecr create-repository \
  --repository-name express-puppeteer-app \
  --region us-east-1

# Build and push
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com

docker build -t express-puppeteer-app:latest .

docker tag express-puppeteer-app:latest \
  123456789.dkr.ecr.us-east-1.amazonaws.com/express-puppeteer-app:latest

docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/express-puppeteer-app:latest
```

### Step 3: Create ECS Task Definition

**`task-definition.json`:**

```json
{
  "family": "express-puppeteer-task",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "containerDefinitions": [
    {
      "name": "express-app",
      "image": "123456789.dkr.ecr.us-east-1.amazonaws.com/express-puppeteer-app:latest",
      "portMappings": [
        {
          "containerPort": 8081,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:rds-postgres-url"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/express-puppeteer",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ],
  "executionRoleArn": "arn:aws:iam::123456789:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::123456789:role/ecsTaskRole"
}
```

### Step 4: Create ECS Cluster & Service

```bash
# Create cluster
aws ecs create-cluster --cluster-name production-cluster --region us-east-1

# Register task definition
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json \
  --region us-east-1

# Create service with load balancer
aws ecs create-service \
  --cluster production-cluster \
  --service-name express-puppeteer-service \
  --task-definition express-puppeteer-task \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-12345],securityGroups=[sg-12345],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:us-east-1:123456789:targetgroup/express-tg,containerName=express-app,containerPort=8081" \
  --region us-east-1
```

### Step 5: Auto-Scaling (ECS)

```bash
# Register scalable target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/production-cluster/express-puppeteer-service \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 \
  --max-capacity 6 \
  --region us-east-1

# Create scaling policy (CPU-based)
aws application-autoscaling put-scaling-policy \
  --policy-name cpu-scaling \
  --service-namespace ecs \
  --resource-id service/production-cluster/express-puppeteer-service \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration "TargetValue=70.0,PredefinedMetricSpecification={PredefinedMetricType=ECSServiceAverageCPUUtilization}"
```

---

## 6. Raw EC2 Setup (Only if necessary)

### Step 1: Launch Instance

```bash
aws ec2 run-instances \
  --image-id ami-0c02fb55956c7d316 \
  --instance-type t3.small \
  --key-name my-key-pair \
  --security-group-ids sg-12345 \
  --subnet-id subnet-12345 \
  --region us-east-1
```

### Step 2: SSH & Install Dependencies

```bash
ssh -i my-key-pair.pem ec2-user@your-ec2-ip

# Update system
sudo yum update -y

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo yum install -y nodejs

# Install Puppeteer dependencies
sudo yum install -y chromium fontconfig

# Clone repo and install
git clone https://github.com/yourrepo/express-app.git
cd express-app
npm install
npx prisma migrate deploy

# Use PM2 for process management
npm install -g pm2
pm2 start server.js --name "express-app"
pm2 startup
pm2 save
```

### Step 3: Nginx Reverse Proxy + SSL

```bash
sudo yum install -y nginx

# Create /etc/nginx/conf.d/express.conf
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Test and restart
sudo nginx -t
sudo systemctl restart nginx

# Install Let's Encrypt SSL
sudo yum install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 7. PostgreSQL + Prisma Configuration

### RDS Setup via AWS Console

1. **Create RDS Instance:**
   - Engine: PostgreSQL 16
   - Instance class: db.t3.micro (start) or db.t3.small (production)
   - Storage: 100 GB (gp3)
   - Multi-AZ: No (for dev), Yes (for production)
   - Backup retention: 7 days

2. **Security Group:**
   ```bash
   # Allow port 5432 from application security group
   aws ec2 authorize-security-group-ingress \
     --group-id sg-rds-12345 \
     --protocol tcp \
     --port 5432 \
     --source-security-group-id sg-app-12345
   ```

### Prisma Schema

**`prisma/schema.prisma`:**

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Screenshot {
  id        Int     @id @default(autoincrement())
  url       String
  timestamp DateTime @default(now())
  data      String  @db.Text
  status    String  @default("success")
}

model CrawlJob {
  id        Int     @id @default(autoincrement())
  url       String  @unique
  status    String  @default("pending")
  result    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Prisma Migrations

```bash
# Generate migration
npx prisma migrate dev --name init

# Deploy to production
npx prisma migrate deploy

# View database
npx prisma studio
```

---

## 8. Monitoring, Logging & Alerts

### CloudWatch Setup

**`server.js` logging:**

```javascript
const winston = require('winston');
const WinstonCloudWatch = require('winston-cloudwatch');

const logger = winston.createLogger({
  transports: [
    new winston.transports.Console(),
    new WinstonCloudWatch({
      logGroupName: '/aws/elasticbeanstalk/express-puppeteer',
      logStreamName: `${process.env.HOSTNAME}`,
      awsRegion: 'us-east-1',
      messageFormatter: ({level, message, meta}) => `[${level}] ${message}`
    })
  ]
});

logger.info('Application started');
```

### Alarms

```bash
# CPU utilization
aws cloudwatch put-metric-alarm \
  --alarm-name high-cpu \
  --alarm-description "Alert if CPU > 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2

# RDS connections
aws cloudwatch put-metric-alarm \
  --alarm-name high-db-connections \
  --metric-name DatabaseConnections \
  --namespace AWS/RDS \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold
```

---

## 9. Cost Optimization Tips

### For Elastic Beanstalk:

1. **Use Spot Instances (40–70% savings):**
   ```yaml
   # In .ebextensions/autoscaling.config
   aws:ec2:instances:
     InstanceTypes: t3.small, t3.medium, t2.small
   aws:ec2:instances:
     SpotFleetOnDemandAboveBasePercentage: 20  # 80% Spot, 20% On-Demand
   ```

2. **Reserved Instances (30–40% savings):**
   - 1-year: $106/year (vs $215 on-demand) for t3.small
   - 3-year: $60/year

3. **Right-size instances:** Start with t3.small, monitor, scale up only if needed

4. **RDS optimization:**
   - Use db.t4g (Graviton, cheaper) instead of t3
   - Enable Storage Auto-scaling (no manual resizing)
   - 7-day backups (not 30)

### For Fargate:

1. **Use Fargate Spot (70% cheaper):**
   - ECS task definition: `"launchType": "FARGATE_SPOT"`
   - Trade-off: 2-minute interruption warning

2. **Right-size vCPU + memory:**
   - Monitor actual usage, don't over-provision
   - Use CloudWatch insights

3. **Consolidate tasks:** Run multiple services in one task definition where possible

---

## 10. Recommendation & Final Verdict

| Use Case | Recommendation | Monthly Cost |
|----------|---|---|
| Simple API, low traffic | **Elastic Beanstalk (t3.small)** | ~$63–150 |
| Growing app, variable load | **Elastic Beanstalk (t3.medium + ASG)** | ~$200–350 |
| Microservices, serverless-first | **ECS Fargate** | ~$79–250 |
| Learning/prototyping | **Elastic Beanstalk (single instance)** | ~$50–75 |
| Cost-sensitive, steady load | **Raw EC2 (manual)** | ~$48 (but high DevOps cost) |

### Best Choice for Your Stack:

**→ ELASTIC BEANSTALK with t3.small + Auto Scaling**

**Why:**
- ✅ Puppeteer works perfectly (headless mode, sandbox disabled in config)
- ✅ Zero DevOps: manage scaling, monitoring, SSL automatically
- ✅ Cheapest with production features
- ✅ 10-minute deployment from code → running
- ✅ RDS integration seamless
- ✅ Free ACM SSL certificate
- ✅ Easy to migrate to ECS later if microservices needed

**With $5,000 credits:** You get 6–8 months of free production hosting. After credits expire, ongoing cost is ~$700–900/year for light usage.

---

## 11. Quick Start Command Reference

```bash
# Elastic Beanstalk one-liner (after setup)
eb init -p "Node.js 22" && eb create prod && eb deploy

# ECS Fargate one-liner
aws ecs create-service --cluster prod --service-name app --task-definition app:1 --launch-type FARGATE --desired-count 2

# EC2 + RDS one-liner (manual)
aws ec2 run-instances --image-id ami-xyz --instance-type t3.small
aws rds create-db-instance --engine postgres --db-instance-class db.t3.micro
```

---

**Last Tested:** December 2024  
**Pricing Last Updated:** December 24, 2025  
**Node.js:** v22.x | **Puppeteer:** v21.x | **Prisma:** v5.x