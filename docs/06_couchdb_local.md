# Setting Up Local CouchDB with CouchDB Minihosting

This guide walks through setting up a local CouchDB instance using CouchDB Minihosting for development and testing purposes.

## What is CouchDB Minihosting?

CouchDB Minihosting is a set of automated scripts by Neighbourhoodie Software GmbH that simplifies CouchDB deployment. It provides:

- CouchDB instance running in Docker
- Automatic HTTPS certificates with Let's Encrypt autorenewal
- haproxy and nginx for routing
- Deployment scripts for webapp alongside CouchDB
- Full automation for common hosting tasks

## Prerequisites

- Linux VM or server (Ubuntu 24.10x64 recommended) OR macOS with Docker
- Domain name pointing to your server (for production)
- SSH key pair for server access (for production)
- Basic terminal knowledge
- Docker installed on your system

## Local Development Setup

For local development, you have several options depending on your operating system.

### Option 1: macOS with Docker Desktop (Simplest)

For macOS users, the simplest approach is to run CouchDB directly in Docker:

```bash
# Install Docker Desktop if not already installed
# Download from https://www.docker.com/products/docker-desktop/

# Run CouchDB in Docker
docker run -d --name couchdb \
  -e COUCHDB_USER=admin \
  -e COUCHDB_PASSWORD=password \
  -p 5984:5984 \
  couchdb:3
```

This gives you a fully functional CouchDB instance without the complexity of CouchDB Minihosting's full stack.

### Option 2: macOS with CouchDB Minihosting in Docker

Since CouchDB Minihosting expects a Linux environment, you can run it inside a Docker container:

```bash
# Create a Docker container with Ubuntu
docker run -it --name minihosting \
  -p 5984:5984 \
  -p 6984:6984 \
  -v $(pwd):/workspace \
  ubuntu:24.10 bash

# Inside the container, install prerequisites
apt-get update
apt-get install -y git curl docker.io

# Continue with CouchDB Minihosting setup below
```

### Option 3: Local VM with Vagrant (Cross-platform)

1. Create a `Vagrantfile`:

```ruby
Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/jammy64"
  config.vm.network "private_network", ip: "192.168.56.10"
  config.vm.provider "virtualbox" do |vb|
    vb.memory = "2048"
    vb.cpus = 2
  end
end
```

2. Start the VM:
```bash
vagrant up
vagrant ssh
```

### Option 4: Direct Local Installation (Linux only)

If you're running Linux locally, you can skip the VM/Docker setup and install directly.

## CouchDB Minihosting Installation

**Note:** If you chose Option 1 (macOS with Docker Desktop), skip to the "Configuration for eddoapp" section below.

For Options 2-4, continue with these steps:

1. Clone the CouchDB Minihosting repository:

```bash
git clone https://github.com/neighbourhoodie/couchdb-minihosting.git
cd couchdb-minihosting
```

2. Configure your domain (for local development, you can use a hosts file entry):

```bash
# Add to /etc/hosts for local development (macOS and Linux)
sudo echo "127.0.0.1 couchdb.local" >> /etc/hosts
```

3. Run the setup script:

```bash
./setup.sh
```

4. Follow the prompts to configure:
   - Domain name (e.g., `couchdb.local` for local dev)
   - CouchDB admin username
   - CouchDB admin password
   - SSL certificate (use self-signed for local)

## Configuration for eddoapp

Since eddoapp is a client-side application, we cannot store CouchDB credentials in environment variables as they would be exposed in the built JavaScript. Here are secure alternatives:

### Option 1: Development with Anonymous Access (Testing Only)

1. Configure CouchDB for anonymous access (development only):

```bash
# Create a public database
curl -X PUT http://admin:password@localhost:5984/todos-dev

# Set permissions for anonymous access
curl -X PUT http://admin:password@localhost:5984/todos-dev/_security \
  -H "Content-Type: application/json" \
  -d '{"members":{"roles":["_public"]}}'
```

