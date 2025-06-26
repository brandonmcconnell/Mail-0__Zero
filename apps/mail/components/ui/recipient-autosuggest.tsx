'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { trpcClient } from '@/providers/query-provider';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Avatar, AvatarFallback } from './avatar';

interface RecipientSuggestion {
  email: string;
  name?: string | null;
  displayText: string;
}

interface RecipientAutosuggestProps {
  recipients: string[];
  onRecipientsChange: (recipients: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function RecipientAutosuggest({
  recipients,
  onRecipientsChange,
  placeholder = 'Enter email',
  className,
  disabled = false,
}: RecipientAutosuggestProps) {
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [suggestions, setSuggestions] = useState<RecipientSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isComposing, setIsComposing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cachedContacts, setCachedContacts] = useState<RecipientSuggestion[]>([]);
  const [hasFullCache, setHasFullCache] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (debounceRef.current) {  
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(inputValue);
    }, 300);
    
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [inputValue]);

  const fetchSuggestions = useCallback(
    async (query: string) => {
      try {
        setIsLoading(true);
        
        if (hasFullCache && query.trim()) {
          const localFiltered = cachedContacts
            .filter(c => 
              c.email.toLowerCase().includes(query.toLowerCase()) ||
              (c.name && c.name.toLowerCase().includes(query.toLowerCase()))
            )
            .filter(c => !recipients.includes(c.email))
            .slice(0, 10);
          
          if (localFiltered.length > 0) {
            setSuggestions(localFiltered);
            setIsOpen(true);
            setIsLoading(false);
            return;
          }
        }
        
        const data = await trpcClient.mail.suggestRecipients.query({
          query,
          limit: 10,
        });
        
        if (!query.trim() && data.length > 0) {
          setCachedContacts(data);
          setHasFullCache(true);
        }
        
        const filtered = data.filter((suggestion) => !recipients.includes(suggestion.email));
        setSuggestions(filtered);
        setIsOpen(filtered.length > 0);
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
        setSuggestions([]);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    },
    [recipients, cachedContacts, hasFullCache],
  );

  useEffect(() => {
    if (isComposing) return;

    if (debouncedQuery.trim().length > 0) {
      fetchSuggestions(debouncedQuery);
    } else {
      setIsOpen(false);
      setSuggestions([]);
    }
  }, [debouncedQuery, fetchSuggestions, isComposing]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setSelectedIndex(-1);
  }, []);

  const isValidEmail = useCallback((email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }, []);

  const addRecipient = useCallback((email: string) => {
    if (!recipients.includes(email) && isValidEmail(email)) {
      onRecipientsChange([...recipients, email]);
      setInputValue('');
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  }, [recipients, onRecipientsChange, isValidEmail]);

  const removeRecipient = useCallback((index: number) => {
    const newRecipients = recipients.filter((_, i) => i !== index);
    onRecipientsChange(newRecipients);
  }, [recipients, onRecipientsChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isComposing) return;

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          addRecipient(suggestions[selectedIndex].email);
        } else if (inputValue.trim() && isValidEmail(inputValue.trim())) {
          addRecipient(inputValue.trim());
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
      case 'Backspace':
        if (!inputValue && recipients.length > 0) {
          removeRecipient(recipients.length - 1);
        }
        break;
      case 'Tab':
      case ' ':
        if (inputValue.trim() && isValidEmail(inputValue.trim())) {
          e.preventDefault();
          addRecipient(inputValue.trim());
        }
        break;
    }
  }, [inputValue, selectedIndex, suggestions, recipients, isComposing, addRecipient, removeRecipient, isValidEmail]);

  const handleSuggestionClick = useCallback((suggestion: RecipientSuggestion) => {
    addRecipient(suggestion.email);
  }, [addRecipient]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const emails = pastedText
      .split(/[,;\s]+/)
      .map(email => email.trim())
      .filter(email => email.length > 0 && isValidEmail(email))
      .filter(email => !recipients.includes(email));
    
    if (emails.length > 0) {
      onRecipientsChange([...recipients, ...emails]);
    }
  }, [recipients, onRecipientsChange, isValidEmail]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn('relative w-full', className)}>
      <div className="flex flex-wrap items-center gap-2 min-h-[32px]">
        {recipients.map((email, index) => (
          <div
            key={index}
            className="flex items-center gap-1 rounded-full border px-2 py-0.5"
          >
            <span className="flex gap-1 py-0.5 text-sm text-black dark:text-white">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="bg-offsetLight text-muted-foreground rounded-full text-xs font-bold dark:bg-[#373737] dark:text-[#9B9B9B]">
                  {email.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {email}
            </span>
            <button
              type="button"
              onClick={() => removeRecipient(index)}
              className="text-white/50 hover:text-white/90"
              disabled={disabled}
            >
              <X className="mt-0.5 h-3.5 w-3.5 fill-black dark:fill-[#9A9A9A]" />
            </button>
          </div>
        ))}
        <input
          ref={inputRef}
          type="email"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          placeholder={recipients.length === 0 ? placeholder : ''}
          className="h-6 flex-1 bg-transparent text-sm font-normal leading-normal text-black placeholder:text-[#797979] focus:outline-none dark:text-white"
          disabled={disabled}
        />
      </div>

      {isOpen && (suggestions.length > 0 || isLoading) && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 z-[9999] mt-1 max-h-60 overflow-auto rounded-md border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95"
        >
          {isLoading && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              Loading suggestions...
            </div>
          )}
          {!isLoading && suggestions.length === 0 && debouncedQuery.trim().length > 0 && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">No suggestions</div>
          )}
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.email}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm rounded-sm transition-colors',
                index === selectedIndex
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs font-bold">
                  {suggestion.email.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {suggestion.name || suggestion.email}
                </div>
                {suggestion.name && (
                  <div className="text-xs text-muted-foreground truncate">
                    {suggestion.email}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
} 