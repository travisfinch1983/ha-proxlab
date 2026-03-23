import { css } from "lit";

export const cardStyles = css`
  :host {
    --card-bg: var(--card-background-color, #fff);
    --card-text: var(--primary-text-color, #212121);
    --card-secondary: var(--secondary-text-color, #727272);
    --accent: var(--primary-color, #7c3aed);
    --accent-text: var(--text-primary-color, #fff);
    --divider: var(--divider-color, rgba(0, 0, 0, 0.12));
    --user-bubble: var(--primary-color, #7c3aed);
    --user-text: var(--text-primary-color, #fff);
    --assistant-bubble: var(--secondary-background-color, #f5f5f5);
    --assistant-text: var(--primary-text-color, #212121);
    --input-bg: var(--card-background-color, #fff);
    --input-border: var(--divider-color, rgba(0, 0, 0, 0.12));
    --shadow: var(--ha-card-box-shadow, 0 2px 6px rgba(0, 0, 0, 0.1));
  }

  .card-container {
    display: flex;
    flex-direction: column;
    background: var(--card-bg);
    border-radius: var(--ha-card-border-radius, 12px);
    overflow: hidden;
    box-shadow: var(--shadow);
  }

  /* Portrait layout: avatar panel on left + chat area on right */
  .card-layout {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .portrait-panel {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    padding: 8px;
    border-right: 1px solid var(--divider);
    background: var(--card-bg);
    overflow: hidden;
  }

  /* Auto mode: full image visible, no cropping */
  .portrait-panel .portrait-img-contain {
    flex: 1;
    min-height: 0;
    width: 100%;
    object-fit: contain;
    object-position: top;
    border-radius: 12px;
  }

  /* Manual mode: image fills width, overflows/crops at bottom (shows face) */
  .portrait-panel .portrait-img-cover {
    width: 100%;
    flex: 1;
    min-height: 0;
    object-fit: cover;
    object-position: top;
    border-radius: 12px;
  }

  .portrait-name {
    margin-top: 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--card-text);
    text-align: center;
    word-break: break-word;
    flex-shrink: 0;
  }

  .portrait-status {
    font-size: 11px;
    color: var(--card-secondary);
    text-align: center;
    flex-shrink: 0;
  }

  .portrait-agent {
    font-size: 10px;
    color: var(--card-secondary);
    text-align: center;
    opacity: 0.7;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .chat-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  /* Header */
  .card-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--divider);
    background: var(--card-bg);
  }

  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    background: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-text);
    font-size: 18px;
    font-weight: 600;
    flex-shrink: 0;
    overflow: hidden;
  }

  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .header-info {
    flex: 1;
    min-width: 0;
  }

  .header-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--card-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .header-status {
    font-size: 12px;
    color: var(--card-secondary);
  }

  /* Messages area */
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    scroll-behavior: smooth;
  }

  .messages::-webkit-scrollbar {
    width: 4px;
  }

  .messages::-webkit-scrollbar-thumb {
    background: var(--divider);
    border-radius: 2px;
  }

  .message {
    display: flex;
    flex-direction: column;
    max-width: 85%;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .message.user {
    align-self: flex-end;
  }

  .message.assistant {
    align-self: flex-start;
  }

  .bubble {
    padding: 8px 12px;
    border-radius: 12px;
    font-size: 14px;
    line-height: 1.4;
    word-wrap: break-word;
    white-space: pre-wrap;
  }

  .message.user .bubble {
    background: var(--user-bubble);
    color: var(--user-text);
    border-bottom-right-radius: 4px;
  }

  .message.assistant .bubble {
    background: var(--assistant-bubble);
    color: var(--assistant-text);
    border-bottom-left-radius: 4px;
  }

  .meta {
    font-size: 11px;
    color: var(--card-secondary);
    margin-top: 2px;
    padding: 0 4px;
  }

  .message.user .meta {
    text-align: right;
  }

  /* Message action buttons (edit, regenerate) */
  .msg-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-top: 2px;
    padding: 0 2px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .message:hover .msg-actions {
    opacity: 1;
  }

  .message.user .msg-actions {
    justify-content: flex-end;
  }

  .meta-inline {
    font-size: 11px;
    color: var(--card-secondary);
    margin-right: 4px;
  }

  .msg-btn {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--card-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: background 0.15s, color 0.15s;
  }

  .msg-btn:hover {
    background: var(--divider);
    color: var(--card-text);
  }

  .msg-btn.confirm {
    color: #22c55e;
  }

  .msg-btn.confirm:hover {
    background: rgba(34, 197, 94, 0.15);
  }

  .msg-btn.delete:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.15);
  }

  .msg-btn.speak:hover {
    color: var(--accent);
    background: rgba(124, 58, 237, 0.15);
  }

  .msg-btn.speaking {
    color: var(--accent);
    animation: pulse 1.5s infinite;
  }

  /* Text formatting classes */
  .text-narration {
    font-style: italic;
    color: var(--narration-color, #9e9e9e);
  }

  .text-speech {
    color: var(--speech-color, #f59e0b);
  }

  .text-thoughts {
    font-style: italic;
    font-weight: 600;
    color: var(--thoughts-color, #a855f7);
  }

  /* Inline edit mode */
  .edit-bubble {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }

  .message.editing {
    max-width: 100%;
    align-self: stretch;
  }

  .edit-textarea {
    border: 1px solid var(--accent);
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 14px;
    line-height: 1.4;
    font-family: inherit;
    background: transparent;
    color: var(--card-text);
    outline: none;
    resize: vertical;
    min-height: 96px;
    max-height: 300px;
    width: 100%;
    box-sizing: border-box;
  }

  .edit-actions {
    display: flex;
    gap: 4px;
  }

  .message.user .edit-actions {
    justify-content: flex-end;
  }

  /* Typing indicator */
  .typing {
    display: flex;
    gap: 4px;
    padding: 8px 12px;
    align-self: flex-start;
  }

  .typing-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--card-secondary);
    animation: bounce 1.4s infinite ease-in-out;
  }

  .typing-dot:nth-child(1) { animation-delay: -0.32s; }
  .typing-dot:nth-child(2) { animation-delay: -0.16s; }

  @keyframes bounce {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40% { transform: scale(1); opacity: 1; }
  }

  /* Model unavailable warning */
  .model-warning {
    padding: 6px 12px;
    background: rgba(255, 152, 0, 0.12);
    color: #e65100;
    font-size: 12px;
    text-align: center;
    border-top: 1px solid rgba(255, 152, 0, 0.3);
  }

  /* Input bar */
  .input-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid var(--divider);
    background: var(--input-bg);
  }

  .input-bar input {
    flex: 1;
    border: 1px solid var(--input-border);
    border-radius: 20px;
    padding: 8px 14px;
    font-size: 14px;
    background: transparent;
    color: var(--card-text);
    outline: none;
    transition: border-color 0.2s;
  }

  .input-bar input:focus {
    border-color: var(--accent);
  }

  .input-bar input::placeholder {
    color: var(--card-secondary);
  }

  .btn-icon {
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, opacity 0.2s;
    flex-shrink: 0;
    padding: 0;
  }

  .btn-send {
    background: var(--accent);
    color: var(--accent-text);
  }

  .btn-send:hover {
    opacity: 0.85;
  }

  .btn-send:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .btn-mic {
    background: transparent;
    color: var(--card-secondary);
  }

  .btn-mic:hover {
    background: var(--divider);
  }

  .btn-mic.recording {
    color: #ef4444;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 8px;
    color: var(--card-secondary);
    padding: 24px;
    text-align: center;
  }

  .empty-state .icon {
    font-size: 32px;
    opacity: 0.5;
  }

  /* Not configured state */
  .not-configured {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    color: var(--card-secondary);
    font-size: 14px;
    text-align: center;
  }

  /* Streaming cursor */
  .streaming-cursor::after {
    content: "\u258B";
    animation: blink 0.7s infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  /* Permission request card */
  .message.permission {
    align-self: center;
    max-width: 90%;
    width: 100%;
  }

  .permission-card {
    border: 2px solid #f59e0b;
    border-radius: 12px;
    padding: 12px 16px;
    background: var(--card-bg);
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.15);
  }

  .permission-card.decided {
    opacity: 0.7;
    border-color: var(--divider);
    box-shadow: none;
  }

  .permission-header {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #f59e0b;
    margin-bottom: 6px;
  }

  .permission-tool {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--card-text);
    margin-bottom: 4px;
  }

  .permission-description {
    font-size: 0.85rem;
    color: var(--card-secondary);
    margin-bottom: 8px;
  }

  .permission-input {
    display: block;
    font-family: monospace;
    font-size: 0.8rem;
    background: rgba(0, 0, 0, 0.05);
    border-radius: 6px;
    padding: 8px 10px;
    margin-bottom: 10px;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 120px;
    overflow-y: auto;
    color: var(--card-text);
  }

  .permission-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .permission-actions .btn-allow,
  .permission-actions .btn-deny {
    border: none;
    border-radius: 8px;
    padding: 6px 18px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .permission-actions .btn-allow {
    background: #22c55e;
    color: #fff;
  }

  .permission-actions .btn-deny {
    background: #ef4444;
    color: #fff;
  }

  .permission-actions .btn-allow:hover,
  .permission-actions .btn-deny:hover {
    opacity: 0.85;
  }

  .permission-decided {
    font-size: 0.85rem;
    font-weight: 600;
    text-align: right;
    padding-top: 4px;
  }

  .permission-decided.allow {
    color: #22c55e;
  }

  .permission-decided.deny {
    color: #ef4444;
  }

  @keyframes pulse-border {
    0%, 100% { border-color: #f59e0b; }
    50% { border-color: #fbbf24; }
  }

  .permission-card:not(.decided) {
    animation: pulse-border 2s ease-in-out infinite;
  }
`;

