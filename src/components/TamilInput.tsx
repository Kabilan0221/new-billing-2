import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Languages } from 'lucide-react';
import { transliterateTamil, transliterateWord } from '../services/tamilTransliterate';

interface TamilInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  englishName?: string;
  disabled?: boolean;
  title?: string;
}

export const TamilInput: React.FC<TamilInputProps> = ({
  value,
  onChange,
  placeholder = 'தமிழ் பெயர் (Type Tanglish / தமிழ்)',
  className = '',
  autoFocus = false,
  onKeyDown,
  englishName,
  disabled = false,
  title,
}) => {
  const [autoTranslit, setAutoTranslit] = useState(true);
  const [currentWordPreview, setCurrentWordPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Helper to extract the word immediately preceding the cursor
  const getPrecedingWord = (text: string, cursorPos: number): { word: string; start: number; end: number } | null => {
    const textBeforeCursor = text.slice(0, cursorPos);
    const match = textBeforeCursor.match(/([a-zA-Z0-9]+)$/);
    if (!match) return null;
    const word = match[1];
    const start = cursorPos - word.length;
    return { word, start, end: cursorPos };
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    const cursorPos = e.target.selectionStart || 0;

    if (autoTranslit) {
      const preceding = getPrecedingWord(newVal, cursorPos);
      if (preceding && /[a-zA-Z]/.test(preceding.word)) {
        const translit = transliterateWord(preceding.word);
        setCurrentWordPreview(translit !== preceding.word ? translit : null);
      } else {
        setCurrentWordPreview(null);
      }
    } else {
      setCurrentWordPreview(null);
    }

    onChange(newVal);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // If Space key is pressed and auto-transliteration is ON, transliterate preceding English word
    if (e.key === ' ' && autoTranslit) {
      const input = inputRef.current;
      if (input) {
        const cursorPos = input.selectionStart || 0;
        const preceding = getPrecedingWord(value, cursorPos);

        if (preceding && /[a-zA-Z]/.test(preceding.word)) {
          e.preventDefault();
          const converted = transliterateWord(preceding.word);
          const before = value.slice(0, preceding.start);
          const after = value.slice(preceding.end);
          const updated = `${before}${converted} ${after}`;
          const newCursorPos = preceding.start + converted.length + 1;

          onChange(updated);
          setCurrentWordPreview(null);

          // Restore cursor position after state flush
          requestAnimationFrame(() => {
            if (inputRef.current) {
              inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
            }
          });
          return;
        }
      }
    }

    // If Enter key is pressed, transliterate any trailing English before passing to parent
    if (e.key === 'Enter' && autoTranslit && /[a-zA-Z]/.test(value)) {
      const allTransliterated = transliterateTamil(value);
      if (allTransliterated !== value) {
        onChange(allTransliterated);
      }
    }

    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  const handleBlur = () => {
    setCurrentWordPreview(null);
    // Auto-transliterate any remaining English tokens on blur
    if (autoTranslit && /[a-zA-Z]/.test(value)) {
      const converted = transliterateTamil(value);
      if (converted !== value) {
        onChange(converted);
      }
    }
  };

  // Convert entire current text to Tamil
  const handleTransliterateAll = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (value.trim()) {
      const converted = transliterateTamil(value);
      onChange(converted);
    } else if (englishName && englishName.trim()) {
      const converted = transliterateTamil(englishName);
      onChange(converted);
    }
    inputRef.current?.focus();
  };

  // Auto-translate / transliterate from English Name
  const handleAutoFromEnglish = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (englishName && englishName.trim()) {
      const converted = transliterateTamil(englishName);
      onChange(converted);
    }
    inputRef.current?.focus();
  };

  return (
    <div className="relative w-full flex items-center group">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        title={title || 'Type in Tanglish (e.g. "arisi") + Space = auto converts to தமிழ்'}
        className={`w-full pr-12 font-sans ${className}`}
      />

      {/* Floating live preview of Tamil transliteration under cursor */}
      {currentWordPreview && (
        <div className="absolute left-1 bottom-full mb-0.5 z-30 bg-[#0f2a4a] text-amber-300 text-[10px] font-sans px-1.5 py-0.5 rounded shadow-lg border border-blue-400 pointer-events-none whitespace-nowrap animate-in fade-in duration-75 flex items-center gap-1">
          <span className="text-[9px] text-slate-300">Space ➔</span>
          <span className="font-bold text-white">{currentWordPreview}</span>
        </div>
      )}

      {/* Action icons inside input */}
      <div className="absolute right-1 flex items-center gap-0.5 select-none">
        {englishName && englishName.trim() && (
          <button
            type="button"
            tabIndex={-1}
            onClick={handleAutoFromEnglish}
            className="p-0.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded text-[10px] cursor-pointer"
            title={`Auto-fill Tamil from English ("${englishName}")`}
          >
            <Sparkles className="w-3 h-3 text-amber-600 hover:text-amber-700" />
          </button>
        )}

        <button
          type="button"
          tabIndex={-1}
          onClick={() => setAutoTranslit((prev) => !prev)}
          className={`px-1 py-0.2 rounded text-[10px] font-semibold tracking-tighter cursor-pointer transition-colors border ${
            autoTranslit
              ? 'bg-blue-600 text-white border-blue-700 shadow-2xs'
              : 'bg-slate-200 text-slate-600 border-slate-300'
          }`}
          title={
            autoTranslit
              ? 'Tamil Auto-Transliteration is ON (Tanglish ➔ தமிழ்). Click to turn OFF.'
              : 'Tamil Auto-Transliteration is OFF. Click to turn ON.'
          }
        >
          {autoTranslit ? 'த ON' : 'En'}
        </button>
      </div>
    </div>
  );
};
