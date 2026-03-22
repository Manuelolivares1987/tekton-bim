import { useRef, useEffect, useCallback, useState } from "react";
import {
  Box,
  RotateCw,
  DoorOpen,
  Square,
  Trash2,
  Navigation,
  Play,
  Loader2,
  ArrowRight,
  Move,
  Layers,
  Plus,
  Link,
  Group,
  LayoutGrid,
  TriangleRight,
  Hammer,
  PenLine,
} from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useProjectStore } from "../../store/project-store";
import { useUIStore } from "../../store/ui-store";
import { useIfcStore } from "../../store/ifc-store";
import { useBimModelerStore, type BimTool } from "../../store/bim-modeler-store";
import * as bimApi from "../../api/bim-modeler-api";
import type { BimPanelData, CatalogItem, FramingMemberData } from "../../api/bim-modeler-api";
import FloorPlanView from "./FloorPlanView";

const SCALE = 0.001; // mm to meters
const SNAP_DIST = 150; // mm - generous snap distance for easy panel joining

const COLORS = {
  wall: 0x8b7355,        // wood brown
  floor: 0x6b8e6b,       // green for floor panels
  roof: 0xb87333,        // copper for roof panels
  selected: 0x3b82f6,    // blue
  ghost: 0x3b82f6,       // blue transparent
  opening: 0x1a1a2e,     // dark (cutout)
  ground: 0x1e293b,      // dark ground
  connectionInline: 0x22c55e,  // green
  connectionCorner: 0xf59e0b,  // yellow
  connectionAngled: 0xef4444,  // red
  wallGroupLine: 0x8b5cf6,    // purple
  storeyPlane: 0x334155,      // dark grey
  // Framing member colors
  stud: 0xdeb887,             // burlywood
  king_stud: 0xcd853f,        // peru
  jack_stud: 0xd2691e,        // chocolate
  cripple_stud: 0xbc8f8f,     // rosy brown
  top_plate: 0xa0522d,        // sienna
  bottom_plate: 0xa0522d,     // sienna
  header: 0x8b0000,           // dark red
  sill_plate: 0x556b2f,       // dark olive
  connection_stud: 0xff6347,  // tomato red (corners/T-junctions only)
  tablilla_osb: 0xf4a460,   // sandy brown - OSB spline at panel joints
  snapIndicator: 0x00ff88,    // bright green
};

const TOOL_GROUPS = {
  dibujo: [
    { id: "draw-wall" as BimTool, label: "Dibujar Muro", icon: <PenLine size={16} />, key: "W" },
  ],
  aberturas: [
    { id: "wall-opening" as BimTool, label: "Abertura", icon: <DoorOpen size={16} />, key: "D" },
  ],
  edicion: [
    { id: "orbit" as BimTool, label: "Orbitar", icon: <Navigation size={16} />, key: "O" },
    { id: "delete" as BimTool, label: "Borrar", icon: <Trash2 size={16} />, key: "X" },
  ],
};

const ALL_TOOLS = [...TOOL_GROUPS.dibujo, ...TOOL_GROUPS.aberturas, ...TOOL_GROUPS.edicion];

