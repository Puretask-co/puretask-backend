// scripts/generate-postman-collection.ts
// Generate Postman collection from OpenAPI specification

import fs from 'fs';
import path from 'path';
import { swaggerSpec } from '../src/config/swagger';

type OpenAPISpec = {
  info: { title: string; description: string; version: string };
  servers?: Array<{ url: string }>;
  paths?: Record<string, Record<string, any>>;
};

async function generatePostmanCollection() {
  try {
    const spec = swaggerSpec as OpenAPISpec;
    
    // Convert OpenAPI spec to Postman collection format
    const collection = {
      info: {
        name: spec.info.title,
        description: spec.info.description,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        version: spec.info.version,
      },
      auth: {
        type: 'bearer',
        bearer: [
          {
            key: 'token',
            value: '{{auth_token}}',
            type: 'string',
          },
        ],
      },
      variable: [
        {
          key: 'base_url',
          value: spec.servers?.[0]?.url || 'http://localhost:4000',
          type: 'string',
        },
        {
          key: 'auth_token',
          value: '',
          type: 'string',
        },
      ],
      item: [] as any[],
    };

    // Group endpoints by tags
    const endpointsByTag: Record<string, any[]> = {};

    // Extract paths from OpenAPI spec
    if (spec.paths) {
      for (const [path, methods] of Object.entries(spec.paths)) {
        for (const [method, operation] of Object.entries(methods)) {
          if (operation && typeof operation === 'object' && operation.tags) {
            const tag = operation.tags[0] || 'Default';
            if (!endpointsByTag[tag]) {
              endpointsByTag[tag] = [];
            }

            const item: any = {
              name: (operation.summary as string) || `${method.toUpperCase()} ${path}`,
              request: {
                method: method.toUpperCase(),
                header: [] as any[],
                url: {
                  raw: `{{base_url}}${path}`,
                  host: ['{{base_url}}'],
                  path: path.split('/').filter(Boolean),
                },
              },
              response: [],
            };

            // Add description
            if (operation.description) {
              item.request.description = {
                type: 'text',
                content: operation.description as string,
              };
            }

            // Add authentication
            if (operation.security) {
              item.request.auth = {
                type: 'bearer',
                bearer: [
                  {
                    key: 'token',
                    value: '{{auth_token}}',
                    type: 'string',
                  },
                ],
              };
            }

            // Add request body
            if (operation.requestBody) {
              const content = (operation.requestBody as any).content?.['application/json'];
              if (content?.schema) {
                item.request.body = {
                  mode: 'raw',
                  raw: JSON.stringify(
                    generateExampleFromSchema(content.schema),
                    null,
                    2
                  ),
                  options: {
                    raw: {
                      language: 'json',
                    },
                  },
                };
                item.request.header.push({
                  key: 'Content-Type',
                  value: 'application/json',
                });
              }
            }

            // Add query parameters
            if (operation.parameters) {
              const queryParams: any[] = [];
              for (const param of operation.parameters as any[]) {
                if (param.in === 'query') {
                  queryParams.push({
                    key: param.name,
                    value: param.example || '',
                    description: param.description,
                  });
                } else if (param.in === 'path') {
                  // Replace path parameters in URL
                  item.request.url.path = item.request.url.path.map((p: string) =>
                    p === `{${param.name}}` ? `:${param.name}` : p
                  );
                }
              }
              if (queryParams.length > 0) {
                item.request.url.query = queryParams;
              }
            }

            endpointsByTag[tag].push(item);
          }
        }
      }
    }

    // Organize items by tag
    for (const [tag, items] of Object.entries(endpointsByTag)) {
      collection.item.push({
        name: tag,
        item: items,
      });
    }

    // Write collection to file
    const outputPath = path.join(__dirname, '..', 'postman', 'PureTask-API.postman_collection.json');
    const outputDir = path.dirname(outputPath);
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(collection, null, 2));
    console.log(`✅ Postman collection generated: ${outputPath}`);
    console.log(`📦 Import this file into Postman to test the API`);

  } catch (error) {
    console.error('❌ Failed to generate Postman collection:', error);
    process.exit(1);
  }
}

function generateExampleFromSchema(schema: any): any {
  if (schema.type === 'object' && schema.properties) {
    const example: any = {};
    for (const [key, prop] of Object.entries(schema.properties as any)) {
      if (schema.required?.includes(key) || !schema.required) {
        example[key] = generateExampleFromSchema(prop);
      }
    }
    return example;
  } else if (schema.type === 'array' && schema.items) {
    return [generateExampleFromSchema(schema.items)];
  } else if (schema.type === 'string') {
    if (schema.format === 'email') return 'user@example.com';
    if (schema.format === 'date-time') return new Date().toISOString();
    if (schema.format === 'uri') return 'https://example.com';
    if (schema.format === 'uuid') return '00000000-0000-0000-0000-000000000000';
    return schema.example || 'string';
  } else if (schema.type === 'number' || schema.type === 'integer') {
    return schema.example || 0;
  } else if (schema.type === 'boolean') {
    return schema.example || true;
  }
  return null;
}

generatePostmanCollection();
