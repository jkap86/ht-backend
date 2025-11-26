# Authentication API Contract

This document defines the API contract for authentication endpoints between backend and frontend.

## Base URL
All endpoints are prefixed with `/api/auth`

## Type Definitions

### UserResponse
```typescript
{
  id: string;              // User unique identifier
  username: string;        // Username
  createdAt?: Date | string; // Account creation timestamp (optional)
  updatedAt?: Date | string; // Last update timestamp (optional)
}
```

### AuthResponse
```typescript
{
  user: UserResponse;      // User information
  token: string;           // JWT access token (15min expiry)
  refreshToken: string;    // JWT refresh token (30day expiry)
}
```

### MeResponse
```typescript
{
  user: UserResponse;      // Current user information
}
```

## Endpoints

### 1. Register New User
**POST** `/api/auth/register`

Creates a new user account.

**Request Body:**
```json
{
  "username": string,  // 3-20 characters, alphanumeric + underscore
  "password": string   // Minimum 6 characters
}
```

**Success Response (201 Created):**
```json
{
  "user": {
    "id": "uuid-string",
    "username": "johndoe",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `400 Bad Request` - Invalid username format or password too short
- `409 Conflict` - Username already exists

---

### 2. Login
**POST** `/api/auth/login`

Authenticates user and returns tokens.

**Request Body:**
```json
{
  "username": string,
  "password": string
}
```

**Success Response (200 OK):**
```json
{
  "user": {
    "id": "uuid-string",
    "username": "johndoe",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid credentials

---

### 3. Get Current User
**GET** `/api/auth/me`

Returns information about the currently authenticated user.

**Headers Required:**
```
Authorization: Bearer <access_token>
```

**Success Response (200 OK):**
```json
{
  "user": {
    "id": "uuid-string",
    "username": "johndoe",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid access token

---

### 4. Refresh Access Token
**POST** `/api/auth/refresh`

Exchanges a refresh token for a new access token and refresh token.

**Request Body:**
```json
{
  "refreshToken": string
}
```

**Success Response (200 OK):**
```json
{
  "user": {
    "id": "uuid-string",
    "username": "johndoe",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",  // New access token
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."  // New refresh token
}
```

**Error Responses:**
- `400 Bad Request` - Refresh token not provided
- `401 Unauthorized` - Invalid or expired refresh token

---

## Important Notes

1. **Field Name Mapping**: The backend domain uses `userId` internally, but the API contract uses `id` to match frontend expectations.

2. **Token Expiry**:
   - Access tokens expire in 15 minutes
   - Refresh tokens expire in 30 days

3. **Frontend DTOs**: The frontend Dart DTOs (`UserDto`, `AuthResultDto`) are designed to match these response shapes exactly.

4. **Error Handling**: All error responses follow a consistent format through the error middleware.

## Implementation Details

- **Backend Types**: See `src/app/types/AuthResponses.ts`
- **Controller**: See `src/app/controllers/auth.controller.ts`
- **Service Layer**: See `src/application/services/AuthService.ts`
- **Frontend DTOs**: See `frontend/lib/features/auth/data/dtos/`
