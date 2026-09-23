# AI SaaS Platform Integration and Security Protocol

## Scoped API Key Access Architecture
The AI SaaS Platform uses cryptographic SHA-256 hashed API keys. 
Secret keys are generated with the live prefix `sk_live_` and are never stored in plaintext.

### Supported Scope Tiers
1. `rag:query`: Allows programmatic client applications to query the organization's vector knowledge base with semantic search and citations.
2. `documents:write`: Permits uploading, chunking, and indexing of knowledge base documents (PDF, DOCX, TXT, Markdown).
3. `documents:read`: Permits listing indexed documents, viewing chunk distributions, and inspecting vector statuses.
4. `admin`: Full administrative access to all endpoints, FinOps billing attribution logs, and quota configurations.

## Multi-Tenant Isolation and Data Privacy
Each tenant's data is isolated at the database level by unique Organization UUIDs. 
Embeddings are computed using the `all-MiniLM-L6-v2` dense vector model and are strictly partitioned. 
Tenants cannot access or retrieve chunks across organization boundaries.
In transit data is secured via TLS 1.3, and at rest data is encrypted using AES-256.
