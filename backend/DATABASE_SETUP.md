# PostgreSQL Database Setup Guide

## Current Status
The backend application is **fully configured** and ready to run. However, PostgreSQL database is not currently running on your system.

## Prerequisites
You need PostgreSQL installed and running on your machine.

## Installation Options

### Option 1: Install PostgreSQL Directly (Recommended)
1. Download PostgreSQL from: https://www.postgresql.org/download/windows/
2. Run the installer
3. During installation:
   - Set the password for the `postgres` user to: `postgres`
   - Use the default port: `5432`
   - Remember the installation directory

4. After installation, PostgreSQL should start automatically

### Option 2: Use Docker (If you install Docker)
If you prefer Docker, run this command:
```bash
docker run --name postgres-aimarketing -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
```

## Verify PostgreSQL is Running

### Windows Services Method
1. Press `Win + R`, type `services.msc`, and press Enter
2. Look for "postgresql-x64-16" (or similar)
3. Ensure the status is "Running"

### Command Line Method
Open PowerShell and run:
```powershell
# Test if PostgreSQL is listening on port 5432
Test-NetConnection -ComputerName localhost -Port 5432
```

If successful, you should see `TcpTestSucceeded : True`

## Database Configuration

The application is configured with these settings (in `appsettings.json`):
- **Server**: localhost
- **Port**: 5432
- **Database**: aimarketing
- **Username**: postgres
- **Password**: postgres

> **Note**: If you set a different password during PostgreSQL installation, update the connection string in `appsettings.json`

## Apply Database Migrations

Once PostgreSQL is running, execute these commands from the `backend` directory:

```bash
# Apply migrations to create the database schema
dotnet ef database update

# Verify the database was created
dotnet ef database list
```

This will create:
- Database: `aimarketing`
- Tables: `Campaigns`, `Targetings`, `CreativeAssets`, `DistributionPlans`, `ExecutionRuns`

## Run the Backend

After the database is set up:

```bash
dotnet run
```

The API will be available at:
- **HTTP**: http://localhost:5000
- **HTTPS**: https://localhost:5001
- **API Documentation**: http://localhost:5000/scalar/v1

## Troubleshooting

### "Failed to connect to 127.0.0.1:5432"
- PostgreSQL is not running. Start the PostgreSQL service.

### "Password authentication failed for user postgres"
- Update the password in `appsettings.json` to match your PostgreSQL installation.

### "Database 'aimarketing' does not exist"
- Run `dotnet ef database update` to create it.

## Next Steps

1. Install PostgreSQL
2. Run `dotnet ef database update` from the backend directory
3. Run `dotnet run` to start the API server
4. Test the API at http://localhost:5000/scalar/v1