2. In your client code:

```typescript
// src/hooks/use_sync_dev.ts
export const useSyncDev = () => {
  const db = usePouchDb();
  
  useEffect(() => {
    // Development only - no auth needed
    const remoteDb = new PouchDB('http://localhost:5984/todos-dev');
    
    const sync = db.sync(remoteDb, {
      live: true,
      retry: true
    });
    
    return () => sync.cancel();
  }, [db]);
};
```

### Option 2: Session-Based Authentication (Recommended)

1. Create a login component:

```typescript
// src/components/sync_setup.tsx
export const SyncSetup = () => {
  const [syncUrl, setSyncUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const setupSync = async () => {
    // Authenticate directly with CouchDB
    const response = await fetch(`${syncUrl}/_session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: username, password })
    });
    
    if (response.ok) {
      // Store sync URL only (no credentials)
      localStorage.setItem('syncUrl', syncUrl);
      localStorage.setItem('syncEnabled', 'true');
      window.location.reload();
    }
  };
  
  return (
    <div>
      <input 
        placeholder="CouchDB URL (e.g., http://localhost:5984)"
        value={syncUrl}
        onChange={(e) => setSyncUrl(e.target.value)}
      />
      <input 
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <input 
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={setupSync}>Enable Sync</button>
    </div>
  );
};
```

2. Create the sync hook:

```typescript
// src/hooks/use_sync.ts
export const useSync = () => {
  const db = usePouchDb();
  const syncUrl = localStorage.getItem('syncUrl');
  const syncEnabled = localStorage.getItem('syncEnabled') === 'true';
  
  useEffect(() => {
    if (!syncEnabled || !syncUrl) return;
    
    const remoteDb = new PouchDB(`${syncUrl}/todos`, {
      skip_setup: true,
      fetch: (url, opts) => {
        // Include cookies for session auth
        opts.credentials = 'include';
        return PouchDB.fetch(url, opts);
      }
    });
    
    const sync = db.sync(remoteDb, {
      live: true,
      retry: true
    });
    
    sync.on('error', (err) => {
      if (err.status === 401) {
        // Session expired, clear sync settings
        localStorage.removeItem('syncEnabled');
        console.error('Session expired, please login again');
      }
    });
    
    return () => sync.cancel();
  }, [db, syncUrl, syncEnabled]);
};
```

### Option 3: Per-User Databases with Proxy

For production, implement a lightweight auth proxy:

```typescript
// Example using Cloudflare Workers or similar
export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/api/auth') {
      // Handle authentication
      const { username, password } = await request.json();
      
      // Verify with CouchDB
      const authResponse = await fetch('YOUR_COUCHDB/_session', {
        method: 'POST',
        body: JSON.stringify({ name: username, password })
      });
      
      if (authResponse.ok) {
        // Return user-specific database URL
        return new Response(JSON.stringify({
          dbUrl: `/api/db/userdb-${username}`,
          session: authResponse.headers.get('set-cookie')
        }));
      }
    }
    
    if (url.pathname.startsWith('/api/db/')) {
      // Proxy database requests with auth
      const couchUrl = url.pathname.replace('/api/db/', 'YOUR_COUCHDB/');
      return fetch(couchUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body
      });
    }
  }
};
```

## Verifying the Setup

1. Check CouchDB is running:

```bash
# For macOS Docker or any localhost setup
curl http://localhost:5984/

