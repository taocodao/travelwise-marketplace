import * as fs from 'fs-extra';
import * as path from 'path';
import SwaggerParser from '@apidevtools/swagger-parser';
import { OpenAPIV3 } from 'openapi-types';

export interface GeneratorOptions {
  specUrl: string;
  serverName: string; // e.g. "petstore"
  outputDir: string;
}

export class MCPGenerator {
  private spec: OpenAPIV3.Document | null = null;

  async generate(options: GeneratorOptions): Promise<{ success: boolean; message: string; path?: string }> {
    try {
      console.log(`Fetching and parsing spec from ${options.specUrl}...`);
      // Dereference the spec to resolve $refs
      const api = await SwaggerParser.dereference(options.specUrl) as OpenAPIV3.Document;
      this.spec = api;

      const serverDir = path.join(options.outputDir, options.serverName);
      
      // 1. Create directory structure
      await fs.ensureDir(path.join(serverDir, 'src'));

      // 2. Generate package.json
      await this.generatePackageJson(serverDir, options.serverName);

      // 3. Generate tsconfig.json
      await this.generateTsConfig(serverDir);

      // 4. Generate source code
      await this.generateSourceCode(serverDir, options.serverName);

      return {
        success: true,
        message: `Successfully generated MCP server '${options.serverName}' at ${serverDir}`,
        path: serverDir
      };
    } catch (error: any) {
      console.error('Generation failed:', error);
      return {
        success: false,
        message: `Generation failed: ${error.message}`
      };
    }
  }

  private async generatePackageJson(dir: string, name: string) {
    const pkg = {
      name: `@travelwise-mcp/${name}`,
      version: "1.0.0",
      main: "dist/index.js",
      scripts: {
        "build": "tsc",
        "start": "node dist/index.js",
        "dev": "tsx src/index.ts"
      },
      dependencies: {
        "axios": "^1.6.0",
        "dotenv": "^16.3.1",
        "express": "^4.18.2"
      },
      devDependencies: {
        "@types/express": "^4.17.21",
        "@types/node": "^20.11.0",
        "tsx": "^4.7.0",
        "typescript": "^5.3.3"
      }
    };
    await fs.writeJSON(path.join(dir, 'package.json'), pkg, { spaces: 2 });
  }

  private async generateTsConfig(dir: string) {
    const tsconfig = {
      compilerOptions: {
        target: "ES2020",
        module: "CommonJS",
        outDir: "./dist",
        rootDir: "./src",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true
      },
      include: ["src/**/*"],
      exclude: ["node_modules"]
    };
    await fs.writeJSON(path.join(dir, 'tsconfig.json'), tsconfig, { spaces: 2 });
  }

  private async generateSourceCode(dir: string, serverName: string) {
    if (!this.spec) return;

    const tools = this.extractTools();
    const imports = `import express, { Request, Response } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();
`;

    const classDef = `
class ${this.pascalCase(serverName)}MCPServer {
  private app: express.Application;
  private port: number;
  private baseUrl: string = '${this.getBaseUrl()}';

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3000');
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(express.json());
  }

  private setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', service: '${serverName} MCP', version: '1.0.0' });
    });

    // List tools
    this.app.get('/tools', (req, res) => {
      res.json({
        tools: ${JSON.stringify(tools.map(t => t.metadata), null, 10)}
      });
    });

${tools.map(tool => this.generateToolRoute(tool)).join('\n')}
  }

  public start() {
    this.app.listen(this.port, () => {
      console.log(\`✅ ${serverName} MCP Server running on port \${this.port}\`);
    });
  }
}

const server = new ${this.pascalCase(serverName)}MCPServer();
server.start();
`;

    await fs.writeFile(path.join(dir, 'src/index.ts'), imports + classDef);
  }

  private getBaseUrl(): string {
    if (this.spec?.servers && this.spec.servers.length > 0) {
      return this.spec.servers[0].url;
    }
    return '';
  }

  private extractTools(): any[] {
    const tools: any[] = [];
    if (!this.spec || !this.spec.paths) return tools;

    for (const [pathStr, pathItem] of Object.entries(this.spec.paths)) {
      if (!pathItem) continue;
      
      const methods = ['get', 'post', 'put', 'delete', 'patch'] as const;
      
      for (const method of methods) {
        const op = (pathItem as any)[method] as OpenAPIV3.OperationObject;
        if (op) {
          const toolName = op.operationId || `${method}_${pathStr.replace(/[^a-zA-Z0-9]/g, '_')}`;
          
          const inputSchema = this.generateInputSchema(op);
          
          tools.push({
            metadata: {
              name: toolName,
              description: op.summary || op.description || `Call ${method.toUpperCase()} ${pathStr}`,
              baseCost: 0.01, // Default cost
              inputSchema
            },
            method,
            path: pathStr,
            toolName
          });
        }
      }
    }
    return tools;
  }

  private generateInputSchema(op: OpenAPIV3.OperationObject): any {
    const schema: any = {
      type: 'object',
      properties: {},
      required: []
    };

    // Handle parameters (query, path, header)
    if (op.parameters) {
      for (const param of op.parameters as OpenAPIV3.ParameterObject[]) {
        if (param.in === 'body') continue; // OpenAPI 2 specific, mostly handled in requestBody for V3
        
        schema.properties[param.name] = {
          type: (param.schema as OpenAPIV3.SchemaObject)?.type || 'string',
          description: param.description
        };
        if (param.required) {
          schema.required.push(param.name);
        }
      }
    }

    // Handle requestBody
    if (op.requestBody) {
       const body = op.requestBody as OpenAPIV3.RequestBodyObject;
       const content = body.content['application/json'];
       if (content && content.schema) {
         const bodySchema = content.schema as OpenAPIV3.SchemaObject;
         // Merge properties
         if (bodySchema.properties) {
           Object.assign(schema.properties, bodySchema.properties);
         }
         if (bodySchema.required) {
           schema.required.push(...bodySchema.required);
         }
       }
    }

    return schema;
  }

  private generateToolRoute(tool: any): string {
    return `    // Tool: ${tool.metadata.name}
    this.app.post('/tools/${tool.metadata.name}', async (req: Request, res: Response) => {
      try {
        const args = req.body;
        
        // Construct URL with path params
        let url = \`\${this.baseUrl}${tool.path}\`;
        ${this.generateUrlReplacementCode(tool.path)}

        const response = await axios({
          method: '${tool.method}',
          url,
          ${tool.method === 'get' ? 'params: args,' : 'data: args,'}
        });

        res.json({
          success: true,
          tool: '${tool.metadata.name}',
          data: response.data
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: error.message,
          details: error.response?.data
        });
      }
    });`;
  }

  private generateUrlReplacementCode(pathStr: string): string {
    // pathStr might be /pets/{petId}
    // We need to replace {petId} with args.petId
    // And remove it from args so it's not sent in query/body again (optional optimization)
    
    // Regex to find {param}
    const matches = pathStr.match(/{([^}]+)}/g);
    if (!matches) return '';

    return matches.map(match => {
      const paramName = match.replace(/[{}]/g, '');
      return `
        url = url.replace('${match}', args['${paramName}']);
        // delete args['${paramName}']; // Clean up
      `;
    }).join('\n');
  }

  private pascalCase(str: string): string {
    return str.replace(/(^|_)(\w)/g, (_all, _sep, char) => char.toUpperCase());
  }
}
