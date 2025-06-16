#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DataForSEOClient, DataForSEOConfig } from './client/dataforseo.client.js';
import { SerpApiModule } from './modules/serp/serp-api.module.js';
import { KeywordsDataApiModule } from './modules/keywords-data/keywords-data-api.module.js';
import { OnPageApiModule } from './modules/onpage/onpage-api.module.js';
import { DataForSEOLabsApi } from './modules/dataforseo-labs/dataforseo-labs-api.module.js';
import { EnabledModulesSchema, isModuleEnabled, defaultEnabledModules } from './config/modules.config.js';
import { BaseModule, ToolDefinition } from './modules/base.module.js';
import { z } from 'zod';
import { BacklinksApiModule } from "./modules/backlinks/backlinks-api.module.js";
import { BusinessDataApiModule } from "./modules/business-data-api/business-data-api.module.js";
import { DomainAnalyticsApiModule } from "./modules/domain-analytics/domain-analytics-api.module.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { Request as ExpressRequest, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { GetPromptResult, isInitializeRequest, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js"
import { name, version } from './utils/version.js';

// Extended request interface to include auth properties
interface Request extends ExpressRequest {
  username?: string;
  password?: string;
}

console.error('Starting DataForSEO MCP Server...');

function getServer(username: string | undefined, password: string | undefined) : McpServer
{
  const server = new McpServer({
    name,
    version,
  },{ capabilities: { logging: {}} });
   // Register a simple prompt
   server.prompt(
    'greeting-template',
    'A simple greeting prompt template',
    {
      name: z.string().describe('Name to include in greeting'),
    },
    async ({ name }): Promise<any> => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please greet ${name} in a friendly manner.`,
            },
          },
        ],
      };
    }
  );
  // Initialize DataForSEO client
  const dataForSEOConfig: DataForSEOConfig = {
    username: username || "",
    password: password || "",
  };
  
  const dataForSEOClient = new DataForSEOClient(dataForSEOConfig);
  console.error('DataForSEO client initialized');
  
  // Parse enabled modules from environment
  const enabledModules = EnabledModulesSchema.parse(process.env.ENABLED_MODULES);
  
  // Initialize modules
  const modules: BaseModule[] = [];
  
  if (isModuleEnabled('SERP', enabledModules)) {
    modules.push(new SerpApiModule(dataForSEOClient));
  }
  if (isModuleEnabled('KEYWORDS_DATA', enabledModules)) {
    modules.push(new KeywordsDataApiModule(dataForSEOClient));
  }
  if (isModuleEnabled('ONPAGE', enabledModules)) {
    modules.push(new OnPageApiModule(dataForSEOClient));
  }
  if (isModuleEnabled('DATAFORSEO_LABS', enabledModules)) {
    modules.push(new DataForSEOLabsApi(dataForSEOClient));
  }
  if (isModuleEnabled('BACKLINKS', enabledModules)) {
    modules.push(new BacklinksApiModule(dataForSEOClient));
  }
  if (isModuleEnabled('BUSINESS_DATA', enabledModules)) {
    modules.push(new BusinessDataApiModule(dataForSEOClient));
  }
  if (isModuleEnabled('DOMAIN_ANALYTICS', enabledModules)) {
    modules.push(new DomainAnalyticsApiModule(dataForSEOClient));
  }
  console.error('Modules initialized');
  function registerModuleTools() {
    console.error('Registering tools');
    console.error(modules.length);
    modules.forEach(module => {
      const tools = module.getTools();
      Object.entries(tools).forEach(([name, tool]) => {
        const typedTool = tool as ToolDefinition;
        const schema = z.object(typedTool.params);
        server.tool(
          name,
          typedTool.description,
          schema.shape,
          typedTool.handler
        );
      });
    });
  }
  registerModuleTools();
  console.error('Tools registered');
  server.resource(
    'greeting-resource',
    'https://example.com/greetings/default',
    { mimeType: 'text/plain' },
    async (): Promise<ReadResourceResult> => {
      return {
        contents: [
          {
            uri: 'https://example.com/greetings/default',
            text: 'Hello, world!',
          },
        ],
      };
    }
  );
  return server;
}

function getSessionId() {
  return randomUUID().toString();
}

async function main() {
  const app = express();
  
  // Enable CORS for all routes
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, mcp-session-id');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });
  
  app.use(express.json());

  // Root endpoint for quick connectivity check
  app.get('/', (req, res) => {
    res.status(200).json({
      message: 'DataForSEO MCP Server is running',
      service: 'DataForSEO MCP Server (HTTP)',
      version: process.env.npm_package_version || 'unknown',
      timestamp: new Date().toISOString()
    });
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'DataForSEO MCP Server (HTTP)',
      version: process.env.npm_package_version || 'unknown'
    });
  });

  // Basic Auth Middleware
  const basicAuth = (req: Request, res: Response, next: NextFunction) => {
    // Check for Authorization header
    const authHeader = req.headers.authorization;
    console.error(authHeader)
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      next();
      return;
    }

    // Extract credentials
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    if (!username || !password) {
      console.error('Invalid credentials');
      res.status(401).json({
        jsonrpc: "2.0",
        error: {
          code: -32001, 
          message: "Invalid credentials"
        },
        id: null
      });
      return;
    }

    // Add credentials to request
    req.username = username;
    req.password = password;
    next();
  };

  // Apply basic auth to MCP endpoint
  app.post('/mcp', basicAuth, async (req: Request, res: Response) => {
    // In stateless mode, create a new instance of transport and server for each request
    // to ensure complete isolation. A single instance would cause request ID collisions
    // when multiple clients connect concurrently.
    
    try {
      console.error(Date.now().toLocaleString())
      
      // Check if we have valid credentials
      if (!req.username && !req.password) {
        // If no request auth, check environment variables
        const envUsername = process.env.DATAFORSEO_USERNAME;
        const envPassword = process.env.DATAFORSEO_PASSWORD;
        
        if (!envUsername || !envPassword) {
          console.error('No DataForSEO credentials provided');
          res.status(401).json({
            jsonrpc: "2.0",
            error: {
              code: -32001,
              message: "Authentication required. Provide DataForSEO credentials."
            },
            id: null
          });
          return;
        }
        // Use environment variables
        req.username = envUsername;
        req.password = envPassword;
      }
      
      const server = getServer(req.username, req.password); 
      console.error(Date.now().toLocaleString())

      const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined
      });

      await server.connect(transport);
      console.error('handle request');
      await transport.handleRequest(req , res, req.body);
      console.error('end handle request');
      req.on('close', () => {
        console.error('Request closed');
        transport.close();
        server.close();
      });

    } catch (error) {
      console.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  });

  app.get('/mcp', async (req: Request, res: Response) => {
    console.error('Received GET MCP request');
    res.status(405).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed."
      },
      id: null
    });
  });

  app.delete('/mcp', async (req: Request, res: Response) => {
    console.error('Received DELETE MCP request');
    res.status(405).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed."
      },
      id: null
    });
  });

  // Start the server
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const HOST = process.env.HOST || '0.0.0.0';
  
  console.log(`Starting server on ${HOST}:${PORT}...`);
  console.log(`Environment: NODE_ENV=${process.env.NODE_ENV}`);
  console.log(`Port from env: ${process.env.PORT}`);
  console.log(`Host from env: ${process.env.HOST}`);
  
  const server = app.listen(PORT, HOST, () => {
    console.log(`✅ MCP Stateless Streamable HTTP Server listening on ${HOST}:${PORT}`);
    console.log(`🏥 Health check available at: http://${HOST}:${PORT}/health`);
    console.log(`🚀 Server is ready to accept connections`);
  });
  
  server.on('error', (error) => {
    console.error('❌ Server error:', error);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