# For CouchDB Minihosting with custom domain
curl http://couchdb.local:5984/
```

Expected response:
```json
{
  "couchdb": "Welcome",
  "version": "3.x.x",
  "vendor": {
    "name": "The Apache Software Foundation"
  }
}
```

2. Access Fauxton (CouchDB web interface):
   - macOS Docker: http://localhost:5984/_utils
   - Local Minihosting: http://couchdb.local:5984/_utils
   - Production: https://your-domain.com:6984/_utils

## Enabling Sync in eddoapp

Since eddoapp is client-side only, sync requires one of the secure authentication methods above:

### For Development (Option 1 - Anonymous Access):
1. Create a public database with anonymous access
2. Implement the `useSyncDev` hook
3. The sync will start automatically when the component mounts

### For Production (Option 2 - Session Auth):
1. Add the `SyncSetup` component to your app
2. Users enter their CouchDB URL and credentials
3. Session is stored in cookies (not localStorage)
4. Implement the `useSync` hook to handle authenticated sync

The sync implementation handles:
- Continuous bidirectional sync
- Automatic retry on connection failures
- Session expiration detection
- Conflict resolution

### Important Security Notes:
- Never hardcode credentials in your client-side code
- Use HTTPS in production to protect session cookies
- Consider implementing per-user databases for data isolation
- Regularly rotate CouchDB user passwords

## Security Considerations

### Client-Side Security:
- **Never** store CouchDB admin credentials in client-side code
- **Never** use environment variables for secrets in client apps
- Use session-based authentication with cookies
- Implement per-user databases for proper data isolation

### For local development:
- Use anonymous access databases only for testing
- Keep development databases separate from production
- Use strong admin passwords even locally
- Consider IP whitelisting if exposing ports

### For production:
- Always use HTTPS to protect session cookies
- Enable CouchDB authentication for all databases
- Configure proper CORS settings
- Implement a backend proxy for additional security
- Use per-user databases with proper access controls
- Consider implementing row-level security with design documents

## Troubleshooting

### Connection refused
- Ensure CouchDB is running: `docker ps`
- Check firewall settings
- Verify the URL in your `.env` file
- On macOS, ensure Docker Desktop is running

### Authentication failed
- Double-check username/password
- Ensure the database exists
- Check CouchDB logs: `docker logs couchdb`

### CORS issues

The easiest way to configure CORS is using the `add-cors-to-couchdb` npm package:

```bash
# Install globally
npm install -g add-cors-to-couchdb

# For local development (allows all origins)
add-cors-to-couchdb http://localhost:5984 -u admin -p password

# For specific server
add-cors-to-couchdb http://your-couchdb-server.com:5984 -u admin -p password
```

For more fine-grained control, you can still use curl commands:
```bash
# Enable CORS
curl -X PUT http://admin:password@localhost:5984/_node/_local/_config/httpd/enable_cors -d '"true"'

# Set specific origins for production (replace with your domain)
curl -X PUT http://admin:password@localhost:5984/_node/_local/_config/cors/origins -d '"https://your-app.com"'

# Enable credentials for session auth
curl -X PUT http://admin:password@localhost:5984/_node/_local/_config/cors/credentials -d '"true"'
```

Note: The npm script configures CORS with permissive settings suitable for development. For production, consider setting specific allowed origins.

### macOS-specific issues
- If using Docker Desktop, ensure it has enough allocated memory (2GB minimum)
- Check Docker Desktop settings for resource limits
- Restart Docker Desktop if containers become unresponsive

## Production Deployment

For production deployment on a VPS:

1. **Recommended VPS Providers:**
   - Hetzner Cloud CX22: €3.79/month
   - DigitalOcean Droplet: $4/month

2. **Setup Steps:**
   - Point your domain to the VPS IP
   - SSH into your server
   - Follow the CouchDB Minihosting installation steps above
   - Use Let's Encrypt for SSL certificates

3. **Monitoring:**
   - Set up basic monitoring for disk space
   - Monitor CouchDB logs
   - Consider backup strategies

## Next Steps

- Set up regular backups of your CouchDB data
- Configure replication for high availability
- Implement user authentication beyond admin access
- Consider performance tuning for larger datasets

## Resources

- [CouchDB Minihosting GitHub](https://github.com/neighbourhoodie/couchdb-minihosting)
- [CouchDB Documentation](https://docs.couchdb.org/)
- [PouchDB Sync Guide](https://pouchdb.com/guides/replication.html)