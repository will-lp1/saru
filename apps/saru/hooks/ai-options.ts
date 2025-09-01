import { createWithEqualityFn } from "zustand/traditional";
import { persist, createJSONStorage } from "zustand/middleware";
import { shallow } from "zustand/shallow";

export const AI_STORAGE_KEY = "ai-options-storage" as const;

export type SuggestionLength = "short" | "medium" | "long";

interface AiOptionsState {
  suggestionLength: SuggestionLength;
  customInstructions: string;
  writingSample: string;
  writingStyleSummary: string;
  applyStyle: boolean;
  setSuggestionLength: (length: SuggestionLength) => void;
  setCustomInstructions: (instructions: string) => void;
  setWritingSample: (sample: string) => void;
  setWritingStyleSummary: (summary: string) => void;
  setApplyStyle: (val: boolean) => void;
  syncFromStorage: () => void;
}

// Type guard for SuggestionLength
const isSuggestionLength = (value: unknown): value is SuggestionLength =>
  typeof value === "string" && ["short", "medium", "long"].includes(value);

// Create the store
export const useAiOptions = createWithEqualityFn<AiOptionsState>()(
  persist(
    (set) => ({
      suggestionLength: "medium",
      customInstructions: "",
      writingSample: "",
      writingStyleSummary: "",
      applyStyle: false,
      setSuggestionLength: (length) => set({ suggestionLength: length }),
      setCustomInstructions: (instructions) =>
        set({ customInstructions: instructions }),
      setWritingSample: (sample) => set({ writingSample: sample }),
      setWritingStyleSummary: (summary) => set({ writingStyleSummary: summary }),
      setApplyStyle: (val) => set({ applyStyle: val }),
      syncFromStorage: () => {
        try {
          const stored = localStorage.getItem(AI_STORAGE_KEY);
          if (!stored) return;

          const data = JSON.parse(stored);
          const length = data?.state?.suggestionLength;
          const instructions = data?.state?.customInstructions;
          const writingSample = data?.state?.writingSample;
          const writingStyleSummary = data?.state?.writingStyleSummary;
          const applyStyle = data?.state?.applyStyle;

          set({
            suggestionLength: isSuggestionLength(length) ? length : "medium",
            customInstructions:
              typeof instructions === "string" ? instructions : "",
            writingSample: typeof writingSample === "string" ? writingSample : "",
            writingStyleSummary:
              typeof writingStyleSummary === "string" ? writingStyleSummary : "",
            applyStyle: typeof applyStyle === "boolean" ? applyStyle : false,
          });
        } catch (error) {
          console.error("Failed to sync AI options from storage:", error);
        }
      },
    }),
    {
      name: AI_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        suggestionLength: state.suggestionLength,
        customInstructions: state.customInstructions,
        writingSample: state.writingSample,
        writingStyleSummary: state.writingStyleSummary,
        applyStyle: state.applyStyle,
      }),
    }
  ),
  shallow
);

// Set up storage event listener for cross-tab synchronization
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === AI_STORAGE_KEY) {
      useAiOptions.getState().syncFromStorage();
    }
  });
}

// Export a type-safe selector hook with proper caching
export const useAiOptionsValue = () =>
  useAiOptions((state) => ({
    suggestionLength: state.suggestionLength,
    customInstructions: state.customInstructions,
    writingSample: state.writingSample,
    writingStyleSummary: state.writingStyleSummary,
    applyStyle: state.applyStyle,
  }));
