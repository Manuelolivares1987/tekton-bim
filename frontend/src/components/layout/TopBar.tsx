import { useState, useRef } from "react";
import { Upload, FolderOpen, Plus, ChevronDown } from "lucide-react";
import { useProjectStore } from "../../store/project-store";
import { useIfcStore } from "../../store/ifc-store";

export default function TopBar() {
  const { projects, currentProjectId, setCurrentProject, addProject } = useProjectStore();
  const { uploadModel, uploading } = useIfcStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  const currentProject = projects.find((p) => p.id === currentProjectId);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentProjectId) return;
    await uploadModel(currentProjectId, file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    const project = await addProject(newProjectName.trim());
    setCurrentProject(project.id);
    setNewProjectName("");
    setShowNewProject(false);
  };

  return (
    <header
      className="flex items-center justify-between px-4 h-12 border-b flex-shrink-0"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-3">
        {/* Project Selector */}
        <div className="flex items-center gap-1.5">
          <FolderOpen size={14} style={{ color: "var(--muted-foreground)" }} />
          <div className="relative">
            <select
              value={currentProjectId ?? ""}
              onChange={(e) => setCurrentProject(e.target.value ? Number(e.target.value) : null)}
              className="appearance-none text-sm font-medium pr-6 pl-2 py-1 rounded-md cursor-pointer"
              style={{
                background: "var(--secondary)",
                color: "var(--foreground)",
                border: "1px solid var(--border)",
              }}
            >
              <option value="">Seleccionar proyecto...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--muted-foreground)" }}
            />
          </div>

          <button
            onClick={() => setShowNewProject(!showNewProject)}
            className="p-1 rounded-md transition-colors"
            style={{ color: "var(--muted-foreground)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--secondary)";
              e.currentTarget.style.color = "var(--primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--muted-foreground)";
            }}
            title="Nuevo Proyecto"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* New Project Input */}
        {showNewProject && (
          <div className="flex items-center gap-2 animate-fadeIn">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateProject();
                if (e.key === "Escape") setShowNewProject(false);
              }}
              placeholder="Nombre del proyecto..."
              className="text-sm rounded-md px-2.5 py-1 w-44"
              style={{
                background: "var(--secondary)",
                color: "var(--foreground)",
                border: "1px solid var(--border)",
              }}
              autoFocus
            />
            <button
              onClick={handleCreateProject}
              className="text-xs font-medium rounded-md px-2.5 py-1 transition-opacity hover:opacity-90"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              Crear
            </button>
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".ifc"
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={!currentProjectId || uploading}
          className="flex items-center gap-1.5 text-xs font-medium rounded-md px-3 py-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: "var(--secondary)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
          }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.disabled) e.currentTarget.style.borderColor = "var(--primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
          }}
        >
          <Upload size={13} />
          {uploading ? "Subiendo..." : "Importar IFC"}
        </button>
      </div>
    </header>
  );
}
