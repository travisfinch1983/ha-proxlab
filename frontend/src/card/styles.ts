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

  .portrait-panel img {
    flex: 1;
    min-height: 0;
    width: 100%;
    object-fit: contain;
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
