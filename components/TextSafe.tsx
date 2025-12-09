'use client';

import { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface Text {
  id: number;
  content: string;
  created_at: string;
  updated_at: string;
}

interface TextSafeProps {
  user: { id: number; username: string };
  onLogout: () => void;
}

// Detect if content is code (improved heuristic)
function isCode(content: string): boolean {
  if (!content || content.trim().length === 0) return false;
  
  const codeIndicators = [
    /^\s*(function|const|let|var|class|import|export|def|if|for|while|return|public|private|static|async|await)\s+/m,
    /[{}();=<>[\]]/,
    /^\s*#/m, // Comments
    /^\s*\/\//m, // Comments
    /^\s*\/\*/m, // Comments
    /^\s*<\?/m, // PHP
    /^\s*<!DOCTYPE/m, // HTML
    /^\s*package\s+\w+/m, // Java/Go
    /^\s*namespace\s+/m, // C#/C++
  ];
  
  // Check for code patterns
  const hasCodePattern = codeIndicators.some(pattern => pattern.test(content));
  
  // Also check if it looks like code based on structure
  const lines = content.split('\n');
  const hasMultipleLines = lines.length > 1;
  const hasIndentation = lines.some(line => /^\s{2,}/.test(line));
  const hasBrackets = /[{}[\]]/.test(content);
  const hasOperators = /[+\-*/%=<>!&|]/.test(content);
  
  // If it has code patterns OR looks structured like code
  return hasCodePattern || (hasMultipleLines && (hasIndentation || hasBrackets || hasOperators));
}

// Detect programming language
function detectLanguage(content: string): string {
  const patterns: { [key: string]: RegExp } = {
    javascript: /(function|const|let|var|=>|import|export|console\.)/,
    typescript: /(interface|type|enum|export\s+type|:\s*\w+)/,
    python: /(def\s+\w+|import\s+\w+|from\s+\w+|print\(|if\s+__name__)/,
    java: /(public\s+class|import\s+java|@Override|System\.out\.println)/,
    cpp: /(#include|using\s+namespace|std::|cout\s*<<)/,
    c: /(#include\s*<|printf\(|scanf\(|int\s+main)/,
    html: /(<!DOCTYPE|<html|<head|<body|<div|<script)/,
    css: /(@media|@keyframes|\.\w+\s*\{|#\w+\s*\{)/,
    sql: /(SELECT|INSERT|UPDATE|DELETE|CREATE\s+TABLE|FROM\s+\w+)/,
    json: /(\{[\s\n]*"[^"]+"\s*:|\[[\s\n]*\{)/,
    bash: new RegExp('(#!/bin/bash|#!/bin/sh|echo\\s+|export\\s+\\w+=)'),
    yaml: /(^[\s-]*\w+:\s*[\w-]+|^[\s-]*-\s*\w+:)/m,
  };

  for (const [lang, pattern] of Object.entries(patterns)) {
    if (pattern.test(content)) {
      return lang;
    }
  }

  return 'text';
}

export default function TextSafe({ user, onLogout }: TextSafeProps) {
  const [texts, setTexts] = useState<Text[]>([]);
  const [selectedText, setSelectedText] = useState<Text | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');

  useEffect(() => {
    loadTexts();
  }, []);

  const loadTexts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/texts');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load texts');
      }

      setTexts(data.texts || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load texts');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!content.trim()) {
      setError('Content cannot be empty');
      return;
    }

    try {
      setSaving(true);
      setError('');

      if (selectedText) {
        const response = await fetch(`/api/texts/${selectedText.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to update text');
        }

        await loadTexts();
        setSelectedText(null);
        setContent('');
        setViewMode('edit');
      } else {
        const response = await fetch('/api/texts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to save text');
        }

        await loadTexts();
        setContent('');
        setViewMode('edit');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save text');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this text? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/texts/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete text');
      }

      await loadTexts();
      if (selectedText?.id === id) {
        setSelectedText(null);
        setContent('');
        setViewMode('edit');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete text');
    }
  };

  const handleSelectText = (text: Text) => {
    setSelectedText(text);
    setContent(text.content);
    setError('');
    setViewMode('edit'); // Start in edit mode to see the code properly
  };

  const handleNewText = () => {
    setSelectedText(null);
    setContent('');
    setError('');
    setViewMode('edit');
  };

  const isCodeContent = isCode(content);
  const detectedLanguage = detectLanguage(content);

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white border-2 border-black rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-black mb-2">
                🔒 Secure Code Vault
              </h1>
              <p className="text-gray-600">
                Welcome, <span className="font-semibold text-black">{user.username}</span>
              </p>
            </div>
            <button
              onClick={onLogout}
              className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors border-2 border-black"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Text List */}
          <div className="lg:col-span-1">
            <div className="bg-white border-2 border-black rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-black">Your Files</h2>
                <button
                  onClick={handleNewText}
                  className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm border-2 border-black"
                >
                  + New
                </button>
              </div>

              {loading ? (
                <div className="text-gray-600 text-center py-8">Loading...</div>
              ) : texts.length === 0 ? (
                <div className="text-gray-600 text-center py-8">
                  No files yet. Create your first secure file!
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {texts.map((text) => (
                    <div
                      key={text.id}
                      className={`p-4 rounded-lg cursor-pointer transition-all border-2 ${
                        selectedText?.id === text.id
                          ? 'bg-black text-white border-black'
                          : 'bg-white border-gray-300 hover:border-black text-black'
                      }`}
                      onClick={() => handleSelectText(text)}
                    >
                      <div className={`font-medium mb-1 ${selectedText?.id === text.id ? 'text-white' : 'text-black'}`}>
                        File #{text.id}
                      </div>
                      <div className={`text-xs mb-2 ${selectedText?.id === text.id ? 'text-gray-300' : 'text-gray-600'}`}>
                        {new Date(text.updated_at).toLocaleString()}
                      </div>
                      <div className={`text-sm line-clamp-2 font-mono ${selectedText?.id === text.id ? 'text-gray-200' : 'text-gray-700'}`}>
                        {text.content.substring(0, 100)}
                        {text.content.length > 100 ? '...' : ''}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(text.id);
                        }}
                        className={`mt-2 text-xs ${selectedText?.id === text.id ? 'text-red-300 hover:text-red-200' : 'text-red-600 hover:text-red-800'}`}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Editor */}
          <div className="lg:col-span-2">
            <div className="bg-white border-2 border-black rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-black">
                  {selectedText ? 'Edit File' : 'New File'}
                </h2>
                {selectedText && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewMode('edit')}
                      className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                        viewMode === 'edit'
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-black border-gray-300 hover:border-black'
                      }`}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setViewMode('preview')}
                      className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                        viewMode === 'preview'
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-black border-gray-300 hover:border-black'
                      }`}
                    >
                      Preview
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-100 border-2 border-red-500 text-red-800 px-4 py-3 rounded-lg text-sm mb-4">
                  {error}
                </div>
              )}

              {viewMode === 'edit' ? (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter your code or text here... It will be encrypted before storage."
                  className="w-full h-96 px-4 py-3 bg-white border-2 border-gray-300 rounded-lg text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-black resize-none font-mono text-sm"
                  style={{ 
                    whiteSpace: 'pre',
                    tabSize: 2,
                    fontFamily: 'var(--font-geist-mono), "Courier New", monospace',
                    overflowWrap: 'normal',
                    wordWrap: 'normal',
                  }}
                  spellCheck={false}
                  wrap="off"
                />
              ) : (
                <div className="w-full h-96 border-2 border-gray-300 rounded-lg overflow-auto bg-black">
                  {isCodeContent ? (
                    <SyntaxHighlighter
                      language={detectedLanguage}
                      style={vscDarkPlus}
                      customStyle={{
                        margin: 0,
                        padding: '1rem',
                        background: '#000000',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        fontFamily: 'var(--font-geist-mono), "Courier New", monospace',
                      }}
                      showLineNumbers={true}
                      wrapLines={false}
                      wrapLongLines={true}
                      PreTag="div"
                      codeTagProps={{
                        style: {
                          fontFamily: 'var(--font-geist-mono), "Courier New", monospace',
                        }
                      }}
                    >
                      {content}
                    </SyntaxHighlighter>
                  ) : (
                    <pre className="p-4 text-white font-mono text-sm whitespace-pre-wrap bg-black" style={{ fontFamily: 'var(--font-geist-mono), "Courier New", monospace' }}>
                      {content}
                    </pre>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between mt-4">
                <div className="text-gray-600 text-sm">
                  {content.length} characters
                  {isCodeContent && ` • ${detectedLanguage}`}
                </div>
                <div className="space-x-3">
                  {selectedText && (
                    <button
                      onClick={() => {
                        setSelectedText(null);
                        setContent('');
                        setError('');
                        setViewMode('edit');
                      }}
                      className="px-6 py-2 bg-white border-2 border-gray-300 text-black rounded-lg hover:border-black transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saving || !content.trim()}
                    className="px-6 py-2 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-black"
                  >
                    {saving ? 'Saving...' : selectedText ? 'Update' : 'Save'}
                  </button>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gray-100 border-2 border-gray-300 rounded-lg">
                <p className="text-black text-sm">
                  🔐 <strong>Security:</strong> Your content is encrypted using AES-256 before being stored in the database. 
                  Code syntax highlighting is applied automatically.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
