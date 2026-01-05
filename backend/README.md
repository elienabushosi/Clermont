# Lindero Backend

Backend server for the Lindero application with Supabase integration.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the `backend` directory with your Supabase credentials:

```
SUPABASE_URL=https://navarlhgtpvdgutcsfhj.supabase.co
SUPABASE_ANON_KEY=sb_publishable_pCqZ-f4i-JjUjhj1wJ2U1Q_Ulct2mk-
```

3. **Set up the database schema:**

    - Go to your Supabase dashboard
    - Navigate to SQL Editor
    - Run the SQL from `schema.sql` to create the tables

4. Run the development server:

```bash
npm run dev
```

## API Endpoints

-   `GET /api/health` - Health check endpoint
-   `GET /api/test-supabase` - Test Supabase connection
-   `POST /api/auth/signup` - Create a new user and organization

## Database Schema

The application uses two main tables:

### Organizations

-   `IdOrganization` (UUID, Primary Key)
-   `Name` (TEXT)
-   `Type` (TEXT, nullable)
-   `CreatedAt` (TIMESTAMP)
-   `UpdatedAt` (TIMESTAMP)

### Users

-   `IdUser` (UUID, Primary Key)
-   `IdOrganization` (UUID, Foreign Key to organizations)
-   `Name` (TEXT)
-   `Email` (TEXT, Unique)
-   `Password` (TEXT) - **Note: Should be hashed in production!**
-   `Role` (TEXT, default: 'Owner')
-   `CreatedAt` (TIMESTAMP)
-   `UpdatedAt` (TIMESTAMP)

## Signup Flow

When a user signs up:

1. An organization is created first
2. A user is created with the organization ID
3. The user is assigned the "Owner" role
4. Both records are returned in the response
