import { spawn, ChildProcess } from "child_process";
import path from "path";
import { app } from "electron";

let backendProcess: ChildProcess | null = null;
const BACKEND_PORT = 8000;

export function startBackend(): Promise<number> {
  return new Promise((resolve, reject) => {
    const isDev = !app.isPackaged;

    if (isDev) {
      // In dev mode, backend runs separately via uvicorn
      resolve(BACKEND_PORT);
      return;
    }

    // In production, spawn the PyInstaller executable
    const backendPath = path.join(
      process.resourcesPath,
      "cadworks-engine",
      process.platform === "win32"
        ? "cadworks-engine.exe"
        : "cadworks-engine"
    );

    backendProcess = spawn(backendPath, ["--port", String(BACKEND_PORT)], {
      env: {
        ...process.env,
        CADWORKS_DATA_DIR: app.getPath("userData"),
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    const timeout = setTimeout(() => {
      reject(new Error("Backend startup timeout"));
    }, 30000);

    backendProcess.stdout?.on("data", (data: Buffer) => {
      const output = data.toString();
      console.log("[Backend]", output);
      if (output.includes("Application startup complete")) {
        clearTimeout(timeout);
        resolve(BACKEND_PORT);
      }
    });

    backendProcess.stderr?.on("data", (data: Buffer) => {
      console.error("[Backend Error]", data.toString());
    });

    backendProcess.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    backendProcess.on("exit", (code) => {
      console.log(`Backend exited with code ${code}`);
      backendProcess = null;
    });
  });
}

export function stopBackend(): void {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

export function getBackendPort(): number {
  return BACKEND_PORT;
}
