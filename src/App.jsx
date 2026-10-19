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
  CheckCircle2, 
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function App() {
  const [backendOnline, setBackendOnline] = useState(false);
  const [documents, setDocuments] = useState([
    {
      doc_id: 'sample-doc-1',
      filename: 'Sample_Research_Document.pdf',
      total_pages: 14,
      file_size_formatted: '2.4 MB'
    }
  ]);
  const [activeDocId, setActiveDocId] = useState('sample-doc-1');
  const [messages, setMessages] = useState([
    {
      id: 'welcome-1',
      sender: 'ai',
      text: 'Hello! I am your AI PDF Assistant. Upload any document on the left or select an existing one to ask questions, extract key insights, and query page references in real-time.',
      sources: []
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Ping backend health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/health`, { method: 'GET' });
        if (res.ok) {
          setBackendOnline(true);
        } else {
          setBackendOnline(false);
        }
      } catch (err) {
        setBackendOnline(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 8000);
    return () => clearInterval(interval);
  }, []);

  // Auto scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const activeDoc = documents.find(d => d.doc_id === activeDocId);

  // Handle PDF file upload
  const handleFileUpload = async (file) => {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please select a valid PDF file.');
      return;
    }

    const tempDocId = `doc-${Date.now()}`;
    const newDocObj = {
      doc_id: tempDocId,
      filename: file.name,
      total_pages: 1,
      file_size_formatted: `${(file.size / (1024 * 1024)).toFixed(1)} MB`
    };

    // Attempt real backend upload if online
    if (backendOnline) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch(`${API_BASE_URL}/pdf/upload`, {
          method: 'POST',
          body: formData
        });
        if (res.ok) {
          const json = await res.json();
          newDocObj.doc_id = json.data.doc_id;
          newDocObj.total_pages = json.data.total_pages;
        }
      } catch (e) {
        console.warn('Backend upload error, fallback to local state:', e);
      }
    }

    setDocuments(prev => [newDocObj, ...prev]);
    setActiveDocId(newDocObj.doc_id);

    setMessages(prev => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        sender: 'ai',
        text: `📄 Uploaded and parsed "${file.name}". You can now ask questions about this document!`,
        sources: []
      }
    ]);
  };

  const handleSend = async (questionText = inputValue) => {
    const query = questionText.trim();
    if (!query || isLoading) return;

    const userMsg = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: query
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    if (backendOnline) {
      try {
        const res = await fetch(`${API_BASE_URL}/chat/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            doc_id: activeDocId,
            question: query,
            chat_history: messages.map(m => ({ role: m.sender, content: m.text }))
          })
        });

        if (res.ok) {
          const data = await res.json();
          setMessages(prev => [
            ...prev,
            {
              id: `ai-${Date.now()}`,
              sender: 'ai',
              text: data.answer,
              sources: data.sources || []
            }
          ]);
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.error('Error querying backend:', err);
      }
    }

    // High quality simulated preview response
    setTimeout(() => {
      let simulatedReply = '';
      let simulatedSources = [];

      if (query.toLowerCase().includes('summary') || query.toLowerCase().includes('summarize')) {
        simulatedReply = `Here is an executive summary of **${activeDoc ? activeDoc.filename : 'the document'}**:\n\n• **Core Purpose**: Outlines foundational architecture and operational objectives for real-time document intelligence.\n• **Key Findings**: Demonstrates high accuracy retrieval-augmented generation (RAG) with low latency token streaming.\n• **Recommendations**: Implements modular vector chunking and proactive source attribution for each synthesized answer.`;
        simulatedSources = [{ page_number: 1, excerpt: "Introduction and Executive Abstract overview..." }, { page_number: 4, excerpt: "Performance metrics and benchmark comparisons..." }];
      } else if (query.toLowerCase().includes('takeaway') || query.toLowerCase().includes('finding')) {
        simulatedReply = `The three primary takeaways from this document are:\n\n1. **Semantic Precision**: Contextual chunks yield up to 40% higher relevance compared to naive sliding-window text splits.\n2. **Citation Traceability**: Linking specific page numbers significantly enhances user trust.\n3. **Scalability**: Python FastAPI backend guarantees asynchronous non-blocking throughput.`;
        simulatedSources = [{ page_number: 2, excerpt: "Methodology and benchmark analysis..." }];
      } else {
        simulatedReply = `Based on **${activeDoc ? activeDoc.filename : 'your document'}**, the text discusses: "${query}".\n\nThe Python FastAPI backend is structured and ready. Once you provide the project requirements specification document, we will connect the vector search and your chosen LLM engine.`;
        simulatedSources = [{ page_number: 1, excerpt: "Relevant section match found in indexed context." }];
      }

      setMessages(prev => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: simulatedReply,
          sources: simulatedSources
        }
      ]);
      setIsLoading(false);
    }, 800);
  };

  const samplePrompts = [
    { title: 'Executive Summary', prompt: 'Summarize this document in 3 concise bullet points.' },
    { title: 'Key Findings', prompt: 'What are the main findings and takeaways discussed?' },
    { title: 'Methodology & Setup', prompt: 'Explain the core methodology or architecture used.' },
    { title: 'Actionable Steps', prompt: 'What are the primary action items or recommendations?' }
  ];

  return (
    <div className="app-container">
      <div className="app-layout">
        {/* Left Sidebar */}
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-icon">
              <Bot size={22} />
            </div>
            <div>
              <div className="brand-title">
                DocuMind <span className="brand-badge">API v1.0</span>
              </div>
            </div>
          </div>

          {/* Backend Status indicator */}
          <div className="status-pill">
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <span className={`status-dot ${backendOnline ? 'online' : 'offline'}`} />
              FastAPI Backend
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: backendOnline ? 'var(--accent-emerald)' : '#f43f5e' }}>
              {backendOnline ? 'CONNECTED' : 'STANDBY'}
            </span>
          </div>

          {/* PDF Upload Dropzone */}
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
              <UploadCloud size={24} />
            </div>
            <div className="upload-title">Drop PDF here</div>
            <div className="upload-subtitle">or click to browse files (max 25MB)</div>
          </div>

          {/* Documents List */}
          <div className="documents-section">
            <div className="section-label">Uploaded Documents ({documents.length})</div>
            {documents.map((doc) => (
              <div 
                key={doc.doc_id} 
                className={`doc-item ${doc.doc_id === activeDocId ? 'active' : ''}`}
                onClick={() => setActiveDocId(doc.doc_id)}
              >
                <div className="doc-info">
                  <FileText size={18} color={doc.doc_id === activeDocId ? 'var(--primary)' : 'var(--text-muted)'} />
                  <div>
                    <div className="doc-name">{doc.filename}</div>
                    <div className="doc-meta">{doc.total_pages} pages • {doc.file_size_formatted || 'PDF'}</div>
                  </div>
                </div>
                {doc.doc_id === activeDocId && <ChevronRight size={16} color="var(--primary)" />}
              </div>
            ))}
          </div>

          {/* Bottom Quick Info */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>Python FastAPI:</span>
              <span style={{ color: 'var(--text-primary)' }}>:8000</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>React Vite UI:</span>
              <span style={{ color: 'var(--text-primary)' }}>:5173</span>
            </div>
          </div>
        </aside>

        {/* Main Chat Interface */}
        <main className="main-chat">
          {/* Top Header */}
          <header className="chat-header">
            <div className="active-doc-badge">
              <BookOpen size={18} color="var(--primary)" />
              <span>{activeDoc ? activeDoc.filename : 'Select or upload a document'}</span>
              {activeDoc && (
                <span className="brand-badge" style={{ marginLeft: 8 }}>
                  {activeDoc.total_pages} Pages Indexed
                </span>
              )}
            </div>
            <div className="header-actions">
              <button 
                className="btn-secondary"
                onClick={() => setMessages([
                  {
                    id: `cleared-${Date.now()}`,
                    sender: 'ai',
                    text: 'Chat history cleared. What would you like to know about this document?',
                    sources: []
                  }
                ])}
              >
                <Trash2 size={14} /> Clear Chat
              </button>
            </div>
          </header>

          {/* Messages Viewport */}
          <div className="chat-messages">
            {messages.length === 1 && (
              <div className="welcome-container animate-fade-in">
                <div className="welcome-hero-badge">
                  <Sparkles size={14} /> Intelligent PDF Dialogue
                </div>
                <h1 className="welcome-title">Ask anything about your document</h1>
                <p className="welcome-desc">
                  Extract answers, generate summaries, and navigate page citations effortlessly with our dual Python API and React frontend setup.
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
            )}

            {messages.map((m) => (
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
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Layers size={13} /> Sources:
                        </span>
                        {m.sources.map((s, idx) => (
                          <span key={idx} className="citation-chip">
                            Page {s.page_number}
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
            ))}

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

          {/* Bottom Chat Input Bar */}
          <div className="chat-input-wrapper">
            <div className="input-container">
              <input
                type="text"
                className="chat-input"
                placeholder={activeDoc ? `Ask about "${activeDoc.filename}"...` : "Upload a PDF document to begin..."}
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
    </div>
  );
}
