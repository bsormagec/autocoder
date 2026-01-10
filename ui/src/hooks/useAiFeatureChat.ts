/**
 * Hook for managing AI Feature Creator chat WebSocket connection
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import type { ChatMessage } from '../lib/types'

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

interface UseAiFeatureChatOptions {
    projectName: string
    onError?: (error: string) => void
    onFeatureCreated?: (feature: any) => void
}

interface UseAiFeatureChatReturn {
    messages: ChatMessage[]
    isLoading: boolean
    connectionStatus: ConnectionStatus
    start: () => void
    sendMessage: (content: string) => void
    disconnect: () => void
}

function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export function useAiFeatureChat({
    projectName,
    onError,
    onFeatureCreated,
}: UseAiFeatureChatOptions): UseAiFeatureChatReturn {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')

    const wsRef = useRef<WebSocket | null>(null)
    const currentAssistantMessageRef = useRef<string | null>(null)
    const pingIntervalRef = useRef<number | null>(null)

    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current)
            }
            if (wsRef.current) {
                wsRef.current.close()
            }
        }
    }, [])

    const connect = useCallback(() => {
        // Prevent multiple connection attempts
        if (wsRef.current?.readyState === WebSocket.OPEN ||
            wsRef.current?.readyState === WebSocket.CONNECTING) {
            return
        }

        setConnectionStatus('connecting')

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const host = window.location.host
        const wsUrl = `${protocol}//${host}/api/projects/${encodeURIComponent(projectName)}/ai-features/ws`

        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
            setConnectionStatus('connected')

            // Start ping interval to keep connection alive
            pingIntervalRef.current = window.setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'ping' }))
                }
            }, 30000)
        }

        ws.onclose = () => {
            setConnectionStatus('disconnected')
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current)
                pingIntervalRef.current = null
            }
        }

        ws.onerror = () => {
            setConnectionStatus('error')
            onError?.('WebSocket connection error')
        }

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)

                switch (data.type) {
                    case 'text': {
                        // Append text to current assistant message or create new one
                        setMessages((prev) => {
                            const lastMessage = prev[prev.length - 1]
                            if (lastMessage?.role === 'assistant' && lastMessage.isStreaming) {
                                // Append to existing streaming message
                                return [
                                    ...prev.slice(0, -1),
                                    {
                                        ...lastMessage,
                                        content: lastMessage.content + data.content,
                                    },
                                ]
                            } else {
                                // Create new assistant message
                                currentAssistantMessageRef.current = generateId()
                                return [
                                    ...prev,
                                    {
                                        id: currentAssistantMessageRef.current,
                                        role: 'assistant',
                                        content: data.content,
                                        timestamp: new Date(),
                                        isStreaming: true,
                                    },
                                ]
                            }
                        })
                        break
                    }

                    case 'feature_created': {
                        setIsLoading(false)
                        // Add final success message
                        setMessages((prev) => [
                            ...prev,
                            {
                                id: generateId(),
                                role: 'system',
                                content: `Feature created: ${data.feature.name}`,
                                timestamp: new Date(),
                            },
                        ])
                        onFeatureCreated?.(data.feature)
                        break
                    }

                    case 'response_done': {
                        setIsLoading(false)

                        // Mark current message as done streaming
                        setMessages((prev) => {
                            const lastMessage = prev[prev.length - 1]
                            if (lastMessage?.role === 'assistant' && lastMessage.isStreaming) {
                                return [
                                    ...prev.slice(0, -1),
                                    { ...lastMessage, isStreaming: false },
                                ]
                            }
                            return prev
                        })
                        break
                    }

                    case 'error': {
                        setIsLoading(false)
                        onError?.(data.content)

                        // Add error as system message
                        setMessages((prev) => [
                            ...prev,
                            {
                                id: generateId(),
                                role: 'system',
                                content: `Error: ${data.content}`,
                                timestamp: new Date(),
                            },
                        ])
                        break
                    }

                    case 'pong': {
                        break
                    }
                }
            } catch (e) {
                console.error('Failed to parse WebSocket message:', e)
            }
        }
    }, [projectName, onError, onFeatureCreated])

    const start = useCallback(() => {
        connect()

        // Wait for connection then send start message
        const checkAndSend = () => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                setIsLoading(true)
                wsRef.current.send(JSON.stringify({ type: 'start' }))
            } else if (wsRef.current?.readyState === WebSocket.CONNECTING) {
                setTimeout(checkAndSend, 100)
            }
        }

        setTimeout(checkAndSend, 100)
    }, [connect])

    const sendMessage = useCallback((content: string) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            // Try to reconnect if disconnected
            connect()
            setTimeout(() => sendMessage(content), 500)
            return
        }

        // Add user message to chat
        setMessages((prev) => [
            ...prev,
            {
                id: generateId(),
                role: 'user',
                content,
                timestamp: new Date(),
            },
        ])

        setIsLoading(true)

        // Send to server
        wsRef.current.send(
            JSON.stringify({
                type: 'message',
                content,
            })
        )
    }, [connect])

    const disconnect = useCallback(() => {
        if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current)
            pingIntervalRef.current = null
        }
        if (wsRef.current) {
            wsRef.current.close()
            wsRef.current = null
        }
        setConnectionStatus('disconnected')
    }, [])

    return {
        messages,
        isLoading,
        connectionStatus,
        start,
        sendMessage,
        disconnect,
    }
}
