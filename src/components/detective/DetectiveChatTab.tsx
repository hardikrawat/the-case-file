'use client';

import React, { useRef, useEffect, useState } from 'react';
import {
  Send,
  Loader2,
  Search,
  HelpCircle,
  FileSearch,
  Settings,
  Bot,
  Copy,
  Check,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useDetective } from '@/hooks/useDetective';
import useDetectiveStore from '@/store/detectiveStore';

interface DetectiveChatTabProps {
  boardId: string;
}

// Helper to highlight detective node references like [clue-incident] or [suspect-marcus]
const renderWithNodeBadges = (children: React.ReactNode): React.ReactNode => {
  return React.Children.map(children, (child) => {
    if (typeof child === 'string') {
      const parts = child.split(/(\[(?:clue|suspect|evidence|note|node)-[^\]]+\])/g);
      if (parts.length === 1) return child;
      return parts.map((part, i) => {
        const match = part.match(/^\[((?:clue|suspect|evidence|note|node)-[^\]]+)\]$/);
        if (match) {
          return (
            <span
              key={i}
              className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded text-[11px] font-mono font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 select-all"
              title={`Board Reference: ${match[1]}`}
            >
              🏷️ {match[1]}
            </span>
          );
        }
        return part;
      });
    }
    if (React.isValidElement(child) && (child.props as { children?: React.ReactNode })?.children) {
      return React.cloneElement(
        child as React.ReactElement<{ children?: React.ReactNode }>,
        undefined,
        renderWithNodeBadges((child.props as { children?: React.ReactNode }).children)
      );
    }
    return child;
  });
};

