import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  openFileDialog: (filters?: Array<{ name: string; extensions: string[] }>) =>
    ipcRenderer.invoke("dialog:openFile", filters),
  saveFileDialog: (
    defaultName?: string,
    filters?: Array<{ name: string; extensions: string[] }>
  ) => ipcRenderer.invoke("dialog:saveFile", defaultName, filters),
});