export default function BimModeler3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const groundPlaneRef = useRef<THREE.Mesh | null>(null);
  const ghostMeshRef = useRef<THREE.Mesh | null>(null);
  const meshMapRef = useRef<Map<THREE.Mesh, BimPanelData>>(new Map());
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const ghostRotationRef = useRef(0);
  const dragPanelRef = useRef<BimPanelData | null>(null);
  const isDraggingRef = useRef(false);
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const connectionMeshesRef = useRef<THREE.Object3D[]>([]);
  const storeyPlanesRef = useRef<THREE.Object3D[]>([]);
  const framingMeshesRef = useRef<THREE.Object3D[]>([]);
  const snapIndicatorRef = useRef<THREE.Object3D | null>(null);
  const guideLineRefs = useRef<THREE.Object3D[]>([]);
  const snapLabelRef = useRef<HTMLDivElement | null>(null);
  const copySnapPointsRef = useRef<{ mesh: THREE.Mesh; posX: number; posZ: number; rot: number; label: string }[]>([]);
  const ghostWallRef = useRef<THREE.Group | null>(null);
  const wallStartMarkerRef = useRef<THREE.Mesh | null>(null);

  const { currentProjectId } = useProjectStore();
  const { setActiveView } = useUIStore();
  const { selectModel } = useIfcStore();
  const {
    catalog, selectedCatalogId, panels, selectedPanelId, activeTool, summary,
    storeys, activeStoreyId, wallGroups, connections, showConnections, showWallGroups,
    fetchCatalog, selectCatalog, fetchPanels, placePanel, movePanel, rotatePanel,
    removePanel, addOpeningToPanel, selectPanel, setTool, fetchSummary,
    fetchStoreys, addStorey, setActiveStorey, autoGroupWalls,
    fetchConnections, toggleConnections, toggleWallGroups,
    showFraming, framingMembers, toggleFraming, fetchFraming, fetchAllFraming, clearFraming,
    walls, selectedWallId, wallAssemblies, drawingWallStart,
    fetchWalls, drawWall, selectWall, deleteWall, addWallOpening,
    startDrawingWall, cancelDrawingWall, fetchWallAssembly,
  } = useBimModelerStore();

  const [generating, setGenerating] = useState(false);
  const [showStoreyModal, setShowStoreyModal] = useState(false);
  const [newStoreyName, setNewStoreyName] = useState("");
  const [copyMode, setCopyMode] = useState(false);
  const [viewMode, setViewMode] = useState<"3d" | "plan">("plan"); // default to plan view
  const [snapLabel, setSnapLabel] = useState("");
  const [liveDistance, setLiveDistance] = useState("");
  // Opening dialog state
  const [showOpeningDialog, setShowOpeningDialog] = useState(false);
  const [openingPanelId, setOpeningPanelId] = useState<number | null>(null);
  const [openingForm, setOpeningForm] = useState({
    opening_type: "window" as string,
    opening_x_mm: 160,
    opening_y_mm: 900,
    opening_width_mm: 1200,
    opening_height_mm: 1200,
  });

  // Load data
  useEffect(() => {
    if (currentProjectId) {
      fetchCatalog(currentProjectId);
      fetchPanels(currentProjectId);
      fetchSummary(currentProjectId);
      fetchStoreys(currentProjectId);
      fetchWalls(currentProjectId).then(() => {
        // After walls loaded, fetch assemblies for each
        const { walls: loadedWalls } = useBimModelerStore.getState();
        for (const w of loadedWalls) {
          useBimModelerStore.getState().fetchWallAssembly(w.id);
        }
      });
    }
  }, [currentProjectId]);

  const selectedCatalog = catalog.find((c) => c.id === selectedCatalogId);
  const selectedPanel = panels.find((p) => p.id === selectedPanelId);
  const activeStorey = storeys.find((s) => s.id === activeStoreyId);

  // Get orientation for current tool
  const getOrientation = useCallback((): "wall" | "floor" | "roof" => {
    if (activeTool === "place-floor") return "floor";
    if (activeTool === "place-roof") return "roof";
    return "wall";
  }, [activeTool]);

  const isPlaceTool = activeTool === "place" || activeTool === "place-floor" || activeTool === "place-roof";

  // Initialize Three.js
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 500);
    camera.position.set(12, 8, 12);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.maxPolarAngle = Math.PI / 2.1;
    // Only orbit with middle mouse button - left button is for tools
    controls.mouseButtons = {
      LEFT: undefined as any,    // disable - we handle left click
      MIDDLE: THREE.MOUSE.ROTATE,
      RIGHT: THREE.MOUSE.PAN,
    };
    controls.zoomToCursor = true; // zoom toward cursor position
    controlsRef.current = controls;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(20, 25, 15);
    dir.castShadow = true;
    scene.add(dir);
    scene.add(new THREE.HemisphereLight(0xddeeff, 0x0f0e0d, 0.3));

    // Grid
    const grid = new THREE.GridHelper(30, 30, 0x334455, 0x1e293b);
    scene.add(grid);

    // Ground plane (invisible, for raycasting)
    const groundGeo = new THREE.PlaneGeometry(100, 100);
    const groundMat = new THREE.MeshBasicMaterial({ visible: false });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    scene.add(ground);
    groundPlaneRef.current = ground;

    // Axes
    scene.add(new THREE.AxesHelper(2));

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (cw === 0 || ch === 0) return;
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    };
    window.addEventListener("resize", onResize);
    // ResizeObserver for split view layout changes
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);
    // Initial resize after layout settles
    requestAnimationFrame(onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      resizeObserver.disconnect();
      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  // Update ground plane height when active storey changes
  useEffect(() => {
    const ground = groundPlaneRef.current;
    if (!ground || !activeStorey) return;
    ground.position.y = activeStorey.elevation_mm * SCALE;
  }, [activeStoreyId, storeys]);

  // Draw storey level planes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove old storey planes
    storeyPlanesRef.current.forEach((obj) => scene.remove(obj));
    storeyPlanesRef.current = [];

    for (const storey of storeys) {
      if (storey.id === activeStoreyId) continue; // Don't show plane for active storey
      const y = storey.elevation_mm * SCALE;
      const planeGeo = new THREE.PlaneGeometry(20, 20);
      const planeMat = new THREE.MeshBasicMaterial({
        color: COLORS.storeyPlane,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
      });
      const plane = new THREE.Mesh(planeGeo, planeMat);
      plane.rotation.x = -Math.PI / 2;
      plane.position.y = y;
      scene.add(plane);
      storeyPlanesRef.current.push(plane);

      // Label
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 32;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "rgba(100,116,139,0.8)";
        ctx.fillRect(0, 0, 128, 32);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 16px monospace";
        ctx.textAlign = "center";
        ctx.fillText(storey.name, 64, 22);
      }
      const tex = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(-10, y + 0.1, 0);
      sprite.scale.set(1.5, 0.38, 1);
      scene.add(sprite);
      storeyPlanesRef.current.push(sprite);
    }
  }, [storeys, activeStoreyId]);

  // Rebuild panel meshes when panels change
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const toRemove: THREE.Object3D[] = [];
    scene.traverse((obj) => { if (obj.userData.isBimPanel) toRemove.push(obj); });
    toRemove.forEach((obj) => scene.remove(obj));
    meshMapRef.current.clear();

    for (const panel of panels) {
      const group = createPanelMesh(panel, panel.id === selectedPanelId);
      scene.add(group);
    }
  }, [panels, selectedPanelId]);

  // Draw connections
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove old connection meshes
    connectionMeshesRef.current.forEach((obj) => scene.remove(obj));
    connectionMeshesRef.current = [];

    if (!showConnections) return;

    for (const conn of connections) {
      const color = conn.type === "inline" ? COLORS.connectionInline
        : conn.type === "corner" ? COLORS.connectionCorner
        : COLORS.connectionAngled;

      // Connection sphere
      const geo = new THREE.SphereGeometry(0.06, 8, 8);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        conn.pos_x_mm * SCALE,
        conn.pos_y_mm * SCALE + 1.2, // mid height
        conn.pos_z_mm * SCALE,
      );
      scene.add(mesh);
      connectionMeshesRef.current.push(mesh);

      // Vertical line showing connection
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(conn.pos_x_mm * SCALE, conn.pos_y_mm * SCALE, conn.pos_z_mm * SCALE),
        new THREE.Vector3(conn.pos_x_mm * SCALE, conn.pos_y_mm * SCALE + 2.44, conn.pos_z_mm * SCALE),
      ]);
      const lineMat = new THREE.LineBasicMaterial({ color, opacity: 0.5, transparent: true });
      const line = new THREE.Line(lineGeo, lineMat);
      scene.add(line);
      connectionMeshesRef.current.push(line);
    }
  }, [connections, showConnections]);

  // Auto-render framing from wall assemblies (always on)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove old framing meshes
    framingMeshesRef.current.forEach((obj) => scene.remove(obj));
    framingMeshesRef.current = [];

    // Collect all framing members from all wall assemblies
    const allFraming: import("../../api/bim-modeler-api").FramingMemberData[] = [];
    for (const assembly of Object.values(wallAssemblies)) {
      if (assembly.framing) {
        allFraming.push(...assembly.framing);
      }
    }

    if (allFraming.length === 0) return;

    for (const member of allFraming) {
      const panelRad = -((member.panel_rotation_deg ?? 0) * Math.PI) / 180; // negate for Three.js
      const panelX = (member.world_x_mm ?? 0) * SCALE;
      const panelY = (member.world_y_mm ?? 0) * SCALE;
      const panelZ = (member.world_z_mm ?? 0) * SCALE;

      const isPlate = member.member_type.includes("plate");
      const isHeader = member.member_type === "header";

      let geoW: number, geoH: number, geoD: number;
      if (isPlate || isHeader) {
        geoW = member.length_mm * SCALE;
        geoH = member.width_mm * SCALE;
        geoD = member.depth_mm * SCALE;
      } else {
        geoW = member.width_mm * SCALE;
        geoH = member.length_mm * SCALE;
        geoD = member.depth_mm * SCALE;
      }

      const geo = new THREE.BoxGeometry(geoW, geoH, geoD);
      const colorKey = member.member_type as keyof typeof COLORS;
      const color = COLORS[colorKey] || COLORS.stud;
      const mat = new THREE.MeshPhongMaterial({ color, transparent: true, opacity: 0.85 });
      const mesh = new THREE.Mesh(geo, mat);

      // Position: offset so left edge aligns with member position
      let localX: number, localY: number;
      if (isPlate || isHeader) {
        localX = (member.position_x_mm + member.length_mm / 2) * SCALE;
        localY = (member.position_y_mm + member.width_mm / 2) * SCALE;
      } else {
        localX = (member.position_x_mm + member.width_mm / 2) * SCALE;
        localY = (member.position_y_mm + member.length_mm / 2) * SCALE;
      }

      // Transform to world using wall rotation (already negated)
      const cos = Math.cos(panelRad);
      const sin = Math.sin(panelRad);
      mesh.position.set(
        panelX + cos * localX - sin * 0, // no Z offset for members
        panelY + localY,
        panelZ + sin * localX + cos * 0,
      );
      mesh.rotation.y = panelRad;

      // Edges
      const edges = new THREE.EdgesGeometry(geo);
      mesh.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.2, transparent: true })));

      scene.add(mesh);
      framingMeshesRef.current.push(mesh);
    }
  }, [wallAssemblies]);

  // Create a 3D mesh for a panel
  const createPanelMesh = useCallback((panel: BimPanelData, isSelected: boolean): THREE.Group => {
    const group = new THREE.Group();
    group.userData.isBimPanel = true;
    group.userData.panelId = panel.id;

    const w = panel.width_mm * SCALE;
    const h = panel.height_mm * SCALE;
    const d = panel.thickness_mm * SCALE;

    const isFloor = panel.orientation === "floor";
    const isRoof = panel.orientation === "roof";
    const isHorizontal = isFloor || isRoof;

    // For horizontal panels, swap height and thickness visually
    const geoW = isHorizontal ? w : w;
    const geoH = isHorizontal ? d : h;
    const geoD = isHorizontal ? h : d;

    const geo = new THREE.BoxGeometry(geoW, geoH, geoD);
    const baseColor = isSelected ? COLORS.selected
      : isFloor ? COLORS.floor
      : isRoof ? COLORS.roof
      : COLORS.wall;

    const mat = new THREE.MeshPhongMaterial({
      color: baseColor,
      transparent: true,
      opacity: isSelected ? 0.95 : 0.85,
      side: THREE.DoubleSide,
    });
    if (isSelected) mat.emissive = new THREE.Color(0x112244);

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isBimPanel = true;
    // Offset mesh so left edge aligns with group origin (panel position = left edge)
    mesh.position.x = geoW / 2;
    group.add(mesh);
    meshMapRef.current.set(mesh, panel);

    // Subtle panel edges (thin lines, not full box edges)
    const edges = new THREE.EdgesGeometry(geo);
    const edgeColor = isSelected ? 0x5b9cf6 : 0x5a5040;
    const lineMat = new THREE.LineBasicMaterial({ color: edgeColor, opacity: 0.3, transparent: true });
    const edgeMesh = new THREE.LineSegments(edges, lineMat);
    edgeMesh.position.x = geoW / 2;
    group.add(edgeMesh);

    // Opening visualization (only for wall panels)
    if (!isHorizontal && panel.has_opening && panel.opening_width_mm && panel.opening_height_mm) {
      const ow = panel.opening_width_mm * SCALE;
      const oh = panel.opening_height_mm * SCALE;
      const openGeo = new THREE.BoxGeometry(ow, oh, d + 0.01);
      const openMat = new THREE.MeshBasicMaterial({ color: COLORS.opening, transparent: true, opacity: 0.9 });
      const openMesh = new THREE.Mesh(openGeo, openMat);

      const ox = ((panel.opening_x_mm || 0) - panel.width_mm / 2 + (panel.opening_width_mm || 0) / 2) * SCALE;
      const oy = ((panel.opening_y_mm || 0) - panel.height_mm / 2 + (panel.opening_height_mm || 0) / 2) * SCALE;
      openMesh.position.set(geoW / 2 + ox, oy, 0);
      group.add(openMesh);

      const openEdges = new THREE.EdgesGeometry(openGeo);
      const openLineMat = new THREE.LineBasicMaterial({
        color: panel.opening_type === "door" ? 0xf59e0b : 0x06b6d4,
      });
      const openLines = new THREE.LineSegments(openEdges, openLineMat);
      openLines.position.copy(openMesh.position);
      group.add(openLines);
    }

    // Label sprite
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const bgColor = isSelected ? "rgba(59,130,246,0.8)"
        : isFloor ? "rgba(107,142,107,0.8)"
        : isRoof ? "rgba(184,115,51,0.8)"
        : "rgba(0,0,0,0.7)";
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, 256, 64);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px monospace";
      ctx.textAlign = "center";
      ctx.fillText(panel.label, 128, 28);
      ctx.font = "14px monospace";
      const orient = isFloor ? "LOSA" : isRoof ? "TECHO" : "";
      ctx.fillText(`${panel.width_mm}x${panel.height_mm} ${orient}`, 128, 50);
    }
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(geoW / 2, geoH / 2 + 0.15, 0);
    sprite.scale.set(geoW * 0.9, geoW * 0.22, 1);
    sprite.userData.isBimPanel = true;
    group.add(sprite);

    // Position and rotation
    // rotation_deg from backend = atan2(dz,dx) in degrees
    // Three.js rotation.y positive = X toward -Z (clockwise from above)
    // We need X toward +Z for positive angles, so negate
    const rad = (panel.rotation_deg * Math.PI) / 180;
    group.position.set(
      panel.pos_x_mm * SCALE,
      panel.pos_y_mm * SCALE + geoH / 2,
      panel.pos_z_mm * SCALE,
    );
    group.rotation.y = -rad;

    // For roof panels, apply pitch
    if (isRoof && panel.pitch_deg) {
      group.rotation.z = (panel.pitch_deg * Math.PI) / 180;
    }

    return group;
  }, []);

  // Snap position to existing panels
  const snapToExisting = useCallback(
    (worldX: number, worldZ: number, catalogItem: CatalogItem | undefined): { x: number; z: number; rot: number; snapType: string } => {
      if (!catalogItem) return { x: worldX, z: worldZ, rot: ghostRotationRef.current, snapType: "none" };

      const newW = catalogItem.width_mm * SCALE;
      const newD = catalogItem.thickness_mm * SCALE;
      let bestDist = SNAP_DIST * SCALE;
      let snapped = { x: worldX, z: worldZ, rot: ghostRotationRef.current, snapType: "grid" };

      // Snap to panels on same storey (any orientation for wall-to-wall)
      const storeyPanels = panels.filter(
        (p) => !activeStoreyId || p.storey_id === activeStoreyId,
      );

      for (const p of storeyPanels) {
        const pw = p.width_mm * SCALE;
        const pd = p.thickness_mm * SCALE;
        const px = p.pos_x_mm * SCALE;
        const pz = p.pos_z_mm * SCALE;
        const pRad = (p.rotation_deg * Math.PI) / 180;
        const pCos = Math.cos(pRad);
        const pSin = Math.sin(pRad);

        // Same rotation: snap side by side (inline)
        if (Math.abs(p.rotation_deg - ghostRotationRef.current) < 1) {
          // Right edge of existing panel
          const rightX = px + pCos * pw;
          const rightZ = pz + pSin * pw;
          const distRight = Math.sqrt((worldX - rightX) ** 2 + (worldZ - rightZ) ** 2);
          if (distRight < bestDist) {
            bestDist = distRight;
            snapped = { x: rightX, z: rightZ, rot: p.rotation_deg, snapType: "inline" };
          }

          // Left edge of existing panel
          const distLeft = Math.sqrt((worldX - px) ** 2 + (worldZ - pz) ** 2);
          if (distLeft < bestDist) {
            bestDist = distLeft;
            snapped = { x: px - pCos * newW, z: pz - pSin * newW, rot: p.rotation_deg, snapType: "inline" };
          }
        }

        // L-corner: perpendicular snap at panel origin (front-left corner)
        const corner1X = px;
        const corner1Z = pz + pd;
        const dist1 = Math.sqrt((worldX - corner1X) ** 2 + (worldZ - corner1Z) ** 2);
        if (dist1 < bestDist) {
          bestDist = dist1;
          snapped = { x: corner1X, z: corner1Z, rot: (p.rotation_deg + 90) % 360, snapType: "corner" };
        }

        // L-corner: perpendicular at panel right end
        const corner2X = px + pCos * pw;
        const corner2Z = pz + pSin * pw + pd;
        const dist2 = Math.sqrt((worldX - corner2X) ** 2 + (worldZ - corner2Z) ** 2);
        if (dist2 < bestDist) {
          bestDist = dist2;
          snapped = { x: corner2X, z: corner2Z, rot: (p.rotation_deg + 90) % 360, snapType: "corner" };
        }

        // L-corner: perpendicular at back side
        const corner3X = px - pSin * pd;
        const corner3Z = pz + pCos * pd;
        const dist3 = Math.sqrt((worldX - corner3X) ** 2 + (worldZ - corner3Z) ** 2);
        if (dist3 < bestDist) {
          bestDist = dist3;
          snapped = { x: corner3X, z: corner3Z, rot: (p.rotation_deg + 90) % 360, snapType: "corner" };
        }

        // T-junction: snap to midpoint of panel face
        const midX = px + pCos * pw / 2;
        const midZ = pz + pSin * pw / 2 + pd;
        const distMid = Math.sqrt((worldX - midX) ** 2 + (worldZ - midZ) ** 2);
        if (distMid < bestDist) {
          bestDist = distMid;
          snapped = { x: midX, z: midZ, rot: (p.rotation_deg + 90) % 360, snapType: "t-junction" };
        }
      }

      // Grid snap fallback
      if (bestDist >= SNAP_DIST * SCALE) {
        const gridStep = 0.1;
        snapped.x = Math.round(worldX / gridStep) * gridStep;
        snapped.z = Math.round(worldZ / gridStep) * gridStep;
        snapped.snapType = "grid";
      }

      // Update snap indicator + guide lines
      const scene = sceneRef.current;

      // Clear old guide lines
      guideLineRefs.current.forEach((obj) => scene?.remove(obj));
      guideLineRefs.current = [];

      if (scene && snapped.snapType !== "grid") {
        // Snap point indicator (SketchUp style)
        const snapColor =
          snapped.snapType === "inline" ? 0x00ff00 :    // green = endpoint
          snapped.snapType === "corner" ? 0xffff00 :    // yellow = corner
          snapped.snapType === "t-junction" ? 0x00ffff : // cyan = midpoint
          0x00ff00;

        if (!snapIndicatorRef.current) {
          const geo = new THREE.SphereGeometry(0.05, 16, 16);
          const mat = new THREE.MeshBasicMaterial({ color: snapColor, depthTest: false });
          const indicator = new THREE.Mesh(geo, mat);
          indicator.renderOrder = 999;
          scene.add(indicator);
          snapIndicatorRef.current = indicator;
        }
        snapIndicatorRef.current.visible = true;
        (snapIndicatorRef.current as THREE.Mesh).position.set(snapped.x, 0.02, snapped.z);
        ((snapIndicatorRef.current as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHex(snapColor);

        // Guide line from snap point along snap axis (dashed)
        const guideLen = 5; // meters
        const rad = (snapped.rot * Math.PI) / 180;
        const cosR = Math.cos(rad);
        const sinR = Math.sin(rad);

        // Alignment guide along panel direction (red = X axis direction)
        const guideGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(snapped.x - cosR * guideLen, 0.01, snapped.z - sinR * guideLen),
          new THREE.Vector3(snapped.x + cosR * guideLen, 0.01, snapped.z + sinR * guideLen),
        ]);
        const guideMat = new THREE.LineDashedMaterial({
          color: 0xff4444, dashSize: 0.1, gapSize: 0.05, opacity: 0.6, transparent: true, depthTest: false,
        });
        const guideLine = new THREE.Line(guideGeo, guideMat);
        guideLine.computeLineDistances();
        guideLine.renderOrder = 998;
        scene.add(guideLine);
        guideLineRefs.current.push(guideLine);

        // Perpendicular guide (green = Z axis direction)
        const perpGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(snapped.x + sinR * guideLen, 0.01, snapped.z - cosR * guideLen),
          new THREE.Vector3(snapped.x - sinR * guideLen, 0.01, snapped.z + cosR * guideLen),
        ]);
        const perpMat = new THREE.LineDashedMaterial({
          color: 0x44ff44, dashSize: 0.1, gapSize: 0.05, opacity: 0.4, transparent: true, depthTest: false,
        });
        const perpLine = new THREE.Line(perpGeo, perpMat);
        perpLine.computeLineDistances();
        perpLine.renderOrder = 998;
        scene.add(perpLine);
        guideLineRefs.current.push(perpLine);

        // Set snap label
        const labels: Record<string, string> = {
          inline: "Borde",
          corner: "Esquina",
          "t-junction": "Union T",
        };
        setSnapLabel(labels[snapped.snapType] || "");
      } else {
        if (snapIndicatorRef.current) snapIndicatorRef.current.visible = false;
        setSnapLabel("");
      }

      // Live distance readout
      if (snapped.snapType !== "grid") {
        const distMm = Math.sqrt(snapped.x * snapped.x + snapped.z * snapped.z) / SCALE;
        setLiveDistance(`${Math.round(distMm)} mm`);
      } else {
        setLiveDistance(`X:${Math.round(snapped.x / SCALE)} Z:${Math.round(snapped.z / SCALE)}`);
      }

      return snapped;
    },
    [panels, activeStoreyId, getOrientation],
  );

  // Clear copy snap points
  const clearCopySnapPoints = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const toRemove: THREE.Object3D[] = [];
    scene.traverse((obj) => { if (obj.userData.isCopySnap) toRemove.push(obj); });
    toRemove.forEach((obj) => scene.remove(obj));
    copySnapPointsRef.current = [];
  }, []);

  // Place panel at a copy snap point
  const placeCopyAtPoint = useCallback(async (posXmm: number, posZmm: number, rotDeg: number) => {
    if (!currentProjectId || !selectedCatalogId) return;
    const catalogItem = catalog.find((c) => c.id === selectedCatalogId);
    if (!catalogItem) return;

    const baseY = activeStorey ? activeStorey.elevation_mm : 0;

    const newPanel = await placePanel({
      project_id: currentProjectId,
      panel_catalog_id: selectedCatalogId,
      storey_id: activeStoreyId ?? undefined,
      orientation: "wall",
      pos_x_mm: posXmm,
      pos_y_mm: baseY,
      pos_z_mm: posZmm,
      rotation_deg: rotDeg,
      width_mm: catalogItem.width_mm,
      height_mm: catalogItem.height_mm,
      thickness_mm: catalogItem.thickness_mm,
    });

    if (currentProjectId) fetchSummary(currentProjectId);
    if (showFraming && currentProjectId) fetchAllFraming(currentProjectId);
    selectPanel(newPanel.id);

    // Clear snap points and exit copy mode
    clearCopySnapPoints();
    setCopyMode(false);
  }, [currentProjectId, selectedCatalogId, catalog, activeStorey, activeStoreyId, placePanel, fetchSummary, showFraming, fetchAllFraming, selectPanel, clearCopySnapPoints]);

  // Mouse handlers
  useEffect(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    const controls = controlsRef.current;
    if (!renderer || !camera || !scene || !controls) return;

    const onMouseMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      // Move tool dragging
      if (activeTool === "move" && isDraggingRef.current && dragPanelRef.current) {
        const ground = groundPlaneRef.current;
        if (!ground) return;
        const intersects = raycasterRef.current.intersectObject(ground);
        if (intersects.length === 0) return;
        const point = intersects[0].point;

        const gridStep = 0.1;
        const snapX = Math.round(point.x / gridStep) * gridStep;
        const snapZ = Math.round(point.z / gridStep) * gridStep;

        // Update ghost position during drag
        if (ghostMeshRef.current) {
          const h = dragPanelRef.current.height_mm * SCALE;
          ghostMeshRef.current.position.set(snapX, activeStorey ? activeStorey.elevation_mm * SCALE + h / 2 : h / 2, snapZ);
        }
        return;
      }

      // ── Draw Wall ghost ──
      if (activeTool === "draw-wall" && drawingWallStart) {
        const ground = groundPlaneRef.current;
        if (!ground) return;
        const gHits = raycasterRef.current.intersectObject(ground);
        if (gHits.length === 0) return;

        const pt = gHits[0].point;
        const gridStep = 0.1;
        let endX = Math.round(pt.x / gridStep) * gridStep;
        let endZ = Math.round(pt.z / gridStep) * gridStep;
        const startX = drawingWallStart.x * SCALE;
        const startZ = drawingWallStart.z * SCALE;

        // Axis lock: force to X or Z axis (hold Shift to allow diagonal)
        const rawDx = Math.abs(endX - startX);
        const rawDz = Math.abs(endZ - startZ);
        if (rawDx > 0.01 || rawDz > 0.01) {
          if (rawDx >= rawDz) {
            endZ = startZ; // lock to X axis
          } else {
            endX = startX; // lock to Z axis
          }
        }

        const dx = endX - startX;
        const dz = endZ - startZ;
        const length = Math.sqrt(dx * dx + dz * dz);

        if (length > 0.05) {
          const rotation = Math.atan2(dz, dx);
          const wallH = 2.44; // 2440mm default
          const wallD = 0.136; // 136mm

          // Remove old ghost
          if (ghostWallRef.current && scene) scene.remove(ghostWallRef.current);

          const group = new THREE.Group();

          // Wall box - position at start point, offset mesh by half width
          const geo = new THREE.BoxGeometry(length, wallH, wallD);
          const mat = new THREE.MeshPhongMaterial({
            color: 0xe5a44c, transparent: true, opacity: 0.3, side: THREE.DoubleSide,
          });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.x = length / 2; // offset so left edge = group origin
          group.add(mesh);

          // Edges
          const edges = new THREE.EdgesGeometry(geo);
          const eLine = new THREE.LineBasicMaterial({ color: 0xe5a44c, opacity: 0.8, transparent: true });
          const edgeMesh = new THREE.LineSegments(edges, eLine);
          edgeMesh.position.x = length / 2;
          group.add(edgeMesh);

          // Position at start point, rotate to face end point
          group.position.set(startX, wallH / 2, startZ);
          group.rotation.y = -rotation;

          scene.add(group);
          ghostWallRef.current = group;

          // Dimension label
          const lengthMm = Math.round(length / SCALE);
          setLiveDistance(`${lengthMm} mm (${(lengthMm / 1000).toFixed(2)} m)`);
        }
        return;
      }

      if (!isPlaceTool || !selectedCatalog) return;

      const ground = groundPlaneRef.current;
      if (!ground) return;
      const intersects = raycasterRef.current.intersectObject(ground);
      if (intersects.length === 0) return;

      const point = intersects[0].point;
      const snapped = snapToExisting(point.x, point.z, selectedCatalog);

      // Ghost mesh
      if (!ghostMeshRef.current) {
        const orientation = getOrientation();
        const w = selectedCatalog.width_mm * SCALE;
        const h = selectedCatalog.height_mm * SCALE;
        const d = selectedCatalog.thickness_mm * SCALE;
        const isHoriz = orientation !== "wall";
        const geo = new THREE.BoxGeometry(
          w,
          isHoriz ? d : h,
          isHoriz ? h : d,
        );
        const mat = new THREE.MeshPhongMaterial({
          color: COLORS.ghost,
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
        });
        const ghost = new THREE.Mesh(geo, mat);
        ghost.userData.isGhost = true;

        const edges = new THREE.EdgesGeometry(geo);
        const lineMat2 = new THREE.LineBasicMaterial({ color: 0x3b82f6, opacity: 0.6, transparent: true });
        ghost.add(new THREE.LineSegments(edges, lineMat2));

        scene.add(ghost);
        ghostMeshRef.current = ghost;
      }

      const ghost = ghostMeshRef.current;
      const orientation = getOrientation();
      const isHoriz = orientation !== "wall";
      const dispH = isHoriz ? selectedCatalog.thickness_mm * SCALE : selectedCatalog.height_mm * SCALE;
      const baseY = activeStorey ? activeStorey.elevation_mm * SCALE : 0;

      if (orientation === "floor") {
        ghost.position.set(snapped.x, baseY + dispH / 2, snapped.z);
      } else if (orientation === "roof") {
        const roofY = baseY + (activeStorey?.floor_height_mm ?? 2440) * SCALE;
        ghost.position.set(snapped.x, roofY + dispH / 2, snapped.z);
      } else {
        ghost.position.set(snapped.x, baseY + dispH / 2, snapped.z);
      }
      ghost.rotation.y = (snapped.rot * Math.PI) / 180;
      ghostRotationRef.current = snapped.rot;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      pointerDownPosRef.current = { x: e.clientX, y: e.clientY };

      if (activeTool !== "move") return;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const meshes = Array.from(meshMapRef.current.keys());
      const hits = raycasterRef.current.intersectObjects(meshes);
      if (hits.length === 0) return;

      const hitMesh = hits[0].object as THREE.Mesh;
      const panelData = meshMapRef.current.get(hitMesh);
      if (!panelData) return;

      dragPanelRef.current = panelData;
      isDraggingRef.current = true;
      // controls always enabled for navigation
      selectPanel(panelData.id);

      // Create ghost at panel position
      const w = panelData.width_mm * SCALE;
      const h = panelData.height_mm * SCALE;
      const d = panelData.thickness_mm * SCALE;
      const geo = new THREE.BoxGeometry(w, h, d);
      const mat = new THREE.MeshPhongMaterial({
        color: 0x3b82f6,
        transparent: true,
        opacity: 0.4,
      });
      const ghost = new THREE.Mesh(geo, mat);
      ghost.position.set(
        panelData.pos_x_mm * SCALE,
        panelData.pos_y_mm * SCALE + h / 2,
        panelData.pos_z_mm * SCALE,
      );
      ghost.rotation.y = (panelData.rotation_deg * Math.PI) / 180;
      scene.add(ghost);
      ghostMeshRef.current = ghost;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.button !== 0) return;

      // Move tool: finish drag
      if (activeTool === "move" && isDraggingRef.current && dragPanelRef.current && ghostMeshRef.current) {
        const newX = ghostMeshRef.current.position.x / SCALE;
        const newZ = ghostMeshRef.current.position.z / SCALE;
        movePanel(dragPanelRef.current.id, { pos_x_mm: newX, pos_z_mm: newZ });
        isDraggingRef.current = false;
        dragPanelRef.current = null;
        controls.enabled = true;

        scene.remove(ghostMeshRef.current);
        ghostMeshRef.current = null;
        return;
      }

      // Detect click (not drag): pointer didn't move more than 5px
      const downPos = pointerDownPosRef.current;
      if (!downPos) return;
      const dx = Math.abs(e.clientX - downPos.x);
      const dy = Math.abs(e.clientY - downPos.y);
      if (dx > 5 || dy > 5) return; // Was a drag, not a click

      // Update mouse for raycast
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      // ── Draw Wall tool ──
      if (activeTool === "draw-wall" && currentProjectId) {
        const ground = groundPlaneRef.current;
        if (!ground) return;
        const hits = raycasterRef.current.intersectObject(ground);
        if (hits.length === 0) return;

        const pt = hits[0].point;
        const gridStep = 0.1; // 100mm snap
        let snapX = Math.round(pt.x / gridStep) * gridStep;
        let snapZ = Math.round(pt.z / gridStep) * gridStep;

        // Apply axis lock on second click
        if (drawingWallStart) {
          const sX = drawingWallStart.x * SCALE;
          const sZ = drawingWallStart.z * SCALE;
          if (Math.abs(snapX - sX) >= Math.abs(snapZ - sZ)) {
            snapZ = sZ;
          } else {
            snapX = sX;
          }
        }

        const worldXmm = snapX / SCALE;
        const worldZmm = snapZ / SCALE;

        if (!drawingWallStart) {
          // First click: set start point
          startDrawingWall(worldXmm, worldZmm);

          // Show start marker
          if (!wallStartMarkerRef.current && scene) {
            const geo = new THREE.SphereGeometry(0.08, 16, 16);
            const mat = new THREE.MeshBasicMaterial({ color: 0xe5a44c, depthTest: false });
            const marker = new THREE.Mesh(geo, mat);
            marker.renderOrder = 1000;
            scene.add(marker);
            wallStartMarkerRef.current = marker;
          }
          if (wallStartMarkerRef.current) {
            wallStartMarkerRef.current.position.set(snapX, 0.08, snapZ);
            wallStartMarkerRef.current.visible = true;
          }
        } else {
          // Second click: create wall
          const dx = worldXmm - drawingWallStart.x;
          const dz = worldZmm - drawingWallStart.z;
          const length = Math.sqrt(dx * dx + dz * dz);

          if (length > 300) { // minimum 300mm
            drawWall({
              project_id: currentProjectId,
              start_x_mm: drawingWallStart.x,
              start_z_mm: drawingWallStart.z,
              end_x_mm: worldXmm,
              end_z_mm: worldZmm,
              storey_id: activeStoreyId ?? undefined,
            }).then(() => {
              if (currentProjectId) fetchSummary(currentProjectId);
              if (showFraming && currentProjectId) fetchAllFraming(currentProjectId);
            });
          }

          // Clean up
          cancelDrawingWall();
          if (wallStartMarkerRef.current) wallStartMarkerRef.current.visible = false;
          if (ghostWallRef.current && scene) {
            scene.remove(ghostWallRef.current);
            ghostWallRef.current = null;
          }
        }
        return;
      }

      // ── Wall Opening tool ──
      if (activeTool === "wall-opening") {
        const meshes = Array.from(meshMapRef.current.keys());
        const wallHits = raycasterRef.current.intersectObjects(meshes);
        if (wallHits.length > 0) {
          const hitMesh = wallHits[0].object as THREE.Mesh;
          const panelData = meshMapRef.current.get(hitMesh);
          if (panelData && panelData.wall_id) {
            selectPanel(panelData.id);
            setOpeningPanelId(panelData.id);
            // Calculate position along wall from hit point
            setOpeningForm({
              opening_type: "window",
              opening_x_mm: 160,
              opening_y_mm: 900,
              opening_width_mm: 1200,
              opening_height_mm: 1200,
            });
            setShowOpeningDialog(true);
          }
        }
        return;
      }

      // Check if clicked on a copy snap point
      if (copySnapPointsRef.current.length > 0) {
        const snapMeshes = copySnapPointsRef.current.map((sp) => sp.mesh);
        const snapHits = raycasterRef.current.intersectObjects(snapMeshes);
        if (snapHits.length > 0) {
          const hitMesh = snapHits[0].object as THREE.Mesh;
          const snapPt = copySnapPointsRef.current.find((sp) => sp.mesh === hitMesh);
          if (snapPt) {
            placeCopyAtPoint(snapPt.posX, snapPt.posZ, snapPt.rot);
            return;
          }
        }
      }

      if (isPlaceTool && selectedCatalog && currentProjectId) {
        const ground = groundPlaneRef.current;
        if (!ground) return;
        const intersects = raycasterRef.current.intersectObject(ground);
        if (intersects.length === 0) return;

        const point = intersects[0].point;
        const snapped = snapToExisting(point.x, point.z, selectedCatalog);
        const orientation = getOrientation();
        const baseY = activeStorey ? activeStorey.elevation_mm : 0;

        let posY = baseY;
        if (orientation === "roof") {
          posY = baseY + (activeStorey?.floor_height_mm ?? 2440);
        }

        placePanel({
          project_id: currentProjectId,
          panel_catalog_id: selectedCatalog.id,
          storey_id: activeStoreyId ?? undefined,
          orientation,
          pos_x_mm: snapped.x / SCALE,
          pos_y_mm: posY,
          pos_z_mm: snapped.z / SCALE,
          rotation_deg: snapped.rot,
          width_mm: selectedCatalog.width_mm,
          height_mm: selectedCatalog.height_mm,
          thickness_mm: selectedCatalog.thickness_mm,
        }).then((newPanel) => {
          if (currentProjectId) fetchSummary(currentProjectId);
          if (showFraming && currentProjectId) fetchAllFraming(currentProjectId);
          // Select the new panel and switch to orbit mode
          selectPanel(newPanel.id);
          setTool("orbit");
          setCopyMode(false);
          // Remove ghost
          if (ghostMeshRef.current && sceneRef.current) {
            sceneRef.current.remove(ghostMeshRef.current);
            ghostMeshRef.current = null;
          }
          // Clear guides
          guideLineRefs.current.forEach((obj) => sceneRef.current?.remove(obj));
          guideLineRefs.current = [];
          if (snapIndicatorRef.current) snapIndicatorRef.current.visible = false;
          setSnapLabel("");
          setLiveDistance("");
        });
        return;
      }

      // Raycast against panel meshes
      const meshes = Array.from(meshMapRef.current.keys());
      const hits = raycasterRef.current.intersectObjects(meshes);
      if (hits.length === 0) {
        selectPanel(null);
        return;
      }

      const hitMesh = hits[0].object as THREE.Mesh;
      const panelData = meshMapRef.current.get(hitMesh);
      if (!panelData) return;

      if (activeTool === "orbit") {
        selectPanel(panelData.id);
      } else if (activeTool === "rotate") {
        rotatePanel(panelData.id);
      } else if (activeTool === "door") {
        selectPanel(panelData.id);
        setOpeningPanelId(panelData.id);
        setOpeningForm({
          opening_type: "door",
          opening_x_mm: 160,
          opening_y_mm: 0,
          opening_width_mm: 900,
          opening_height_mm: 2100,
        });
        setShowOpeningDialog(true);
      } else if (activeTool === "window") {
        selectPanel(panelData.id);
        setOpeningPanelId(panelData.id);
        setOpeningForm({
          opening_type: "window",
          opening_x_mm: 160,
          opening_y_mm: 900,
          opening_width_mm: 1200,
          opening_height_mm: 1200,
        });
        setShowOpeningDialog(true);
      } else if (activeTool === "delete") {
        removePanel(panelData.id).then(() => {
          if (currentProjectId) fetchSummary(currentProjectId);
        });
      }
    };

    // OrbitControls always enabled - it only uses middle/right mouse
    controls.enabled = true;

    renderer.domElement.addEventListener("pointermove", onMouseMove);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    return () => {
      renderer.domElement.removeEventListener("pointermove", onMouseMove);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);

      if (ghostMeshRef.current && scene) {
        scene.remove(ghostMeshRef.current);
        ghostMeshRef.current = null;
      }
    };
  }, [
    activeTool, selectedCatalog, panels, currentProjectId, selectedPanelId,
    activeStoreyId, storeys, snapToExisting, isPlaceTool, getOrientation,
    placePanel, movePanel, rotatePanel, removePanel, addOpeningToPanel,
    selectPanel, fetchSummary, placeCopyAtPoint,
    drawWall, drawingWallStart, startDrawingWall, cancelDrawingWall,
    addWallOpening, deleteWall, activeStoreyId,
  ]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const key = e.key.toUpperCase();

      // C = copy: show snap points on the selected panel
      if (key === "C") {
        if (selectedPanelId && sceneRef.current) {
          const panel = panels.find((p) => p.id === selectedPanelId);
          if (panel && panel.panel_catalog_id) {
            selectCatalog(panel.panel_catalog_id);
            setCopyMode(true);

            // Clear old snap points
            clearCopySnapPoints();

            // Generate snap points on the panel edges
            const scene = sceneRef.current;
            const rad = (panel.rotation_deg * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const px = panel.pos_x_mm * SCALE;
            const pz = panel.pos_z_mm * SCALE;
            const pw = panel.width_mm * SCALE;
            const pd = panel.thickness_mm * SCALE;
            const catalogItem = catalog.find((c) => c.id === panel.panel_catalog_id);
            const newW = catalogItem ? catalogItem.width_mm : panel.width_mm;

            const points = [
              // Right edge (inline - same direction)
              {
                x: px + cos * pw, z: pz + sin * pw,
                rot: panel.rotation_deg, label: "Derecha",
                color: 0x22c55e, // green
              },
              // Left edge (inline - same direction)
              {
                x: px - cos * (newW * SCALE), z: pz - sin * (newW * SCALE),
                rot: panel.rotation_deg, label: "Izquierda",
                color: 0x22c55e,
              },
              // Front-right corner (perpendicular)
              {
                x: px + cos * pw, z: pz + sin * pw + pd,
                rot: (panel.rotation_deg + 90) % 360, label: "Esquina",
                color: 0xf59e0b, // yellow
              },
              // Front-left corner (perpendicular)
              {
                x: px, z: pz + pd,
                rot: (panel.rotation_deg + 90) % 360, label: "Esquina",
                color: 0xf59e0b,
              },
              // Back-right corner (perpendicular other side)
              {
                x: px + cos * pw - sin * pd, z: pz + sin * pw + cos * pd,
                rot: (panel.rotation_deg + 270) % 360, label: "Esquina",
                color: 0xf59e0b,
              },
            ];

            for (const pt of points) {
              const geo = new THREE.SphereGeometry(0.07, 16, 16);
              const mat = new THREE.MeshBasicMaterial({
                color: pt.color,
                depthTest: false,
                transparent: true,
                opacity: 0.9,
              });
              const sphere = new THREE.Mesh(geo, mat);
              sphere.position.set(pt.x, 0.07, pt.z);
              sphere.renderOrder = 1000;
              sphere.userData.isCopySnap = true;
              scene.add(sphere);

              // Pulsing ring around the sphere
              const ringGeo = new THREE.RingGeometry(0.08, 0.12, 16);
              const ringMat = new THREE.MeshBasicMaterial({
                color: pt.color, side: THREE.DoubleSide,
                transparent: true, opacity: 0.4, depthTest: false,
              });
              const ring = new THREE.Mesh(ringGeo, ringMat);
              ring.rotation.x = -Math.PI / 2;
              ring.position.set(pt.x, 0.02, pt.z);
              ring.renderOrder = 999;
              ring.userData.isCopySnap = true;
              scene.add(ring);

              copySnapPointsRef.current.push({
                mesh: sphere,
                posX: pt.x / SCALE,
                posZ: pt.z / SCALE,
                rot: pt.rot,
                label: pt.label,
              });
            }
          }
        }
        return;
      }

      const tool = ALL_TOOLS.find((t) => t.key === key);
      if (tool) {
        setTool(tool.id);
        setCopyMode(false);
        clearCopySnapPoints();
      }
      if (key === "Q") {
        ghostRotationRef.current = (ghostRotationRef.current + 90) % 360;
      }
      // Escape cancels copy mode
      if (key === "ESCAPE") {
        setCopyMode(false);
        clearCopySnapPoints();
        // Cancel wall drawing
        cancelDrawingWall();
        if (wallStartMarkerRef.current) wallStartMarkerRef.current.visible = false;
        if (ghostWallRef.current && sceneRef.current) {
          sceneRef.current.remove(ghostWallRef.current);
          ghostWallRef.current = null;
        }
        setLiveDistance("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setTool, selectCatalog, selectedPanelId, currentProjectId, panels, catalog, clearCopySnapPoints, cancelDrawingWall]);

  const handleGenerate = async () => {
    if (!currentProjectId) return;
    setGenerating(true);
    try {
      const result = await bimApi.generateElements(currentProjectId);
      await selectModel(result.ifc_model_id);
      alert(`Generados: ${result.elements_created} elementos, ${result.openings_created} vanos`);
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleAutoGroup = async () => {
    if (!currentProjectId) return;
    await autoGroupWalls(currentProjectId);
    await fetchConnections(currentProjectId);
  };

  const handleAddStorey = async () => {
    if (!currentProjectId || !newStoreyName) return;
    const lastStorey = storeys[storeys.length - 1];
    const elevation = lastStorey ? lastStorey.elevation_mm + lastStorey.floor_height_mm : 0;
    await addStorey(currentProjectId, newStoreyName, elevation);
    setNewStoreyName("");
    setShowStoreyModal(false);
  };

  if (!currentProjectId) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--muted-foreground)]">
        Selecciona un proyecto
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[var(--card)] border-b border-[var(--border)] flex-shrink-0">
        {/* Tool groups */}
        {Object.entries(TOOL_GROUPS).map(([groupName, tools]) => (
          <div key={groupName} className="flex gap-0.5 bg-[var(--secondary)] p-0.5 rounded">
            {tools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => setTool(tool.id)}
                className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded ${
                  activeTool === tool.id ? "bg-[var(--primary)] text-white" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
                title={`${tool.label} (${tool.key})`}
              >
                {tool.icon}
                <span className="hidden xl:inline">{tool.label}</span>
              </button>
            ))}
          </div>
        ))}

        <div className="w-px h-6 bg-[var(--border)]" />

        {/* Storey selector */}
        <div className="flex items-center gap-1">
          <Layers size={14} className="text-[var(--muted-foreground)]" />
          <select
            value={activeStoreyId ?? ""}
            onChange={(e) => setActiveStorey(e.target.value ? Number(e.target.value) : null)}
            className="text-xs bg-[var(--secondary)] border border-[var(--border)] rounded px-2 py-1"
          >
            {storeys.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.elevation_mm}mm)
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowStoreyModal(true)}
            className="p-1 rounded hover:bg-[var(--secondary)] text-[var(--muted-foreground)]"
            title="Agregar piso"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="w-px h-6 bg-[var(--border)]" />

        {/* Toggle buttons */}
        <button
          onClick={handleAutoGroup}
          className="flex items-center gap-1 px-2 py-1.5 text-xs bg-purple-600/20 text-purple-400 rounded hover:bg-purple-600/30"
          title="Agrupar muros"
        >
          <Group size={14} />
          <span className="hidden lg:inline">Agrupar</span>
        </button>
        <button
          onClick={() => {
            toggleConnections();
            if (!showConnections && currentProjectId) fetchConnections(currentProjectId);
          }}
          className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded ${
            showConnections ? "bg-green-600/20 text-green-400" : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
          }`}
          title="Conexiones"
        >
          <Link size={14} />
          <span className="hidden lg:inline">Conexiones</span>
        </button>

        <button
          onClick={toggleFraming}
          className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded ${
            showFraming ? "bg-amber-600/20 text-amber-400" : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
          }`}
          title="Entramado"
        >
          <Hammer size={14} />
          <span className="hidden lg:inline">Entramado</span>
        </button>

        <div className="w-px h-6 bg-[var(--border)]" />
        <span className="text-xs text-[var(--muted-foreground)]">W = dibujar | D = abertura | Esc = cancelar</span>

        <div className="flex-1" />

        <button
          onClick={handleGenerate}
          disabled={generating || panels.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          {generating ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          Generar
        </button>
        <button
          onClick={() => setActiveView("sip-panelization")}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--primary)] text-white rounded"
        >
          Panelizar <ArrowRight size={14} />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-60 flex-shrink-0 border-r border-[var(--border)] overflow-y-auto p-3 space-y-4">
          {/* Catalog */}
          <div>
            <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase mb-2">
              Catalogo de Paneles
            </h3>
            <div className="space-y-1">
              {catalog.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    selectCatalog(item.id);
                    setTool("place");
                    setCopyMode(false);
                    clearCopySnapPoints();
                  }}
                  className={`w-full text-left px-2 py-2 rounded text-xs transition-colors ${
                    selectedCatalogId === item.id
                      ? "bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/30"
                      : "hover:bg-[var(--secondary)]"
                  }`}
                >
                  <div className="font-medium">{item.name}</div>
                  <div className="text-[var(--muted-foreground)]">
                    {item.width_mm}x{item.height_mm}x{item.thickness_mm}mm | {item.weight_kg}kg
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Storeys */}
          <div className="border-t border-[var(--border)] pt-3">
            <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase mb-2">
              Pisos
            </h3>
            <div className="space-y-0.5">
              {storeys.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveStorey(s.id)}
                  className={`flex items-center justify-between w-full px-2 py-1.5 text-xs rounded ${
                    activeStoreyId === s.id
                      ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                      : "hover:bg-[var(--secondary)]"
                  }`}
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="text-[var(--muted-foreground)] font-mono">{s.elevation_mm}mm</span>
                </button>
              ))}
            </div>
          </div>

          {/* Selected panel properties */}
          {selectedPanel && (
            <div className="border-t border-[var(--border)] pt-3">
              <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase mb-2">
                {selectedPanel.label}
              </h3>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div className="bg-[var(--secondary)] rounded p-1.5">
                  <div className="text-[var(--muted-foreground)]">Tipo</div>
                  <div className="font-mono capitalize">{selectedPanel.orientation}</div>
                </div>
                <div className="bg-[var(--secondary)] rounded p-1.5">
                  <div className="text-[var(--muted-foreground)]">Dim</div>
                  <div className="font-mono">{selectedPanel.width_mm}x{selectedPanel.height_mm}</div>
                </div>
                <div className="bg-[var(--secondary)] rounded p-1.5">
                  <div className="text-[var(--muted-foreground)]">Pos X</div>
                  <div className="font-mono">{selectedPanel.pos_x_mm.toFixed(0)}</div>
                </div>
                <div className="bg-[var(--secondary)] rounded p-1.5">
                  <div className="text-[var(--muted-foreground)]">Pos Z</div>
                  <div className="font-mono">{selectedPanel.pos_z_mm.toFixed(0)}</div>
                </div>
                <div className="bg-[var(--secondary)] rounded p-1.5">
                  <div className="text-[var(--muted-foreground)]">Rot</div>
                  <div className="font-mono">{selectedPanel.rotation_deg}°</div>
                </div>
                <div className="bg-[var(--secondary)] rounded p-1.5">
                  <div className="text-[var(--muted-foreground)]">Vano</div>
                  <div>{selectedPanel.has_opening ? selectedPanel.opening_type : "No"}</div>
                </div>
              </div>
            </div>
          )}

          {/* Modular Summary */}
          {summary && (
            <div className="border-t border-[var(--border)] pt-3">
              <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase mb-2">
                Resumen Modular
              </h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">Paneles muro:</span>
                  <span className="font-bold">{summary.wall_panels}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">Paneles losa:</span>
                  <span className="font-bold">{summary.floor_panels}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">Paneles techo:</span>
                  <span className="font-bold">{summary.roof_panels}</span>
                </div>
                <div className="border-t border-[var(--border)] my-1" />
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">Area muros:</span>
                  <span className="font-mono">{summary.wall_area_m2} m²</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">Area losa:</span>
                  <span className="font-mono">{summary.floor_area_m2} m²</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">Area techo:</span>
                  <span className="font-mono">{summary.roof_area_m2} m²</span>
                </div>
                <div className="border-t border-[var(--border)] my-1" />
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">Peso total:</span>
                  <span className="font-mono">{summary.total_weight_kg} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">Muros agrup:</span>
                  <span className="font-bold">{summary.wall_groups}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">Conexiones:</span>
                  <span className="font-bold">{summary.connections}</span>
                </div>
              </div>
            </div>
          )}

          {/* Panel list */}
          <div className="border-t border-[var(--border)] pt-3">
            <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase mb-2">
              Paneles ({panels.length})
            </h3>
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {panels.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectPanel(p.id)}
                  className={`flex items-center justify-between w-full px-2 py-1 text-xs rounded ${
                    selectedPanelId === p.id
                      ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                      : "hover:bg-[var(--secondary)]"
                  }`}
                >
                  <span className="font-mono">{p.label}</span>
                  <span className="text-[var(--muted-foreground)]">
                    {p.width_mm}x{p.height_mm}
                    {p.has_opening ? ` [${p.opening_type === "door" ? "P" : "V"}]` : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Wall groups */}
          {wallGroups.length > 0 && (
            <div className="border-t border-[var(--border)] pt-3">
              <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase mb-2">
                Muros ({wallGroups.length})
              </h3>
              <div className="space-y-1">
                {wallGroups.map((wg) => (
                  <div key={wg.id} className="bg-[var(--secondary)] rounded p-2 text-xs">
                    <div className="font-medium text-purple-400">{wg.name}</div>
                    <div className="text-[var(--muted-foreground)]">
                      {wg.panel_count} paneles | {(wg.total_length_mm / 1000).toFixed(2)}m
                    </div>
                    <div className="text-[var(--muted-foreground)] text-[10px]">
                      {wg.panels.join(", ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Split Viewport: 2D Plan (left) + 3D (right) */}
        <div className="flex-1 flex overflow-hidden" style={{ minHeight: 400 }}>
          {/* Plan View (2D) */}
          <div className="flex-1 relative border-r" style={{ borderColor: "var(--border)" }}>
            <div className="absolute top-2 left-2 z-10 text-[10px] font-bold px-2 py-0.5 rounded"
              style={{ background: "var(--card)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
              PLANTA
            </div>
            <FloorPlanView />
          </div>

          {/* 3D View */}
          <div className="flex-1 relative">
            <div className="absolute top-2 left-2 z-10 text-[10px] font-bold px-2 py-0.5 rounded"
              style={{ background: "var(--card)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
              3D
            </div>
            <div
              ref={containerRef}
              className="w-full h-full"
              style={{
                cursor: activeTool === "draw-wall" || activeTool === "wall-opening" ? "crosshair" : "default",
              }}
            />

          {/* Snap label (SketchUp-style tooltip) */}
          {snapLabel && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-yellow-500/90 text-black text-xs font-bold px-3 py-1 rounded shadow">
              {snapLabel}
              {copyMode && " (COPIA)"}
            </div>
          )}

          {/* Copy mode indicator */}
          {copyMode && (
            <div className="absolute top-3 right-3 bg-blue-600/90 text-white text-xs font-bold px-3 py-1 rounded">
              + COPIAR (Esc cancela)
            </div>
          )}

          {/* VCB - Value Control Box (SketchUp style dimension readout) */}
          {liveDistance && (
            <div className="absolute bottom-3 right-3 bg-black/80 text-white text-xs font-mono px-3 py-1.5 rounded border border-white/20">
              {liveDistance}
            </div>
          )}
          </div> {/* close 3D relative div */}
        </div>
      </div>

      {/* Opening Dialog */}
      {showOpeningDialog && openingPanelId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--card)] rounded-lg p-6 w-96 border border-[var(--border)]">
            <h3 className="text-sm font-semibold mb-4">
              {openingForm.opening_type === "door" ? "Agregar Puerta" : "Agregar Ventana"}
            </h3>

            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setOpeningForm((f) => ({
                    ...f,
                    opening_type: "door",
                    opening_y_mm: 0,
                    opening_width_mm: 900,
                    opening_height_mm: 2100,
                  }))}
                  className={`flex-1 py-2 text-sm rounded ${
                    openingForm.opening_type === "door"
                      ? "bg-amber-600 text-white"
                      : "bg-[var(--secondary)]"
                  }`}
                >
                  Puerta
                </button>
                <button
                  onClick={() => setOpeningForm((f) => ({
                    ...f,
                    opening_type: "window",
                    opening_y_mm: 900,
                    opening_width_mm: 1200,
                    opening_height_mm: 1200,
                  }))}
                  className={`flex-1 py-2 text-sm rounded ${
                    openingForm.opening_type === "window"
                      ? "bg-cyan-600 text-white"
                      : "bg-[var(--secondary)]"
                  }`}
                >
                  Ventana
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--muted-foreground)]">Ancho (mm)</label>
                  <input
                    type="number"
                    value={openingForm.opening_width_mm}
                    onChange={(e) => setOpeningForm((f) => ({ ...f, opening_width_mm: Number(e.target.value) }))}
                    className="w-full px-2 py-1.5 text-sm bg-[var(--secondary)] border border-[var(--border)] rounded"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted-foreground)]">Alto (mm)</label>
                  <input
                    type="number"
                    value={openingForm.opening_height_mm}
                    onChange={(e) => setOpeningForm((f) => ({ ...f, opening_height_mm: Number(e.target.value) }))}
                    className="w-full px-2 py-1.5 text-sm bg-[var(--secondary)] border border-[var(--border)] rounded"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted-foreground)]">Pos X (mm)</label>
                  <input
                    type="number"
                    value={openingForm.opening_x_mm}
                    onChange={(e) => setOpeningForm((f) => ({ ...f, opening_x_mm: Number(e.target.value) }))}
                    className="w-full px-2 py-1.5 text-sm bg-[var(--secondary)] border border-[var(--border)] rounded"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted-foreground)]">Pos Y (mm)</label>
                  <input
                    type="number"
                    value={openingForm.opening_y_mm}
                    onChange={(e) => setOpeningForm((f) => ({ ...f, opening_y_mm: Number(e.target.value) }))}
                    className="w-full px-2 py-1.5 text-sm bg-[var(--secondary)] border border-[var(--border)] rounded"
                  />
                </div>
              </div>

              <div className="bg-[var(--secondary)] rounded p-3 text-xs text-[var(--muted-foreground)]">
                {openingForm.opening_type === "door" ? (
                  <p>La puerta se coloca desde el piso. El entramado genera king studs, jack studs, dintel y cripple studs automaticamente.</p>
                ) : (
                  <p>La ventana se coloca a la altura indicada. Se genera alfeizar (sill), dintel, king studs, jack studs y cripple studs arriba y abajo.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setShowOpeningDialog(false); setOpeningPanelId(null); }}
                className="px-3 py-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!openingPanelId) return;
                  await bimApi.addOpening(openingPanelId, openingForm);
                  if (currentProjectId) await fetchPanels(currentProjectId);
                  if (showFraming && currentProjectId) await fetchAllFraming(currentProjectId);
                  setShowOpeningDialog(false);
                  setOpeningPanelId(null);
                }}
                className="px-3 py-1.5 text-sm bg-[var(--primary)] text-white rounded"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Storey Modal */}
      {showStoreyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--card)] rounded-lg p-6 w-80 border border-[var(--border)]">
            <h3 className="text-sm font-semibold mb-4">Agregar Piso</h3>
            <input
              type="text"
              placeholder="Nombre (ej: Piso 2)"
              value={newStoreyName}
              onChange={(e) => setNewStoreyName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[var(--secondary)] border border-[var(--border)] rounded mb-4"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleAddStorey()}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowStoreyModal(false)}
                className="px-3 py-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddStorey}
                disabled={!newStoreyName}
                className="px-3 py-1.5 text-sm bg-[var(--primary)] text-white rounded disabled:opacity-50"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
