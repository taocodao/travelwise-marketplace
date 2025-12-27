/**
 * Execution Logger
 * 
 * Automatically logs tool execution results for AI reputation building.
 * No human intervention needed - AI analyzes results to build reputation.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ExecutionLog {
  serverId: string;
  serverName: string;
  toolName: string;
  success: boolean;
  latencyMs: number;
  errorMessage?: string;
  userId?: string;
  query?: string;
}

export class ExecutionLogger {
  /**
   * Log a tool execution for AI analysis
   */
  async logExecution(log: ExecutionLog): Promise<void> {
    try {
      // Store execution in database for AI analysis
      await prisma.$executeRaw`
        INSERT INTO tool_execution_logs (
          id, server_id, server_name, tool_name, success, latency_ms, 
          error_message, user_id, query, created_at
        )
        VALUES (
          gen_random_uuid(), ${log.serverId}, ${log.serverName}, ${log.toolName},
          ${log.success}, ${log.latencyMs}, ${log.errorMessage || null},
          ${log.userId || null}, ${log.query || null}, NOW()
        )
      `.catch(() => {
        // Table might not exist, use fallback in-memory storage
        this.logToMemory(log);
      });

      console.log(`📊 Logged: ${log.serverName}.${log.toolName} - ${log.success ? '✅' : '❌'} (${log.latencyMs}ms)`);
    } catch (error) {
      // Silently fail - don't break execution for logging
      this.logToMemory(log);
    }
  }

  // In-memory fallback when database isn't available
  private executionCache: ExecutionLog[] = [];
  
  private logToMemory(log: ExecutionLog): void {
    this.executionCache.push(log);
    // Keep last 1000 logs
    if (this.executionCache.length > 1000) {
      this.executionCache = this.executionCache.slice(-1000);
    }
  }

  /**
   * Get execution stats for a server (used by AI for reviews)
   */
  async getServerStats(serverIdOrName: string): Promise<{
    totalCalls: number;
    successRate: number;
    avgLatency: number;
    errorRate: number;
    recentErrors: string[];
  }> {
    try {
      // Try database first
      const stats = await prisma.$queryRaw<any[]>`
        SELECT 
          COUNT(*) as total_calls,
          AVG(CASE WHEN success THEN 1 ELSE 0 END) as success_rate,
          AVG(latency_ms) as avg_latency,
          AVG(CASE WHEN NOT success THEN 1 ELSE 0 END) as error_rate
        FROM tool_execution_logs
        WHERE server_id = ${serverIdOrName} OR server_name = ${serverIdOrName}
        AND created_at > NOW() - INTERVAL '7 days'
      `.catch(() => null);

      if (stats && stats.length > 0) {
        const s = stats[0];
        return {
          totalCalls: parseInt(s.total_calls) || 0,
          successRate: parseFloat(s.success_rate) || 0,
          avgLatency: Math.round(parseFloat(s.avg_latency) || 0),
          errorRate: parseFloat(s.error_rate) || 0,
          recentErrors: [],
        };
      }
    } catch (error) {
      // Fall through to cache
    }

    // Use in-memory cache
    const serverLogs = this.executionCache.filter(
      l => l.serverId === serverIdOrName || l.serverName === serverIdOrName
    );
    
    const totalCalls = serverLogs.length;
    const successCount = serverLogs.filter(l => l.success).length;
    const totalLatency = serverLogs.reduce((sum, l) => sum + l.latencyMs, 0);
    const errors = serverLogs.filter(l => !l.success).map(l => l.errorMessage || 'Unknown error');

    return {
      totalCalls,
      successRate: totalCalls > 0 ? successCount / totalCalls : 1,
      avgLatency: totalCalls > 0 ? Math.round(totalLatency / totalCalls) : 0,
      errorRate: totalCalls > 0 ? 1 - (successCount / totalCalls) : 0,
      recentErrors: errors.slice(-5),
    };
  }
}

export const executionLogger = new ExecutionLogger();
