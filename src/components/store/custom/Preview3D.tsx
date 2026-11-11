"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { PreviewModel } from "./preview-model";

// معاينة ثلاثية الأبعاد (Three.js) تُحمَّل عند الحاجة فقط (dynamic import).
// المجسم يُبنى من المقاسات الفعلية (بالمتر داخل المشهد)، وأسهم القياس تعرض القيم كما أدخلها العميل بوحدتها.
// إن فشل WebGL أو التحميل ⇒ onError فيعرض المكوّن الأب البديل ثنائي الأبعاد.

export type PreviewHandle = { capture: () => string | null | Promise<string | null>; zoom: (f: number) => void; reset: () => void };

const IVORY = 0xf3efe6, WALL = 0xf6f3ec, FLOOR = 0xe7e0d2, FRAME = 0xfbfaf6;
const DIM = { w: "#8a6b2e", l: "#3f5871", h: "#a4483a" };

function label(text: string, color: string) {
  const el = document.createElement("div");
  el.textContent = text;
  el.dir = "rtl";
  el.style.cssText = `background:#fff;color:${color};border:1px solid ${color}40;padding:2px 10px;border-radius:999px;font:500 12px var(--font-plex),system-ui,sans-serif;white-space:nowrap;box-shadow:0 4px 14px -6px rgba(0,0,0,.25);pointer-events:none`;
  return new CSS2DObject(el);
}

// سهم قياس: خط + رأسان + خطا امتداد قصيران + تسمية في المنتصف
function dimension(a: THREE.Vector3, b: THREE.Vector3, text: string, color: string, ext?: THREE.Vector3) {
  const g = new THREE.Group();
  const c = new THREE.Color(color);
  const mat = new THREE.LineBasicMaterial({ color: c });
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), mat));
  const dir = b.clone().sub(a).normalize();
  const len = a.distanceTo(b);
  const head = Math.min(0.08, len * 0.12);
  for (const [p, d] of [[a, dir.clone().negate()], [b, dir]] as const) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(head * 0.35, head, 12), new THREE.MeshBasicMaterial({ color: c }));
    cone.position.copy(p).add(d.clone().multiplyScalar(-head / 2));
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    g.add(cone);
    if (ext) g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p.clone().sub(ext), p.clone().add(ext)]), mat));
  }
  const l = label(text, color);
  l.position.copy(a).add(b).multiplyScalar(0.5);
  g.add(l);
  return g;
}

function fabricMaterial(hex: string, fabric: string, opacity = 1) {
  const velvet = /قطيفة|مخمل/.test(fabric), shiny = /ساتان|لامع/.test(fabric);
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(hex), side: THREE.DoubleSide,
    roughness: shiny ? 0.45 : velvet ? 0.95 : 0.85, sheen: velvet ? 1 : shiny ? 0.3 : 0.15,
    sheenColor: new THREE.Color(hex).offsetHSL(0, 0, 0.15), sheenRoughness: 0.6,
    transparent: opacity < 1, opacity,
  });
}

// صورة القماش الحقيقية (من الإدارة) كنسيج متكرر بمقياس واقعي؛ إن فشل التحميل يبقى اللون
const loader = new THREE.TextureLoader().setCrossOrigin("anonymous");
const texCache = new Map<string, Promise<THREE.Texture>>();
function applyTexture(mat: THREE.MeshStandardMaterial, url: string | null, rx: number, ry: number) {
  if (!url) return;
  let p = texCache.get(url);
  if (!p) { p = loader.loadAsync(url).then((t) => { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }); texCache.set(url, p); }
  p.then((base) => {
    const t = base.clone(); t.repeat.set(Math.max(1, rx), Math.max(1, ry)); t.needsUpdate = true;
    mat.map = t; mat.color.set(0xffffff); mat.needsUpdate = true;
  }).catch(() => { texCache.delete(url); });
}

