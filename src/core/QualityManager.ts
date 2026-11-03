import * as THREE from 'three';

export type QualityTier = 'low' | 'medium' | 'high';

export interface QualityProfile {
  tier: QualityTier;
  maxDPR: number;
  shadows: boolean;
  shadowMapSize: number;
  maxGasPuffs: number;
  shatterShards: number;
  starCount: number;
  earthDetail: number;
  cullDistance: number;
}

export class QualityManager {
  private static instance: QualityManager;
  public tier: QualityTier = 'medium';
  public currentDPR: number = 1.0;
  public profile!: QualityProfile;

  // Frame timing & adaptive throttling
  private frameTimes: number[] = [];
  private readonly maxSampleCount = 60;
  private lastTierCheck = performance.now();
  private consecutiveSlowSeconds = 0;
  private consecutiveFastSeconds = 0;
  private isAuto = true;

  // Renderer reference for info & DPR updates
  private renderer: THREE.WebGLRenderer | null = null;
  private onDPRChangeCallbacks: Array<(dpr: number) => void> = [];

  // Performance overlay elements
  private perfOverlayElem: HTMLElement | null = null;
  public showPerfOverlay = false;

  public static getInstance(): QualityManager {
    if (!QualityManager.instance) {
      QualityManager.instance = new QualityManager();
    }
    return QualityManager.instance;
  }

  constructor() {
    this.detectHardware();
    this.updateProfile();

    // Check URL param ?perf=1
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('perf') === '1') {
        this.showPerfOverlay = true;
      }

