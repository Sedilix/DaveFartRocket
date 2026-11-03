/**
 * Persistent progression system for Dave Fart Rocket.
 * Tracks unlocked acts, cross-act casualties, best scores, and achievements in localStorage.
 */

export interface ActStats {
  farts?: number;
  falls?: number;
  casualties?: number;
  timeMs?: number;
  bestChain?: number;
  attempts?: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: number;
}

export const ACHIEVEMENTS: Record<string, Omit<Achievement, 'id'>> = {
  dave_is_fine: {
    title: 'Dave Is Fine',
    description: 'Survive Earth’s launch without a scratch.',
    icon: '🚀'
  },
  holy_wind: {
    title: 'Prophet of the Gust',
    description: 'Cross the Moon of Nom gulch and ring the Gust Horn.',
    icon: '💨'
  },
  found_the_stairs: {
    title: 'Found the Stairs',
    description: 'Notice the stairs in Frostbite Hotel that everyone ignored.',
    icon: '🪜'
  },
  perfectly_silent: {
    title: 'Perfect Silence',
    description: 'Release precisely within the silent green window on your first attempt.',
    icon: '🌱'
  },
  gust_master: {
    title: 'Gust Master',
    description: 'Maintain a boost chain of x6 or higher.',
    icon: '⚡'
  },
  reasonable_answer: {
    title: 'The Reasonable Answer',
    description: 'Stand completely still when the Silence approaches.',
    icon: '⏳'
  },
  pigeon_whisperer: {
    title: 'Pigeon Whisperer',
    description: 'Cross paths with the galaxy-trotting pigeon in every act.',
    icon: '🐦'
  },
  brunch: {
    title: 'Epilogue: Brunch',
    description: 'Rebuild a home for Dave and the Quell on the new Earth.',
    icon: '☕'
  }
};

export interface ProgressionData {
  unlockedAct: number; // 0 = Street, 1 = S1 Ship, ..., 5 = S5 Source
  completedActs: number[];
  totalCasualties: number;
  actStats: Record<number, ActStats>;
  achievements: Record<string, number>; // id -> timestamp
}

const STORAGE_KEY = 'dave_progression_v1';

class ProgressionManager {
  private data: ProgressionData = {
    unlockedAct: 0,
    completedActs: [],
    totalCasualties: 0,
    actStats: {},
    achievements: {}
  };

  private listeners = new Set<() => void>();

  constructor() {
    this.load();
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.data = {
          unlockedAct: typeof parsed.unlockedAct === 'number' ? parsed.unlockedAct : 0,
          completedActs: Array.isArray(parsed.completedActs) ? parsed.completedActs : [],
          totalCasualties: typeof parsed.totalCasualties === 'number' ? parsed.totalCasualties : 0,
          actStats: parsed.actStats || {},
          achievements: parsed.achievements || {}
        };
      }
    } catch (e) {
      console.warn('Failed to load progression from localStorage', e);
    }
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      this.notify();
    } catch (e) {
      console.warn('Failed to save progression to localStorage', e);
    }
  }

  private notify() {
    for (const cb of this.listeners) {
      try { cb(); } catch {}
    }
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  public get unlockedAct(): number {
    return this.data.unlockedAct;
  }

  public isActUnlocked(act: number): boolean {
    return act === 0 || this.data.unlockedAct >= act;
  }

  public isActCompleted(act: number): boolean {
    return this.data.completedActs.includes(act);
  }

  public unlockAct(act: number) {
    if (act > this.data.unlockedAct) {
      this.data.unlockedAct = act;
      this.save();
    }
  }

  public completeAct(act: number, stats?: ActStats) {
    if (!this.data.completedActs.includes(act)) {
      this.data.completedActs.push(act);
    }
    // Advance unlocked act to at least next act
    if (act + 1 > this.data.unlockedAct) {
      this.data.unlockedAct = Math.min(5, act + 1);
    }
    if (stats) {
      this.data.actStats[act] = {
        ...(this.data.actStats[act] || {}),
        ...stats
      };
      if (stats.casualties) {
        this.data.totalCasualties += stats.casualties;
      }
    }
    this.save();
  }

  public addCasualties(count: number) {
    if (count <= 0) return;
    this.data.totalCasualties += count;
    this.save();
  }

  public get totalCasualties(): number {
    return this.data.totalCasualties;
  }

  public unlockAchievement(id: string): boolean {
    if (this.data.achievements[id]) return false;
    this.data.achievements[id] = Date.now();
    this.save();
    this.showAchievementToast(id);
    return true;
  }

  public hasAchievement(id: string): boolean {
    return !!this.data.achievements[id];
  }

  public get achievementsList(): Array<Achievement & { unlocked: boolean }> {
    return Object.entries(ACHIEVEMENTS).map(([id, meta]) => ({
      id,
      title: meta.title,
      description: meta.description,
      icon: meta.icon,
      unlockedAt: this.data.achievements[id],
      unlocked: !!this.data.achievements[id]
    }));
  }

  public showAchievementToast(id: string) {
    if (typeof document === 'undefined') return;
    const meta = ACHIEVEMENTS[id];
    if (!meta) return;
    const toast = document.createElement('div');
    toast.className = 'hud-toast';
    toast.innerHTML = `<span style="font-size:18px;margin-right:6px">${meta.icon}</span> <span><b>ACHIEVEMENT:</b> ${meta.title}</span>`;
    document.body.appendChild(toast);
    const rAf = typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : (fn: () => void) => setTimeout(fn, 16);
    rAf(() => toast.classList.add('visible'));
    window.setTimeout(() => {
      toast.classList.remove('visible');
      window.setTimeout(() => toast.remove?.(), 400);
    }, 3500);
  }

  public reset() {
    this.data = {
      unlockedAct: 0,
      completedActs: [],
      totalCasualties: 0,
      actStats: {},
      achievements: {}
    };
    this.save();
  }
}

export const progression = new ProgressionManager();
