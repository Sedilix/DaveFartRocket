import { createStore } from 'zustand/vanilla';
import { getMilestone } from '../data/milestones';
export const useGameStore = createStore((set, get) => ({
    fartNumber: 1,
    currentMilestone: getMilestone(1),
    tensionTimer: 4.5,
    maxTension: 4.5,
    isAirborne: false,
    altitude: 0,
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
            isAirborne: nextFart >= 9,
            isClimax: nextFart === 25
        });
    },
    setTensionTimer: (time) => set({ tensionTimer: Math.max(0, time) }),
    setAltitude: (altitude) => set({ altitude }),
    setAirborne: (isAirborne) => set({ isAirborne }),
    setWhiteoutOpacity: (whiteoutOpacity) => set({ whiteoutOpacity }),
    setEndingReady: (endingReady) => set({ endingReady }),
    resetGame: () => {
        const first = getMilestone(1);
        set({
            fartNumber: 1,
            currentMilestone: first,
            tensionTimer: 4.5,
            isAirborne: false,
            altitude: 0,
            isClimax: false,
            centerPopupText: first.centerPopup,
            narrativeText: first.narrativeSubtitle,
            onomatopoeiaText: null,
            whiteoutOpacity: 0,
            endingReady: false
        });
    }
}));
//# sourceMappingURL=gameState.js.map