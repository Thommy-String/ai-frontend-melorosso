// src/ChatHistoryViewer.tsx

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { type ContactRequest } from './ContactRequestSection';
import './ChatHistoryViewer.css';

// 1. Definizioni dei tipi aggiornate
type TextMsg = { type: 'text'; content: string };
type ProductCardData = { title: string; price: string; imageUrl: string; linkUrl: string; };
type ProductCardMsg = { type: 'product_card'; data: ProductCardData };
type ButtonMsg = { type: 'button'; label: string; action: string; class?: string };
type MapCardData = { title: string; embedUrl: string; linkUrl: string };
type MapCardMsg = { type: 'map_card'; data: MapCardData };

type ParsedMsg = TextMsg | ProductCardMsg | ButtonMsg | MapCardMsg;


interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatHistoryViewerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  isLoading: boolean;
  contactInfo: ContactRequest | null;
}

export default function ChatHistoryViewer({ isOpen, onClose, messages, isLoading, contactInfo }: ChatHistoryViewerProps) {
  if (!isOpen) return null;

  // 2. Funzione di rendering aggiornata con i nuovi elementi
  const renderMessageContent = (msg: Message) => {
    if (msg.role === 'user') {
      return <div className="message-bubble">{msg.content}</div>;
    }

    try {
      const parsedContent: ParsedMsg[] = JSON.parse(msg.content);

      if (Array.isArray(parsedContent)) {
        return parsedContent.map((item, index) => {
          switch (item.type) {
            case 'text':
              return (
                <div key={index} className="message-bubble">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {item.content}
                  </ReactMarkdown>
                </div>
              );
            case 'product_card':
              return (
                <a key={index} href={item.data.linkUrl} target="_blank" rel="noopener noreferrer" className="product-card-viewer">
                  <img src={item.data.imageUrl} alt={item.data.title} className="product-card-image-viewer" />
                  <div className="product-card-info-viewer">
                    <div className="product-card-title-viewer">{item.data.title}</div>
                    <div className="product-card-price-viewer">{item.data.price}</div>
                  </div>
                </a>
              );
            case 'button':
              return (
                <a key={index} href={item.action} className={`chat-button-viewer ${item.class || ''}`}>
                  {item.label}
                </a>
              );
            case 'map_card':
              return (
                <div key={index} className="map-card-viewer">
                  <iframe
                    src={item.data.embedUrl}
                    width="100%" height="180"
                    loading="lazy" style={{ border: 0 }}
                    allowFullScreen></iframe>
                  <div className="map-card-footer-viewer">
                    <a href={item.data.linkUrl} target="_blank" rel="noopener noreferrer">
                      {item.data.title} - Apri su Google Maps
                    </a>
                  </div>
                </div>
              );
            default:
              return null;
          }
        });
      }
    } catch (error) {
      return (
        <div className="message-bubble">
           <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {msg.content}
          </ReactMarkdown>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="chat-history-viewer">
      <header className="viewer-header">
        <div className="viewer-contact-details">
          <h3>Chat con {contactInfo?.name}</h3>
          <span>{new Date(contactInfo!.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</span>
        </div>
        <div className="viewer-actions">
          {contactInfo?.phone && (
            <a href={`tel:${contactInfo.phone}`} className="viewer-action-button" title="Chiama">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
            </a>
          )}
          {contactInfo?.email && (
            <a href={`mailto:${contactInfo.email}`} className="viewer-action-button" title="Invia Email">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
            </a>
          )}
        </div>
        <button className="viewer-close-button" onClick={onClose}>&times;</button>
      </header>
      <div className="viewer-body">
        {isLoading ? (
          <div className="loading-spinner">Caricamento...</div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`message-bubble-wrapper message-from-${msg.role}`}>
              {renderMessageContent(msg)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}