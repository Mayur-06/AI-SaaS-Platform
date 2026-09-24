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
  Database,
  Plus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { aiService } from '../../services/aiService';
import { useAuthStore } from '../../store/authStore';
import { extractErrorMessage } from '../../services/api';
import { toast } from 'sonner';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '../ui/AlertDialog';
import { ScrollArea } from '../ui/ScrollArea';
import { SimpleTooltip } from '../ui/Tooltip';

export const DocumentPanel = ({
  onDocumentsChange,
  isEmbedded = false,
  isSplit = false,
}) => {
  const { role, user } = useAuthStore();
  const canManageDocs = user?.is_staff || user?.is_superuser || role !== 'viewer';
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);

  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [pendingDeleteDoc, setPendingDeleteDoc] = useState(null); // { id, title }

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const res = await aiService.getDocuments(1);
      const docs = res.results || (Array.isArray(res) ? res : []);
      setDocuments(docs);
      if (onDocumentsChange) onDocumentsChange(docs);
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

  const handleFileChange = (e) => {
    const selected = e.target.files ? e.target.files[0] : null;
    setFile(selected);
    if (selected && !title.trim()) {
      const cleanName = selected.name.replace(/\.[^/.]+$/, '');
      setTitle(cleanName);
    }
  };

  const handleCreateDocument = async (e) => {
    e.preventDefault();
    if (!file) {
      setErrorMessage('Please select a document file (.pdf, .docx, .txt or .md) to upload.');
      return;
    }

    const docTitle = title.trim() || file.name.replace(/\.[^/.]+$/, '');

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const doc = await aiService.createDocument({
        title: docTitle,
        file,
      });

      toast.success(`Document "${doc.title || docTitle}" uploaded and indexed into knowledge base.`);
      setTitle('');
      setFile(null);
      await fetchDocuments();
    } catch (err) {
      const { message } = extractErrorMessage(err);
      setErrorMessage(`Error adding document: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteDoc) return;
    try {
      await aiService.deleteDocument(pendingDeleteDoc.id);
      toast.success('Document removed from knowledge base.');
      await fetchDocuments();
    } catch (err) {
      const { message } = extractErrorMessage(err);
      toast.error(`Failed to delete document: ${message}`);
    } finally {
      setPendingDeleteDoc(null);
    }
  };

  const totalChunks = documents.reduce((acc, d) => acc + (d.chunk_count || 0), 0);
  const Container = isEmbedded ? 'div' : Card;
  const containerProps = isEmbedded
    ? { className: 'space-y-4' }
    : { variant: 'bordered', className: 'shadow-sm space-y-4' };

  const scrollAreaHeight = isSplit
    ? (showUploadForm ? 'h-[180px]' : 'h-[240px]')
    : (showUploadForm ? 'h-[240px]' : 'h-[380px]');

  return (
    <Container {...containerProps}>
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#b2c147]/20 text-[#292929] flex items-center justify-center">
            <Database size={15} />
          </div>
          <div>
            <h3
              style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
              className="text-base font-bold text-[#292929] tracking-tight"
            >
              Knowledge Base
            </h3>
            <p className="text-[11px] text-gray-500">
              {documents.length} {documents.length === 1 ? 'doc' : 'docs'} • {totalChunks} chunks grounded in AI queries
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchDocuments}
            disabled={isLoading}
            className="flex items-center gap-1 text-xs px-2.5 py-1"
          >
            <RotateCw size={12} className={isLoading ? 'animate-spin text-[#b2c147]' : ''} />
            <span>Refresh</span>
          </Button>

          {canManageDocs && (
            <Button
              variant={showUploadForm ? 'secondary' : 'primary'}
              size="sm"
              onClick={() => setShowUploadForm(!showUploadForm)}
              className="flex items-center gap-1 text-xs px-2.5 py-1"
            >
              <Plus size={12} />
              <span>{showUploadForm ? 'Hide Upload' : 'Upload Doc'}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Status Alerts */}
      {errorMessage && (
        <div className="px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
          <AlertCircle size={15} className="text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Upload Document Form */}
      {showUploadForm && canManageDocs && (
        <form onSubmit={handleCreateDocument} className="p-3.5 sm:p-4 rounded-xl bg-gray-50/80 border border-gray-200 space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-gray-200/60">
            <span className="text-xs font-semibold text-[#292929] uppercase tracking-wider font-mono">
              Upload Document
            </span>
            <span className="text-[11px] text-gray-500 font-mono">
              .pdf, .docx, .txt, .md
            </span>
          </div>

          <div className="relative border-2 border-dashed border-[#b2c147]/60 hover:border-[#b2c147] bg-[#b2c147]/5 rounded-xl p-5 text-center transition-colors cursor-pointer group">
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md,.markdown"
              onChange={handleFileChange}
              disabled={isLoading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center justify-center gap-1.5 pointer-events-none">
              <div className="w-9 h-9 rounded-xl bg-[#b2c147]/20 text-[#292929] flex items-center justify-center group-hover:scale-105 transition-transform">
                <UploadCloud size={20} />
              </div>
              <span className="text-xs font-semibold text-[#292929]">
                {file ? file.name : 'Click to select or drag and drop document'}
              </span>
              <span className="text-[11px] text-gray-500 font-mono">
                {file ? `${(file.size / 1024).toFixed(1)} KB — ready to upload` : 'Supports PDF, DOCX, TXT and Markdown files'}
              </span>
            </div>
          </div>

          <Input
            label="Document Title"
            placeholder="e.g. Refund Policy, Company FAQ, Pricing Guide"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isLoading}
            className="text-xs py-1.5"
          />

          <Button
            type="submit"
            variant="primary"
            disabled={isLoading || !file}
            className="w-full py-2 text-xs font-medium flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5 text-[#292929]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Indexing Chunks…</span>
              </>
            ) : (
              <span>Upload & Index Document →</span>
            )}
          </Button>
        </form>
      )}

      {/* Previously Uploaded Documents List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-gray-500">
          <span>Previously Uploaded ({documents.length})</span>
          {/* <span>RAG Grounding Status</span> */}
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-7 border border-dashed border-gray-200 rounded-xl text-xs text-gray-400 px-4 space-y-2.5">
            <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
              <FileText size={18} />
            </div>
            <div>
              <p className="font-semibold text-gray-700 text-xs">No documents uploaded yet</p>
              <p className="text-[11px] text-gray-400 max-w-xs mx-auto mt-0.5">
                Upload company documents to ground AI queries with vector citations.
              </p>
            </div>
            {!showUploadForm && canManageDocs && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setShowUploadForm(true)}
                className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5"
              >
                <Plus size={13} />
                <span>Upload First Document</span>
              </Button>
            )}
          </div>
        ) : (
          <ScrollArea className={`${scrollAreaHeight} pr-2 w-full [&>div]:!block`}>
            <div className="space-y-2 w-full min-w-0">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="w-full p-3 rounded-xl border border-gray-200 bg-white hover:border-gray-300 transition-colors flex items-center justify-between gap-3 text-xs overflow-hidden"
                >
                  {/* Left: Icon, Title, Date */}
                  <div className="min-w-0 flex-1 flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center shrink-0 mt-0.5">
                      <FileText size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-xs text-[#292929] truncate block" title={doc.title}>
                        {doc.title}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono mt-0.5">
                        <span className="flex items-center gap-0.5 shrink-0">
                          <Clock size={10} />
                          {new Date(doc.created_at).toLocaleDateString()}
                        </span>
                        <span className="shrink-0">•</span>
                        <span className="flex items-center gap-0.5 text-gray-600 font-semibold bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                          <Layers size={9} />
                          {doc.chunk_count ?? 0} chunks
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Status badge & Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <Badge variant={doc.status === 'failed' ? 'red' : 'green'} className="text-[10px] px-1.5 py-0 shrink-0">
                      {doc.status || 'ready'}
                    </Badge>

                    {canManageDocs && (
                      <div className="flex items-center gap-1 ml-1 shrink-0">
                        <SimpleTooltip content="Delete document from knowledge base">
                          <button
                            type="button"
                            onClick={() => setPendingDeleteDoc({ id: doc.id, title: doc.title })}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer border border-transparent hover:border-red-200"
                            title="Delete Document"
                            aria-label={`Delete ${doc.title}`}
                          >
                            <Trash2 size={14} className="text-gray-500 hover:text-red-600" />
                          </button>
                        </SimpleTooltip>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Delete Document AlertDialog */}
      <AlertDialog
        open={Boolean(pendingDeleteDoc)}
        onOpenChange={(open) => { if (!open) setPendingDeleteDoc(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>&ldquo;{pendingDeleteDoc?.title}&rdquo;</strong> from the knowledge base?
              All associated vector embeddings will be pruned and this document will no longer ground AI queries.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="danger" onClick={handleConfirmDelete}>
              Delete Document
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Container>
  );
};
