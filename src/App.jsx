import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  UploadCloud, 
  Send, 
  Sparkles, 
  Bot, 
  User, 
  Trash2, 
  BookOpen, 
  Layers, 
  Key, 
  Plus, 
  MessageSquare, 
  AlertCircle,
  X,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export default function App() {
  const [backendOnline, setBackendOnline] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('GEMINI_API_KEY') || '');
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [tempKeyInput, setTempKeyInput] = useState('');

  // Documents State
  const [documents, setDocuments] = useState([]);
  const [activeDocId, setActiveDocId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Chat Sessions State
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);

  // Messages State
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // 1. Health check & Initial Data load
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/v1/health`, { method: 'GET' });
        setBackendOnline(res.ok);
      } catch {
        setBackendOnline(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 8000);
    return () => clearInterval(interval);
  }, []);

  // 2. Fetch Documents and Sessions when backend is online
  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
        if (data.documents && data.documents.length > 0 && !activeDocId) {
          setActiveDocId(data.documents[0].id);
        }
      }
    } catch (err) {
      console.warn('Could not fetch documents:', err);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/chats`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
        if (data.sessions && data.sessions.length > 0) {
          selectSession(data.sessions[0].id);
        } else {
          createNewSession("Default Chat");
        }
      }
    } catch (err) {
      console.warn('Could not fetch sessions:', err);
    }
  };

  useEffect(() => {
    if (backendOnline) {
      fetchDocuments();
      fetchSessions();
    }
  }, [backendOnline]);

  // Select a session and load its messages
  const selectSession = async (sessionId) => {
    setActiveSessionId(sessionId);
    try {
      const res = await fetch(`${API_BASE_URL}/chats/${sessionId}/messages`);
      if (res.ok) {
        const data = await res.json();
        const loadedMessages = (data.messages || []).map(m => ({
          id: m.id,
          sender: m.role === 'user' ? 'user' : 'ai',
          text: m.content,
          sources: m.sources || []
        }));
        setMessages(loadedMessages);
      }
    } catch (err) {
      console.error('Error fetching session messages:', err);
    }
  };

  // Create a new chat session
  const createNewSession = async (title = "New Chat") => {
    if (!backendOnline) {
      const fakeId = `local-${Date.now()}`;
      setSessions(prev => [{ id: fakeId, title, created_at: new Date().toISOString() }, ...prev]);
      setActiveSessionId(fakeId);
      setMessages([]);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(prev => [data.session, ...prev]);
        setActiveSessionId(data.session.id);
        setMessages([]);
      }
    } catch (err) {
      console.error('Error creating chat session:', err);
    }
  };

  // Delete a session
  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation();
    try {
      await fetch(`${API_BASE_URL}/chats/${sessionId}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setMessages([]);
        setActiveSessionId(null);
      }
    } catch (err) {
      console.error('Error deleting session:', err);
    }
  };

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const activeDoc = documents.find(d => d.id === activeDocId);

  // File Upload Handler
  const handleFileUpload = async (file) => {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Only PDF documents are supported.');
      return;
    }
    setUploadError('');
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    const headers = {};
    if (geminiApiKey) {
      headers['X-Gemini-Api-Key'] = geminiApiKey;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/documents`, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Upload failed');
      }

      const result = await res.json();
      await fetchDocuments();
      if (result.data && result.data.id) {
        setActiveDocId(result.data.id);
      }

      setMessages(prev => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          sender: 'ai',
          text: `📄 Ingested and indexed "${file.name}" (${result.data.total_pages} pages). You can now ask questions about it!`,
          sources: []
        }
      ]);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Delete Document
  const handleDeleteDocument = async (e, docId) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this document and its vector embeddings?')) return;
    try {
      await fetch(`${API_BASE_URL}/documents/${docId}`, { method: 'DELETE' });
      setDocuments(prev => prev.filter(d => d.id !== docId));
      if (activeDocId === docId) {
        setActiveDocId(null);
      }
    } catch (err) {
      console.error('Error deleting document:', err);
    }
  };

  // Send Question with Streaming or Fallback
  const handleSend = async (questionText = inputValue) => {
    const query = questionText.trim();
    if (!query || isLoading) return;

    let targetSessionId = activeSessionId;
    if (!targetSessionId) {
      await createNewSession("Document Inquiry");
      targetSessionId = activeSessionId;
    }

    const userMsg = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: query
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    if (backendOnline && targetSessionId) {
      const headers = { 'Content-Type': 'application/json' };
      if (geminiApiKey) {
        headers['X-Gemini-Api-Key'] = geminiApiKey;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/chats/${targetSessionId}/messages`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            question: query,
            document_id: activeDocId,
            stream: false
          })
        });

        if (response.ok) {
          const data = await response.json();
          setMessages(prev => [
            ...prev,
            {
              id: data.message_id || `ai-${Date.now()}`,
              sender: 'ai',
              text: data.answer,
              sources: data.sources || []
            }
          ]);
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.error('Failed to query backend chat:', err);
      }
    }

    // Offline / Standby Simulated Fallback
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: `Backend is in standby or offline. Once the Python FastAPI server is running with 'uvicorn app.main:app --reload --port 8000', questions will be retrieved from ChromaDB and answered by Google Gemini with real page citations!`,
          sources: activeDoc ? [{ filename: activeDoc.filename, page_number: 1, excerpt: "Sample indexed document passage." }] : []
        }
      ]);
      setIsLoading(false);
    }, 600);
  };

  const saveApiKey = () => {
    localStorage.setItem('GEMINI_API_KEY', tempKeyInput.trim());
    setGeminiApiKey(tempKeyInput.trim());
    setIsKeyModalOpen(false);
  };

  const samplePrompts = [
    { title: 'Executive Summary', prompt: 'Summarize this document in 3 concise bullet points.' },
    { title: 'Key Findings & Decisions', prompt: 'What are the main findings, takeaways, or conclusions?' },
    { title: 'Methodology / Rules', prompt: 'Explain the core methodology, requirements, or architecture.' },
    { title: 'Action Items', prompt: 'List any actionable next steps or recommendations mentioned.' }
  ];

  return (
    <div className="app-container">
      <div className="app-layout">
        {/* Left Sidebar */}
        <aside className="sidebar">
          {/* Brand */}
          <div className="brand">
            <div className="brand-icon">
              <Bot size={22} />
            </div>
            <div>
              <div className="brand-title">
                DocuMind <span className="brand-badge">RAG AI</span>
              </div>
            </div>
          </div>

          {/* Backend Status */}
          <div className="status-pill">
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <span className={`status-dot ${backendOnline ? 'online' : 'offline'}`} />
              FastAPI + ChromaDB
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: backendOnline ? 'var(--accent-emerald)' : '#f43f5e' }}>
              {backendOnline ? 'ONLINE' : 'STANDBY'}
            </span>
          </div>

          {/* PDF Upload Dropzone */}
          <div>
            <div 
              className={`upload-card ${isDragOver ? 'drag-active' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileUpload(e.dataTransfer.files[0]);
                }
              }}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                accept=".pdf"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />
              <div className="upload-icon">
                <UploadCloud size={20} />
              </div>
              <div className="upload-title">
                {isUploading ? "Extracting & Embedding..." : "Upload PDF"}
              </div>
              <div className="upload-subtitle">Drag & drop or browse (max 15MB)</div>
            </div>
            {uploadError && (
              <div style={{ color: '#f43f5e', fontSize: '0.75rem', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={14} /> {uploadError}
              </div>
            )}
          </div>

          {/* Documents Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="section-header">
              <span className="section-label">Documents ({documents.length})</span>
            </div>
            <div className="items-list">
              {documents.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '6px 8px' }}>
                  No documents uploaded yet.
                </div>
              ) : (
                documents.map((doc) => (
                  <div 
                    key={doc.id} 
                    className={`list-item ${doc.id === activeDocId ? 'active' : ''}`}
                    onClick={() => setActiveDocId(doc.id)}
                  >
                    <div className="item-left">
                      <FileText size={16} color={doc.id === activeDocId ? 'var(--primary)' : 'var(--text-muted)'} />
                      <div>
                        <div className="item-name">{doc.filename}</div>
                        <div className="item-sub">{doc.total_pages} pages</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className={doc.status === 'ready' ? 'badge-ready' : 'badge-processing'}>
                        {doc.status}
                      </span>
                      <button 
                        className="btn-icon-danger"
                        title="Delete document"
                        onClick={(e) => handleDeleteDocument(e, doc.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Chat Sessions History Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            <div className="section-header">
              <span className="section-label">Chat Sessions</span>
              <button 
                className="btn-action" 
                style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                onClick={() => createNewSession(`Chat ${sessions.length + 1}`)}
              >
                <Plus size={12} /> New
              </button>
            </div>
            <div className="items-list" style={{ flex: 1, maxHeight: '220px' }}>
              {sessions.map((s) => (
                <div 
                  key={s.id} 
                  className={`list-item ${s.id === activeSessionId ? 'active' : ''}`}
                  onClick={() => selectSession(s.id)}
                >
                  <div className="item-left">
                    <MessageSquare size={14} color={s.id === activeSessionId ? 'var(--primary)' : 'var(--text-muted)'} />
                    <div className="item-name">{s.title}</div>
                  </div>
                  <button 
                    className="btn-icon-danger"
                    title="Delete session"
                    onClick={(e) => handleDeleteSession(e, s.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Gemini API Key Config Button */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
            <button 
              className="btn-action" 
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => {
                setTempKeyInput(geminiApiKey);
                setIsKeyModalOpen(true);
              }}
            >
              <Key size={14} /> {geminiApiKey ? "Gemini Key Configured" : "Set Gemini API Key"}
            </button>
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="main-chat">
          {/* Header */}
          <header className="chat-header">
            <div className="active-doc-badge">
              <BookOpen size={18} color="var(--primary)" />
              <span>{activeDoc ? activeDoc.filename : 'All Indexed Documents'}</span>
              {activeDoc && (
                <span className="brand-badge">
                  {activeDoc.total_pages} Pages Indexed
                </span>
              )}
            </div>
            <div className="header-actions">
              <button 
                className="btn-action"
                onClick={() => setMessages([])}
              >
                <Trash2 size={14} /> Clear Messages
              </button>
            </div>
          </header>

          {/* Messages */}
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="welcome-container animate-fade-in">
                <div className="welcome-hero-badge">
                  <Sparkles size={14} /> Grounded Document Intelligence
                </div>
                <h1 className="welcome-title">Ask anything about your document</h1>
                <p className="welcome-desc">
                  Every answer is strictly retrieved from your PDF chunks, powered by Gemini and ChromaDB vector search with traceable page citations.
                </p>
                <div className="prompt-suggestions">
                  {samplePrompts.map((p, idx) => (
                    <div 
                      key={idx} 
                      className="prompt-card"
                      onClick={() => handleSend(p.prompt)}
                    >
                      <div className="prompt-card-title">{p.title}</div>
                      <div className="prompt-card-sub">{p.prompt}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`message-row ${m.sender} animate-fade-in`}>
                  {m.sender === 'ai' && (
                    <div className="avatar ai">
                      <Bot size={18} />
                    </div>
                  )}
                  <div>
                    <div className="bubble">
                      <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                      {m.sources && m.sources.length > 0 && (
                        <div className="citations-container">
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Layers size={12} /> Citations:
                          </span>
                          {m.sources.map((s, idx) => (
                            <span 
                              key={idx} 
                              className="citation-chip"
                              title={s.excerpt || `Page ${s.page_number}`}
                            >
                              {s.filename ? `${s.filename} • ` : ''}Page {s.page_number}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {m.sender === 'user' && (
                    <div className="avatar user">
                      <User size={18} />
                    </div>
                  )}
                </div>
              ))
            )}

            {isLoading && (
              <div className="message-row ai animate-fade-in">
                <div className="avatar ai">
                  <Bot size={18} />
                </div>
                <div className="bubble">
                  <div className="typing-dots">
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="chat-input-wrapper">
            <div className="input-container">
              <input
                type="text"
                className="chat-input"
                placeholder={activeDoc ? `Ask a question about "${activeDoc.filename}"...` : "Upload a PDF or ask a question..."}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button 
                className="send-btn"
                disabled={!inputValue.trim() || isLoading}
                onClick={() => handleSend()}
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Gemini API Key Modal */}
      {isKeyModalOpen && (
        <div className="modal-overlay" onClick={() => setIsKeyModalOpen(false)}>
          <div className="modal-card animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Google Gemini API Key</div>
              <button 
                onClick={() => setIsKeyModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Enter your Google Gemini API key to enable live embedding creation and synthesized RAG answers. You can get a free key from Google AI Studio (<a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>aistudio.google.com</a>).
            </p>
            <input 
              type="password"
              className="modal-input"
              placeholder="AIzaSy..."
              value={tempKeyInput}
              onChange={(e) => setTempKeyInput(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn-action" onClick={() => setIsKeyModalOpen(false)}>
                Cancel
              </button>
              <button className="btn-action primary" onClick={saveApiKey}>
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
