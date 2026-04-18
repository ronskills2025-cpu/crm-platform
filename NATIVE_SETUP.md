# Native Setup Guide (Docker-Free)

This guide explains how to set up the CRM system without Docker, using native installations of PostgreSQL and Redis.

## Prerequisites

### 1. Node.js
- **Version**: 20.x or higher
- **Download**: https://nodejs.org/
- **Verify**: `node --version && npm --version`

### 2. PostgreSQL
- **Version**: 14.x or higher
- **Windows**: https://www.postgresql.org/download/windows/
- **Alternative**: Use cloud services like Supabase or Neon

#### PostgreSQL Setup (Windows)
```bash
# Using Chocolatey (recommended)
choco install postgresql

# Or download installer from postgresql.org
# Default settings:
# - Port: 5432
# - Superuser: postgres
# - Database: postgres
```

#### Create Development Database
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE crm_dev;
CREATE USER crm WITH PASSWORD 'crm_secret';
GRANT ALL PRIVILEGES ON DATABASE crm_dev TO crm;
\q
```

### 3. Redis
- **Version**: 6.x or higher
- **Windows**: Use Redis for Windows or WSL

#### Redis Setup (Windows)
```bash
# Using Chocolatey
choco install redis-64

# Or download from: https://github.com/microsoftarchive/redis/releases
# Default port: 6379
```

#### Start Redis
```bash
# Start Redis server
redis-server

# Test connection (new terminal)
redis-cli ping
# Should return: PONG
```

## Project Setup

### 1. Clone and Install
```bash
git clone <repository-url>
cd crm
npm install
```

### 2. Environment Configuration
```bash
# Copy environment template
copy .env.example .env

# Run interactive database setup
node setup-database.js
```

Choose option 3 (Local PostgreSQL) and use:
- **Database URL**: `postgresql://crm:crm_secret@localhost:5432/crm_dev`

### 3. Verify Infrastructure
```bash
# Test PostgreSQL connection
psql postgresql://crm:crm_secret@localhost:5432/crm_dev -c "SELECT version();"

# Test Redis connection
redis-cli ping
```

## Running the Application

### One-Command Start
```bash
npm run dev
```

This will:
1. ✅ Check PostgreSQL (port 5432)
2. ✅ Check Redis (port 6379)
3. 🚀 Start API server (port 4000)
4. 🚀 Start frontend (port 5173)
5. 🚀 Start admin panel (port 5174)
6. 🚀 Start background workers
7. 📊 Run database migrations
8. 🌱 Seed initial data (first run)

### Manual Start (Alternative)
```bash
# Terminal 1 - API Server
npm run api:dev

# Terminal 2 - Background Workers
npm run worker:dev

# Terminal 3 - Frontend
npm run web:dev

# Terminal 4 - Admin Panel (optional)
npm run admin:dev
```

## Verification

### 1. Service Health
```bash
# API Health Check
curl http://localhost:4000/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2024-...",
  "redis": true,
  "database": true
}
```

### 2. Application URLs
- **Frontend**: http://localhost:5173
- **Admin Panel**: http://localhost:5174
- **API Server**: http://localhost:4000
- **API Docs**: http://localhost:4000/api-docs (if available)

### 3. Database Verification
```bash
# Check tables were created
psql postgresql://crm:crm_secret@localhost:5432/crm_dev -c "\dt"
```

## Troubleshooting

### PostgreSQL Issues
```bash
# Check if PostgreSQL is running
netstat -an | findstr :5432

# Start PostgreSQL service (Windows)
net start postgresql-x64-14

# Check PostgreSQL logs
# Location: C:\Program Files\PostgreSQL\14\data\log\
```

### Redis Issues
```bash
# Check if Redis is running
netstat -an | findstr :6379

# Start Redis manually
redis-server

# Check Redis logs
redis-cli info server
```

### Port Conflicts
```bash
# Find process using port
netstat -ano | findstr :4000
netstat -ano | findstr :5173

# Kill process
taskkill /PID <PID> /F
```

### Permission Issues
```bash
# Run as administrator if needed
# Or adjust PostgreSQL permissions:
psql -U postgres -c "ALTER USER crm CREATEDB;"
```

## Development Workflow

### Database Operations
```bash
# Reset database (careful!)
npm run db:reset

# Run migrations only
npm run db:migrate

# Seed data
npm run db:seed

# Backup database
pg_dump postgresql://crm:crm_secret@localhost:5432/crm_dev > backup.sql
```

### Logs and Debugging
```bash
# View API logs
npm run api:dev

# View worker logs
npm run worker:dev

# View all logs (if using npm run dev)
# Logs are prefixed: [API], [WORKER], [WEB], [ADMIN]
```

## Production Considerations

### Database
- Use cloud PostgreSQL (Supabase, Neon, AWS RDS)
- Set up connection pooling
- Configure backups
- Use SSL connections

### Redis
- Use cloud Redis (Upstash, AWS ElastiCache)
- Configure persistence
- Set up clustering for high availability

### Application
- Use PM2 for process management
- Set up reverse proxy (nginx)
- Configure SSL certificates
- Set up monitoring and logging

## Migration from Docker

If you previously used Docker:

1. **Export data** (if needed):
   ```bash
   # From Docker PostgreSQL
   docker exec postgres_container pg_dump -U crm crm_dev > backup.sql
   ```

2. **Import to native PostgreSQL**:
   ```bash
   psql postgresql://crm:crm_secret@localhost:5432/crm_dev < backup.sql
   ```

3. **Update environment**:
   - Remove Docker-related environment variables
   - Update DATABASE_URL to local PostgreSQL
   - Update REDIS_URL to local Redis

4. **Start native services**:
   ```bash
   npm run dev
   ```

## Support

For issues with this setup:
1. Check the troubleshooting section above
2. Verify all prerequisites are installed correctly
3. Check service logs for specific error messages
4. Ensure firewall/antivirus isn't blocking ports

---

**Note**: This setup provides the same functionality as the Docker version but with native installations, giving you more control and potentially better performance.
