import React, { useState, useRef } from 'react';
import { Paperclip, Send, X, FileText, Image as ImageIcon, File } from 'lucide-react';
import { uploadFiles } from '../lib/upload';

interface ChatInputProps {
  onSendMessage: (text: string, attachments: any[]) => Promise<void>;
  placeholder?: string;
  showAttachmentButton?: boolean;
}

const MAX_FILE_SIZE = 6 * 1024 * 1024; // 6MB
const ALLOWED_TYPES = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp'
];

export function ChatInput({ onSendMessage, placeholder = "Digite sua mensagem...", showAttachmentButton = true }: ChatInputProps) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (!e.target.files) return;

    const selectedFiles = Array.from(e.target.files) as File[];
    const validFiles: File[] = [];
    let hasError = false;

    if (files.length + selectedFiles.length > 2) {
      setError('Você pode anexar no máximo 2 arquivos por mensagem.');
      hasError = true;
    }

    for (const file of selectedFiles) {
      if (validFiles.length + files.length >= 2) break;

      if (file.size > MAX_FILE_SIZE) {
        setError(`O arquivo '${file.name}' excede o limite de 6 MB. Por favor, selecione um arquivo menor.`);
        hasError = true;
        continue;
      }

      // Basic frontend MIME check (backend does deep check)
      if (!ALLOWED_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith('.doc') && !file.name.toLowerCase().endsWith('.docx') && !file.name.toLowerCase().endsWith('.pdf')) {
        setError(`Tipo de arquivo não permitido. São aceitos apenas: Word (.doc, .docx), PDF (.pdf) e imagens.`);
        hasError = true;
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles].slice(0, 2));
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!text.trim() && files.length === 0) || isUploading) return;

    setIsUploading(true);
    setError(null);

    try {
      let attachments = [];
      if (files.length > 0) {
        attachments = await uploadFiles(files);
      }

      await onSendMessage(text, attachments);
      setText('');
      setFiles([]);
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar mensagem.');
    } finally {
      setIsUploading(false);
    }
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-blue-500" />;
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return <FileText className="w-4 h-4 text-red-500" />;
    if (file.name.toLowerCase().endsWith('.doc') || file.name.toLowerCase().endsWith('.docx')) return <FileText className="w-4 h-4 text-blue-700" />;
    return <File className="w-4 h-4 text-slate-500" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="flex flex-col w-full">
      {error && (
        <div className="mb-2 p-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 ml-2">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {files.map((file, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 text-xs max-w-[200px]">
              {getFileIcon(file)}
              <div className="flex-1 truncate" title={file.name}>
                <span className="font-medium text-slate-700 block truncate">{file.name}</span>
                <span className="text-slate-500 text-[10px]">{formatSize(file.size)}</span>
              </div>
              <button 
                type="button" 
                onClick={() => removeFile(idx)}
                className="text-slate-400 hover:text-red-500 p-0.5 rounded-full hover:bg-slate-200 transition-colors"
                disabled={isUploading}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        {showAttachmentButton && (
          <>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              className="hidden" 
              multiple 
              accept=".doc,.docx,.pdf,image/jpeg,image/png,image/gif,image/webp,image/bmp"
              disabled={isUploading || files.length >= 2}
            />
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || files.length >= 2}
              className="p-2 text-slate-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed h-10 w-10 flex items-center justify-center shrink-0"
              title="Anexar arquivo"
            >
              <Paperclip className="w-5 h-5" />
            </button>
          </>
        )}
        
        <input 
          type="text" 
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder} 
          disabled={isUploading}
          className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary h-10" 
        />
        
        <button 
          type="submit" 
          disabled={(!text.trim() && files.length === 0) || isUploading} 
          className="bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed h-10 flex items-center justify-center shrink-0"
        >
          {isUploading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
    </div>
  );
}
