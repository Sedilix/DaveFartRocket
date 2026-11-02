import { createStore } from 'zustand/vanilla';
import { FartMilestone, getMilestone } from '../data/milestones';

export interface GameStore {
  fartNumber: number;
  currentMilestone: FartMilestone;
  tensionTimer: number; // 0.0 to 4.5 seconds
  maxTension: number;
  isClimax: boolean;
  centerPopupText: string | null;
  narrativeText: string | null;
  onomatopoeiaText: string | null;
  onomatopoeiaTrigger: number;
  whiteoutOpacity: number;
  endingReady: boolean; // the closing cinematic finished; show the "Dave is fine" screen

  // Actions
  triggerFart: () => void;
  setTensionTimer: (time: number) => void;
  setWhiteoutOpacity: (op: number) => void;
  setEndingReady: (ready: boolean) => void;
  resetGame: () => void;
}

export const useGameStore = createStore<GameStore>((set, get) => ({
  fartNumber: 1,
  currentMilestone: getMilestone(1),
  tensionTimer: 4.5,
  maxTension: 4.5,
  isClimax: false,
  centerPopupText: getMilestone(1).centerPopup,
  narrativeText: getMilestone(1).narrativeSubtitle,
  onomatopoeiaText: null,
  onomatopoeiaTrigger: 0,
  whiteoutOpacity: 0,
  endingReady: false,

  triggerFart: () => {
    const current = get().fartNumber;
    const nextFart = Math.min(25, current + 1);
    const milestone = getMilestone(nextFart);

    set({
      fartNumber: nextFart,
      currentMilestone: milestone,
      tensionTimer: 4.5, // reset tension ring
      onomatopoeiaText: milestone.onomatopoeia,
      onomatopoeiaTrigger: Date.now(),
      centerPopupText: milestone.centerPopup,
      narrativeText: milestone.narrativeSubtitle,
      isClimax: nextFart === 25
    });
  },

  setTensionTimer: (time: number) => set({ tensionTimer: Math.max(0, time) }),
  setWhiteoutOpacity: (whiteoutOpacity: number) => set({ whiteoutOpacity }),
  setEndingReady: (endingReady: boolean) => set({ endingReady }),

  resetGame: () => {
    const first = getMilestone(1);
    set({
      fartNumber: 1,
      currentMilestone: first,
      tensionTimer: 4.5,
      isClimax: false,
      centerPopupText: first.centerPopup,
      narrativeText: first.narrativeSubtitle,
      onomatopoeiaText: null,
      whiteoutOpacity: 0,
      endingReady: false
    });
  }
}));
