import React, { useState, useRef, useEffect } from 'react';
import { Plus, Search, Check } from 'lucide-react';

interface BadgeDropdownProps {
  type: 'category' | 'priority';
  value: string;
  options: string[];
  onChange: (newValue: string) => void;
}

export function getCategoryStyles(category: string) {
  const normalized = category.toLowerCase().trim();
  switch (normalized) {
    case 'unsorted':
      return 'bg-neutral-100 text-neutral-850 border-neutral-200';
    case 'tech':
      return 'bg-teal-50 text-teal-700 border-teal-200/50';
    case 'design':
      return 'bg-purple-50 text-purple-700 border-purple-200/50';
    case 'finance':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200/50';
    case 'reading list':
    case 'to learn':
      return 'bg-rose-50 text-rose-700 border-rose-200/50';
    case 'resources':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200/50';
    default:
      // Generate a stable color based on string length & character code sum
      const colors = [
        'bg-blue-50 text-blue-700 border-blue-200/50',
        'bg-orange-50 text-orange-700 border-orange-200/50',
        'bg-amber-50 text-amber-800 border-amber-200/50',
        'bg-cyan-50 text-cyan-700 border-cyan-200/50',
        'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200/50',
      ];
      const sum = normalized.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return colors[sum % colors.length];
  }
}

export function getPriorityStyles(priority: string) {
  const norm = priority.toLowerCase();
  if (norm === 'high') {
    return 'bg-red-50 text-red-700 border-red-200/50';
  } else if (norm === 'medium') {
    return 'bg-amber-50 text-amber-850 border-amber-250';
  }
  return 'bg-blue-50 text-blue-700 border-blue-200/50';
}

export default function BadgeDropdown({ type, value, options, onChange }: BadgeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Parse comma-separated active categories list
  const activeCategories = type === 'category'
    ? value ? value.split(',').map(s => s.trim()).filter(Boolean) : ['Unsorted']
    : [value];

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectPriority = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const handleToggleCategory = (opt: string) => {
    let nextCats = [...activeCategories];
    
    if (opt === 'Unsorted') {
      // If choosing unsorted, clear all others
      nextCats = ['Unsorted'];
    } else {
      // Remove 'Unsorted' first if present
      nextCats = nextCats.filter(c => c !== 'Unsorted');
      
      if (nextCats.includes(opt)) {
        nextCats = nextCats.filter(c => c !== opt);
      } else {
        nextCats.push(opt);
      }
    }

    const finalCats = nextCats.filter(Boolean);
    const joined = finalCats.length > 0 ? finalCats.join(', ') : 'Unsorted';
    onChange(joined);
  };

  const handleCreateNewCategory = () => {
    const trimmed = search.trim();
    if (trimmed) {
      handleToggleCategory(trimmed);
      setSearch('');
    }
  };

  const filteredOptions = type === 'category'
    ? options.filter((opt) => opt.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <div className="relative inline-block select-none" ref={dropdownRef}>
      {type === 'category' ? (
        // Multi-badges triggers container
        <div 
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className="flex flex-wrap items-center gap-1 cursor-pointer max-w-[200px]"
        >
          {activeCategories.map((cat) => {
            const style = getCategoryStyles(cat);
            return (
              <span 
                key={cat} 
                className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md border transition-all hover:opacity-85 ${style}`}
              >
                {cat}
              </span>
            );
          })}
          {activeCategories.length === 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md border bg-neutral-100 text-neutral-800 border-neutral-200">
              Unsorted
            </span>
          )}
        </div>
      ) : (
        // Priority single badge trigger
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className={`px-2 py-0.5 text-xs font-semibold rounded-md border transition-all-custom cursor-pointer hover:opacity-85 ${getPriorityStyles(value)}`}
        >
          {value}
        </button>
      )}

      {isOpen && (
        <div 
          className="absolute z-30 mt-1 w-48 rounded-md bg-white border border-neutral-200/60 shadow-lg text-xs flex flex-col text-neutral-800 divide-y divide-neutral-100"
          onClick={(e) => e.stopPropagation()}
        >
          {type === 'category' && (
            <div className="p-1.5 flex items-center gap-1.5 bg-neutral-50/50">
              <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search or add tag..."
                className="w-full bg-transparent outline-none py-0.5 text-neutral-700 placeholder-neutral-400 font-semibold"
                autoFocus
              />
            </div>
          )}

          <div className="max-h-48 overflow-y-auto py-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = type === 'category'
                  ? activeCategories.includes(opt)
                  : opt === value;

                return (
                  <button
                    key={opt}
                    onClick={() => {
                      if (type === 'category') {
                        handleToggleCategory(opt);
                      } else {
                        handleSelectPriority(opt);
                      }
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-neutral-50 flex items-center justify-between font-bold text-neutral-700 cursor-pointer"
                  >
                    <span className="truncate">{opt}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-hn-orange shrink-0" />}
                  </button>
                );
              })
            ) : (
              type === 'category' && search.trim() && (
                <button
                  onClick={handleCreateNewCategory}
                  className="w-full px-3 py-1.5 text-left text-neutral-500 hover:bg-neutral-50 flex items-center gap-1.5 font-bold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <span className="truncate">Add tag "{search.trim()}"</span>
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
