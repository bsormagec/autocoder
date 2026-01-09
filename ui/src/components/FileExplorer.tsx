import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    Folder,
    FolderOpen,
    File,
    FileCode,
    FileJson,
    FileText,
    ChevronRight,
    ChevronDown,
    Loader2,
    AlertCircle
} from 'lucide-react'
import * as api from '../lib/api'
import type { DirectoryEntry } from '../lib/types'

interface FileExplorerProps {
    initialPath: string
    onFileSelect: (path: string, name: string) => void
    selectedFile: string | null
}

interface FileTreeItemProps {
    path: string
    name: string
    level: number
    onFileSelect: (path: string, name: string) => void
    selectedFile: string | null
    isFolder: boolean
}

function getFileIcon(name: string) {
    if (name.endsWith('.tsx') || name.endsWith('.ts') || name.endsWith('.js') || name.endsWith('.py')) {
        return <FileCode size={16} className="text-blue-500" />
    }
    if (name.endsWith('.json')) {
        return <FileJson size={16} className="text-yellow-600" />
    }
    if (name.endsWith('.md') || name.endsWith('.txt')) {
        return <FileText size={16} className="text-gray-500" />
    }
    return <File size={16} className="text-[var(--color-neo-text-secondary)]" />
}

function FileTreeItem({ path, name, level, onFileSelect, selectedFile, isFolder }: FileTreeItemProps) {
    const [isOpen, setIsOpen] = useState(false)

    // Query for children only if it's a folder and open
    const { data, isLoading, error } = useQuery({
        queryKey: ['filesystem', 'list', path],
        queryFn: () => api.listDirectory(path, true),
        enabled: isFolder && isOpen,
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    })

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (isFolder) {
            setIsOpen(!isOpen)
        } else {
            onFileSelect(path, name)
        }
    }

    const isSelected = selectedFile === path

    return (
        <div className="select-none">
            <div
                className={`
          flex items-center gap-2 py-1 px-2 cursor-pointer
          hover:bg-[var(--color-neo-bg-hover)]
          border-l-4 border-transparent
          ${isSelected ? 'bg-[var(--color-neo-bg)] border-[var(--color-neo-progress)] font-medium' : ''}
        `}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
                onClick={handleToggle}
            >
                {isFolder ? (
                    <div className="flex items-center gap-1 text-[var(--color-neo-text-secondary)]">
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {isOpen ? (
                            <FolderOpen size={16} className="text-[var(--color-neo-progress)]" />
                        ) : (
                            <Folder size={16} className="text-[var(--color-neo-progress)]" />
                        )}
                    </div>
                ) : (
                    <div className="ml-[18px]">
                        {getFileIcon(name)}
                    </div>
                )}

                <span className="truncate text-sm text-[var(--color-neo-text)]">{name}</span>
            </div>

            {isFolder && isOpen && (
                <div>
                    {isLoading ? (
                        <div className="flex items-center gap-2 py-1 px-4 ml-4 text-xs text-gray-400">
                            <Loader2 size={12} className="animate-spin" />
                            Loading...
                        </div>
                    ) : error ? (
                        <div className="flex items-center gap-2 py-1 px-4 ml-4 text-xs text-red-400">
                            <AlertCircle size={12} />
                            Error
                        </div>
                    ) : (
                        data?.entries.map((entry: DirectoryEntry) => (
                            <FileTreeItem
                                key={entry.path}
                                path={entry.path}
                                name={entry.name}
                                level={level + 1}
                                onFileSelect={onFileSelect}
                                selectedFile={selectedFile}
                                isFolder={entry.is_directory}
                            />
                        ))
                    )}
                    {data?.entries.length === 0 && (
                        <div className="py-1 px-4 ml-8 text-xs text-gray-400 italic">
                            Empty
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export function FileExplorer({ initialPath, onFileSelect, selectedFile }: FileExplorerProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['filesystem', 'list', initialPath],
        queryFn: () => api.listDirectory(initialPath, true),
    })

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-gray-400">
            <Loader2 size={24} className="animate-spin mb-2" />
            <span className="text-sm">Loading project files...</span>
        </div>
    )

    if (error) return (
        <div className="p-4 text-center text-red-500">
            <AlertCircle size={32} className="mx-auto mb-2" />
            <p>Failed to load files</p>
        </div>
    )

    return (
        <div className="h-full overflow-y-auto bg-white border-r-3 border-[var(--color-neo-border)]">
            <div className="p-3 border-b-2 border-[var(--color-neo-border)] bg-[var(--color-neo-bg)] font-bold text-sm tracking-wide flex items-center gap-2">
                <FolderOpen size={16} />
                PROJECT FILES
            </div>
            <div className="py-2">
                {data?.entries.map((entry: DirectoryEntry) => (
                    <FileTreeItem
                        key={entry.path}
                        path={entry.path}
                        name={entry.name}
                        level={0}
                        onFileSelect={onFileSelect}
                        selectedFile={selectedFile}
                        isFolder={entry.is_directory}
                    />
                ))}
            </div>
        </div>
    )
}
