export type Scene = {
  id: string;
  prompt: string;
  referenceImage?: string;
  referenceSceneId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  resultImage?: string;
  error?: string;
};

export type Project = {
  id: string;
  name: string;
  createdAt: number;
  scenes: Scene[];
};