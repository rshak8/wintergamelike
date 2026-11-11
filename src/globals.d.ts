import type * as THREE from 'three';
import type { Game } from './game';

interface CloseupOptions { yaw?: number; dist?: number; height?: number; look?: number; fov?: number }

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
    // ad network SDKs (present only inside an ad container)
    mraid?: { open?(url: string): void; addEventListener?(event: string, cb: () => void): void };
    ExitApi?: { exit?(): void };
    // debug hooks for automated QA
    __game?: Game;
    __renderer?: THREE.WebGLRenderer;
    __pause?: boolean;
    __step?: (sec: number, fps?: number) => void;
    __closeup?: (obj: THREE.Object3D, opts?: CloseupOptions) => void;
    __resume?: () => void;
  }
}

export {};