export const editorStyles = css`
  :host {
    --card-bg: var(--card-background-color, #fff);
    --card-text: var(--primary-text-color, #212121);
    --card-secondary: var(--secondary-text-color, #727272);
    --accent: var(--primary-color, #7c3aed);
    --divider: var(--divider-color, rgba(0, 0, 0, 0.12));
  }

  .editor {
    padding: 16px;
  }

  .tabs {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid var(--divider);
    margin-bottom: 16px;
    overflow-x: auto;
  }

  .tab {
    padding: 8px 12px;
    font-size: 13px;
    cursor: pointer;
    border: none;
    background: transparent;
    color: var(--card-secondary);
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .tab:hover:not(.disabled) {
    color: var(--card-text);
  }

  .tab.disabled {
    opacity: 0.4;
    cursor: default;
    pointer-events: none;
  }

  .tab-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field label {
    font-size: 12px;
    font-weight: 500;
    color: var(--card-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .field input,
  .field select,
  .field textarea {
    border: 1px solid var(--divider);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 14px;
    background: transparent;
    color: var(--card-text);
    outline: none;
    transition: border-color 0.2s;
    font-family: inherit;
  }

  .field input:focus,
  .field select:focus,
  .field textarea:focus {
    border-color: var(--accent);
  }

  .field textarea {
    min-height: 80px;
    resize: vertical;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 0;
  }

  .toggle-row label {
    font-size: 14px;
    color: var(--card-text);
    text-transform: none;
    letter-spacing: 0;
  }

  .toggle-row .sublabel {
    font-size: 12px;
    color: var(--card-secondary);
  }

  /* Simple toggle switch */
  .switch {
    position: relative;
    width: 40px;
    height: 22px;
    flex-shrink: 0;
  }

  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    inset: 0;
    background: var(--divider);
    border-radius: 11px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .slider::before {
    content: "";
    position: absolute;
    width: 18px;
    height: 18px;
    left: 2px;
    bottom: 2px;
    background: white;
    border-radius: 50%;
    transition: transform 0.2s;
  }

  .switch input:checked + .slider {
    background: var(--accent);
  }

  .switch input:checked + .slider::before {
    transform: translateX(18px);
  }

  /* Avatar preview */
  .avatar-preview {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--divider);
  }

  .avatar-upload {
    display: flex;
    align-items: center;
    gap: 12px;
  }
`;