      window.addEventListener('keydown', (e) => {
        if ((e.key === 'p' || e.key === 'P') && !e.repeat) {
          this.togglePerfOverlay();
        }
      });
    }
  }

  public bindRenderer(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    this.applyDPR();
    if (this.showPerfOverlay) {
      this.initPerfOverlay();
    }
  }

  public onDPRChange(cb: (dpr: number) => void) {
    this.onDPRChangeCallbacks.push(cb);
  }

  private detectHardware() {
    // 1. Check user preference stored in localStorage
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('dave_quality_tier') : null;
    if (saved === 'low' || saved === 'medium' || saved === 'high') {
      this.tier = saved;
      this.isAuto = false;
      return;
    }

    const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
    const memory = typeof navigator !== 'undefined' && (navigator as unknown as { deviceMemory?: number }).deviceMemory
      ? (navigator as unknown as { deviceMemory: number }).deviceMemory
      : 4;

    if (!isTouch && cores >= 8 && memory >= 8) {
      this.tier = 'high';
    } else if (cores <= 4 || memory <= 3) {
      this.tier = 'low';
    } else {
      this.tier = 'medium';
    }
  }

  public setTier(tier: QualityTier, manual = true) {
    this.tier = tier;
    if (manual) {
      this.isAuto = false;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('dave_quality_tier', tier);
      }
    }
    this.updateProfile();
    this.applyDPR();
  }

  private updateProfile() {
    const rawDPR = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    switch (this.tier) {
      case 'low':
        this.profile = {
          tier: 'low',
          maxDPR: 1.0,
          shadows: false,
          shadowMapSize: 512,
          maxGasPuffs: 7,
          shatterShards: 24,
          starCount: 600,
          earthDetail: 2,
          cullDistance: 65
        };
        break;

      case 'medium':
        this.profile = {
          tier: 'medium',
          maxDPR: Math.min(1.25, rawDPR),
          shadows: true,
          shadowMapSize: 1024,
          maxGasPuffs: 14,
          shatterShards: 38,
          starCount: 1200,
          earthDetail: 3,
          cullDistance: 95
        };
        break;

      case 'high':
      default:
        this.profile = {
          tier: 'high',
          maxDPR: Math.min(1.75, rawDPR),
          shadows: true,
          shadowMapSize: 2048,
          maxGasPuffs: 22,
          shatterShards: 58,
          starCount: 1800,
          earthDetail: 4,
          cullDistance: 130
        };
        break;
    }

    this.currentDPR = this.profile.maxDPR;
  }

  private applyDPR() {
    if (this.renderer) {
      this.renderer.setPixelRatio(this.currentDPR);
      this.onDPRChangeCallbacks.forEach((cb) => cb(this.currentDPR));
    }
  }

  public recordFrame(dt: number) {
    const frameMs = dt * 1000;
    this.frameTimes.push(frameMs);
    if (this.frameTimes.length > this.maxSampleCount) {
      this.frameTimes.shift();
    }

    const now = performance.now();
    // Analyze every 1.5 seconds if on auto mode
    if (this.isAuto && now - this.lastTierCheck >= 1500 && this.frameTimes.length >= 30) {
      this.lastTierCheck = now;
      const avgMs = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;

      // Drop quality if frame drops below ~38 FPS (> 26ms frame time)
      if (avgMs > 26.0) {
        this.consecutiveSlowSeconds++;
        this.consecutiveFastSeconds = 0;

        if (this.consecutiveSlowSeconds >= 2) {
          this.consecutiveSlowSeconds = 0;
          if (this.currentDPR > 0.85) {
            this.currentDPR = Math.max(0.75, this.currentDPR - 0.2);
            this.applyDPR();
          } else if (this.tier === 'high') {
            this.setTier('medium', false);
          } else if (this.tier === 'medium') {
            this.setTier('low', false);
          }
        }
      } else if (avgMs < 16.2) {
        this.consecutiveFastSeconds++;
        this.consecutiveSlowSeconds = 0;

        // Upgrade quality if plenty of headroom for 8 seconds
        if (this.consecutiveFastSeconds >= 5) {
          this.consecutiveFastSeconds = 0;
          if (this.currentDPR < this.profile.maxDPR) {
            this.currentDPR = Math.min(this.profile.maxDPR, this.currentDPR + 0.15);
            this.applyDPR();
          }
        }
      } else {
        this.consecutiveSlowSeconds = 0;
        this.consecutiveFastSeconds = 0;
      }
    }

    if (this.showPerfOverlay) {
      this.updatePerfOverlay(dt);
    }
  }

  public togglePerfOverlay() {
    this.showPerfOverlay = !this.showPerfOverlay;
    if (this.showPerfOverlay) {
      this.initPerfOverlay();
    } else if (this.perfOverlayElem) {
      this.perfOverlayElem.style.display = 'none';
    }
  }

  private initPerfOverlay() {
    if (!this.perfOverlayElem && typeof document !== 'undefined') {
      this.perfOverlayElem = document.createElement('div');
      this.perfOverlayElem.id = 'perf-overlay';
      this.perfOverlayElem.style.cssText = `
        position: fixed;
        top: 8px;
        left: 8px;
        background: rgba(10, 15, 25, 0.88);
        border: 1px solid rgba(255, 255, 255, 0.25);
        border-radius: 8px;
        padding: 6px 10px;
        font-family: monospace;
        font-size: 11px;
        color: #00ffcc;
        z-index: 99999;
        pointer-events: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        line-height: 1.4;
      `;
      document.body.appendChild(this.perfOverlayElem);
    }
    if (this.perfOverlayElem) {
      this.perfOverlayElem.style.display = 'block';
    }
  }

  private updatePerfOverlay(dt: number) {
    if (!this.perfOverlayElem || !this.renderer) return;

    const fps = Math.round(1 / Math.max(dt, 0.001));
    const ms = (dt * 1000).toFixed(1);
    const info = this.renderer.info;
    const calls = info.render.calls;
    const tris = info.render.triangles;
    const geos = info.memory.geometries;
    const texs = info.memory.textures;

    this.perfOverlayElem.innerHTML = `
      <div style="font-weight:bold;color:#ffdd55">FPS: ${fps} (${ms}ms)</div>
      <div>DPR: ${this.currentDPR.toFixed(2)} [${this.tier.toUpperCase()}]</div>
      <div>Calls: ${calls} | Tris: ${tris.toLocaleString()}</div>
      <div>Geom: ${geos} | Tex: ${texs}</div>
    `;
  }
}

export const quality = QualityManager.getInstance();
