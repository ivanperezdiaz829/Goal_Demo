import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import * as CANNON from "cannon-es";

// -------------------------------------------------
// 1. Three.js scene
// -------------------------------------------------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 500);
camera.position.set(5, 5, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

// luz
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));

// -------------------------------------------------
// 2. Mundo físico Cannon
// -------------------------------------------------
const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, 0, 0)
});

// alta precisión
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;

// -------------------------------------------------
// 3. Cargar el suelo OBJ + colisión física
// -------------------------------------------------
const loader = new OBJLoader();

loader.load("suelo.obj", (obj) => {
    obj.traverse((child) => {
        if (child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({ color: 0x888888 });
        }
    });

    scene.add(obj);

    // Crear Trimesh físico
    const vertices = [];
    const indices = [];

    obj.traverse((child) => {
        if (child.isMesh) {
            const geo = child.geometry.clone().toNonIndexed();
            const pos = geo.attributes.position;

            for (let i = 0; i < pos.count; i++) {
                vertices.push(pos.getX(i), pos.getY(i), pos.getZ(i));
                indices.push(i);
            }
        }
    });

    const trimesh = new CANNON.Trimesh(vertices, indices);
    const groundBody = new CANNON.Body({ mass: 0 });
    groundBody.addShape(trimesh);
    world.addBody(groundBody);
});

// -------------------------------------------------
// 4. Crear gusano articulado
// -------------------------------------------------
const segments = [];
const bodies = [];
const NUM_SEGMENTS = 10;

for (let i = 0; i < NUM_SEGMENTS; i++) {
    const geom = new THREE.SphereGeometry(0.3, 16, 16);
    const mat = new THREE.MeshStandardMaterial({ color: 0x55ff66 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(i * 0.7, 2, 0);
    scene.add(mesh);
    segments.push(mesh);

    // cuerpo físico
    const shape = new CANNON.Sphere(0.3);
    const body = new CANNON.Body({ mass: 0.3 });
    body.addShape(shape);
    body.position.set(i * 0.7, 2, 0);
    world.addBody(body);
    bodies.push(body);

    // unir con constraint
    if (i > 0) {
        const constraint = new CANNON.DistanceConstraint(bodies[i - 1], body, 0.7);
        world.addConstraint(constraint);
    }
}

// -------------------------------------------------
// 5. Picking — arrastrar un segmento
// -------------------------------------------------
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let pickedBody = null;
let dragConstraint = null;

window.addEventListener("pointerdown", (e) => {
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersect = raycaster.intersectObjects(segments);
    if (intersect.length > 0) {
        const index = segments.indexOf(intersect[0].object);
        pickedBody = bodies[index];

        dragConstraint = new CANNON.PointToPointConstraint(
            pickedBody,
            new CANNON.Vec3(0, 0, 0), // punto del segmento
            null,
            new CANNON.Vec3(0, 0, 0) // punto del “cursor”
        );

        world.addConstraint(dragConstraint);
    }
});

window.addEventListener("pointerup", () => {
    if (dragConstraint) world.removeConstraint(dragConstraint);
    dragConstraint = null;
    pickedBody = null;
});

// mover el anclaje del cursor
window.addEventListener("pointermove", (e) => {
    if (!pickedBody) return;

    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const dir = new THREE.Vector3();
    raycaster.ray.at(5, dir);

    dragConstraint.pivotB.copy(new CANNON.Vec3(dir.x, dir.y, dir.z));
});

// -------------------------------------------------
// 6. Loop
// -------------------------------------------------
function animate() {
    requestAnimationFrame(animate);

    world.step(1/60);

    for (let i = 0; i < bodies.length; i++) {
        segments[i].position.copy(bodies[i].position);
        segments[i].quaternion.copy(bodies[i].quaternion);
    }

    renderer.render(scene, camera);
}
animate();
