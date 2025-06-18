# Backend Options for PouchDB Todo App

This document evaluates backend options for adding persistent, multi-device sync to our GTD-inspired todo and time tracking application.

## Current Architecture Assessment

**Strengths to Preserve:**
- Offline-first approach with local PouchDB storage
- Real-time changes feed for instant UI updates
- Database-as-state-management (no Redux/Zustand needed)
- Versioned data model with automatic migrations
- MapReduce design document views for efficient querying

**Missing Capabilities:**
- Multi-device synchronization
- Data backup and recovery
- Real-time collaboration across devices
- Persistent storage beyond browser limitations

## Backend Strategy Evaluation

### Option 1: CouchDB (Recommended - Minimal Change)

**Why CouchDB is the Natural Choice:**
- **Perfect PouchDB Compatibility**: CouchDB IS PouchDB's server counterpart
- **Bi-directional Sync**: Built-in real-time replication
- **Preserve Current Architecture**: Zero changes to data model or queries
- **Master-Master Replication**: Handles offline conflicts automatically

**Implementation:**
```typescript
// Minimal change to existing code
const localDb = new PouchDB('todos');
const remoteDb = new PouchDB('https://your-couchdb.com/todos');

// Enable continuous sync
localDb.sync(remoteDb, {
  live: true,
  retry: true
});
```

**Managed Service Options:**
- **IBM Cloudant**: ~$75-100+/month (minimum provisioned throughput pricing - outside budget)
- **Hyve Managed Hosting**: Contact for pricing, European CouchDB hosting with German data centers
- **A2 Hosting**: VPS plans suitable for CouchDB, pricing varies
- **Self-hosted VPS**: $5-20/month (DigitalOcean, Linode, etc.)

**Pros:**
- Zero breaking changes to existing code
- Maintains offline-first approach
- Automatic conflict resolution
- Real-time sync across all devices
- Can self-host for cost savings

**Cons:**
- CouchDB learning curve for operations
- Query limitations compared to SQL
- Replication can be resource-intensive

### Option 2: Supabase (Modern Full-Stack)

**Real-time PostgreSQL with modern tooling**

**Architecture Changes:**
- Replace PouchDB queries with Supabase client
- Use Supabase real-time subscriptions instead of changes feed
- Maintain offline capability with local caching

**Implementation Pattern:**
```typescript
// Supabase setup
const supabase = createClient(url, key);

// Real-time subscription (similar to PouchDB changes)
supabase
  .channel('todos')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'todos' }, 
    (payload) => {
      // Update local state
    }
  )
  .subscribe();
```

**Pricing:**
- Free tier: 2 databases, 500MB storage
- Pro: $25/month per project
- Team: $599/month

**Pros:**
- Modern developer experience
- Built-in auth, storage, edge functions
- Real-time subscriptions
- SQL queries and joins
- Excellent TypeScript support

**Cons:**
- Requires rewriting data access layer
- Less offline-first than PouchDB/CouchDB
- Vendor lock-in to Supabase

### Option 3: Firebase (Google Ecosystem)

**NoSQL with real-time sync**

**Architecture:**
- Replace PouchDB with Firestore
- Use Firestore offline persistence
- Real-time listeners for updates

**Pricing:**
- Free tier: 1GB storage, 50k reads/day
- Pay-as-you-go: ~$20-50/month for typical usage

**Pros:**
- Mature real-time database
- Excellent offline support
- Strong mobile SDK
- Built-in authentication

**Cons:**
- Complete rewrite required
- Google vendor lock-in
- Query limitations
- Complex pricing model

### Option 4: Hybrid Approach - PouchDB + Sync Service

**Keep PouchDB, add sync backend**

**Options:**
1. **PouchDB Server** (Node.js): Self-hosted, maintains API compatibility
2. **Hoodie**: Offline-first framework with sync backend
3. **Custom Express + PouchDB**: Roll your own sync server

**Implementation:**
```typescript
// PouchDB Server setup
const express = require('express');
const PouchDB = require('pouchdb');

app.use('/db', require('express-pouchdb')(PouchDB));
```

**Pros:**
- Minimal frontend changes
- Full control over backend
- Cost-effective (self-hosted)

**Cons:**
- DevOps overhead
- Maintenance burden
- Scaling challenges

## Recommendation: Phased Approach

### Phase 1: CouchDB Sync (Immediate - Low Risk)
**Timeline: 1-2 weeks**
```typescript
// Add to existing PouchDB setup
const remoteDb = new PouchDB(process.env.VITE_COUCHDB_URL);
localDb.sync(remoteDb, { live: true, retry: true });
```

**Benefits:**
- Zero breaking changes
- Immediate multi-device sync
- Preserves offline-first approach
- Can use managed CouchDB service

### Phase 2: Enhanced Backend (Future - High Value)
**Timeline: 1-2 months**
- Consider Supabase migration if need arises for:
  - User authentication
  - Advanced querying
  - File storage
  - Analytics

## Technical Implementation Details

### CouchDB Integration (Recommended First Step)

**1. Environment Setup:**
```typescript
// .env
VITE_COUCHDB_URL=https://username:password@your-couchdb.com/todos
VITE_ENABLE_SYNC=true
```

**2. Sync Setup:**
```typescript
// src/hooks/use_sync.ts
export const useSync = () => {
  const db = usePouchDb();
  
  useEffect(() => {
    if (!process.env.VITE_ENABLE_SYNC) return;
    
    const remoteDb = new PouchDB(process.env.VITE_COUCHDB_URL);
    
    const sync = db.sync(remoteDb, {
      live: true,
      retry: true
    });
    
    return () => sync.cancel();
  }, [db]);
};
```

