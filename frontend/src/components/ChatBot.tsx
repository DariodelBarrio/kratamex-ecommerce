/*
=================================================================
KRATAMEX — ChatBot Component
=================================================================
Chatbot flotante con respuestas automáticas a preguntas
frecuentes sobre la tienda.
=================================================================
*/

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X, Send, Bot, User } from 'lucide-react'

interface Message {
  id: number
  role: 'bot' | 'user'
  text: string
  timestamp: Date
}

const BIENVENIDA_TEXT = '¡Hola! Soy el asistente de Kratamex. Puedo ayudarte con info sobre envíos, devoluciones, productos y pagos. ¿En qué te ayudo?'

const SUGERENCIAS = [
  '¿Cómo es el envío?',
  '¿Cuánto tarda mi pedido?',
  '¿Cómo devuelvo un producto?',
  '¿Qué métodos de pago aceptan?',
]

export function ChatBot() {
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState<Message[]>(() => [{
    id: 0,
    role: 'bot',
    text: BIENVENIDA_TEXT,
    timestamp: new Date(),
  }])
  const nextId = useRef(1)
  const [input, setInput] = useState('')
  const [cargando, setCargando] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (abierto) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [abierto])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes, cargando])

  const enviarMensaje = async (texto: string) => {
    const txt = texto.trim()
    if (!txt || cargando) return
    setInput('')

    const msgUsuario: Message = { id: nextId.current++, role: 'user', text: txt, timestamp: new Date() }
    setMensajes(prev => [...prev, msgUsuario])
    setCargando(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: txt }),
      })
      const data = await res.json()
      setMensajes(prev => [...prev, {
        id: nextId.current++,
        role: 'bot',
        text: data.reply || 'Lo siento, no pude procesar tu consulta.',
        timestamp: new Date(),
      }])
    } catch {
      setMensajes(prev => [...prev, {
        id: nextId.current++,
        role: 'bot',
        text: 'Ocurrió un error. Por favor intenta de nuevo.',
        timestamp: new Date(),
      }])
    } finally {
      setCargando(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    enviarMensaje(input)
  }

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="chatbot-wrapper">
      {/* Panel de chat */}
      <AnimatePresence>
        {abierto && (
          <motion.div
            className="chatbot-panel"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            {/* Header */}
            <div className="chatbot-header">
              <div className="chatbot-header-info">
                <div className="chatbot-avatar">
                  <Bot size={18} />
                  <span className="chatbot-status-dot" />
                </div>
                <div>
                  <p className="chatbot-name">Asistente Kratamex</p>
                  <p className="chatbot-status">En línea</p>
                </div>
              </div>
              <button className="chatbot-close" onClick={() => setAbierto(false)} aria-label="Cerrar chat">
                <X size={18} />
              </button>
            </div>

            {/* Mensajes */}
            <div className="chatbot-messages">
              {mensajes.map(msg => (
                <motion.div
                  key={msg.id}
                  className={`chatbot-msg chatbot-msg--${msg.role}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {msg.role === 'bot' && (
                    <div className="chatbot-msg-avatar"><Bot size={13} /></div>
                  )}
                  <div className="chatbot-msg-content">
                    <p className="chatbot-msg-text">{msg.text}</p>
                    <span className="chatbot-msg-time">{formatTime(msg.timestamp)}</span>
                  </div>
                  {msg.role === 'user' && (
                    <div className="chatbot-msg-avatar chatbot-msg-avatar--user"><User size={13} /></div>
                  )}
                </motion.div>
              ))}

              {cargando && (
                <motion.div
                  className="chatbot-msg chatbot-msg--bot"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="chatbot-msg-avatar"><Bot size={13} /></div>
                  <div className="chatbot-msg-content">
                    <div className="chatbot-typing">
                      <span /><span /><span />
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Sugerencias (solo si hay pocos mensajes) */}
            {mensajes.length <= 2 && (
              <div className="chatbot-suggestions">
                {SUGERENCIAS.map(s => (
                  <button key={s} className="chatbot-suggestion" onClick={() => enviarMensaje(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <form className="chatbot-input-form" onSubmit={handleSubmit}>
              <input
                ref={inputRef}
                className="chatbot-input"
                type="text"
                placeholder="Escribe tu pregunta..."
                value={input}
                onChange={e => setInput(e.target.value)}
                maxLength={300}
                disabled={cargando}
              />
              <button
                className="chatbot-send"
                type="submit"
                disabled={!input.trim() || cargando}
                aria-label="Enviar"
              >
                <Send size={16} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botón flotante */}
      <motion.button
        className="chatbot-fab"
        onClick={() => setAbierto(v => !v)}
        aria-label="Abrir chat de soporte"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
      >
        <AnimatePresence mode="wait">
          {abierto ? (
            <motion.span key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.18 }}>
              <X size={22} />
            </motion.span>
          ) : (
            <motion.span key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.18 }}>
              <MessageCircle size={22} />
            </motion.span>
          )}
        </AnimatePresence>
        {!abierto && <span className="chatbot-fab-pulse" />}
      </motion.button>
    </div>
  )
}
