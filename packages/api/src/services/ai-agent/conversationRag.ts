import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class ConversationRAG {
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  }

  async storeConversation(question: string, answer: string, category: string) {
    const embedding = await this.generateEmbedding(question);
    return prisma.conversationExample.create({
      data: { question, answer, category, embedding, source: 'user', usageCount: 1 },
    });
  }

  async findSimilar(query: string, limit: number = 5) {
    const queryEmbedding = await this.generateEmbedding(query);
    const examples = await prisma.conversationExample.findMany({ take: 100 });

    const withScores = examples
      .map(ex => ({
        ...ex,
        score: this.cosineSimilarity(queryEmbedding, ex.embedding as number[]),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return withScores;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (!b || b.length === 0) return 0;
    const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dot / (magA * magB);
  }
}
