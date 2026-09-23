import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Plus,
  ShieldAlert,
  Key,
  Lock,
  Copy,
  Terminal,
  Code,
  Check,
  Sparkles,
  UploadCloud,
  BookOpen,
  FileCode,
  Layers,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { billingService } from '../../services/billingService';
import { useAuthStore } from '../../store/authStore';
import { KeyList } from '../../components/keys/KeyList';
import { CreateKeyModal } from '../../components/keys/CreateKeyModal';
import { KeyRevealDialog } from '../../components/keys/KeyRevealDialog';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs';
import { SimpleTooltip } from '../../components/ui/Tooltip';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '../../components/ui/AlertDialog';
import { copyToClipboard } from '../../lib/utils';
import { extractErrorMessage } from '../../services/api';

export const APIKeysPage = () => {
  const { role, user, organization } = useAuthStore();
  const [keys, setKeys] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [revealedKey, setRevealedKey] = useState(null);

  // AlertDialog states
  const [pendingRevoke, setPendingRevoke] = useState(null);     // keyId
  const [pendingRegenerate, setPendingRegenerate] = useState(null); // keyId
  const [copiedSnippet, setCopiedSnippet] = useState(null);

  // Quickstart Code Sample states
  const [selectedOperation, setSelectedOperation] = useState('query'); // 'query' | 'upload' | 'list' | 'sdk'
  const [selectedLang, setSelectedLang] = useState('python'); // 'python' | 'curl' | 'node'

  const apiBaseUrl = typeof window !== 'undefined' && window.location.host === '116.202.210.102:20358'
    ? `${window.location.origin}/api`
    : 'http://116.202.210.102:20358/api';

  const activeKeySample = 'enter your api key';

  const copySnippet = async (text, key) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedSnippet(key);
      toast.success('Code snippet copied to clipboard.');
      setTimeout(() => setCopiedSnippet(null), 2000);
    } else {
      toast.error('Failed to copy code snippet.');
    }
  };

  const getSnippet = () => {
    if (selectedOperation === 'sdk') {
      return `"""
AI SaaS Platform — Official External Developer Python SDK Client Example
========================================================================

Installation:
    pip install requests
"""

import os
import requests
from pathlib import Path
from typing import Optional, Dict, Any, List


class AISaaSClient:
    """
    Client for interacting with the AI SaaS Platform API via API key authentication.
    """

    def __init__(self, api_key: str, base_url: str = "${apiBaseUrl}"):
        self.api_key = api_key.strip()
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
        })

    def query(
        self,
        question: str,
        model: str = "gemini-2.5-flash",
        top_k: int = 8,
        document_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Execute a RAG question answering query against the tenant's vector database.
        """
        url = f"{self.base_url}/ai/query/"
        payload = {"question": question, "model": model, "top_k": top_k}
        if document_id:
            payload["document_id"] = document_id

        res = self.session.post(url, json=payload)
        res.raise_for_status()
        data = res.json()

        print("\\n=== RAG Synthesized Answer ===")
        print(data.get("answer"))
        print("\\n=== Cited Passages ===")
        for chunk in data.get("cited_chunks", []):
            print(f"- {chunk.get('document_title')} (Section {chunk.get('chunk_index', 0) + 1}) [Relevance: {chunk.get('score')}]")
        return data

    def upload_document(self, file_path: str, title: Optional[str] = None) -> Dict[str, Any]:
        """
        Uploads a PDF, DOCX, TXT, or Markdown document.
        Automatically chunks text and computes vector embeddings for RAG search.
        """
        path = Path(file_path)
        if not path.is_file():
            raise FileNotFoundError(f"File not found: {file_path}")

        url = f"{self.base_url}/ai/documents/"
        with open(path, "rb") as f:
            files = {"file": (path.name, f, "application/octet-stream")}
            data = {"title": title or path.name}
            headers = {"Authorization": f"Bearer {self.api_key}"}
            res = requests.post(url, files=files, data=data, headers=headers)

        res.raise_for_status()
        doc = res.json()
        print(f"\\n[Uploaded] ID: {doc.get('id')} | Title: {doc.get('title')} | Status: {doc.get('status')} | Chunks: {doc.get('chunk_count', 0)}")
        return doc

    def list_documents(self) -> List[Dict[str, Any]]:
        """List all indexed documents in the tenant's knowledge base."""
        url = f"{self.base_url}/ai/documents/"
        res = self.session.get(url)
        res.raise_for_status()
        data = res.json()
        items = data.get("results", data) if isinstance(data, dict) else data
        print(f"\\n=== Knowledge Base ({len(items)} docs) ===")
        for d in items:
            print(f"- [{d.get('status', '').upper()}] {d.get('title')} (ID: {d.get('id')}) | Chunks: {d.get('chunk_count', 0)}")
        return items


# =============================================================================
# Quickstart Usage Demonstration
# =============================================================================
if __name__ == "__main__":
    API_KEY = os.getenv("AI_SAAS_API_KEY", "${activeKeySample}")
    client = AISaaSClient(api_key=API_KEY)

    # 1. Query the RAG Pipeline
    client.query("What are the key insights in our knowledge base?")

    # 2. Upload and index a document (PDF, DOCX, TXT, MD)
    # client.upload_document("research_paper.pdf", title="Q3 Publication")

    # 3. List indexed knowledge base documents
    # client.list_documents()`;
    }

    if (selectedOperation === 'query') {
      if (selectedLang === 'python') {
        return `import requests

API_KEY = "${activeKeySample}"
BASE_URL = "${apiBaseUrl}"

# Submit a semantic RAG query with vector search and LLM synthesis
response = requests.post(
    f"{BASE_URL}/ai/query/",
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    },
    json={
        "question": "What methods were used to differentiate hiPSCs into muscle progenitor cells?",
        "model": "gemini-2.5-flash",  # Target model ('gemini-2.5-flash', 'gemini-2.5-pro', or 'auto')
        "top_k": 8                    # Number of semantic passages to retrieve
    }
)

data = response.json()

print("=== Synthesized Answer ===")
print(data.get("answer"))

print("\\n=== Cited Sources ===")
for chunk in data.get("cited_chunks", []):
    print(f"- {chunk.get('document_title')} (Section {chunk.get('chunk_index', 0) + 1}) [Score: {chunk.get('score')}]")`;
      }
      if (selectedLang === 'curl') {
        return `curl -X POST "${apiBaseUrl}/ai/query/" \\
  -H "Authorization: Bearer ${activeKeySample}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "question": "What methods were used to differentiate hiPSCs into muscle progenitor cells?",
    "model": "gemini-2.5-flash",
    "top_k": 8
  }'`;
      }
      return `const API_KEY = "${activeKeySample}";
const BASE_URL = "${apiBaseUrl}";

const response = await fetch(\`\${BASE_URL}/ai/query/\`, {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    question: "What methods were used to differentiate hiPSCs into muscle progenitor cells?",
    model: "gemini-2.5-flash",
    top_k: 8,
  }),
});

const data = await response.json();
console.log("RAG Answer:", data.answer);
console.log("Cited Sources:", data.cited_chunks);`;
    }

    if (selectedOperation === 'upload') {
      if (selectedLang === 'python') {
        return `import requests
from pathlib import Path

API_KEY = "${activeKeySample}"
BASE_URL = "${apiBaseUrl}"
FILE_PATH = "research_paper.pdf"  # Supports .pdf, .docx, .txt, .md

# Automatically extracts text, chunks, computes embeddings, and indexes into vector store
with open(FILE_PATH, "rb") as f:
    files = {"file": (Path(FILE_PATH).name, f, "application/octet-stream")}
    data = {"title": "Stem Cell Regeneration Study"}
    response = requests.post(
        f"{BASE_URL}/ai/documents/",
        files=files,
        data=data,
        headers={"Authorization": f"Bearer {API_KEY}"}
    )

doc = response.json()
print(f"Uploaded: {doc.get('title')} (ID: {doc.get('id')}) | Status: {doc.get('status')} | Chunks: {doc.get('chunk_count', 0)}")`;
      }
      if (selectedLang === 'curl') {
        return `curl -X POST "${apiBaseUrl}/ai/documents/" \\
  -H "Authorization: Bearer ${activeKeySample}" \\
  -F "file=@/path/to/research_paper.pdf" \\
  -F "title=Stem Cell Regeneration Study"`;
      }
      return `import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

const form = new FormData();
form.append('file', fs.createReadStream('research_paper.pdf'));
form.append('title', 'Stem Cell Regeneration Study');

const response = await fetch('${apiBaseUrl}/ai/documents/', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${activeKeySample}',
    ...form.getHeaders(),
  },
  body: form,
});

const doc = await response.json();
console.log('Indexed Document:', doc);`;
    }

    if (selectedOperation === 'list') {
      if (selectedLang === 'python') {
        return `import requests

API_KEY = "${activeKeySample}"
BASE_URL = "${apiBaseUrl}"

# List all indexed documents in the organization's knowledge base
response = requests.get(
    f"{BASE_URL}/ai/documents/",
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Accept": "application/json"
    }
)

documents = response.json()
items = documents.get("results", documents) if isinstance(documents, dict) else documents

print(f"=== Knowledge Base ({len(items)} documents) ===")
for doc in items:
    print(f"- [{doc.get('status', '').upper()}] {doc.get('title')} (ID: {doc.get('id')}) | Chunks: {doc.get('chunk_count', 0)}")`;
      }
      if (selectedLang === 'curl') {
        return `curl -X GET "${apiBaseUrl}/ai/documents/" \\
  -H "Authorization: Bearer ${activeKeySample}" \\
  -H "Accept: application/json"`;
      }
      return `const response = await fetch("${apiBaseUrl}/ai/documents/", {
  headers: {
    "Authorization": "Bearer ${activeKeySample}",
    "Accept": "application/json",
  },
});

const data = await response.json();
const docs = data.results || data;
console.log("Documents in Knowledge Base:", docs);`;
    }

    return '';
  };

  const canManage = role === 'owner' || role === 'admin';

  const fetchKeys = async (page = currentPage) => {
    setIsLoading(true);
    try {
      const res = await billingService.getKeys(page);
      const activeKeys = (res.results || []).filter((k) => k.is_active !== false);
      setKeys(activeKeys);
      setTotalCount(res.count !== undefined ? activeKeys.length : activeKeys.length);
      setCurrentPage(page);
    } catch (err) {
      const { message } = extractErrorMessage(err);
      toast.error(`Failed to load keys: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canManage && (organization || !user?.is_staff)) {
      fetchKeys(1);
    }
  }, [organization, user, canManage]);

  const handleCreateKey = async (data) => {
    setIsLoading(true);
    try {
      const newKey = await billingService.createKey(data);
      setIsCreateModalOpen(false);
      await fetchKeys(1);

      if (newKey.full_key) {
        setRevealedKey({
          fullKey: newKey.full_key,
          keyName: newKey.name,
        });
      } else {
        toast.success('API key created successfully.');
      }
    } catch (err) {
      const { message } = extractErrorMessage(err);
      toast.error(`Failed to create key: ${message}`);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateKey = async () => {
    if (!pendingRegenerate) return;
    const oldId = pendingRegenerate;
    setIsLoading(true);
    try {
      const regenerated = await billingService.regenerateKey(oldId);
      setKeys((prev) => prev.filter((k) => k.id !== oldId));
      await fetchKeys(currentPage);

      if (regenerated.full_key) {
        setRevealedKey({
          fullKey: regenerated.full_key,
          keyName: regenerated.name,
        });
      } else {
        toast.success('Key regenerated successfully.');
      }
    } catch (err) {
      const { message } = extractErrorMessage(err);
      toast.error(`Regeneration failed: ${message}`);
    } finally {
      setIsLoading(false);
      setPendingRegenerate(null);
    }
  };

  const handleRevokeKey = async () => {
    if (!pendingRevoke) return;
    const targetId = pendingRevoke;
    setIsLoading(true);
    try {
      await billingService.revokeKey(targetId);
      setKeys((prev) => prev.filter((k) => k.id !== targetId));
      toast.success('API key revoked. Applications using it have lost access.');
      await fetchKeys(currentPage);
    } catch (err) {
      const { message } = extractErrorMessage(err);
      toast.error(`Revocation failed: ${message}`);
    } finally {
      setIsLoading(false);
      setPendingRevoke(null);
    }
  };

  const handleUpdateKey = async (id, name, permissions) => {
    setIsLoading(true);
    try {
      await billingService.updateKey(id, { name, permissions });
      toast.success('API key updated.');
      await fetchKeys(currentPage);
    } catch (err) {
      const { message } = extractErrorMessage(err);
      toast.error(`Update failed: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / 20) || 1;

  if (!organization && user?.is_staff) {
    return (
      <Card variant="bordered" className="max-w-xl mx-auto text-center py-12 px-6 shadow-sm space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center mx-auto">
          <ShieldAlert size={24} />
        </div>
        <h2
          style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
          className="text-2xl font-bold text-[#292929]"
        >
          Superadmin Console Mode
        </h2>
        <p className="text-xs text-gray-500 leading-relaxed max-w-md mx-auto">
          API keys are scoped to specific tenant organizations. You are currently logged in as a <strong>Platform Superadmin</strong> without an active tenant organization context.
        </p>
        <div className="pt-2">
          <Link to="/admin" className="no-underline">
            <Button variant="dark" size="md">
              Go to Superadmin Console →
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  if (!canManage) {
    return (
      <Card variant="bordered" className="max-w-xl mx-auto text-center py-12 px-6 shadow-sm space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
          <Lock size={24} />
        </div>
        <h2
          style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
          className="text-2xl font-bold text-[#292929]"
        >
          API Key Management Restricted
        </h2>
        <p className="text-xs text-gray-500 leading-relaxed max-w-md mx-auto">
          Programmatic API keys provide administrative access to organization endpoints. Your current role is <strong className="uppercase font-mono">{role || 'member'}</strong>. Key generation and secret inspection require Admin or Owner permissions.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-100">
        <div>
          <h1
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-2xl sm:text-3xl font-extrabold text-[#292929] tracking-tight"
          >
            API Keys Management
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Generate and manage hashed secret credentials with organization-scoped rate limits.
          </p>
        </div>

        {canManage && (
          <Button
            variant="primary"
            size="md"
            onClick={() => setIsCreateModalOpen(true)}
            className="self-start sm:self-auto flex items-center gap-1.5"
          >
            <Plus size={16} />
            <span>Generate New Key</span>
          </Button>
        )}
      </div>

      {/* Key Table */}
      <KeyList
        keys={keys}
        onRevoke={(id) => setPendingRevoke(id)}
        onRegenerate={(id) => setPendingRegenerate(id)}
        onUpdate={handleUpdateKey}
        isLoading={isLoading}
        canManage={canManage}
      />

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-500">
        <span>
          Showing page <strong className="text-[#292929]">{currentPage}</strong> of{' '}
          <strong className="text-[#292929]">{totalPages}</strong> ({totalCount} keys total)
        </span>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={currentPage <= 1 || isLoading}
            onClick={() => fetchKeys(currentPage - 1)}
          >
            ← Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={currentPage >= totalPages || isLoading}
            onClick={() => fetchKeys(currentPage + 1)}
          >
            Next →
          </Button>
        </div>
      </div>

      {/* Integration Quickstart & Developer Code Samples */}
      <Card variant="bordered" className="shadow-sm space-y-5 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#b2c147]/20 text-[#292929] flex items-center justify-center font-bold shrink-0">
              <Code size={20} />
            </div>
            <div>
              <h3
                style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
                className="text-lg font-bold text-[#292929] tracking-tight"
              >
                Developer Quickstart &amp; External Code Integration
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Connect external applications, scripts, or pipelines to the AI service using your API key.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-[11px] font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded-md border border-gray-200">
              Base URL: <strong className="text-[#292929]">{apiBaseUrl}</strong>
            </span>
          </div>
        </div>

        {/* Operation Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-gray-100 text-xs">
          <button
            type="button"
            onClick={() => setSelectedOperation('query')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              selectedOperation === 'query'
                ? 'bg-[#292929] text-white shadow-sm'
                : 'text-gray-600 hover:text-[#292929] hover:bg-gray-100'
            }`}
          >
            <Sparkles size={14} className={selectedOperation === 'query' ? 'text-[#b2c147]' : ''} />
            <span>1. Ask AI (RAG Query)</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedOperation('upload')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              selectedOperation === 'upload'
                ? 'bg-[#292929] text-white shadow-sm'
                : 'text-gray-600 hover:text-[#292929] hover:bg-gray-100'
            }`}
          >
            <UploadCloud size={14} className={selectedOperation === 'upload' ? 'text-[#b2c147]' : ''} />
            <span>2. Upload Document</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedOperation('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              selectedOperation === 'list'
                ? 'bg-[#292929] text-white shadow-sm'
                : 'text-gray-600 hover:text-[#292929] hover:bg-gray-100'
            }`}
          >
            <BookOpen size={14} className={selectedOperation === 'list' ? 'text-[#b2c147]' : ''} />
            <span>3. List Knowledge Base</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedOperation('sdk')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              selectedOperation === 'sdk'
                ? 'bg-[#292929] text-white shadow-sm'
                : 'text-gray-600 hover:text-[#292929] hover:bg-gray-100'
            }`}
          >
            <Layers size={14} className={selectedOperation === 'sdk' ? 'text-[#b2c147]' : ''} />
            <span>Full Python Client SDK</span>
          </button>
        </div>

        {/* Language selector (for query, upload, list) */}
        {selectedOperation !== 'sdk' && (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setSelectedLang('python')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                  selectedLang === 'python' ? 'bg-white text-[#292929] shadow-xs' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <Code size={13} />
                <span>Python</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedLang('curl')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                  selectedLang === 'curl' ? 'bg-white text-[#292929] shadow-xs' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <Terminal size={13} />
                <span>cURL</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedLang('node')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                  selectedLang === 'node' ? 'bg-white text-[#292929] shadow-xs' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <FileCode size={13} />
                <span>Node.js / Fetch</span>
              </button>
            </div>

            <span className="text-[11px] text-gray-500 flex items-center gap-1">
              <Info size={12} className="text-gray-400" />
              Auth header: <code className="bg-gray-100 px-1 rounded text-gray-700 font-mono">Authorization: Bearer &lt;KEY&gt;</code>
            </span>
          </div>
        )}

        {/* Code Box */}
        <div className="relative rounded-xl bg-[#292929] p-4 text-xs font-mono text-gray-200 overflow-x-auto shadow-inner">
          <SimpleTooltip content="Copy snippet to clipboard">
            <button
              type="button"
              onClick={() => copySnippet(getSnippet(), `${selectedOperation}-${selectedLang}`)}
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-sans"
            >
              {copiedSnippet === `${selectedOperation}-${selectedLang}` ? (
                <>
                  <Check size={13} className="text-[#b2c147]" />
                  <span className="text-[#b2c147] text-[11px] font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span className="text-[11px]">Copy</span>
                </>
              )}
            </button>
          </SimpleTooltip>
          <pre className="text-xs leading-relaxed text-gray-300 whitespace-pre-wrap font-mono">
            {getSnippet()}
          </pre>
        </div>

        {/* Operation Specs Footer */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
          <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100 space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-gray-400 font-mono tracking-wider block">Endpoint</span>
            <span className="font-mono font-semibold text-gray-800 text-[11px]">
              {selectedOperation === 'query' && 'POST /api/ai/query/'}
              {selectedOperation === 'upload' && 'POST /api/ai/documents/'}
              {selectedOperation === 'list' && 'GET /api/ai/documents/'}
              {selectedOperation === 'sdk' && 'REST API Suite (/api/ai/*)'}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100 space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-gray-400 font-mono tracking-wider block">Required Scope</span>
            <span className="font-mono text-purple-700 font-semibold text-[11px]">
              {selectedOperation === 'query' && 'rag:query (or write / admin:*)'}
              {selectedOperation === 'upload' && 'documents:write (or write / admin:*)'}
              {selectedOperation === 'list' && 'documents:read (or write / admin:*)'}
              {selectedOperation === 'sdk' && 'rag:query, documents:write, documents:read'}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100 space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-gray-400 font-mono tracking-wider block">Authentication</span>
            <span className="text-gray-700 text-[11px]">
              <code className="font-mono bg-white px-1 py-0.5 rounded border border-gray-200">Bearer &lt;key&gt;</code> or <code className="font-mono bg-white px-1 py-0.5 rounded border border-gray-200">X-API-Key</code>
            </span>
          </div>
        </div>
      </Card>

      {/* Create Modal */}
      <CreateKeyModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateKey}
        isLoading={isLoading}
      />

      {/* One-Time Key Reveal Dialog */}
      {revealedKey && (
        <KeyRevealDialog
          fullKey={revealedKey.fullKey}
          keyName={revealedKey.keyName}
          onClose={() => setRevealedKey(null)}
        />
      )}

      {/* Revoke Confirm Dialog */}
      <AlertDialog open={Boolean(pendingRevoke)} onOpenChange={(open) => { if (!open) setPendingRevoke(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This will <strong className="text-red-600">immediately revoke</strong> this API key. Any application or script using it will lose access right away. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="danger" onClick={handleRevokeKey} disabled={isLoading}>
              {isLoading ? 'Revoking…' : 'Revoke key'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Regenerate Confirm Dialog */}
      <AlertDialog open={Boolean(pendingRegenerate)} onOpenChange={(open) => { if (!open) setPendingRegenerate(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              The existing secret will be <strong className="text-red-600">immediately invalidated</strong> and a new one will be generated. Update any integrations using the old key before closing the reveal dialog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="danger" onClick={handleRegenerateKey} disabled={isLoading}>
              {isLoading ? 'Regenerating…' : 'Regenerate key'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
