// public/js/ui/chatBox.js — Multi-player In-game Free Text Chat Component
import { html } from './components.js';
import { useState, useEffect, useRef } from '../../vendor/hooks.module.js';
import { net } from '../net.js';
import { useStore } from '../store.js';
import { toast } from './toasts.js';
import { t } from '../../../shared/i18n.js';

export function ChatBox({ active: controlledActive, onToggle, showTrigger = controlledActive === undefined }) {
  const messages = useStore((s) => s.chatMessages) || [];
  const [internalActive, setInternalActive] = useState(false);
  const active = controlledActive !== undefined ? controlledActive : internalActive;
  const setActive = onToggle || setInternalActive;
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const pending = useRef(false);
  const composing = useRef(false);
  const inputRef = useRef(null);
  const logRef = useRef(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Focus input when activated
  useEffect(() => {
    if (active) {
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [active]);

  // Desktop Enter key trigger & Escape cancel
  useEffect(() => {
    const handleKey = (e) => {
      if (e.isComposing || e.keyCode === 229 || e.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === 'Enter') {
        if (!active) {
          e.preventDefault();
          e.stopPropagation();
          setActive(true);
        }
      } else if (e.key === 'Escape') {
        if (active) {
          setActive(false);
          inputRef.current?.blur();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [active, setActive]);

  const send = async (e) => {
    e?.preventDefault?.();
    if (pending.current || composing.current) return;
    const text = draft.trim();
    if (!text) {
      setActive(false);
      return;
    }
    pending.current = true;
    setSending(true);
    try {
      await net.request('room.chat', { text });
      setDraft('');
      setActive(false);
    } catch (err) {
      console.warn('[chat] send failed', err);
      if (err?.code === 'RATE' || err?.error === 'RATE') {
        toast(t('发言过于频繁，请稍候'), 'warn');
      } else {
        toast(err?.msg || t('发送失败，请重试'), 'warn');
      }
      setActive(true);
    } finally {
      pending.current = false;
      setSending(false);
    }
  };

  const getSeatColorClass = (seat, isSpectator) => {
    if (isSpectator) return 'seat-spec';
    switch (seat) {
      case 0: return 'seat-0';
      case 1: return 'seat-1';
      case 2: return 'seat-2';
      case 3: return 'seat-3';
      case 4: return 'seat-4';
      case 5: return 'seat-5';
      default: return '';
    }
  };

  return html`
    <div class=${`chat-panel ${active ? 'is-active' : ''}`}>
      <!-- Tactical Chat Stream (pass-through clicks, expands on hover/active) -->
      <div class="chat-log" ref=${logRef}>
        ${messages.map((m, i) => {
          const seatLabel = m.isSpectator ? t('观战') : `P${(m.seat ?? 0) + 1}`;
          const colorCls = getSeatColorClass(m.seat, m.isSpectator);
          return html`
            <div key=${i} class="chat-item">
              <span class=${`chat-seat ${colorCls}`}>
                [${seatLabel}] ${m.name || t('博士')}:
              </span>
              <span class="chat-text">${m.text}</span>
            </div>
          `;
        })}
      </div>

      <!-- Input Bar (Active) or Mobile Trigger Button -->
      ${active ? html`
        <form class="chat-form" onSubmit=${send}>
          <input
            ref=${inputRef}
            type="text"
            class="chat-input"
            maxlength="80"
            placeholder=${t('输入对话 (Enter发送, Esc取消)...')}
            value=${draft}
            readOnly=${sending}
            onInput=${(e) => setDraft(e.target.value)}
            onCompositionStart=${() => { composing.current = true; }}
            onCompositionEnd=${() => { composing.current = false; }}
            onKeyDown=${(e) => {
              e.stopPropagation();
              if (e.key === 'Enter' && (e.isComposing || composing.current || e.keyCode === 229)) e.preventDefault();
              if (e.key === 'Escape' && !sending && !composing.current) setActive(false);
            }}
          />
          <button type="submit" class="chat-send-btn" disabled=${sending}>${t('发送')}</button>
        </form>
      ` : (showTrigger ? html`
        <button
          type="button"
          class="chat-trigger-btn"
          onClick=${() => {
            setActive(true);
            setTimeout(() => inputRef.current?.focus(), 30);
          }}
          title=${t('打开对话')}
          aria-label=${t('打开对话')}
        >
          💬
        </button>
      ` : null)}
    </div>
  `;
}
