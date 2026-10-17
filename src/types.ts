export type ModelType = 'raven' | 'aleph2' | 'veo3.1' | 'gen-3-alpha';

export type AspectRatio = '16:9' | '9:16' | '1:1' | '21:9' | '4:3';

export type CameraMotion = 
  | 'drone-aerial' 
  | 'dolly-zoom' 
  | 'pan-right' 
  | 'pan-left' 
  | 'tilt-up' 
  | 'tilt-down' 
  | 'fpv-orbit' 
  | 'static-tripod';

export interface CameraSettings {
  motion: CameraMotion;
  speed: number; // 1-10
  lens: '16mm Ultra-Wide' | '24mm Wide' | '35mm Street' | '50mm Prime' | '85mm Anamorphic';
  fps: 24 | 30 | 60;
  smoothness: number; // 1-100
}

export interface Keyframe {
  id: string;
  url: string;
  timePosition: number; // in seconds
  label: string;
  source: 'upload' | 'pexafy' | 'generated';
}

export interface VideoProject {
  id: string;
  title: string;
  promptText: string;
  negativePrompt?: string;
  model: ModelType;
  aspectRatio: AspectRatio;
  duration: number; // seconds (4, 8, 12, 16)
  camera: CameraSettings;
  keyframes: Keyframe[];
  videoUrl?: string;
  thumbnailUrl: string;
  status: 'idle' | 'queued' | 'rendering' | 'completed' | 'failed';
  progress: number;
  createdAt: string;
  musicMood?: string;
}

export interface PexafyPhoto {
  id: string;
  title: string;
  photographer: string;
  url: string;
  aspect: 'landscape' | 'portrait' | 'square';
  tags: string[];
  suggestedPrompt: string;
  lighting: string;
  colorPalette: string[];
}

export interface StoryboardScene {
  id: string;
  sceneNumber: number;
  title: string;
  prompt: string;
  duration: number;
  camera: CameraMotion;
  thumbnail: string;
  videoUrl?: string;
  transition: 'cut' | 'fade' | 'dissolve' | 'whip-pan';
}
