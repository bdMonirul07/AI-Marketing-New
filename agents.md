# Project Context: AI Marketing

## Overview
This is a full-stack web application designed for AI-driven marketing campaigns.

## Architecture

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite 7
- **Routing**: React Router 7
- **Style/Linting**: ESLint 9 configured.
- **Location**: `/frontend`
- **Port**: 5173

### Backend
- **Framework**: ASP.NET Core 9.0 Web API
- **ORM**: Entity Framework Core 9 (Npgsql for PostgreSQL)
- **Documentation**: Scalar (OpenAPI)
- **Location**: `/backend`
- **Port**: 5286

## Key Workflows

### Running the Application
A shell script is provided to spin up both services:
```bash
./run.sh
```
- Starts Backend on port 5286
- Starts Frontend on port 5173
- Handles cleanup of ports on exit

### Configuration
- **Frontend**: `.env` files in `/frontend`
- **Backend**: `appsettings.json` and `appsettings.Development.json` in `/backend`

## API & Database
- The backend provides a REST API.
- Database runs on PostgreSQL.
- `backend.http` file exists for quick API testing.
