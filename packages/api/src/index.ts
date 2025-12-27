import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import adminRoutes from './routes/admin';
import marketplaceRoutes from './routes/marketplace';
import paymentsRoutes from './routes/payments';
import agentsRoutes from './routes/agents';
import { errorHandler } from './middleware/errorHandler';
import aiAgentRoutes from './routes/aiAgent.routes';
import erc8004RegistryRoutes from './routes/erc8004-registry';
import apolloMcpRoutes from './routes/apollo-mcp.routes';
import apolloKeysRoutes from './routes/apollo-keys.routes';
import workflowExecutionRoutes from './routes/workflow-execution.routes';
import x402PaymentRoutes from './routes/x402-payment.routes';
import { loadMcpServers } from './mcp-loader';


dotenv.config();

const app: Express = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3006', // MCP Generator Test Hub
    'http://localhost:3001', // Same-origin
  ],
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req: any, res: { json: (arg0: { status: string; timestamp: string; uptime: number; }) => void; }) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Routes
app.use('/api/admin', adminRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/registry', erc8004RegistryRoutes); // ERC-8004 Registry

// Error handling
app.use(errorHandler);


// ... existing code ...

app.use('/api/ai-agent', aiAgentRoutes);

// Apollo MCP Server
app.use('/mcp/apollo', apolloMcpRoutes);

// Apollo API Key Management
app.use('/api/apollo-keys', apolloKeysRoutes);

// Workflow Execution
app.use('/api/workflows', workflowExecutionRoutes);

// X402 Payment System
app.use('/api/x402', x402PaymentRoutes);

// Load Dynamic MCP Servers
loadMcpServers(app);

// Start server
const server = app.listen(PORT, () => {
  console.log(`✅ API Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(async () => {
    await prisma.$disconnect();
    console.log('HTTP server closed');
  });
});

export { app, prisma };
