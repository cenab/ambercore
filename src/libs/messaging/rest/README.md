# REST Client Library

A powerful and flexible REST client library for NestJS applications, with built-in TypeScript support, error handling, and comprehensive request/response types.

## Features

- 🚀 Support for all HTTP methods (GET, POST, PUT, PATCH, DELETE)
- 🔄 Automatic request/response transformation
- 📝 Full TypeScript support with type inference
- 🎯 NestJS module integration
- 🔍 Detailed logging and debugging
- ⚡ Query parameter handling
- 🔒 Custom header support
- 💪 Timeout handling
- 🎭 Comprehensive error handling

## Installation

No additional installation required - the library is part of the core package.

## Usage

### Module Configuration

```typescript
import { Module } from '@nestjs/common';
import { RestModule } from './rest.module';

@Module({
  imports: [
    RestModule.forRoot({
      baseUrl: 'https://api.example.com',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'your-api-key',
      },
      timeout: 5000,
    }),
  ],
})
export class AppModule {}
```

### Service Usage

```typescript
import { Injectable } from '@nestjs/common';
import { RestClient } from './rest.client';
import { ApiResponse } from './rest.types';

interface User {
  id: number;
  name: string;
  email: string;
}

@Injectable()
export class UserService {
  constructor(private readonly restClient: RestClient) {}

  // GET request example
  async getUser(id: number): Promise<ApiResponse<User>> {
    return this.restClient.get(`/users/${id}`);
  }

  // GET with query parameters
  async listUsers(page: number, limit: number): Promise<ApiResponse<User[]>> {
    return this.restClient.get('/users', {
      query: { page: page.toString(), limit: limit.toString() },
    });
  }

  // POST request example
  async createUser(user: Omit<User, 'id'>): Promise<ApiResponse<User>> {
    return this.restClient.post('/users', { body: user });
  }

  // PUT request example
  async updateUser(id: number, user: Partial<User>): Promise<ApiResponse<User>> {
    return this.restClient.put(`/users/${id}`, { body: user });
  }

  // PATCH request example
  async patchUser(id: number, update: Partial<User>): Promise<ApiResponse<User>> {
    return this.restClient.patch(`/users/${id}`, { body: update });
  }

  // DELETE request example
  async deleteUser(id: number): Promise<ApiResponse<void>> {
    return this.restClient.delete(`/users/${id}`);
  }
}
```

## API Reference

### RestClient

#### Methods

##### `get<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>>`
Makes a GET request to the specified path.

##### `post<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>>`
Makes a POST request to the specified path.

##### `put<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>>`
Makes a PUT request to the specified path.

##### `patch<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>>`
Makes a PATCH request to the specified path.

##### `delete<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>>`
Makes a DELETE request to the specified path.

### Configuration Options

```typescript
interface RestConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  timeout?: number;
}

interface RequestOptions {
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: any;
  headers?: Record<string, string>;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}
```

## Error Handling

The client includes comprehensive error handling:

```typescript
try {
  const response = await restClient.get('/users/999');
} catch (error) {
  if (error.statusCode === 404) {
    // Handle not found error
  } else if (error.code === 'REQUEST_ERROR') {
    // Handle network/timeout errors
  } else {
    // Handle other errors
  }
}
```

## Testing

The library includes comprehensive tests for all HTTP methods and error scenarios. Run tests with:

```bash
npm test src/libs/rest/rest.client.spec.ts
```

## Best Practices

1. **Type Safety**: Always define interfaces for your request/response types.
2. **Error Handling**: Implement proper error handling for all requests.
3. **Timeouts**: Set appropriate timeouts for your use case.
4. **Headers**: Use consistent headers across your application.
5. **Query Parameters**: Use the query options for GET requests instead of building URLs manually.
6. **Base URL**: Configure the base URL at the module level for consistency.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 