const markdownComponents = {
  h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1
      className="text-base font-bold text-[var(--panel-foreground)] mt-3 mb-2 pb-1 border-b border-[var(--panel-border)] flex items-center gap-1.5"
      {...props}
    >
      {renderWithNodeBadges(children)}
    </h1>
  ),
  h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      className="text-sm font-bold text-[var(--panel-foreground)] mt-2.5 mb-1.5 flex items-center gap-1.5"
      {...props}
    >
      {renderWithNodeBadges(children)}
    </h2>
  ),
  h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3
      className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mt-2 mb-1"
      {...props}
    >
      {renderWithNodeBadges(children)}
    </h3>
  ),
  p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p
      className="mb-2 last:mb-0 leading-relaxed text-[var(--panel-foreground)]"
      {...props}
    >
      {renderWithNodeBadges(children)}
    </p>
  ),
  ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul
      className="list-disc list-outside pl-5 mb-2.5 space-y-1 text-[var(--panel-foreground)]"
      {...props}
    >
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol
      className="list-decimal list-outside pl-5 mb-2.5 space-y-1 text-[var(--panel-foreground)]"
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({ children, ...props }: React.LiHTMLAttributes<HTMLLIElement>) => (
    <li className="leading-relaxed text-[var(--panel-foreground)]" {...props}>
      {renderWithNodeBadges(children)}
    </li>
  ),
  strong: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-semibold text-amber-700 dark:text-amber-300" {...props}>
      {renderWithNodeBadges(children)}
    </strong>
  ),
  blockquote: ({ children, ...props }: React.BlockquoteHTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className="border-l-2 border-amber-500/60 pl-3 my-2 italic text-gray-600 dark:text-gray-300 bg-amber-500/5 py-1 rounded-r"
      {...props}
    >
      {renderWithNodeBadges(children)}
    </blockquote>
  ),
  code: ({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) => {
    const isMultiline = typeof children === 'string' && children.includes('\n');
    if (!isMultiline) {
      return (
        <code
          className="bg-amber-500/10 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-mono text-xs border border-amber-500/20"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <div className="relative my-2 rounded-md overflow-hidden bg-black/5 dark:bg-black/40 border border-[var(--panel-border)]">
        <pre className="p-2.5 text-xs font-mono overflow-x-auto text-[var(--panel-foreground)]">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      </div>
    );
  },
  table: ({ children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) => (
    <div className="overflow-x-auto my-2 border border-[var(--panel-border)] rounded">
      <table className="min-w-full text-xs divide-y divide-[var(--panel-border)]" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className="bg-black/5 dark:bg-white/5 font-semibold text-[var(--panel-foreground)]" {...props}>
      {children}
    </thead>
  ),
  th: ({ children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th className="px-2.5 py-1.5 text-left font-semibold text-xs border-b border-[var(--panel-border)]" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td className="px-2.5 py-1.5 text-xs border-b border-[var(--panel-border)]" {...props}>
      {children}
    </td>
  ),
  a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-amber-600 dark:text-amber-400 underline hover:opacity-80"
      {...props}
    >
      {children}
    </a>
  ),
  hr: (props: React.HTMLAttributes<HTMLHRElement>) => (
    <hr className="my-3 border-[var(--panel-border)]" {...props} />
  ),
};

function AssistantMessageContent({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const isError = content.startsWith('Error:');

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isError) {
    return (
      <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-md text-sm">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div className="whitespace-pre-wrap leading-relaxed">{content}</div>
      </div>
    );
  }

  return (
    <div className="group relative">
      <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[var(--panel-border)]/60 text-xs font-semibold text-[var(--sidebar-accent)]">
        <div className="flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5" />
          <span>Detective Analysis</span>
        </div>
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded text-gray-500 hover:text-[var(--panel-foreground)] flex items-center gap-1 text-[10px]"
          title="Copy response"
        >
          {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      <div className="text-sm text-[var(--panel-foreground)] leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

export default function DetectiveChatTab({ boardId }: DetectiveChatTabProps) {
  const {
    isConfigured,
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isStreaming,
    isLoadingHistory,
    sendMessage,
    clearChat,
  } = useDetective(boardId);
  const { setPanelMode } = useDetectiveStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  if (!isConfigured) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-4 text-[var(--panel-foreground)]">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-2">
          <Settings className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-xl font-bold">AI Not Configured</h3>
        <p className="text-sm text-gray-500">
          Please configure your AI provider settings to start investigating with the AI Detective.
        </p>
        <button
          onClick={() => setPanelMode('config')}
          className="mt-4 px-6 py-2 bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] rounded-md font-medium hover:opacity-90 transition-opacity"
        >
          Go to Configuration
        </button>
      </div>
    );
  }

  const handleQuickAction = (text: string) => {
    sendMessage(text);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--panel-background)]">
      <div className="flex items-center gap-2 p-3 border-b border-[var(--panel-border)] overflow-x-auto no-scrollbar">
        <button
          onClick={() => handleQuickAction('Scan the board and summarize the current state.')}
          className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-gray-200 transition-colors"
        >
          <Search className="w-3.5 h-3.5" /> Scan Board
        </button>
        <button
          onClick={() => handleQuickAction('Find gaps or contradictions in my current evidence.')}
          className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-gray-200 transition-colors"
        >
          <FileSearch className="w-3.5 h-3.5" /> Find Gaps
        </button>
        <button
          onClick={() => handleQuickAction('What am I missing? Provide 3 counter-questions.')}
          className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-gray-200 transition-colors"
        >
          <HelpCircle className="w-3.5 h-3.5" /> What am I Missing?
        </button>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            disabled={isStreaming}
            className="whitespace-nowrap flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 disabled:opacity-40 transition-colors ml-auto"
            title="Clear investigation history"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingHistory ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--sidebar-accent)]" />
            <span className="text-xs">Loading case dossier & chat history...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-gray-500 mt-10">
            I am ready to analyze the evidence. How can I assist you in this investigation?
          </div>
        ) : (
          messages
            .filter((m) => m.content?.trim() || (m.toolInvocations && m.toolInvocations.length > 0))
            .map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-3 text-sm ${
                    m.role === 'user'
                      ? 'bg-[var(--sidebar-accent)]/20 text-[var(--panel-foreground)] rounded-tr-none'
                      : 'bg-[var(--panel-background)] border border-[var(--panel-border)] text-[var(--panel-foreground)] rounded-tl-none shadow-xs'
                  }`}
                >
                  {m.role === 'user' ? (
                    <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                  ) : (
                    <AssistantMessageContent content={m.content} />
                  )}

                  {m.toolInvocations &&
                    m.toolInvocations.map((tool, tIdx) => (
                      <div
                        key={tIdx}
                        className="mt-2 p-2 bg-amber-500/5 dark:bg-amber-500/10 rounded text-xs border border-amber-500/20 text-[var(--panel-foreground)]"
                      >
                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                          {tool.toolName}
                        </span>{' '}
                        processing...
                      </div>
                    ))}
                </div>
              </div>
            ))
        )}
        {isStreaming && (
          <div className="flex justify-start">
            <div className="bg-[var(--panel-background)] border border-[var(--panel-border)] text-gray-500 rounded-lg rounded-tl-none p-3 text-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Analyzing...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-[var(--panel-border)] bg-[var(--panel-background)]">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            value={input}
            onChange={handleInputChange}
            placeholder="Type your instruction or question..."
            className="flex-1 resize-none h-[42px] max-h-32 min-h-[42px] p-2.5 bg-transparent border border-[var(--panel-border)] rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--sidebar-accent)] text-sm text-[var(--panel-foreground)]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as unknown as React.FormEvent);
              }
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="h-[42px] w-[42px] flex items-center justify-center bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

