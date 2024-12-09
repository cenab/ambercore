# AmberCore Backend

A modern, scalable NestJS backend with Supabase integration, featuring a read-only database mode, robust error handling, and comprehensive testing support.

## 🚀 Features

- 🔒 **Read-only Supabase database integration**
- 🌐 REST API endpoints
- 🔑 Authentication and authorization
- 📝 Comprehensive validation
- 🎯 Dependency injection
- 📊 Environment configuration
- 🧪 Testing utilities
- 🚦 Health checks
- 📈 Connection pooling
- 🔄 Auto-reconnection

## 📋 Prerequisites

- **Node.js** (v18 or higher)
- **Yarn** package manager
- **Supabase** account and project
- **Redis** (optional, for caching)

## 🛠 Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/yourusername/ambercore.git
   cd ambercore
   ```

2. **Install dependencies:**

   ```bash
   yarn install
   ```

3. **Create environment files:**

   ```bash
   cp .env.example .env
   ```

4. **Configure your environment variables in `.env`:**

   ```env
   NODE_ENV=development
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_KEY=your_service_key
   SUPABASE_JWT_SECRET=your_jwt_secret
   REDIS_URL=your_redis_url
   CORS_ORIGIN=http://localhost:3000
   ```

## 🚀 Running the Application

### Development

```bash
yarn run dev
```

### Production

```bash
yarn build
yarn start
```

### Testing

```bash
yarn test        # Run unit tests
yarn test:e2e    # Run end-to-end tests
yarn test:cov    # Generate coverage report
```

## 📁 Project Structure

```
src/
├── app/                    # Application entry point
├── core/                   # Core modules and services
│   ├── auth/               # Authentication
│   ├── config/             # Configuration
│   ├── database/           # Database service
│   └── health/             # Health checks
├── features/               # Feature modules
│   ├── users/              # User feature example
│   └── products/           # Additional features (e.g., products)
├── common/                 # Shared utilities
└── libs/                   # Library modules
```

## 🔧 Core Concepts

### Database Integration and Service Creation Guide

This section provides a comprehensive guide on how to add new services to the database in the AmberCore backend, how to use the database service, and explains the architectural elements of the database integration within the application.

### Overview

The AmberCore backend is a modern, scalable NestJS application with Supabase integration for database operations. The database service is designed to be efficient, secure, and easy to use throughout the application. This guide will walk you through the architectural elements of the database integration, how to use the existing database service, and how to add new services that interact with the database.

### Architectural Elements

#### Project Structure

The application follows a modular structure that is standard in NestJS applications. The key directories related to database operations are:

- `src/core/database`: Contains the core database service and module.
- `src/features`: Contains feature-specific modules and services.
- `src/core/config`: Contains configuration-related files.

#### Database Service

The database service is implemented in `src/core/database/database.service.ts`. It encapsulates the logic for connecting to the Supabase database, enforces read-only operations, and provides methods to get the Supabase client.

Key features of the database service include:

- **Singleton Pattern**: Ensures a single database client instance is used throughout the application.
- **Read-Only Mode**: Enforces read-only operations by overriding write methods and throwing exceptions if they are called.
- **Connection Management**: Manages connection pooling and cleans up resources when the module is destroyed.
- **Error Handling**: Includes comprehensive error handling and logging mechanisms.

#### Configuration Management

The application uses the `@nestjs/config` module for environment configuration. The `ConfigService` is used to access environment variables and configuration options, such as database URLs and service keys.

### Using the Database Service

#### Accessing the Database Client

To interact with the database, you need to access the Supabase client provided by the database service. Here's how you can do it in your service:

```typescript:src/features/example/example.service.ts
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';

@Injectable()
export class ExampleService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findData(id: string) {
    const supabase = await this.databaseService.getClient();
    const { data, error } = await supabase
      .from('your_table')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(error.message);
    }
    return data;
  }
}
```

In this example:

- We inject the `DatabaseService` into the constructor.
- We use `this.databaseService.getClient()` to get the Supabase client.
- We perform a query on a Supabase table.

#### Read-Only Mode Enforcement

The database service enforces read-only mode by overriding write operations. If you attempt to perform an insert, update, upsert, or delete operation, the service will throw a `ForbiddenException`.

For example:

```typescript
const supabase = await this.databaseService.getClient();
await supabase
  .from('your_table')
  .insert({ name: 'New Item' }); // This will throw a ForbiddenException
```

This ensures that the database remains secure and prevents unintended write operations.

### Adding a New Database Service

To add a new service that interacts with the database, follow these steps:

#### Step 1: Create a New Feature Module

Create a new feature module within the `src/features` directory. For example, to create a `products` feature:

```bash
mkdir src/features/products
```

Create a `products.module.ts` file:

```typescript:src/features/products/products.module.ts
import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { DatabaseModule } from '../../core/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [ProductsService],
  controllers: [ProductsController],
  exports: [ProductsService],
})
export class ProductsModule {}
```

#### Step 2: Implement the Service

Create a `products.service.ts` file within the `products` directory:

```typescript:src/features/products/products.service.ts
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';

@Injectable()
export class ProductsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll() {
    const supabase = await this.databaseService.getClient();
    const { data, error } = await supabase.from('products').select('*');

