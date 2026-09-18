import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  RotateCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
} from 'lucide-react';
import { aiService } from '../../services/aiService';
import { useAuthStore } from '../../store/authStore';
import { extractErrorMessage } from '../../services/api';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';

export const DocumentPanel = () => {
  const { role } = useAuthStore();
  const canManageDocs = role === 'owner' || role === 'admin' || role === 'member';
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(null);

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const res = await aiService.getDocuments(1);
      setDocuments(res.results || []);
    } catch (err) {
      const { message } = extractErrorMessage(err);
      setErrorMessage(`Failed to load documents: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleCreateDocument = async (e) => {
    e.preventDefault();
    if (!title.trim() || (!content.trim() && !file)) {
      setErrorMessage('Please provide a title and document content (or select a file).');
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setIsLoading(true);

    try {
      const doc = await aiService.createDocument({
        title,
        content: content || undefined,
        file: file || undefined,
      });

      setStatusMessage(`Document "${doc.title}" created. Now embedding vector chunks...`);
      try {
        const procRes = await aiService.processDocument(doc.id, content);
        setStatusMessage(
          `Document processed successfully! (${
            procRes.chunks_count || procRes.chunk_count || 0
          } vector chunks indexed)`
        );
      } catch (procErr) {
        setStatusMessage('Document created. Auto-processing queued or pending.');
      }

      setTitle('');
      setContent('');
      setFile(null);
      await fetchDocuments();
    } catch (err) {
      const { message } = extractErrorMessage(err);
      setErrorMessage(`Error adding document: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcess = async (id) => {
    setIsProcessing(id);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await aiService.processDocument(id);
      setStatusMessage(`Document processed into ${res.chunk_count || 0} chunks.`);
      await fetchDocuments();
    } catch (err) {
      const { message } = extractErrorMessage(err);
      setErrorMessage(`Processing error: ${message}`);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this document from the knowledge base?')) return;
    try {
      await aiService.deleteDocument(id);
      setStatusMessage('Document deleted successfully.');
      await fetchDocuments();
    } catch (err) {
      const { message } = extractErrorMessage(err);
      setErrorMessage(`Failed to delete: ${message}`);
    }
  };

  return (
    <Card variant="bordered" className="shadow-sm space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-100 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-lg font-bold text-[#292929] tracking-tight"
          >
            Knowledge Base (RAG Documents)
          </h3>
          <Badge variant="lime">{documents.length} Indexed</Badge>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={fetchDocuments}
          disabled={isLoading}
          className="flex items-center gap-1.5"
        >
          <RotateCw size={13} className={isLoading ? 'animate-spin text-[#b2c147]' : ''} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Alerts */}
      {statusMessage && (
        <div className="px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-800 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Add Document Form */}
      {canManageDocs ? (
        <form onSubmit={handleCreateDocument} className="p-4 sm:p-5 rounded-2xl bg-gray-50/70 border border-gray-200/80 space-y-4">
          <h4
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-sm font-bold uppercase tracking-wider text-[#292929]"
          >
            Add Knowledge Document
          </h4>

          <Input
            label="Document Title"
            placeholder="e.g. Q3 Financial Audit, Employee Handbook"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            disabled={isLoading}
          />

          {/* File Upload Drop Area */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#292929] font-mono">
              Upload Document File (.pdf, .txt, .md)
            </label>
            <div className="relative border-2 border-dashed border-[#b2c147]/50 hover:border-[#b2c147] bg-[#b2c147]/5 rounded-xl p-5 text-center transition-colors cursor-pointer group">
              <input
                type="file"
                accept=".txt,.md,.pdf"
                onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                disabled={isLoading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center gap-1.5 pointer-events-none">
                <UploadCloud size={24} className="text-[#292929] group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-[#292929]">
                  {file ? file.name : 'Click or drop file here'}
                </span>
                <span className="text-[11px] text-gray-400 font-mono">
                  {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Supports PDF, TXT, and Markdown'}
                </span>
              </div>
            </div>
          </div>

          {/* Direct Text Alternative */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="doc-content"
              className="text-xs font-semibold uppercase tracking-wider text-[#292929] font-mono"
            >
              Or Paste Text Content
            </label>
            <textarea
              id="doc-content"
              rows={3}
              placeholder="Paste raw text, policies, or documentation here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isLoading}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white placeholder-gray-400 text-[#292929]
                         focus:outline-none focus:ring-2 focus:ring-[#b2c147] focus:border-transparent transition-all resize-y"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={isLoading || !title.trim() || (!content.trim() && !file)}
            className="w-full py-2.5 text-sm"
          >
            {isLoading ? 'Indexing Chunks…' : 'Add & Index Document →'}
          </Button>
        </form>
      ) : (
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-500 italic">
          Document ingestion and vector indexing require Member, Admin, or Owner permissions. (Viewer mode is active).
        </div>
      )}

      {/* Documents List */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-gray-500 mb-3">
          Indexed Knowledge Documents
        </h4>

        {documents.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl text-xs text-gray-400">
            No documents uploaded yet for this organization.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/80 text-xs font-mono text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3">Document</th>
                  <th className="px-4 py-3">Chunks</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Indexed</th>
                  {canManageDocs && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-gray-400 shrink-0" />
                        <span className="font-semibold text-xs text-[#292929] truncate max-w-[180px]">
                          {doc.title}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 font-mono text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                        <Layers size={11} />
                        {doc.chunk_count} chunks
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={doc.status === 'error' ? 'red' : 'green'}>
                        {doc.status || 'ready'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(doc.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    {canManageDocs && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleProcess(doc.id)}
                            disabled={isProcessing === doc.id}
                            className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-black bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                          >
                            {isProcessing === doc.id ? 'Processing…' : 'Reprocess'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(doc.id)}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete document"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
};
