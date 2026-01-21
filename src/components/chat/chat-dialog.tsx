'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/firebase/auth-context';
import { buildFinancialContext, formatContextForAI } from '@/lib/chat-context';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

const SUGGESTION_CHIPS = [
    "How's my spending this month?",
    "Suggest budget limits",
    "Summarize my finances",
    "How can I save more?",
];

// Simple markdown renderer for chat messages
function renderMarkdown(text: string): React.ReactNode[] {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];

    lines.forEach((line, lineIndex) => {
        // Handle numbered lists (1. , 2. , etc.)
        const numberedListMatch = line.match(/^(\d+)\.\s+(.+)$/);
        if (numberedListMatch) {
            const [, number, content] = numberedListMatch;
            elements.push(
                <div key={lineIndex} className="flex gap-2 mb-1">
                    <span className="text-primary font-medium min-w-[1.5rem]">{number}.</span>
                    <span>{renderInlineMarkdown(content)}</span>
                </div>
            );
            return;
        }

        // Handle bullet points (- or *)
        const bulletMatch = line.match(/^[-*]\s+(.+)$/);
        if (bulletMatch) {
            elements.push(
                <div key={lineIndex} className="flex gap-2 mb-1">
                    <span className="text-primary">•</span>
                    <span>{renderInlineMarkdown(bulletMatch[1])}</span>
                </div>
            );
            return;
        }

        // Regular paragraph
        if (line.trim()) {
            elements.push(
                <p key={lineIndex} className="mb-2 last:mb-0">
                    {renderInlineMarkdown(line)}
                </p>
            );
        } else if (lineIndex > 0 && lines[lineIndex - 1].trim()) {
            // Add spacing between paragraphs
            elements.push(<div key={lineIndex} className="h-1" />);
        }
    });

    return elements;
}

// Handle inline markdown (bold, italic)
function renderInlineMarkdown(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
        // Match **bold** or __bold__
        const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*/);
        if (boldMatch) {
            if (boldMatch[1]) {
                parts.push(<span key={key++}>{boldMatch[1]}</span>);
            }
            parts.push(<strong key={key++} className="font-semibold">{boldMatch[2]}</strong>);
            remaining = remaining.slice(boldMatch[0].length);
            continue;
        }

        // No more matches, add remaining text
        parts.push(<span key={key++}>{remaining}</span>);
        break;
    }

    return parts;
}

export function ChatDialog() {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [financialContext, setFinancialContext] = useState<string>('');
    const [isLoadingContext, setIsLoadingContext] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Load financial context when chat opens
    useEffect(() => {
        if (isOpen && user && !financialContext) {
            loadFinancialContext();
        }
    }, [isOpen, user]);

    // Focus input when chat opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const loadFinancialContext = async () => {
        if (!user) return;
        setIsLoadingContext(true);
        try {
            const context = await buildFinancialContext(user.uid);
            setFinancialContext(formatContextForAI(context));
        } catch (error) {
            console.error('Error loading financial context:', error);
        } finally {
            setIsLoadingContext(false);
        }
    };

    const sendMessage = async (content: string) => {
        if (!content.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: content.trim(),
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, userMessage].map(m => ({
                        role: m.role,
                        content: m.content,
                    })),
                    financialContext,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to get response');
            }

            const data = await response.json();

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.message,
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Chat error:', error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "Sorry, I couldn't process your request. Please try again.",
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(input);
    };

    const handleSuggestionClick = (suggestion: string) => {
        sendMessage(suggestion);
    };

    const handleRefreshContext = async () => {
        await loadFinancialContext();
    };

    if (!user) return null;

    return (
        <>
            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(true)}
                className={`fixed bottom-24 right-6 z-[60] p-4 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-105 transition-all duration-300 ${isOpen ? 'hidden' : ''}`}
                aria-label="Open chat"
            >
                <MessageSquare className="w-6 h-6" />
            </button>

            {/* Chat Dialog */}
            {isOpen && (
                <div className="fixed inset-0 md:inset-auto md:bottom-6 md:right-6 z-[100] w-full md:w-[380px] h-[100dvh] md:h-[600px] md:max-h-[calc(100vh-120px)] bg-background md:border md:border-border md:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-primary/10 to-primary/5">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-full bg-primary/20">
                                <Sparkles className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm">Finance Assistant</h3>
                                <p className="text-xs text-muted-foreground">
                                    {isLoadingContext ? 'Loading data...' : 'Powered by AI'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleRefreshContext}
                                className="p-2 rounded-full hover:bg-muted transition-colors"
                                title="Refresh financial data"
                                disabled={isLoadingContext}
                            >
                                <RefreshCw className={`w-4 h-4 text-muted-foreground ${isLoadingContext ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 rounded-full hover:bg-muted transition-colors"
                            >
                                <X className="w-4 h-4 text-muted-foreground" />
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <div className="p-4 rounded-full bg-primary/10 mb-4">
                                    <Sparkles className="w-8 h-8 text-primary" />
                                </div>
                                <h4 className="font-medium mb-2">Hi! I&apos;m your Finance Assistant</h4>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Ask me about your spending, budgets, goals, or get personalized financial advice.
                                </p>
                                <div className="flex flex-wrap gap-2 justify-center">
                                    {SUGGESTION_CHIPS.map((chip) => (
                                        <button
                                            key={chip}
                                            onClick={() => handleSuggestionClick(chip)}
                                            className="px-3 py-1.5 text-xs rounded-full bg-muted hover:bg-muted/80 transition-colors"
                                            disabled={isLoading || isLoadingContext}
                                        >
                                            {chip}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[85%] rounded-2xl px-4 py-2 ${message.role === 'user'
                                        ? 'bg-primary text-primary-foreground rounded-br-md'
                                        : 'bg-muted rounded-bl-md'
                                        }`}
                                >
                                    <div className="text-sm">
                                        {message.role === 'assistant'
                                            ? renderMarkdown(message.content)
                                            : <p className="whitespace-pre-wrap">{message.content}</p>
                                        }
                                    </div>
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span className="text-sm text-muted-foreground">Thinking...</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Suggestion chips when there are messages */}
                    {messages.length > 0 && !isLoading && (
                        <div className="px-4 py-2 border-t border-border/50">
                            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                                {SUGGESTION_CHIPS.slice(0, 2).map((chip) => (
                                    <button
                                        key={chip}
                                        onClick={() => handleSuggestionClick(chip)}
                                        className="px-3 py-1 text-xs rounded-full bg-muted hover:bg-muted/80 transition-colors whitespace-nowrap shrink-0"
                                    >
                                        {chip}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Input */}
                    <form onSubmit={handleSubmit} className="p-3 border-t border-border">
                        <div className="flex items-center gap-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={isLoadingContext ? "Loading your data..." : "Ask about your finances..."}
                                disabled={isLoading || isLoadingContext}
                                className="flex-1 px-4 py-2 rounded-full bg-muted border-none outline-none text-sm placeholder:text-muted-foreground disabled:opacity-50"
                            />
                            <Button
                                type="submit"
                                size="icon"
                                disabled={!input.trim() || isLoading || isLoadingContext}
                                className="rounded-full shrink-0"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}
                            </Button>
                        </div>
                    </form>
                </div>
            )}
        </>
    );
}
