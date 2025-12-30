/**
 * Debug Log Viewer Component
 *
 * Collapsible panel at the bottom of the screen showing real-time
 * agent output (tool calls, results, steps). Similar to browser DevTools.
 */

import { useEffect, useRef, useState } from 'react'
import { ChevronUp, ChevronDown, Trash2, Terminal } from 'lucide-react'

interface DebugLogViewerProps {
  logs: Array<{ line: string; timestamp: string }>
  isOpen: boolean
  onToggle: () => void
  onClear: () => void
}

type LogLevel = 'error' | 'warn' | 'debug' | 'info'

export function DebugLogViewer({
  logs,
  isOpen,
  onToggle,
  onClear,
}: DebugLogViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  // Auto-scroll to bottom when new logs arrive (if user hasn't scrolled up)
  useEffect(() => {
    if (autoScroll && scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, autoScroll, isOpen])

  // Detect if user scrolled up
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const isAtBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 50
    setAutoScroll(isAtBottom)
  }

  // Parse log level from line content
  const getLogLevel = (line: string): LogLevel => {
    const lowerLine = line.toLowerCase()
    if (lowerLine.includes('error') || lowerLine.includes('exception') || lowerLine.includes('traceback')) {
      return 'error'
    }
    if (lowerLine.includes('warn') || lowerLine.includes('warning')) {
      return 'warn'
    }
    if (lowerLine.includes('debug')) {
      return 'debug'
    }
    return 'info'
  }

  // Get color class for log level
  const getLogColor = (level: LogLevel): string => {
    switch (level) {
      case 'error':
        return 'text-red-400'
      case 'warn':
        return 'text-yellow-400'
      case 'debug':
        return 'text-gray-400'
      case 'info':
      default:
        return 'text-green-400'
    }
  }

  // Format timestamp to HH:MM:SS
  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp)
      return date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } catch {
      return ''
    }
  }

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-40 transition-all duration-200 ${
        isOpen ? 'h-72' : 'h-10'
      }`}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between h-10 px-4 bg-[#1a1a1a] border-t-3 border-black cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <Terminal size={16} className="text-green-400" />
          <span className="font-mono text-sm text-white font-bold">
            Debug
          </span>
          <span className="px-1.5 py-0.5 text-xs font-mono bg-[#333] text-gray-500 rounded" title="Toggle debug panel">
            D
          </span>
          {logs.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-mono bg-[#333] text-gray-300 rounded">
              {logs.length}
            </span>
          )}
          {!autoScroll && isOpen && (
            <span className="px-2 py-0.5 text-xs font-mono bg-yellow-600 text-white rounded">
              Paused
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isOpen && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onClear()
              }}
              className="p-1.5 hover:bg-[#333] rounded transition-colors"
              title="Clear logs"
            >
              <Trash2 size={14} className="text-gray-400" />
            </button>
          )}
          <div className="p-1">
            {isOpen ? (
              <ChevronDown size={16} className="text-gray-400" />
            ) : (
              <ChevronUp size={16} className="text-gray-400" />
            )}
          </div>
        </div>
      </div>

      {/* Log content area */}
      {isOpen && (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-[calc(100%-2.5rem)] overflow-y-auto bg-[#1a1a1a] p-2 font-mono text-sm"
        >
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No logs yet. Start the agent to see output.
            </div>
          ) : (
            <div className="space-y-0.5">
              {logs.map((log, index) => {
                const level = getLogLevel(log.line)
                const colorClass = getLogColor(level)
                const timestamp = formatTimestamp(log.timestamp)

                return (
                  <div
                    key={`${log.timestamp}-${index}`}
                    className="flex gap-2 hover:bg-[#2a2a2a] px-1 py-0.5 rounded"
                  >
                    <span className="text-gray-500 select-none shrink-0">
                      {timestamp}
                    </span>
                    <span className={`${colorClass} whitespace-pre-wrap break-all`}>
                      {log.line}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
