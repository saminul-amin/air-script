import { useCallback, useRef, useState } from "react";
import { fetchSuggestions, fetchAutocomplete, learnCorrection } from "../utils/api";
import type { RecognizedChar, WordSuggestion, AutocompleteResponse } from "../types";

const DEBOUNCE_MS = 300;

/**
 * useSuggestions — manages word suggestions, auto-complete, and personal learning.
 *
 * Watches the current word builder state and fetches suggestions when the user
 * is in the middle of typing a word (partial word detected).
 */
export default function useSuggestions() {
  const [suggestions, setSuggestions] = useState<WordSuggestion[]>([]);
  const [nextWords, setNextWords] = useState<string[]>([]);
  const [autocomplete, setAutocomplete] = useState<AutocompleteResponse | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPrefix = useRef("");

  /**
   * Call this whenever the word array or corrected text changes.
   * Extracts the last partial word and fetches suggestions.
   */
  const updateSuggestions = useCallback((wordArray: RecognizedChar[], correctedText: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      // Get the last word being typed (no space after it = still partial)
      const rawString = wordArray.map((c) => c.label).join("");
      if (!rawString || rawString.endsWith(" ")) {
        // Word just completed — get next-word predictions instead
        const context = (correctedText || rawString).trim();
        if (context) {
          try {
            const result = await fetchSuggestions("", context, 5);
            setSuggestions([]);
            setNextWords(result.next_words || []);
            setAutocomplete(null);
          } catch {
            setNextWords([]);
          }
        } else {
          setSuggestions([]);
          setNextWords([]);
          setAutocomplete(null);
        }
        lastPrefix.current = "";
        return;
      }

      // Extract last partial word
      const words = rawString.split(" ");
      const partial = words[words.length - 1];

      if (!partial || partial.length < 2) {
        setSuggestions([]);
        setAutocomplete(null);
        lastPrefix.current = "";
        return;
      }

      // Skip if we already fetched for this prefix
      if (partial === lastPrefix.current) return;
      lastPrefix.current = partial;

      const context = (correctedText || rawString).trim();

      try {
        const [sugResult, acResult] = await Promise.all([
          fetchSuggestions(partial, context, 5),
          fetchAutocomplete(partial, context),
        ]);
        setSuggestions(sugResult.suggestions || []);
        setNextWords(sugResult.next_words || []);
        setAutocomplete(
          acResult.full_word ? acResult : null,
        );
      } catch {
        setSuggestions([]);
        setNextWords([]);
        setAutocomplete(null);
      }
    }, DEBOUNCE_MS);
  }, []);

  /** Clear all suggestions. */
  const clearSuggestions = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setSuggestions([]);
    setNextWords([]);
    setAutocomplete(null);
    lastPrefix.current = "";
  }, []);

  /**
   * Send a user correction to the personal dictionary backend.
   * Call this when the user edits text — diff the old vs new to find corrections.
   */
  const learnFromEdit = useCallback((oldText: string, newText: string) => {
    if (!oldText || !newText) return;

    const oldWords = oldText.trim().split(/\s+/);
    const newWords = newText.trim().split(/\s+/);

    // Simple word-level diff: same position, different word = correction
    const len = Math.min(oldWords.length, newWords.length);
    for (let i = 0; i < len; i++) {
      if (
        oldWords[i] !== newWords[i] &&
        oldWords[i].length > 0 &&
        newWords[i].length > 0
      ) {
        learnCorrection(oldWords[i], newWords[i]);
      }
    }
  }, []);

  return {
    suggestions,
    nextWords,
    autocomplete,
    updateSuggestions,
    clearSuggestions,
    learnFromEdit,
  };
}