// نسيج خياطة (معيّنات) لوجه الفرشة المبطّن أو بطانة المربعات
function stitchTexture(hex: string, kind: "diamond" | "grid") {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 256;
  const x = cv.getContext("2d")!;
  x.fillStyle = hex; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = "rgba(0,0,0,0.18)"; x.lineWidth = 3; x.setLineDash([10, 6]);
  x.beginPath();
  if (kind === "diamond") { x.moveTo(0, 128); x.lineTo(128, 0); x.lineTo(256, 128); x.lineTo(128, 256); x.closePath(); }
  else { x.rect(8, 8, 240, 240); }
  x.stroke();
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function build(m: PreviewModel): { group: THREE.Group; size: THREE.Vector3; target: THREE.Vector3; view: THREE.Vector3; eye?: THREE.Vector3 } {
  const g = new THREE.Group();
  if (m.kind === "curtains") {
    const W = m.width, H = m.height;
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(W + 2.4, H + 2), new THREE.MeshStandardMaterial({ color: WALL, roughness: 1 }));
    wall.position.set(0, H / 2, -0.01); wall.receiveShadow = true; g.add(wall);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W + 2.4, 2.4), new THREE.MeshStandardMaterial({ color: FLOOR, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, -0.9, 1.2); floor.receiveShadow = true; g.add(floor);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ color: 0xdfe9ef, emissive: 0xcfdde6, emissiveIntensity: 0.35, roughness: 0.2 }));
    glass.position.set(0, H / 2, 0); g.add(glass);
    const frameMat = new THREE.MeshStandardMaterial({ color: FRAME, roughness: 0.6 });
    const t = 0.05;
    for (const [w, h, x, y] of [[W + 2 * t, t, 0, H + t / 2], [W + 2 * t, t, 0, -t / 2], [t, H, -W / 2 - t / 2, H / 2], [t, H, W / 2 + t / 2, H / 2], [t * 0.6, H, 0, H / 2]] as const) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), frameMat); b.position.set(x, y, 0.03); b.castShadow = true; g.add(b);
    }
    const sill = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.04, 0.12), frameMat); sill.position.set(0, -0.06, 0.06); sill.castShadow = true; g.add(sill);
    const rodY = H + 0.22, rodW = W + 0.5;
    const metal = new THREE.MeshStandardMaterial({ color: 0x5b4a36, metalness: 0.7, roughness: 0.35 });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, rodW, 16), metal);
    rod.rotation.z = Math.PI / 2; rod.position.set(0, rodY, 0.16); g.add(rod);
    for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), metal); f.position.set(s * rodW / 2, rodY, 0.16); g.add(f); }
    // قطعتان مفتوحتان جزئياً بكسرات (المعاينة توضيحية: كمية القماش الفعلية يحددها المحل)
    const opacity = m.blackout === "none" ? 0.55 : m.blackout === "partial" ? 0.88 : 1;
    const panelW = rodW * 0.32, panelH = rodY + 0.85;
    for (const s of [-1, 1]) {
      const geo = new THREE.PlaneGeometry(panelW, panelH, 64, 1);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) / panelW) * Math.PI * 14) * 0.03);
      geo.computeVertexNormals();
      const mat = fabricMaterial(m.color, m.fabric, opacity);
      applyTexture(mat, m.texture, panelW / 0.45, panelH / 0.45);
      const p = new THREE.Mesh(geo, mat);
      p.position.set(s * (rodW / 2 - panelW / 2), rodY - panelH / 2, 0.2); p.castShadow = true; g.add(p);
    }
    const ext = new THREE.Vector3(0, 0.05, 0);
    g.add(dimension(new THREE.Vector3(-W / 2, H + 0.5, 0.25), new THREE.Vector3(W / 2, H + 0.5, 0.25), `عرض الشباك ${m.label.w}`, DIM.w, ext));
    g.add(dimension(new THREE.Vector3(W / 2 + 0.55, 0, 0.25), new THREE.Vector3(W / 2 + 0.55, H, 0.25), `ارتفاع الشباك ${m.label.h}`, DIM.h, new THREE.Vector3(0.05, 0, 0)));
    return { group: g, size: new THREE.Vector3(W + 1.4, H + 1.4, 1), target: new THREE.Vector3(0, H / 2, 0), view: new THREE.Vector3(0.35, 0.15, 1) };
  }
  if (m.kind === "ceiling") {
    const W = m.width, L = m.length, R = 2.8;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, L), new THREE.MeshStandardMaterial({ color: FLOOR, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
    const wallMat = new THREE.MeshStandardMaterial({ color: WALL, roughness: 1, side: THREE.DoubleSide });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(W, R), wallMat); back.position.set(0, R / 2, -L / 2); g.add(back);
    const side = new THREE.Mesh(new THREE.PlaneGeometry(L, R), wallMat); side.rotation.y = Math.PI / 2; side.position.set(-W / 2, R / 2, 0); g.add(side);
    // البطانة: سطح مقسّم تحت السقف مباشرة، بشكل حسب التصميم (سادة / كسرات / مربعات)
    const geo = new THREE.PlaneGeometry(W, L, Math.max(8, Math.round(W * 24)), Math.max(8, Math.round(L * 24)));
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const sag = 0.025 * (1 - (2 * x / W) ** 2) * (1 - (2 * y / L) ** 2);
      const d = m.design === "pleated" ? Math.abs(Math.sin((x / W) * Math.PI * W * 3)) * 0.035
        : m.design === "panels" ? (Math.cos((x % 0.6) / 0.6 * Math.PI * 2) * Math.cos((y % 0.6) / 0.6 * Math.PI * 2) + 1) * 0.012 : 0;
      pos.setZ(i, -(sag + d));
    }
    geo.computeVertexNormals();
    const mat = fabricMaterial(m.color, m.fabric);
    if (m.texture) applyTexture(mat, m.texture, W / 0.6, L / 0.6);
    else if (m.design === "panels") { const tx = stitchTexture(m.color, "grid"); tx.repeat.set(W / 0.6, L / 0.6); mat.map = tx; }
    const lining = new THREE.Mesh(geo, mat);
    lining.rotation.x = Math.PI / 2; lining.position.y = R - 0.01; g.add(lining);
    const lamp = new THREE.PointLight(0xfff3df, 1.2, 0, 0); lamp.position.set(0, R * 0.45, 0); g.add(lamp);
    const y = R - 0.08;
    g.add(dimension(new THREE.Vector3(-W / 2, y, -L / 2 + 0.12), new THREE.Vector3(W / 2, y, -L / 2 + 0.12), `عرض السقف ${m.label.w}`, DIM.w, new THREE.Vector3(0, 0, 0.06)));
    g.add(dimension(new THREE.Vector3(-W / 2 + 0.12, y, -L / 2), new THREE.Vector3(-W / 2 + 0.12, y, L / 2), `طول السقف ${m.label.l}`, DIM.l, new THREE.Vector3(0.06, 0, 0)));
        // الكاميرا داخل الغرفة عند الزاوية المفتوحة، على ارتفاع إنسان، تنظر إلى السقف (لا من تحت الأرض ولا فوق السقف)
    const floor2 = new THREE.Mesh(new THREE.PlaneGeometry(W, L), new THREE.MeshStandardMaterial({ color: FLOOR, roughness: 1, side: THREE.DoubleSide }));
    floor2.rotation.x = -Math.PI / 2; floor2.position.y = -0.001; g.add(floor2);
    return { group: g, size: new THREE.Vector3(W, R, L), target: new THREE.Vector3(-W * 0.1, R * 0.82, -L * 0.1), view: new THREE.Vector3(0.7, -0.32, 0.85),
      eye: new THREE.Vector3(W * 0.62, 1.15, L * 0.62) };
  }
  // فرشة أو قطعة أخرى: صندوق ناعم الحواف بالأبعاد الثلاثة (بالمتر داخل المشهد)
  const W = m.width, L = m.length, H = m.height;
  const radius = Math.min(H * 0.3, 0.05, W * 0.1);
  const geo = new RoundedBoxGeometry(W, H, L, 4, radius);
  const mat = fabricMaterial(m.color, m.fabric);
  if (m.texture) applyTexture(mat, m.texture, W / 0.3, L / 0.3);
  else if (m.kind === "mattress" && m.cover === "quilted") { const tx = stitchTexture(m.color, "diamond"); tx.repeat.set(W / 0.25, L / 0.25); mat.map = tx; }
  const body = new THREE.Mesh(geo, mat);
  body.position.y = H / 2; body.castShadow = true; g.add(body);
  if (m.kind === "mattress") {
    // السحاب: خط بلون أغمق حول الحافة العليا؛ المطاطي: شريط سفلي يلتف تحت الفرشة
    const edge = new THREE.Color(m.color).offsetHSL(0, 0, -0.25);
    if (m.cover === "zipper") {
      const ring = new THREE.Mesh(new THREE.BoxGeometry(W + 0.004, 0.008, L + 0.004), new THREE.MeshStandardMaterial({ color: edge }));
      ring.position.y = H - radius; g.add(ring);
    } else if (m.cover === "fitted") {
      const band = new THREE.Mesh(new THREE.BoxGeometry(W + 0.006, Math.min(0.03, H * 0.25), L + 0.006), new THREE.MeshStandardMaterial({ color: edge, roughness: 0.9 }));
      band.position.y = Math.min(0.015, H * 0.12); g.add(band);
    }
  }
  const floor = new THREE.Mesh(new THREE.CircleGeometry(Math.max(W, L) * 1.4, 48), new THREE.MeshStandardMaterial({ color: FLOOR, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  const o = 0.08 + Math.max(W, L) * 0.04;
  g.add(dimension(new THREE.Vector3(-W / 2, 0.01, L / 2 + o), new THREE.Vector3(W / 2, 0.01, L / 2 + o), `العرض ${m.label.w}`, DIM.w, new THREE.Vector3(0, 0, 0.04)));
  g.add(dimension(new THREE.Vector3(W / 2 + o, 0.01, -L / 2), new THREE.Vector3(W / 2 + o, 0.01, L / 2), `الطول ${m.label.l}`, DIM.l, new THREE.Vector3(0.04, 0, 0)));
  if (m.label.h) g.add(dimension(new THREE.Vector3(-W / 2 - o, 0, L / 2), new THREE.Vector3(-W / 2 - o, H, L / 2), `الارتفاع ${m.label.h}`, DIM.h, new THREE.Vector3(0.04, 0, 0)));
  return { group: g, size: new THREE.Vector3(W, H, L), target: new THREE.Vector3(0, H / 2, 0), view: new THREE.Vector3(0.9, 0.75, 1.05) };
}

export default function Preview3D({ model, onError, handleRef }: {
  model: PreviewModel; onError: (e: unknown) => void; handleRef?: React.RefObject<PreviewHandle | null>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ setModel: (m: PreviewModel) => void } | null>(null);
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: "low-power" });
    } catch (e) { onErrorRef.current(e); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.appendChild(renderer.domElement);
    const labels = new CSS2DRenderer();
    labels.domElement.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden";
    labels.domElement.dir = "ltr"; // مواضع التسميات محسوبة من اليسار؛ النص نفسه RTL
    el.appendChild(labels.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(IVORY);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xe8dfcf, 1.25));
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const sun = new THREE.DirectionalLight(0xfff6e8, 1.6);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 4;
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 200);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false;

    let current: THREE.Group | null = null;
    let home = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
    const dispose = (o: THREE.Object3D) => o.traverse((c) => {
      const mesh = c as THREE.Mesh;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const mat of mats) { (mat as THREE.MeshStandardMaterial).map?.dispose(); mat.dispose(); }
      if (c instanceof CSS2DObject) c.element.remove();
    });

    const setModel = (m: PreviewModel) => {
      if (current) { scene.remove(current); dispose(current); }
      const { group, size, target, view, eye } = build(m);
      current = group; scene.add(group);
      const r = size.length() / 2;
      // مسافة تكفي لظهور المجسم وتسميات القياس كاملة حتى في الشاشات العريضة
      const dist = (r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.25;
      home = { pos: eye ?? target.clone().add(view.clone().normalize().multiplyScalar(dist)), target };
      camera.fov = eye ? 60 : 40; camera.updateProjectionMatrix();
      camera.position.copy(home.pos); controls.target.copy(target);
      const d0 = home.pos.distanceTo(target);
      controls.minDistance = d0 * 0.35; controls.maxDistance = d0 * 2.5;
      sun.position.copy(target).add(new THREE.Vector3(r * 1.5, r * 3, r * 2));
      sun.target.position.copy(target); scene.add(sun.target);
      const s = sun.shadow.camera as THREE.OrthographicCamera;
      s.left = s.bottom = -r * 2; s.right = s.top = r * 2; s.far = r * 10; s.updateProjectionMatrix();
      controls.update();
    };
    api.current = { setModel };

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h); labels.setSize(w, h);
      camera.aspect = w / Math.max(h, 1); camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();

    // الرسم فقط عندما تكون المعاينة ظاهرة (توفير للبطارية في الجوال)
    let visible = true, raf = 0;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(el);
    const loop = () => { raf = requestAnimationFrame(loop); if (!visible) return; controls.update(); renderer.render(scene, camera); labels.render(scene, camera); };
    loop();

    if (handleRef) handleRef.current = {
      capture: () => {
        try {
          renderer.render(scene, camera);
          const src = renderer.domElement, scale = Math.min(1, 900 / src.width);
          const c = document.createElement("canvas"); c.width = Math.round(src.width * scale); c.height = Math.round(src.height * scale);
          c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
          return c.toDataURL("image/jpeg", 0.72);
        } catch { return null; }
      },
      zoom: (f) => { camera.position.sub(controls.target).multiplyScalar(f).add(controls.target); controls.update(); },
      reset: () => { camera.position.copy(home.pos); controls.target.copy(home.target); controls.update(); },
    };

    const lost = (e: Event) => { e.preventDefault(); onErrorRef.current(new Error("webgl_context_lost")); };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      if (current) dispose(current);
      renderer.dispose(); renderer.domElement.remove(); labels.domElement.remove();
      api.current = null;
    };
  }, [handleRef]);

  useEffect(() => {
    try { api.current?.setModel(model); } catch (e) { onErrorRef.current(e); }
  }, [model]);

  return <div ref={host} className="relative h-full w-full touch-none [&_canvas]:block" aria-hidden="true" />;
}
