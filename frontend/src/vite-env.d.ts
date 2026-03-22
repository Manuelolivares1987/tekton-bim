/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    openFileDialog: (
      filters?: Array<{ name: string; extensions: string[] }>
    ) => Promise<string | null>;
    saveFileDialog: (
      defaultName?: string,
      filters?: Array<{ name: string; extensions: string[] }>
    ) => Promise<string | null>;
  };
}
