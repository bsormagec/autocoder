import { useEffect, useRef, useState } from 'react'
import { X, Send, Sparkles, Loader2, WifiOff } from 'lucide-react'
import { useAiFeatureChat } from '../hooks/useAiFeatureChat'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface AiFeatureChatModalProps {
    projectName: string
    onClose: () => void
    onFeatureCreated: () => void
}

export function AiFeatureChatModal({ projectName, onClose, onFeatureCreated }: AiFeatureChatModalProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const [input, setInput] = useState('')

    const { messages, isLoading, connectionStatus, start, sendMessage, disconnect } = useAiFeatureChat({
        projectName,
        onError: (err) => console.error("Chat Error:", err),
        onFeatureCreated
    })

    // Scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    // Initialize Session
    useEffect(() => {
        const timeout = setTimeout(() => {
            start()
        }, 100) // Small delay to ensure mount

        return () => {
            clearTimeout(timeout)
            disconnect()
        }
    }, []) // Run once on mount

    const handleSend = () => {
        if (!input.trim() || isLoading) return
        sendMessage(input)
        setInput('')
    }

    // Helper for input
    const handleSetInput = (val: string) => setInput(val)

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--color-neo-bg)] w-full max-w-2xl h-[80vh] flex flex-col border-4 border-[var(--color-neo-border)] shadow-[8px_8px_0px_rgba(0,0,0,1)]">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b-4 border-[var(--color-neo-border)] bg-[var(--color-neo-accent)] text-white">
                    <div className="flex items-center gap-3">
                        <div className="bg-white p-1 border-2 border-black">
                            <Sparkles size={20} className="text-[var(--color-neo-accent)]" />
                        </div>
                        <div>
                            <h2 className="font-display font-bold text-xl leading-none">AI Feature Creator</h2>
                            <p className="text-sm opacity-80">Describe your feature, and I'll create it.</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Connection Error */}
                {connectionStatus === 'error' && (
                    <div className="bg-red-100 p-2 text-center text-red-800 text-xs font-bold border-b border-red-200">
                        Connection Error. Retrying...
                    </div>
                )}
                {connectionStatus === 'disconnected' && (
                    <div className="bg-yellow-100 p-2 text-center text-yellow-800 text-xs font-bold border-b border-yellow-200 flex items-center justify-center gap-2">
                        <WifiOff size={12} /> Disconnected
                    </div>
                )}

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white/50">
                    {messages.length === 0 && isLoading && (
                        <div className="flex justify-center py-8">
                            <Loader2 className="animate-spin text-[var(--color-neo-accent)]" size={32} />
                        </div>
                    )}

                    {/* Empty State */}
                    {messages.length === 0 && !isLoading && (
                        <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-60">
                            <Sparkles size={48} className="mb-4 text-[var(--color-neo-accent)]" />
                            <h3 className="font-display font-bold text-xl mb-2">Ready to Create</h3>
                            <p className="max-w-md">
                                Describe the feature you want to add. I'll help you refine the requirements and create the task for you.
                            </p>
                            <div className="mt-6 grid gap-2 text-sm w-full max-w-sm">
                                <div className="bg-white/50 p-2 border border-black/10 rounded cursor-pointer hover:bg-white hover:border-black/30 transition-colors"
                                    onClick={() => handleSetInput("Add a dark mode toggle to the settings page")}>
                                    "Add a dark mode toggle"
                                </div>
                                <div className="bg-white/50 p-2 border border-black/10 rounded cursor-pointer hover:bg-white hover:border-black/30 transition-colors"
                                    onClick={() => handleSetInput("Create a contact form with email validation")}>
                                    "Create a contact form"
                                </div>
                            </div>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`
                 max-w-[80%] p-3 border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,0.5)]
                 ${msg.role === 'user'
                                    ? 'bg-[var(--color-neo-accent)] text-white'
                                    : 'bg-white text-[var(--color-neo-text)]'}
               `}>
                                <div className="markdown-body text-sm">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            p: ({ node, ...props }: any) => <p className="mb-2 last:mb-0" {...props} />,
                                            ul: ({ node, ...props }: any) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                                            ol: ({ node, ...props }: any) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
                                            li: ({ node, ...props }: any) => <li className="" {...props} />,
                                            a: ({ node, ...props }: any) => <a className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                                            code: ({ node, className, children, ...props }: any) => {
                                                const match = /language-(\w+)/.exec(className || '')
                                                return !match ? (
                                                    <code className="bg-black/10 px-1 rounded font-mono text-xs" {...props}>
                                                        {children}
                                                    </code>
                                                ) : (
                                                    <code className="block bg-black/10 p-2 rounded font-mono text-xs overflow-x-auto my-2" {...props}>
                                                        {children}
                                                    </code>
                                                )
                                            },
                                            table: ({ node, ...props }: any) => <div className="overflow-x-auto my-2"><table className="min-w-full divide-y divide-gray-300 border border-gray-300" {...props} /></div>,
                                            thead: ({ node, ...props }: any) => <thead className="bg-gray-50" {...props} />,
                                            th: ({ node, ...props }: any) => <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200" {...props} />,
                                            tbody: ({ node, ...props }: any) => <tbody className="bg-white divide-y divide-gray-200" {...props} />,
                                            tr: ({ node, ...props }: any) => <tr className="" {...props} />,
                                            td: ({ node, ...props }: any) => <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 border-r border-gray-200 last:border-r-0" {...props} />,
                                            blockquote: ({ node, ...props }: any) => <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-2" {...props} />,
                                        }}
                                    >
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        </div>
                    ))}
                    {isLoading && messages.length > 0 && (
                        <div className="flex justify-start">
                            <div className="bg-white p-3 border-2 border-black">
                                <div className="flex gap-1">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75" />
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150" />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t-4 border-[var(--color-neo-border)] bg-white">
                    <div className="flex gap-2">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    handleSend()
                                }
                            }}
                            placeholder="E.g., Add a dark mode toggle to the settings page..."
                            className="flex-1 p-3 border-2 border-[var(--color-neo-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-neo-accent)] font-mono text-sm resize-none h-[50px] max-h-[150px]"
                            disabled={isLoading || connectionStatus !== 'connected'}
                            autoFocus
                        />
                        <button
                            onClick={handleSend}
                            disabled={isLoading || connectionStatus !== 'connected' || !input.trim()}
                            className="neo-btn neo-btn-primary p-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Send size={20} />
                        </button>
                    </div>
                </div>

            </div>
        </div>
    )
}
