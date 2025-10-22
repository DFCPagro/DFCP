import { create } from "zustand"

type Code = string // e.g. "1A1"

interface State {
  selected: Record<Code, true>
  toggle: (code: Code) => void
  isSelected: (code: Code) => boolean
  clear: () => void
}

export const useSelectionStore = create<State>((set, get) => ({
  selected: {},
  toggle: (code) =>
    set((s) => {
      const next = { ...s.selected }
      if (next[code]) delete next[code]
      else next[code] = true
      return { selected: next }
    }),
  isSelected: (code) => Boolean(get().selected[code]),
  clear: () => set({ selected: {} }),
}))