**3. Conflict Resolution:**
```typescript
// Handle conflicts in existing data model
const handleConflict = (doc: TodoAlpha3) => {
  // Use latest timestamp as winner
  return doc.completed || doc._id; // Creation time as tiebreaker
};
```

### Cost Analysis

**CouchDB Options:**
- **IBM Cloudant**: $75-100+/month (minimum throughput requirements - expensive)
- **Self-hosted CouchDB**: $5-20/month (VPS + domain)
- **Managed CouchDB providers**: $20-50/month (contact for quotes)

**Development Effort:**
- **CouchDB Sync**: 1-2 days implementation
- **Supabase Migration**: 2-3 weeks full rewrite
- **Firebase Migration**: 2-4 weeks full rewrite

## Budget-Conscious Managed CouchDB Options

### Viable Options Under $50/month:

**1. Self-Hosted CouchDB on VPS ($3-20/month)**
- **CouchDB Minihosting**: $4/month (DigitalOcean smallest droplet) - automated setup scripts
- **Hetzner Cloud**: €3.79/month (~$4/month) CX22 (2 vCPU, 4GB RAM, 40GB SSD) - European provider
- **DigitalOcean**: $6/month droplet (1GB RAM, 25GB SSD)
- **Linode**: $5/month plan (1GB RAM, 25GB storage)  
- **Vultr**: $6/month VPS (1GB RAM, 25GB SSD)

**2. CouchDB-Compatible Hosting Providers**
- **A2 Hosting**: VPS starting ~$20/month, supports CouchDB
- **Hostinger**: VPS from $3/month, can install CouchDB
- **InMotion Hosting**: Managed VPS with CouchDB support

**3. European Options**
- **Hetzner Cloud**: €3.79/month CX22 plan, German data centers, excellent price/performance
- **Hyve Managed Hosting**: German data centers, contact for CouchDB pricing
- **IONOS**: European provider with VPS options for CouchDB

### CouchDB Minihosting - Simplified Self-Hosting

**What is it?**
CouchDB Minihosting is a set of automated scripts by Neighbourhoodie Software GmbH that simplifies CouchDB deployment to "matter of minutes" setup time.

**What's Included:**
- CouchDB instance running in Docker
- Automatic HTTPS certificates with Let's Encrypt autorenewal  
- haproxy and nginx for routing
- Deployment scripts for webapp alongside CouchDB
- Full automation for common hosting tasks

**Pricing & Requirements:**
- **Cost**: $4/month (DigitalOcean smallest droplet)
- **Requirements**: Linux VM, domain name, SSH key, basic terminal knowledge
- **Recommended**: Ubuntu 24.10x64

**Ideal For:**
- Proof-of-concept projects
- Demo applications  
- Small personal projects
- Developers new to self-hosting

**Limitations:**
- Not suitable for high-traffic production apps
- Limited scalability options
- Single-server setup (no clustering)

**Source**: Open source solution available on GitHub from Neighbourhoodie Software

### Hetzner Cloud - Best Price/Performance

**Why Hetzner?**
- **Excellent Value**: CX22 plan at €3.79/month (~$4) offers 2 vCPU, 4GB RAM, 40GB SSD
- **European Provider**: GDPR-compliant, data centers in Germany and Finland
- **Better Specs**: More CPU/RAM than DigitalOcean's $6 plan for less money
- **Reliable**: Ranked 2nd Best VPS 2024 under $15, consistent performance grades
- **Flexible Billing**: Hourly billing available for testing configurations
- **Green Energy**: 100% renewable energy powered data centers

**Technical Features:**
- Intel Xeon Gold processors with best price-performance ratio
- 20TB monthly traffic (vs 1TB in US locations)
- Free IPv6, paid IPv4 available
- Snapshots and backups available
- API for automation

**Considerations:**
- Primarily European locations (good for EU users, higher latency for US/Asia)
- Newer company compared to DigitalOcean/Linode
- Less extensive documentation ecosystem

### Note on IBM Cloudant
IBM Cloudant starts at approximately **$75+/month** due to minimum provisioned throughput requirements (100 reads/sec, 50 writes/sec, 5 global queries/sec). This is significantly higher than initially researched and exceeds typical indie developer budgets.

## Conclusion

**Immediate Recommendation: CouchDB Minihosting**

Given budget constraints and ease of setup:
1. **Most Cost-Effective**: $4/month with automated setup
2. **Minimal Risk**: No breaking changes to existing architecture
3. **Maximum Compatibility**: PouchDB was designed for CouchDB sync
4. **Rapid Implementation**: Can be deployed in days, not weeks
5. **Preserve Offline-First**: Maintains core architectural strength
6. **Real-time Sync**: Solves multi-device problem immediately

**Setup Approach:**
- **Option A - CouchDB Minihosting** (Recommended for beginners):
  - Use automated setup scripts from Neighbourhoodie Software
  - Includes Docker, HTTPS with Let's Encrypt, haproxy/nginx
  - Works on Hetzner CX22 (€3.79/month) or DigitalOcean ($4/month)
  - Perfect for demos, proof-of-concept, small projects
- **Option B - Manual Docker Setup**:
  - Use Docker Compose for custom CouchDB deployment
  - Implement basic auth and HTTPS via Let's Encrypt
  - Hetzner CX22 (€3.79/month) offers better specs than DigitalOcean
  - More control but requires more setup work

**Future Considerations:**
- Monitor usage patterns and costs
- Evaluate managed providers if traffic grows significantly
- Consider Supabase if need advanced features (auth, storage, analytics)

CouchDB Minihosting provides the ideal balance of cost ($4/month), ease of setup (automated scripts), and technical compatibility (native PouchDB sync) for indie developers.