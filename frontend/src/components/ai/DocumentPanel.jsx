import React, { useState, useEffect } from 'react';
import { aiService } from '../../services/aiService';
import { useAuthStore } from '../../store/authStore';
import { extractErrorMessage } from '../../services/api';

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

      setStatusMessage(`Document "${doc.title}" created. Now embedding chunks...`);
      // Trigger automatic chunking & vector embedding
      try {
        const procRes = await aiService.processDocument(doc.id, content);
        setStatusMessage(`Document processed successfully! (${procRes.chunks_count || procRes.chunk_count || 0} vector chunks indexed)`);
      } catch (procErr) {
        setStatusMessage(`Document created. Auto-processing queued or pending.`);
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
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Knowledge Base (RAG Documents)</h3>
        <button onClick={fetchDocuments} style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}>
          Refresh List
        </button>
      </div>

      {statusMessage && <div className="alert alert-success">{statusMessage}</div>}
      {errorMessage && <div className="alert alert-error">{errorMessage}</div>}

      {/* Add Document Form */}
      {canManageDocs ? (
        <form onSubmit={handleCreateDocument} style={{ marginBottom: '1.5rem', padding: '0.75rem', background: '#fafafa', border: '1px solid #ddd', borderRadius: '4px' }}>
          <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Add Knowledge Document</h4>

          <div className="form-group">
            <label htmlFor="doc-title">Document Title</label>
            <input
              id="doc-title"
              type="text"
              placeholder="e.g. Employee Handbook, Pricing Guide"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="doc-content">Direct Text Content</label>
            <textarea
              id="doc-content"
              rows={3}
              placeholder="Paste text content here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="doc-file">Or Upload File (.txt, .md, .pdf)</label>
            <input
              id="doc-file"
              type="file"
              onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? 'Uploading & Indexing...' : 'Add & Index Document'}
          </button>
        </form>
      ) : (
        <p style={{ color: '#888', fontStyle: 'italic', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Document ingestion and index modifications are restricted to Members, Admins, and Owners. (Viewer: Read-Only)
        </p>
      )}

      {/* Documents List */}
      <div>
        <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Indexed Documents ({documents.length})</h4>
        {documents.length === 0 ? (
          <p style={{ color: '#777', fontStyle: 'italic' }}>No documents uploaded yet for this organization.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Chunks</th>
                <th>Status</th>
                <th>Created</th>
                {canManageDocs && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td><strong>{doc.title}</strong></td>
                  <td><span className="badge">{doc.chunk_count} chunks</span></td>
                  <td><span className="badge badge-active">{doc.status || 'ready'}</span></td>
                  <td style={{ fontSize: '0.8rem' }}>{new Date(doc.created_at).toLocaleDateString()}</td>
                  {canManageDocs && (
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button
                          onClick={() => handleProcess(doc.id)}
                          disabled={isProcessing === doc.id}
                          style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                        >
                          {isProcessing === doc.id ? 'Processing...' : 'Reprocess'}
                        </button>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="btn-danger"
                          style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
