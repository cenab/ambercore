# AmberCore - Real-time Messaging Service

A serverless real-time messaging service built with NestJS and Pusher, optimized for Vercel deployment.

## Project Structure

```
src/
├── app/                    # Application bootstrap and configuration
│   ├── app.module.ts      # Main application module
│   ├── app.controller.ts  # Basic application endpoints
│   └── app.service.ts     # Basic application services
│
├── core/                   # Core functionality and infrastructure
│   ├── config/            # Configuration validation and env setup
│   ├── messaging/         # Real-time messaging infrastructure
│   │   ├── services/      # Core messaging services
│   │   ├── controllers/   # Messaging endpoints
│   │   └── gateways/      # WebSocket gateways
│   └── shared/            # Shared services and utilities
│       └── services/      # Common services (Redis, etc.)
│
└── modules/               # Feature modules
    ├── auth/             # Authentication module
    │   ├── controllers/  # Auth endpoints
    │   ├── services/     # Auth services
    │   ├── middleware/   # Auth middleware
    │   └── guards/       # Auth guards
    └── chat/             # Chat functionality
        ├── controllers/  # Chat endpoints
        ├── services/     # Chat business logic
        └── dto/          # Chat data transfer objects
```

## Directory Purposes

### App Directory (`src/app/`)
- Application bootstrap and main configuration
- Root module configuration
- Basic health check endpoints

### Core Directory (`src/core/`)
- Contains essential infrastructure and shared functionality
- Not specific to any business feature
- Reusable across different parts of the application

#### Config (`src/core/config/`)
- Environment validation
- Configuration schemas
- Environment variable management

#### Messaging (`src/core/messaging/`)
- Real-time messaging infrastructure
- Pusher integration
- WebSocket handling
- Message routing and delivery

#### Shared (`src/core/shared/`)
- Common services (Redis)
- Shared utilities and helpers
- Cross-cutting concerns

### Modules Directory (`src/modules/`)
- Feature-specific modules
- Business logic implementation
- Domain-specific functionality

#### Auth Module (`src/modules/auth/`)
- Supabase authentication integration
- Session management
- User authentication and authorization
- Token handling and validation

#### Chat Module (`src/modules/chat/`)
- Chat room management
- Message handling
- Real-time chat functionality
- User presence management

## Key Features

- Serverless-first architecture
- Real-time messaging with Pusher
- Redis caching for performance
- Supabase authentication
- WebSocket support
- Modular design
- Type-safe implementation

## Getting Started

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Start the development server:
```bash
npm run start:dev
```

## Environment Variables

Required environment variables:
- `PUSHER_APP_ID`: Pusher application ID
- `PUSHER_KEY`: Pusher key
- `PUSHER_SECRET`: Pusher secret
- `PUSHER_CLUSTER`: Pusher cluster region
- `REDIS_URL`: Redis connection URL
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_KEY`: Supabase service key
- `CORS_ORIGIN`: Allowed CORS origin
