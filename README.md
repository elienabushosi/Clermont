# Lindero Monorepo

A client-intake and asset-analysis tool for architects that automatically generates property feasibility snapshots using just a client's address.

## Project Structure

```
Lindero/
├── frontend/          # Next.js 14 frontend application
├── backend/           # Express.js backend API
└── package.json       # Root monorepo configuration
```

## Setup

### Prerequisites

-   Node.js (v21.4.0 or compatible)
-   npm

### Installation

1. Install root dependencies:

```bash
npm install
```

2. Install workspace dependencies:

```bash
npm run install:all
```

Or install individually:

```bash
cd frontend && npm install
cd ../backend && npm install
```

## Development

### Run Frontend Only

```bash
npm run dev
# or
npm run dev:frontend
```

### Run Backend Only

```bash
npm run dev:backend
```

### Run Both (Frontend + Backend)

```bash
npm run dev:all
```

The frontend will run on `http://localhost:3000`  
The backend will run on `http://localhost:3001`

## Build

Build the frontend for production:

```bash
npm run build
```

## Workspaces

This project uses npm workspaces:

-   `lindero-frontend` - Next.js application
-   `lindero-backend` - Express.js API server
