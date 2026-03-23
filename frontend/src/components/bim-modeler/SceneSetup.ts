/**
 * Three.js scene initialization — camera, renderer, controls, lights, grid.
 * Pure setup, no React dependency.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface SceneRefs {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  groundPlane: THREE.Mesh;
}

export function createScene(container: HTMLDivElement): SceneRefs {
  const w = container.clientWidth || 800;
  const h = container.clientHeight || 600;

  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0e17);

  // Camera
  const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 500);
  camera.position.set(8, 6, 8);
  camera.lookAt(0, 0, 0);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // Controls: middle=orbit, right=pan, wheel=zoom. Left free for tools.
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.mouseButtons = {
    LEFT: undefined as unknown as THREE.MOUSE,
    MIDDLE: THREE.MOUSE.ROTATE,
    RIGHT: THREE.MOUSE.PAN,
  };
  controls.zoomToCursor = true;

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  const directional = new THREE.DirectionalLight(0xffffff, 0.7);
  directional.position.set(15, 20, 10);
  directional.castShadow = true;
  directional.shadow.mapSize.set(2048, 2048);
  scene.add(directional);

  scene.add(new THREE.HemisphereLight(0xddeeff, 0x0f0e0d, 0.3));

  // Grid
  const grid = new THREE.GridHelper(40, 40, 0x232d40, 0x151c2a);
  scene.add(grid);

  // Ground plane (invisible, for raycasting)
  const groundGeo = new THREE.PlaneGeometry(200, 200);
  const groundMat = new THREE.MeshBasicMaterial({ visible: false });
  const groundPlane = new THREE.Mesh(groundGeo, groundMat);
  groundPlane.rotation.x = -Math.PI / 2;
  scene.add(groundPlane);

  // Axes
  scene.add(new THREE.AxesHelper(1.5));

  return { scene, camera, renderer, controls, groundPlane };
}

export function startRenderLoop(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
): () => void {
  let animId = 0;
  const animate = () => {
    animId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  };
  animate();
  return () => cancelAnimationFrame(animId);
}

export function handleResize(
  container: HTMLDivElement,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
): void {
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (w === 0 || h === 0) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
