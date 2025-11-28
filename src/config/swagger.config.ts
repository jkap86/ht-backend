import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env.config';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'HypeTrain Fantasy Football API',
      version: '1.0.0',
      description: `
        A comprehensive REST API for the HypeTrain Fantasy Football platform.

        ## Features
        - User authentication (JWT-based)
        - League management
        - Real-time drafts (standard and matchup)
        - Chat system (league and direct messages)
        - Player data from Sleeper API
        - Payment tracking

        ## Authentication
        Most endpoints require JWT authentication. Include the token in the Authorization header:
        \`Authorization: Bearer <your-token>\`

        ## Rate Limiting
        - Auth endpoints: 5 requests per 15 minutes
        - Registration: 3 requests per hour
        - General API: 100 requests per minute
        - Chat messages: 30 messages per minute
      `,
      contact: {
        name: 'HypeTrain Development Team',
        email: 'support@hypetrain.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}/api`,
        description: 'Development server',
      },
      {
        url: env.FRONTEND_URL ? `${env.FRONTEND_URL}/api` : 'https://api.hypetrain.com/api',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT authentication token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
            status: {
              type: 'integer',
              description: 'HTTP status code',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              format: 'uuid',
              description: 'Unique user identifier',
            },
            username: {
              type: 'string',
              description: 'Username (3-20 characters, alphanumeric and underscore)',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        AuthResult: {
          type: 'object',
          properties: {
            user: {
              $ref: '#/components/schemas/User',
            },
            token: {
              type: 'string',
              description: 'JWT access token (expires in 15 minutes)',
            },
            refreshToken: {
              type: 'string',
              description: 'JWT refresh token (expires in 30 days)',
            },
          },
        },
        League: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
            },
            name: {
              type: 'string',
              maxLength: 100,
            },
            status: {
              type: 'string',
              enum: ['pre_draft', 'drafting', 'in_season', 'complete'],
            },
            settings: {
              type: 'object',
              description: 'League configuration settings',
            },
            scoringSettings: {
              type: 'object',
              description: 'Scoring configuration',
            },
            season: {
              type: 'string',
              pattern: '^\\d{4}$',
            },
            totalRosters: {
              type: 'integer',
              default: 12,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        ChatMessage: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
            },
            leagueId: {
              type: 'integer',
            },
            userId: {
              type: 'string',
              format: 'uuid',
            },
            username: {
              type: 'string',
            },
            message: {
              type: 'string',
            },
            messageType: {
              type: 'string',
              enum: ['chat', 'system', 'trade', 'draft'],
            },
            metadata: {
              type: 'object',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Player: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
            },
            sleeperId: {
              type: 'string',
            },
            fullName: {
              type: 'string',
            },
            position: {
              type: 'string',
              enum: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'],
            },
            team: {
              type: 'string',
              description: 'NFL team abbreviation',
            },
            fantasyPositions: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            active: {
              type: 'boolean',
            },
            injuryStatus: {
              type: 'string',
              enum: ['Healthy', 'Questionable', 'Doubtful', 'Out', 'IR'],
            },
          },
        },
        Draft: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
            },
            leagueId: {
              type: 'integer',
            },
            draftType: {
              type: 'string',
              enum: ['snake', 'linear', 'auction'],
            },
            status: {
              type: 'string',
              enum: ['not_started', 'in_progress', 'completed', 'paused'],
            },
            currentPick: {
              type: 'integer',
            },
            currentRound: {
              type: 'integer',
            },
            settings: {
              type: 'object',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization',
      },
      {
        name: 'Leagues',
        description: 'League management operations',
      },
      {
        name: 'Drafts',
        description: 'Draft operations (standard drafts)',
      },
      {
        name: 'Matchup Drafts',
        description: 'Matchup-specific draft operations',
      },
      {
        name: 'Players',
        description: 'NFL player data operations',
      },
      {
        name: 'Chat',
        description: 'League chat and direct messaging',
      },
      {
        name: 'Health',
        description: 'Application health checks',
      },
    ],
    security: [],
  },
  apis: [
    './src/app/**/*.routes.ts',
    './src/app/**/*.controller.ts',
    './src/app/auth/*.ts',
    './src/app/leagues/*.ts',
    './src/app/drafts/*.ts',
    './src/app/players/*.ts',
    './src/app/direct-messages/*.ts',
    './src/app/matchup-drafts/*.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);