    if (error) {
      throw new Error(error.message);
    }
    return data;
  }

  async findOne(id: string) {
    const supabase = await this.databaseService.getClient();
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(error.message);
    }
    return data;
  }
}
```

#### Step 3: Implement the Controller

Create a `products.controller.ts` file to expose endpoints:

```typescript:src/features/products/products.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async getAll() {
    return await this.productsService.findAll();
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return await this.productsService.findOne(id);
  }
}
```

#### Step 4: Configure the Module

Ensure that the `ProductsModule` is imported into the `AppModule` or any other module where you need to use it:

```typescript:src/app/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from '../core/config/config.validator';
import { DatabaseModule } from '../core/database/database.module';
import { ProductsModule } from '../features/products/products.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      validate,
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      expandVariables: true,
      cache: true,
    }),
    DatabaseModule,
    ProductsModule,
    // Other modules...
  ],
  controllers: [/* ... */],
  providers: [/* ... */],
})
export class AppModule {}
```

### Best Practices

- **Error Handling**: Always check for errors after database operations and handle them appropriately.
- **Asynchronous Operations**: Use `async/await` when interacting with the database client.
- **Dependency Injection**: Use NestJS's dependency injection to access services.
- **Modular Design**: Organize your code into feature modules for better maintainability.
- **Read-Only Enforcement**: Be aware of the read-only mode and ensure your services comply with it.

### Advanced Topics

#### Error Handling

The database service includes comprehensive error handling and logs errors using NestJS's `Logger` service.

Example:

```typescript
if (error) {
  this.logger.error('Database query error:', error);
  throw new Error(error.message);
}
```

#### Connection Management

The `DatabaseService` manages database connections, including connection pooling and cleanup. It ensures that connections are properly cleaned up when the module is destroyed.

Connection management features:

- **Pooling**: Manages a pool of connections to prevent exhausting database resources.
- **Timeout Handling**: Implements timeouts for establishing connections.
- **Cleanup**: Cleans up connections on module destroy using the `onModuleDestroy` lifecycle hook.

#### Health Checks

The `DatabaseService` includes a `healthCheck()` method to verify the database connection. This can be used in health check endpoints.

```typescript:src/core/health/health.controller.ts
import { Controller, Get, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly databaseService: DatabaseService) {}

  @Get()
  async healthCheck() {
    const isDatabaseHealthy = await this.databaseService.healthCheck();

    return {
      status: isDatabaseHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
    };
  }
}
```

#### Read-Only Mode Implementation

The read-only mode is enforced by overriding the write methods of the Supabase client. In the `DatabaseService`, after creating the client, the `from` method is overridden to intercept calls to `insert`, `update`, `upsert`, and `delete`, throwing a `ForbiddenException` if these methods are called.

```typescript:src/core/database/database.service.ts
const originalFrom = supabase.from.bind(supabase);
supabase.from = (table: string) => {
  const builder = originalFrom(table);

  if (DatabaseService.READ_ONLY) {
    // Override write operations
    builder.insert = () => {
      throw new ForbiddenException('INSERT operations are not allowed in read-only mode');
    };
    builder.update = () => {
      throw new ForbiddenException('UPDATE operations are not allowed in read-only mode');
    };
    builder.upsert = () => {
      throw new ForbiddenException('UPSERT operations are not allowed in read-only mode');
    };
    builder.delete = () => {
      throw new ForbiddenException('DELETE operations are not allowed in read-only mode');
    };
  }

  return builder;
};
```

#### Environment Configuration

Environment variables are managed using the `@nestjs/config` module. Ensure you have the necessary environment variables set in your `.env` files:

```env
NODE_ENV=development
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
SUPABASE_JWT_SECRET=your_jwt_secret
REDIS_URL=your_redis_url
CORS_ORIGIN=http://localhost:3000
```

---

## 🔒 Security

### Authentication

The auth service provides authentication methods:

```typescript:src/core/auth/auth.service.ts
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AuthService {
  constructor(private readonly databaseService: DatabaseService) {}

  async signIn(email: string, password: string) {
    const supabase = await this.databaseService.getClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }
    return data;
  }
}
```

### Database Security

- All write operations are blocked in read-only mode.
- Connection pooling prevents resource exhaustion.
- Automatic cleanup of idle connections.

## 📝 Testing

### Unit Tests

```typescript:test/features/products/products.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { DatabaseService } from '../../core/database/database.service';

describe('ProductsService', () => {
  let service: ProductsService;
  let databaseService: DatabaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: DatabaseService,
          useValue: {
            getClient: jest.fn().mockResolvedValue({
              from: jest.fn().mockReturnThis(),
              select: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    databaseService = module.get<DatabaseService>(DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return all products', async () => {
    const result = await service.findAll();
    expect(result).toEqual([]);
  });
});
```

## 🚀 Deployment

### Vercel

The project includes Vercel configuration in `vercel.json`:

```json:vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "src/app/serverless.ts",
      "use": "@vercel/node"
    }
  ]
}
```

Deploy using:

```bash
vercel
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support, email your-email@example.com or open an issue in the repository.

## 🔄 Updates and Maintenance

- Keep dependencies updated using `yarn upgrade-interactive --latest`
- Monitor the health endpoint at `/health`
- Check logs for connection pool warnings
- Review error logs for potential issues

## 📚 Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Supabase Documentation](https://supabase.io/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
