import { useRef, useEffect, useState } from "react";
import {
  Box,
  Loader2,
  Eye,
  EyeOff,
  Maximize2,
  Tag,
  Layers,
} from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useProjectStore } from "../../store/project-store";
import client from "../../api/client";

// Color palette
const PANEL_COLORS: Record<string, number> = {
  full: 0x3b82f6,
  filler: 0xf59e0b,
  header: 0x8b5cf6,
  sill: 0x06b6d4,
  corner_left: 0x10b981,
  corner_right: 0x10b981,
  t_junction: 0xec4899,
};

const SELECTED_COLOR = 0x22c55e;

interface Panel3D {
  id: number;
  label: string;
  position_x_mm: number;
  position_y_mm: number;
  width_mm: number;
  height_mm: number;
  thickness_mm: number;
  panel_type: string;
  is_custom_cut: boolean;
  has_opening: boolean;
  opening_type?: string | null;
  weight_kg: number;
  area_m2: number;
  layers?: { name: string; thickness_mm: number; color: string }[];
}

interface Wall3D {
  wall_id: number;
  wall_name: string;
  storey: string;
  wall_length_mm: number;
  wall_height_mm: number;
  wall_thickness_mm: number;
  config_type: string;
  panels: Panel3D[];
}

export default function PanelViewer3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshMapRef = useRef<Map<THREE.Mesh, Panel3D>>(new Map());

  const { currentProjectId } = useProjectStore();
  const [walls, setWalls] = useState<Wall3D[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPanel, setSelectedPanel] = useState<Panel3D | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [exploded, setExploded] = useState(false);

  // Load 3D data
  useEffect(() => {
    if (!currentProjectId) return;
    setLoading(true);
    client
      .get(`/panelization/3d-data/${currentProjectId}`)
      .then((res) => setWalls(res.data.walls || []))
      .catch((err) => console.error("Error loading 3D data:", err))
      .finally(() => setLoading(false));
  }, [currentProjectId]);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
    camera.position.set(15, 10, 15);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controlsRef.current = controls;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(30, 30, 20);
    dirLight.castShadow = true;
    scene.add(dirLight);
    scene.add(new THREE.HemisphereLight(0xddeeff, 0x0f0e0d, 0.3));

    // Grid
    scene.add(new THREE.GridHelper(50, 50, 0x333355, 0x222244));
    scene.add(new THREE.AxesHelper(3));

    // Raycaster for picking
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const meshes = Array.from(meshMapRef.current.keys());
      const intersects = raycaster.intersectObjects(meshes);

      if (intersects.length > 0) {
        const mesh = intersects[0].object as THREE.Mesh;
        const panel = meshMapRef.current.get(mesh);
        if (panel) {
          setSelectedPanel(panel);
        }
      } else {
        setSelectedPanel(null);
      }
    };

    renderer.domElement.addEventListener("click", onClick);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("click", onClick);
      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  // Build panel meshes when data changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || walls.length === 0) return;

    // Clear existing panel meshes
    const toRemove: THREE.Object3D[] = [];
    scene.traverse((obj) => {
      if (obj.userData.isPanelMesh) toRemove.push(obj);
    });
    toRemove.forEach((obj) => scene.remove(obj));
    meshMapRef.current.clear();

    const scale = 0.001; // mm to meters
    let wallOffsetZ = 0;

    for (const wall of walls) {
      for (const panel of wall.panels) {
        const w = panel.width_mm * scale;
        const h = panel.height_mm * scale;
        const d = panel.thickness_mm * scale;

        const geometry = new THREE.BoxGeometry(w, h, d);
        const color = PANEL_COLORS[panel.panel_type] || PANEL_COLORS.full;
        const material = new THREE.MeshPhongMaterial({
          color,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
        });

        const mesh = new THREE.Mesh(geometry, material);

        // Position
        const x = panel.position_x_mm * scale + w / 2;
        const y = panel.position_y_mm * scale + h / 2;
        const z = wallOffsetZ;

        if (exploded) {
          mesh.position.set(
            x + panel.position_x_mm * scale * 0.05,
            y,
            z + wallOffsetZ * 0.3
          );
        } else {
          mesh.position.set(x, y, z);
        }

        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.isPanelMesh = true;

        scene.add(mesh);
        meshMapRef.current.set(mesh, panel);

        // Edge lines
        const edges = new THREE.EdgesGeometry(geometry);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.3, transparent: true });
        const lineSegments = new THREE.LineSegments(edges, lineMat);
        lineSegments.position.copy(mesh.position);
        lineSegments.userData.isPanelMesh = true;
        scene.add(lineSegments);

        // Label sprite
        if (showLabels) {
          const canvas = document.createElement("canvas");
          canvas.width = 256;
          canvas.height = 64;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "rgba(0,0,0,0.7)";
            ctx.fillRect(0, 0, 256, 64);
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 24px monospace";
            ctx.textAlign = "center";
            ctx.fillText(panel.label, 128, 40);
          }
          const texture = new THREE.CanvasTexture(canvas);
          const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
          const sprite = new THREE.Sprite(spriteMat);
          sprite.position.copy(mesh.position);
          sprite.position.y += h / 2 + 0.15;
          sprite.scale.set(w * 0.8, w * 0.2, 1);
          sprite.userData.isPanelMesh = true;
          scene.add(sprite);
        }
      }

      wallOffsetZ += (wall.wall_thickness_mm * scale) + (exploded ? 2 : 0.5);
    }

    // Fit camera
    if (cameraRef.current && controlsRef.current) {
      const box = new THREE.Box3();
      scene.traverse((obj) => {
        if (obj.userData.isPanelMesh && obj instanceof THREE.Mesh) {
          box.expandByObject(obj);
        }
      });
      if (!box.isEmpty()) {
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        cameraRef.current.position.set(
          center.x + maxDim * 1.2,
          center.y + maxDim * 0.8,
          center.z + maxDim * 1.2
        );
        controlsRef.current.target.copy(center);
      }
    }
  }, [walls, showLabels, exploded, selectedPanel]);

  // Highlight selected panel
  useEffect(() => {
    meshMapRef.current.forEach((panel, mesh) => {
      const mat = mesh.material as THREE.MeshPhongMaterial;
      if (selectedPanel && panel.id === selectedPanel.id) {
        mat.color.setHex(SELECTED_COLOR);
        mat.opacity = 1;
        mat.emissive.setHex(0x224422);
      } else {
        mat.color.setHex(PANEL_COLORS[panel.panel_type] || PANEL_COLORS.full);
        mat.opacity = 0.85;
        mat.emissive.setHex(0x000000);
      }
    });
  }, [selectedPanel]);

  if (!currentProjectId) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--muted-foreground)]">
        Selecciona un proyecto
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-full">
      {/* 3D Viewport */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Box size={24} className="text-[var(--primary)]" />
            <h2 className="text-xl font-bold">Visor 3D de Paneles</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLabels(!showLabels)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded ${
                showLabels ? "bg-[var(--primary)] text-white" : "bg-[var(--secondary)]"
              }`}
            >
              <Tag size={14} />
              Etiquetas
            </button>
            <button
              onClick={() => setExploded(!exploded)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded ${
                exploded ? "bg-[var(--primary)] text-white" : "bg-[var(--secondary)]"
              }`}
            >
              <Maximize2 size={14} />
              Vista Explotada
            </button>
          </div>
        </div>

        <div
          ref={containerRef}
          className="flex-1 rounded-lg overflow-hidden border border-[var(--border)] relative"
          style={{ minHeight: 500 }}
        >
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
              <Loader2 size={32} className="animate-spin text-[var(--primary)]" />
            </div>
          )}
          {walls.length === 0 && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--muted-foreground)]">
              <Layers size={48} className="opacity-30 mb-4" />
              <p>No hay muros panelizados para visualizar</p>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-2 text-xs text-[var(--muted-foreground)]">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ background: "#3b82f6" }}></div> Estándar
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ background: "#f59e0b" }}></div> Corte
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ background: "#8b5cf6" }}></div> Dintel
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ background: "#06b6d4" }}></div> Alféizar
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ background: "#22c55e" }}></div> Seleccionado
          </div>
        </div>
      </div>

      {/* Side panel */}
      <div className="w-72 flex-shrink-0 overflow-y-auto space-y-4">
        {/* Wall list */}
        <div>
          <h3 className="text-sm font-semibold mb-2">Muros ({walls.length})</h3>
          {walls.map((wall) => (
            <div key={wall.wall_id} className="p-2 bg-[var(--secondary)] rounded mb-1 text-sm">
              <div className="font-medium">{wall.wall_name}</div>
              <div className="text-xs text-[var(--muted-foreground)]">
                {wall.storey} | {wall.panels.length} paneles | {wall.config_type.toUpperCase()}
              </div>
            </div>
          ))}
        </div>

        {/* Selected panel info */}
        {selectedPanel && (
          <div className="bg-[var(--card)] border border-[var(--primary)]/30 rounded-lg p-3 space-y-2">
            <h3 className="font-semibold text-sm text-[var(--primary)]">
              Panel {selectedPanel.label}
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[var(--muted-foreground)]">Ancho:</span>
                <div className="font-mono">{Math.round(selectedPanel.width_mm)} mm</div>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Alto:</span>
                <div className="font-mono">{Math.round(selectedPanel.height_mm)} mm</div>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Espesor:</span>
                <div className="font-mono">{Math.round(selectedPanel.thickness_mm)} mm</div>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Tipo:</span>
                <div className="capitalize">{selectedPanel.panel_type}</div>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Area:</span>
                <div className="font-mono">{selectedPanel.area_m2.toFixed(3)} m²</div>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Peso:</span>
                <div className="font-mono">{selectedPanel.weight_kg.toFixed(1)} kg</div>
              </div>
            </div>
            {selectedPanel.is_custom_cut && (
              <div className="text-xs text-amber-500">Requiere corte personalizado</div>
            )}
            {selectedPanel.has_opening && (
              <div className="text-xs text-red-400">Contiene vano ({selectedPanel.opening_type})</div>
            )}
            {selectedPanel.layers && (
              <div className="space-y-1 pt-1 border-t border-[var(--border)]">
                <div className="text-xs text-[var(--muted-foreground)] font-semibold">Capas:</div>
                {selectedPanel.layers.map((layer, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded" style={{ background: layer.color }}></div>
                    <span>{layer.name}</span>
                    <span className="text-[var(--muted-foreground)] ml-auto">{layer.thickness_mm}mm</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
