import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Persists form state to localStorage so users can resume incomplete entries.
 * @param {string} key - unique key per page/form (e.g. 'gate_entry_draft')
 * @param {object} initialState - the default empty state for the form
 * @returns {[state, setState, clearDraft, hasDraft]}
 */
export default function useDraftSave(key, initialState) {
  const storageKey = `k95_draft_${key}`;
  const initialRef = useRef(initialState);

  const [state, setState] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return { ...initialState, ...JSON.parse(saved) };
      } catch { /* ignore parse errors */ }
    }
    return initialState;
  });

  const [hasDraft] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return false;
    try {
      const parsed = JSON.parse(saved);
      // Check if draft has any meaningful data
      return Object.keys(parsed).some(k => {
        const v = parsed[k];
        if (v === '' || v === null || v === undefined) return false;
        if (Array.isArray(v) && v.length === 0) return false;
        if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) return false;
        // Compare with initial
        const init = initialRef.current[k];
        return JSON.stringify(v) !== JSON.stringify(init);
      });
    } catch { return false; }
  });

  // Auto-save on state change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify(state));
    }, 500);
    return () => clearTimeout(timer);
  }, [state, storageKey]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
    setState(initialRef.current);
  }, [storageKey]);

  return [state, setState, clearDraft, hasDraft];
}