import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, AlertCircle, Copy, Check } from 'lucide-react'
import * as api from '../lib/api'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface CodeViewerProps {
    filePath: string | null
    fileName: string | null
}

export function CodeViewer({ filePath, fileName }: CodeViewerProps) {
    const [copied, setCopied] = useState(false)

    const { data, isLoading, error } = useQuery({
        queryKey: ['filesystem', 'content', filePath],
        queryFn: () => filePath ? api.getFileContent(filePath) : null,
        enabled: !!filePath,
    })

    useEffect(() => {
        setCopied(false)
    }, [filePath])

    const handleCopy = () => {
        if (data?.content) {
            navigator.clipboard.writeText(data.content)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const getLanguage = (filename: string | null) => {
        if (!filename) return 'text'
        const ext = filename.split('.').pop()?.toLowerCase()
        switch (ext) {
            case 'ts':
            case 'tsx':
                return 'typescript'
            case 'js':
            case 'jsx':
                return 'javascript'
            case 'py':
                return 'python'
            case 'css':
                return 'css'
            case 'json':
                return 'json'
            case 'html':
                return 'html'
            case 'md':
                return 'markdown'
            case 'sql':
            case 'db':
                return 'sql'
            case 'sh':
            case 'bash':
                return 'bash'
            case 'yaml':
            case 'yml':
                return 'yaml'
            default:
                return 'text'
        }
    }

    if (!filePath) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-[var(--color-neo-bg)] text-[var(--color-neo-text-secondary)]">
                <div className="w-16 h-16 mb-4 rounded-full bg-white border-3 border-[var(--color-neo-border)] flex items-center justify-center">
                    <span className="font-mono text-2xl font-bold">{'</>'}</span>
                </div>
                <p className="font-medium">Select a file to view content</p>
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col bg-white">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b-3 border-[var(--color-neo-border)] bg-[var(--color-neo-bg)]">
                <div className="font-mono text-sm font-bold text-[var(--color-neo-text)] truncate">
                    {fileName}
                </div>
                <div>
                    <button
                        onClick={handleCopy}
                        disabled={!data?.content}
                        className="neo-btn neo-btn-ghost p-1.5 text-xs flex items-center gap-1"
                        title="Copy to clipboard"
                    >
                        {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-0 relative">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                        <Loader2 size={32} className="animate-spin text-[var(--color-neo-progress)]" />
                    </div>
                ) : error ? (
                    <div className="p-8 text-center">
                        <AlertCircle size={32} className="mx-auto mb-2 text-[var(--color-neo-danger)]" />
                        <h3 className="font-bold text-lg mb-1">Error reading file</h3>
                        <p className="text-[var(--color-neo-text-secondary)]">
                            {(error as Error).message || 'Could not load file content'}
                        </p>
                    </div>
                ) : (
                    <SyntaxHighlighter
                        language={getLanguage(fileName)}
                        style={vscDarkPlus}
                        customStyle={{ margin: 0, padding: '1rem', height: '100%', fontSize: '0.875rem' }}
                        showLineNumbers={true}
                    >
                        {data?.content || ''}
                    </SyntaxHighlighter>
                )}
            </div>
        </div>
    )
}