export const groupCardStyles = css`
  :host {
    --card-bg: var(--card-background-color, #fff);
    --card-text: var(--primary-text-color, #212121);
    --accent: var(--primary-color, #7c3aed);
    --user-bubble: var(--accent);
    --user-text: #fff;
    --agent-bubble: var(--secondary-background-color, #f5f5f5);
    --agent-text: var(--card-text);
    --input-bg: var(--card-bg);
    --divider: var(--divider-color, #e5e7eb);
    --meta-color: var(--secondary-text-color, #999);
    display: block;
    font-family: var(--ha-card-font-family, inherit);
  }

  ha-card {
    overflow: hidden;
    background: var(--card-bg);
    color: var(--card-text);
  }

  .card-container {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Participant strip */
  .participant-strip {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--divider);
    overflow-x: auto;
    flex-shrink: 0;
  }

  .participant {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .participant-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
  }

  .participant-avatar.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--divider);
    font-weight: 600;
    font-size: 14px;
    color: var(--meta-color);
  }

  .participant-name {
    font-size: 11px;
    font-weight: 500;
    max-width: 60px;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .participant-mode {
    margin-left: auto;
    flex-shrink: 0;
  }

  .mode-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 10px;
    background: var(--accent);
    color: white;
    white-space: nowrap;
  }

  /* Messages area */
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 8px;
    opacity: 0.5;
    font-size: 13px;
  }

  .msg {
    display: flex;
    max-width: 85%;
  }

  .msg-user {
    align-self: flex-end;
  }

  .agent-msg {
    align-self: flex-start;
    gap: 8px;
  }

  .msg-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    margin-top: 18px;
  }

  .msg-avatar.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--divider);
    font-weight: 600;
    font-size: 12px;
    color: var(--meta-color);
  }

  .agent-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .msg-name {
    font-size: 11px;
    font-weight: 600;
    padding-left: 2px;
  }

  .bubble {
    padding: 8px 12px;
    border-radius: 12px;
    font-size: 14px;
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .user-bubble {
    background: var(--user-bubble);
    color: var(--user-text);
    border-bottom-right-radius: 4px;
  }

  .agent-bubble {
    background: var(--agent-bubble);
    color: var(--agent-text);
    border-bottom-left-radius: 4px;
  }

  .msg-meta {
    display: flex;
    gap: 8px;
    font-size: 10px;
    color: var(--meta-color);
    padding-left: 4px;
  }

  /* Text formatting (SillyTavern-style) */
  .text-narration { font-style: italic; opacity: 0.8; }
  .text-speech { color: var(--speech-color, #f59e0b); }
  .text-thoughts { font-style: italic; font-weight: 600; opacity: 0.7; }

  /* Message action buttons */
  .msg-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-top: 2px;
    padding: 0 2px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .msg:hover .msg-actions,
  .agent-msg:hover .msg-actions {
    opacity: 1;
  }

  .msg-user .msg-actions {
    justify-content: flex-end;
  }

  .meta-inline {
    font-size: 11px;
    color: var(--meta-color);
    margin-right: 4px;
  }

  .msg-btn {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--meta-color);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: background 0.15s, color 0.15s;
  }

  .msg-btn:hover {
    background: var(--divider);
    color: var(--card-text);
  }

  .msg-btn.confirm {
    color: #22c55e;
  }

  .msg-btn.confirm:hover {
    background: rgba(34, 197, 94, 0.15);
  }

  .msg-btn.delete:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.15);
  }

  .msg-btn.speak:hover {
    color: var(--accent);
    background: rgba(124, 58, 237, 0.15);
  }

  .msg-btn.speaking {
    color: var(--accent);
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Inline edit mode */
  .edit-bubble {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }

  .msg.editing,
  .agent-msg.editing {
    max-width: 100%;
    align-self: stretch;
  }

  .edit-textarea {
    border: 1px solid var(--accent);
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 14px;
    line-height: 1.4;
    font-family: inherit;
    background: transparent;
    color: var(--card-text);
    outline: none;
    resize: vertical;
    min-height: 96px;
    max-height: 300px;
    width: 100%;
    box-sizing: border-box;
  }

  .edit-actions {
    display: flex;
    gap: 4px;
  }

  .msg-user .edit-actions {
    justify-content: flex-end;
  }

  /* Streaming cursor */
  .streaming-cursor::after {
    content: "\u258B";
    animation: blink 0.7s infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  /* Loading indicator */
  .loading-row {
    display: flex;
    justify-content: center;
    padding: 8px;
  }

  .typing-indicator {
    display: flex;
    gap: 4px;
    padding: 8px 14px;
    background: var(--agent-bubble);
    border-radius: 12px;
  }

  .typing-indicator span {
    width: 6px;
    height: 6px;
    background: var(--meta-color);
    border-radius: 50%;
    animation: typing 1.4s infinite;
  }

  .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
  .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

  @keyframes typing {
    0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
    30% { opacity: 1; transform: translateY(-4px); }
  }

  /* Input bar */
  .input-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-top: 1px solid var(--divider);
    flex-shrink: 0;
  }

  .input-wrapper {
    flex: 1;
    position: relative;
  }

  .input-wrapper input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--divider);
    border-radius: 20px;
    background: var(--input-bg);
    color: var(--card-text);
    font-size: 14px;
    outline: none;
    box-sizing: border-box;
  }

  .input-wrapper input:focus {
    border-color: var(--accent);
  }

  .send-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: var(--accent);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: opacity 0.15s;
  }

  .send-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .send-btn:not(:disabled):hover {
    opacity: 0.85;
  }

  /* @mention dropdown */
  .mention-dropdown {
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    background: var(--card-bg);
    border: 1px solid var(--divider);
    border-radius: 8px;
    box-shadow: 0 -2px 8px rgba(0,0,0,0.1);
    max-height: 160px;
    overflow-y: auto;
    z-index: 10;
    margin-bottom: 4px;
  }

  .mention-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    cursor: pointer;
    font-size: 13px;
  }

  .mention-item:hover {
    background: var(--agent-bubble);
  }

  .mention-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: cover;
  }

  .mention-avatar.placeholder {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--divider);
    font-weight: 600;
    font-size: 11px;
  }
`;
