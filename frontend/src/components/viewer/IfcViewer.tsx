import { useState, useEffect, useRef, useCallback } from "react";
import { Box, Eye, Loader2, RotateCcw, ZoomIn, ZoomOut, MousePointer, Check, Trash2 } from "lucide-react";
import { useIfcStore } from "../../store/ifc-store";
import { useProjectStore } from "../../store/project-store";
import { getModelFileUrl, listElements } from "../../api/ifc-api";
import { listPanels } from "../../api/panels-api";
import { createAssignment, listAssignments, deleteAssignment } from "../../api/panel-assignments-api";
import type { IfcElement, Panel, PanelAssignmentWithDetails } from "../../types/api";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as WebIFC from "web-ifc";

export default function IfcViewer() {
  const { models, currentModelId, selectedElementIds, setSelectedElements, fetchModels } = useIfcStore();
  const { currentProjectId } = useProjectStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<IfcElement | null>(null);
  const [elements, setElements] = useState<IfcElement[]>([]);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [assignments, setAssignments] = useState<PanelAssignmentWithDetails[]>([]);
  const [selectedPanelId, setSelectedPanelId] = useState<number | null>(null);
  const [assignNotes, setAssignNotes] = useState("");
  const [assigning, setAssigning] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const ifcApiRef = useRef<WebIFC.IfcAPI | null>(null);
  const meshMapRef = useRef<Map<number, { mesh: THREE.Mesh; globalId: string }>>(new Map());
  const highlightedRef = useRef<THREE.Mesh | null>(null);
  const originalMaterialRef = useRef<THREE.Material | null>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    if (currentProjectId) {
      fetchModels(currentProjectId);
      listPanels(currentProjectId).then(setPanels).catch(() => {});
      listAssignments(currentProjectId).then(setAssignments).catch(() => {});
    }
  }, [currentProjectId, fetchModels]);

  const initThree = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(30, 20, 30);
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
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(50, 50, 25);
    directional.castShadow = true;
    scene.add(directional);
    const hemi = new THREE.HemisphereLight(0xddeeff, 0x0f0e0d, 0.3);
    scene.add(hemi);

    // Grid
    const grid = new THREE.GridHelper(100, 50, 0x444466, 0x333355);
    scene.add(grid);

    // Axes
    const axes = new THREE.AxesHelper(5);
    scene.add(axes);

    // Animation loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
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
      cancelAnimationFrame(animFrameRef.current);
      renderer.dispose();
      controls.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Initialize Three.js on mount
  useEffect(() => {
    const cleanup = initThree();
    return () => { if (cleanup) cleanup(); };
  }, [initThree]);

  const loadIfcModel = useCallback(async (modelId: number) => {
    if (!sceneRef.current) return;

    setLoading(true);
    setError(null);
    setModelLoaded(false);
    meshMapRef.current.clear();

    // Clear existing meshes (keep lights, grid, axes)
    const scene = sceneRef.current;
    const toRemove = scene.children.filter(
      (c) => c instanceof THREE.Mesh || c instanceof THREE.Group
    );
    toRemove.forEach((c) => scene.remove(c));

    try {
      // Fetch elements from backend for metadata
      const els = await listElements(modelId, { limit: 2000 });
      setElements(els);

      // Initialize web-ifc
      const ifcApi = new WebIFC.IfcAPI();
      ifcApi.SetWasmPath("/node_modules/web-ifc/");
      await ifcApi.Init();
      ifcApiRef.current = ifcApi;

      // Fetch IFC file
      const url = getModelFileUrl(modelId);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch IFC file: ${response.statusText}`);
      const buffer = await response.arrayBuffer();
      const data = new Uint8Array(buffer);

      // Open model
      const ifcModelId = ifcApi.OpenModel(data);

      // Get all meshes
      ifcApi.StreamAllMeshes(ifcModelId, (mesh: WebIFC.FlatMesh) => {
        const placedGeometries = mesh.geometries;
        const expressId = mesh.expressID;

        for (let i = 0; i < placedGeometries.size(); i++) {
          const placedGeom = placedGeometries.get(i);
          const geomData = ifcApi.GetGeometry(ifcModelId, placedGeom.geometryExpressID);

          const vertices = ifcApi.GetVertexArray(
            geomData.GetVertexData(),
            geomData.GetVertexDataSize()
          );
          const indices = ifcApi.GetIndexArray(
            geomData.GetIndexData(),
            geomData.GetIndexDataSize()
          );

          if (vertices.length === 0 || indices.length === 0) continue;

          const geometry = new THREE.BufferGeometry();
          const positionArray = new Float32Array(vertices.length / 2);
          const normalArray = new Float32Array(vertices.length / 2);

          for (let j = 0; j < vertices.length; j += 6) {
            const idx = j / 2;
            positionArray[idx] = vertices[j];
            positionArray[idx + 1] = vertices[j + 1];
            positionArray[idx + 2] = vertices[j + 2];
            normalArray[idx] = vertices[j + 3];
            normalArray[idx + 1] = vertices[j + 4];
            normalArray[idx + 2] = vertices[j + 5];
          }

          geometry.setAttribute("position", new THREE.BufferAttribute(positionArray, 3));
          geometry.setAttribute("normal", new THREE.BufferAttribute(normalArray, 3));
          geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));

          const color = new THREE.Color(
            placedGeom.color.x,
            placedGeom.color.y,
            placedGeom.color.z
          );
          const opacity = placedGeom.color.w;

          const material = new THREE.MeshPhongMaterial({
            color,
            opacity,
            transparent: opacity < 1,
            side: THREE.DoubleSide,
          });

          const meshObj = new THREE.Mesh(geometry, material);

          // Apply transformation matrix
          const matrix = new THREE.Matrix4();
          matrix.fromArray(placedGeom.flatTransformation);
          meshObj.applyMatrix4(matrix);

          meshObj.userData.expressId = expressId;

          // Look up the global_id from loaded elements
          const line = ifcApi.GetLine(ifcModelId, expressId);
          const globalId = line?.GlobalId?.value || "";
          meshObj.userData.globalId = globalId;

          scene.add(meshObj);
          meshMapRef.current.set(expressId, { mesh: meshObj, globalId });

          geomData.delete();
        }
      });

      // Fit camera to model
      const box = new THREE.Box3();
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh && child.userData.expressId) {
          box.expandByObject(child);
        }
      });

      if (!box.isEmpty()) {
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 1.5;

        cameraRef.current!.position.set(
          center.x + distance * 0.7,
          center.y + distance * 0.5,
          center.z + distance * 0.7
        );
        controlsRef.current!.target.copy(center);
        controlsRef.current!.update();
      }

      ifcApi.CloseModel(ifcModelId);
      setModelLoaded(true);
    } catch (err: any) {
      setError(err.message || "Failed to load IFC model");
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle click on 3D model
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !rendererRef.current) return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onClick = (event: MouseEvent) => {
      if (!sceneRef.current || !cameraRef.current) return;

      const rect = container.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current);
      const meshes = sceneRef.current.children.filter(
        (c): c is THREE.Mesh => c instanceof THREE.Mesh && !!c.userData.expressId
      );
      const intersects = raycaster.intersectObjects(meshes, false);

      // Unhighlight previous
      if (highlightedRef.current && originalMaterialRef.current) {
        highlightedRef.current.material = originalMaterialRef.current;
        highlightedRef.current = null;
        originalMaterialRef.current = null;
      }

      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        const globalId = hit.userData.globalId as string;

        // Highlight
        originalMaterialRef.current = hit.material as THREE.Material;
        hit.material = new THREE.MeshPhongMaterial({
          color: 0x4488ff,
          emissive: 0x2244aa,
          emissiveIntensity: 0.5,
          side: THREE.DoubleSide,
        });
        highlightedRef.current = hit;

        // Find element details
        if (globalId) {
          const element = elements.find((e) => e.global_id === globalId);
          setSelectedElement(element || null);
          setSelectedElements([globalId]);
        }
      } else {
        setSelectedElement(null);
        setSelectedElements([]);
      }
    };

    container.addEventListener("click", onClick);
    return () => container.removeEventListener("click", onClick);
  }, [elements, setSelectedElements]);

  // Highlight from external selection
  useEffect(() => {
    if (!sceneRef.current || selectedElementIds.length === 0) return;

    // Unhighlight previous
    if (highlightedRef.current && originalMaterialRef.current) {
      highlightedRef.current.material = originalMaterialRef.current;
      highlightedRef.current = null;
      originalMaterialRef.current = null;
    }

    const targetId = selectedElementIds[0];
    for (const [, { mesh, globalId }] of meshMapRef.current) {
      if (globalId === targetId) {
        originalMaterialRef.current = mesh.material as THREE.Material;
        mesh.material = new THREE.MeshPhongMaterial({
          color: 0x4488ff,
          emissive: 0x2244aa,
          emissiveIntensity: 0.5,
          side: THREE.DoubleSide,
        });
        highlightedRef.current = mesh;
        break;
      }
    }
  }, [selectedElementIds]);

  const handleResetView = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(30, 20, 30);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  };

  const handleZoom = (factor: number) => {
    if (!cameraRef.current) return;
    cameraRef.current.position.multiplyScalar(factor);
  };

  // Find current assignment for selected element
  const currentAssignment = selectedElement
    ? assignments.find((a) => a.ifc_element_id === selectedElement.id)
    : null;

  const handleAssignPanel = async () => {
    if (!currentProjectId || !selectedElement || !selectedPanelId) return;
    setAssigning(true);
    try {
      await createAssignment({
        project_id: currentProjectId,
        ifc_element_id: selectedElement.id,
        panel_id: selectedPanelId,
        notes: assignNotes || undefined,
      });
      const updated = await listAssignments(currentProjectId);
      setAssignments(updated);
      setAssignNotes("");
    } catch (err: any) {
      console.error("Error al asignar panel:", err);
    } finally {
      setAssigning(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId: number) => {
    if (!currentProjectId) return;
    await deleteAssignment(assignmentId);
    const updated = await listAssignments(currentProjectId);
    setAssignments(updated);
  };

  const model = models.find((m) => m.id === currentModelId);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Eye className="text-blue-400" /> Visor 3D
          </h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            Visualiza e interact\u00faa con modelos de edificios IFC
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Model selector */}
          <select
            value={currentModelId ?? ""}
            onChange={(e) => {
              const id = parseInt(e.target.value);
              if (id) loadIfcModel(id);
            }}
            className="bg-[var(--secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm"
          >
            <option value="">Seleccionar Modelo IFC...</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.file_name} ({m.element_count} elementos)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* 3D Viewport */}
        <div className="flex-1 relative bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
          <div ref={containerRef} className="w-full h-full" />

          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="flex items-center gap-3 bg-[var(--card)] rounded-lg px-6 py-4">
                <Loader2 className="animate-spin text-blue-400" size={24} />
                <span>Cargando modelo IFC...</span>
              </div>
            </div>
          )}

          {/* Error overlay */}
          {error && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="bg-red-900/80 rounded-lg px-6 py-4 max-w-md text-center">
                <p className="text-red-200">{error}</p>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !modelLoaded && !error && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-[var(--muted-foreground)]">
                <Box size={48} className="mx-auto mb-3 opacity-50" />
                <p>Selecciona un modelo IFC para cargar</p>
                <p className="text-sm mt-1">Los modelos se cargan desde tus archivos del proyecto</p>
              </div>
            </div>
          )}

          {/* Toolbar */}
          {modelLoaded && (
            <div className="absolute top-3 right-3 flex flex-col gap-1">
              <button
                onClick={handleResetView}
                className="p-2 bg-[var(--card)]/90 border border-[var(--border)] rounded hover:bg-[var(--secondary)]"
                title="Restablecer Vista"
              >
                <RotateCcw size={16} />
              </button>
              <button
                onClick={() => handleZoom(0.8)}
                className="p-2 bg-[var(--card)]/90 border border-[var(--border)] rounded hover:bg-[var(--secondary)]"
                title="Acercar"
              >
                <ZoomIn size={16} />
              </button>
              <button
                onClick={() => handleZoom(1.25)}
                className="p-2 bg-[var(--card)]/90 border border-[var(--border)] rounded hover:bg-[var(--secondary)]"
                title="Alejar"
              >
                <ZoomOut size={16} />
              </button>
            </div>
          )}

          {/* Controls hint */}
          {modelLoaded && (
            <div className="absolute bottom-3 left-3 text-xs text-[var(--muted-foreground)] bg-[var(--card)]/80 rounded px-2 py-1">
              <MousePointer size={12} className="inline mr-1" />
              Clic izq: seleccionar | Scroll: zoom | Arrastre der: mover | Arrastre izq: orbitar
            </div>
          )}
        </div>

        {/* Info Panel */}
        <div className="w-80 flex-shrink-0 bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 overflow-y-auto">
          <h3 className="font-semibold mb-3 text-sm">Detalles del Elemento</h3>

          {selectedElement ? (
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-[var(--muted-foreground)] text-xs">Nombre</div>
                <div className="font-medium">{selectedElement.name || "Sin nombre"}</div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="text-[var(--muted-foreground)] text-xs">Tipo</div>
                  <div className="font-mono text-blue-400 text-xs">{selectedElement.ifc_type}</div>
                </div>
                {selectedElement.storey_name && (
                  <div className="flex-1">
                    <div className="text-[var(--muted-foreground)] text-xs">Nivel</div>
                    <div className="text-xs">{selectedElement.storey_name}</div>
                  </div>
                )}
              </div>

              {/* Quantities compact */}
              <div className="grid grid-cols-3 gap-1.5">
                {selectedElement.gross_area_m2 != null && (
                  <div className="bg-[var(--secondary)] rounded p-1.5 text-center">
                    <div className="font-mono font-bold text-xs">{selectedElement.gross_area_m2.toFixed(1)}</div>
                    <div className="text-[10px] text-[var(--muted-foreground)]">\u00c1rea m2</div>
                  </div>
                )}
                {selectedElement.length_m != null && (
                  <div className="bg-[var(--secondary)] rounded p-1.5 text-center">
                    <div className="font-mono font-bold text-xs">{selectedElement.length_m.toFixed(2)}</div>
                    <div className="text-[10px] text-[var(--muted-foreground)]">Long. m</div>
                  </div>
                )}
                {selectedElement.height_m != null && (
                  <div className="bg-[var(--secondary)] rounded p-1.5 text-center">
                    <div className="font-mono font-bold text-xs">{selectedElement.height_m.toFixed(2)}</div>
                    <div className="text-[10px] text-[var(--muted-foreground)]">Alt. m</div>
                  </div>
                )}
                {selectedElement.volume_m3 != null && (
                  <div className="bg-[var(--secondary)] rounded p-1.5 text-center">
                    <div className="font-mono font-bold text-xs">{selectedElement.volume_m3.toFixed(3)}</div>
                    <div className="text-[10px] text-[var(--muted-foreground)]">Vol. m3</div>
                  </div>
                )}
              </div>

              <hr className="border-[var(--border)]" />

              {/* Panel Assignment Section */}
              <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                Asignaci\u00f3n de Panel
              </div>

              {currentAssignment ? (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-green-400 font-bold text-lg">{currentAssignment.panel_number}</span>
                    <button
                      onClick={() => handleDeleteAssignment(currentAssignment.id)}
                      className="text-[var(--muted-foreground)] hover:text-red-400 p-1"
                      title="Quitar asignaci\u00f3n"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    {currentAssignment.panel_name} ({currentAssignment.panel_category.replace("_", " ")})
                  </div>
                  {currentAssignment.notes && (
                    <div className="text-xs text-[var(--muted-foreground)] italic">{currentAssignment.notes}</div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    value={selectedPanelId ?? ""}
                    onChange={(e) => setSelectedPanelId(parseInt(e.target.value) || null)}
                    className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded px-2 py-1.5 text-xs"
                  >
                    <option value="">Seleccionar tipo de panel...</option>
                    {panels.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.category.replace("_", " ")})
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={assignNotes}
                    onChange={(e) => setAssignNotes(e.target.value)}
                    placeholder="Notas (opcional)"
                    className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded px-2 py-1.5 text-xs"
                  />
                  <button
                    onClick={handleAssignPanel}
                    disabled={!selectedPanelId || assigning}
                    className="w-full flex items-center justify-center gap-1.5 bg-green-600 text-white rounded px-3 py-1.5 text-xs hover:opacity-90 disabled:opacity-50"
                  >
                    <Check size={12} />
                    {assigning ? "Asignando..." : "Asignar Panel"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-[var(--muted-foreground)] text-center py-8">
              <MousePointer size={24} className="mx-auto mb-2 opacity-50" />
              Haz clic en un elemento del visor 3D para ver sus detalles y asignar un panel
            </div>
          )}

          {/* Assignments summary */}
          {assignments.length > 0 && (
            <>
              <hr className="border-[var(--border)] my-4" />
              <h3 className="font-semibold mb-2 text-sm">Asignaciones ({assignments.length})</h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {assignments.slice(-15).reverse().map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 text-xs bg-[var(--secondary)] rounded px-2 py-1 cursor-pointer hover:bg-[var(--secondary)]/80"
                    onClick={() => {
                      const el = elements.find((e) => e.id === a.ifc_element_id);
                      if (el) {
                        setSelectedElement(el);
                        setSelectedElements([el.global_id]);
                      }
                    }}
                  >
                    <span className="font-mono text-green-400 font-bold">{a.panel_number}</span>
                    <span className="flex-1 truncate text-[var(--muted-foreground)]">
                      {a.element_name || a.element_global_id}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Model info */}
          {model && (
            <>
              <hr className="border-[var(--border)] my-4" />
              <h3 className="font-semibold mb-2 text-sm">Info del Modelo</h3>
              <div className="space-y-1 text-xs text-[var(--muted-foreground)]">
                <div>Archivo: {model.file_name}</div>
                <div>Elementos: {model.element_count}</div>
                {model.ifc_schema && <div>Esquema: {model.ifc_schema}</div>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
