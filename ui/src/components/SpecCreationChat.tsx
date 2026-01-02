/**
 * Spec Creation Chat Component
 *
 * Full chat interface for interactive spec creation with Claude.
 * Handles the 7-phase conversation flow for creating app specifications.
 */

import { useEffect, useRef, useState } from 'react'
import { Send, X, CheckCircle2, AlertCircle, Wifi, WifiOff, RotateCcw, Loader2, ArrowRight, Zap } from 'lucide-react'
import { useSpecChat } from '../hooks/useSpecChat'
import { ChatMessage } from './ChatMessage'
import { QuestionOptions } from './QuestionOptions'
import { TypingIndicator } from './TypingIndicator'

type InitializerStatus = 'idle' | 'starting' | 'error'

interface SpecCreationChatProps {
  projectName: string
  onComplete: (specPath: string, yoloMode?: boolean) => void
  onCancel: () => void
  initializerStatus?: InitializerStatus
  initializerError?: string | null
  onRetryInitializer?: () => void
}

export function SpecCreationChat({
  projectName,
  onComplete,
  onCancel,
  initializerStatus = 'idle',
  initializerError = null,
  onRetryInitializer,
}: SpecCreationChatProps) {
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [yoloEnabled, setYoloEnabled] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    messages,
    isLoading,
    isComplete,
    connectionStatus,
    currentQuestions,
    start,
    sendMessage,
    sendAnswer,
    disconnect,
  } = useSpecChat({
    projectName,
    onComplete,
    onError: (err) => setError(err),
  })

  // Start the chat session when component mounts
  useEffect(() => {
    start()

    return () => {
      disconnect()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentQuestions, isLoading])

  // Focus input when not loading and no questions
  useEffect(() => {
    if (!isLoading && !currentQuestions && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isLoading, currentQuestions])

  const handleSendMessage = () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    sendMessage(trimmed)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleAnswerSubmit = (answers: Record<string, string | string[]>) => {
    sendAnswer(answers)
  }

  // Connection status indicator
  const ConnectionIndicator = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <span className="flex items-center gap-1 text-xs text-[var(--color-neo-done)]">
            <Wifi size={12} />
            Connected
          </span>
        )
      case 'connecting':
        return (
          <span className="flex items-center gap-1 text-xs text-[var(--color-neo-pending)]">
            <Wifi size={12} className="animate-pulse" />
            Connecting...
          </span>
        )
      case 'error':
        return (
          <span className="flex items-center gap-1 text-xs text-[var(--color-neo-danger)]">
            <WifiOff size={12} />
            Error
          </span>
        )
      default:
        return (
          <span className="flex items-center gap-1 text-xs text-[var(--color-neo-text-secondary)]">
            <WifiOff size={12} />
            Disconnected
          </span>
        )
    }
  }

  return (
    <div className="flex flex-col h-full bg-[var(--color-neo-bg)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b-3 border-[var(--color-neo-border)] bg-white">
        <div className="flex items-center gap-3">
          <h2 className="font-display font-bold text-lg text-[#1a1a1a]">
            Create Spec: {projectName}
          </h2>
          <ConnectionIndicator />
        </div>

        <div className="flex items-center gap-2">
          {isComplete && (
            <span className="flex items-center gap-1 text-sm text-[var(--color-neo-done)] font-bold">
              <CheckCircle2 size={16} />
              Complete
            </span>
          )}

          <button
            onClick={onCancel}
            className="neo-btn neo-btn-ghost p-2"
            title="Cancel"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-[var(--color-neo-danger)] text-white border-b-3 border-[var(--color-neo-border)]">
          <AlertCircle size={16} />
          <span className="flex-1 text-sm">{error}</span>
          <button
            onClick={() => setError(null)}
            className="p-1 hover:bg-white/20 rounded"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto py-4">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="neo-card p-6 max-w-md">
              <h3 className="font-display font-bold text-lg mb-2">
                Starting Spec Creation
              </h3>
              <p className="text-sm text-[var(--color-neo-text-secondary)]">
                Connecting to Claude to help you create your app specification...
              </p>
              {connectionStatus === 'error' && (
                <button
                  onClick={start}
                  className="neo-btn neo-btn-primary mt-4 text-sm"
                >
                  <RotateCcw size={14} />
                  Retry Connection
                </button>
              )}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        {/* Structured questions */}
        {currentQuestions && currentQuestions.length > 0 && (
          <QuestionOptions
            questions={currentQuestions}
            onSubmit={handleAnswerSubmit}
            disabled={isLoading}
          />
        )}

        {/* Typing indicator - don't show when we have questions (waiting for user) */}
        {isLoading && !currentQuestions && <TypingIndicator />}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      {!isComplete && (
        <div className="p-4 border-t-3 border-[var(--color-neo-border)] bg-white">
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                currentQuestions
                  ? 'Or type a custom response...'
                  : 'Type your response...'
              }
              className="neo-input flex-1"
              disabled={(isLoading && !currentQuestions) || connectionStatus !== 'connected'}
            />
            <button
              onClick={handleSendMessage}
              disabled={!input.trim() || (isLoading && !currentQuestions) || connectionStatus !== 'connected'}
              className="neo-btn neo-btn-primary px-6"
            >
              <Send size={18} />
            </button>
          </div>

          {/* Help text */}
          <p className="text-xs text-[var(--color-neo-text-secondary)] mt-2">
            Press Enter to send. Claude will guide you through creating your app specification.
          </p>
        </div>
      )}

      {/* Completion footer */}
      {isComplete && (
        <div className={`p-4 border-t-3 border-[var(--color-neo-border)] ${
          initializerStatus === 'error' ? 'bg-[var(--color-neo-danger)]' : 'bg-[var(--color-neo-done)]'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {initializerStatus === 'starting' ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span className="font-bold">
                    Starting agent{yoloEnabled ? ' (YOLO mode)' : ''}...
                  </span>
                </>
              ) : initializerStatus === 'error' ? (
                <>
                  <AlertCircle size={20} className="text-white" />
                  <span className="font-bold text-white">
                    {initializerError || 'Failed to start agent'}
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={20} />
                  <span className="font-bold">Specification created successfully!</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {initializerStatus === 'error' && onRetryInitializer && (
                <button
                  onClick={onRetryInitializer}
                  className="neo-btn bg-white"
                >
                  <RotateCcw size={14} />
                  Retry
                </button>
              )}
              {initializerStatus === 'idle' && (
                <>
                  {/* YOLO Mode Toggle */}
                  <button
                    onClick={() => setYoloEnabled(!yoloEnabled)}
                    className={`neo-btn text-sm py-2 px-3 ${
                      yoloEnabled ? 'neo-btn-warning' : 'bg-white'
                    }`}
                    title="YOLO Mode: Skip testing for rapid prototyping"
                  >
                    <Zap size={16} className={yoloEnabled ? 'text-yellow-900' : ''} />
                    <span className={yoloEnabled ? 'text-yellow-900 font-bold' : ''}>
                      YOLO
                    </span>
                  </button>
                  <button
                    onClick={() => onComplete('', yoloEnabled)}
                    className="neo-btn neo-btn-primary"
                  >
                    Continue to Project
                    <ArrowRight size={16} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
