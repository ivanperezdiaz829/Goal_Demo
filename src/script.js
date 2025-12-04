import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import * as CANNON from "cannon-es"; // Se usa en vez de ammo.js por simplicidad (leer README)
import * as TWEEN from "@tweenjs/tween.js";

// --- CONFIGURACIÓN GLOBAL ---
const MAX_BALLS = 10;
const MAP_SIZE = 26;
const WALL_HEIGHT = 9;

const GOAL_WIDTH = 10;
const GOAL_HEIGHT = 5;
const POST_THICKNESS = 0.2;
const GOAL_Z_POS = -7; 
const NET_DEPTH = 4; 

let score = 0;

// Configuración del Portero
// La velocidad la controla tween.js más abajo
const GOALKEEPER_RANGE = 3; 
const KEEPER_SCALE = 0.018; 
const KEEPER_PHYSICS_SIZE = new CANNON.Vec3(1.5, 2.8, 1); 

const PLAYER_SPEED = 12; 
const JUMP_FORCE = 8; 

// --- ESCENA Y CÁMARA ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111); 

const textureLoader = new THREE.TextureLoader();

// Cargar las texturas
const grassTexture = textureLoader.load('../resources/textures/grass_texture.jpg');
grassTexture.wrapS = THREE.RepeatWrapping; 
grassTexture.wrapT = THREE.RepeatWrapping;
grassTexture.repeat.set(4, 4);
grassTexture.colorSpace = THREE.SRGBColorSpace;

const concreteTexture = textureLoader.load('../resources/textures/Concrete.jpg');
concreteTexture.wrapS = THREE.RepeatWrapping; concreteTexture.wrapT = THREE.RepeatWrapping;
concreteTexture.repeat.set(4, 2); 
concreteTexture.colorSpace = THREE.SRGBColorSpace;

const mapTexture = textureLoader.load('../resources/textures/metal.jpg');
mapTexture.wrapS = THREE.RepeatWrapping; mapTexture.wrapT = THREE.RepeatWrapping;
mapTexture.repeat.set(1, 1);
mapTexture.colorSpace = THREE.SRGBColorSpace;

// Generador de la red de la portería
function createProceduralNetTexture(repeatX, repeatY) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 512);
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 20; 
    ctx.beginPath();
    for (let i = 10; i <= 512; i += 64) {
        ctx.moveTo(i, 0); ctx.lineTo(i, 512); 
        ctx.moveTo(0, i); ctx.lineTo(512, i); 
    }
    ctx.stroke();
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

const netMatBack = new THREE.MeshBasicMaterial({ map: createProceduralNetTexture(10, 5), transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 });
const netMatSide = new THREE.MeshBasicMaterial({ map: createProceduralNetTexture(4, 5), transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 });
const netMatTop  = new THREE.MeshBasicMaterial({ map: createProceduralNetTexture(10, 4), transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 });
const wallVisualMaterial = new THREE.MeshStandardMaterial({ map: concreteTexture, roughness: 0.9, metalness: 0.1 });
const goalPostMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });

// Cámara
const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 500);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; 
document.body.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, document.body);

// UI
const info = document.createElement('div');
info.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;color:#fff;background:rgba(0,0,0,0.5);padding:20px;border-radius:10px;font-family:sans-serif;font-size:20px;pointer-events:none;';
info.innerHTML = '<b>CLICK PARA JUGAR</b><br><br>WASD: Moverse | ESPACIO: Saltar | Click: Disparar';
document.body.appendChild(info);

const scoreDiv = document.createElement('div');
scoreDiv.style.cssText = 'position:absolute;top:20px;right:30px;color:#00ff00;font-family:Impact,sans-serif;font-size:40px;pointer-events:none;text-shadow:2px 2px 0 #000;';
scoreDiv.innerHTML = 'GOLES: 0';
document.body.appendChild(scoreDiv);

const autorDiv = document.createElement('div');
autorDiv.style.cssText = 'position:absolute;top:20px;left:36px;color:#ffffffee;font-family:Impact,sans-serif;font-size:25px;pointer-events:none;text-shadow:2px 2px 0 #000;';
autorDiv.innerHTML = 'Iván Pérez Díaz';
document.body.appendChild(autorDiv);

controls.addEventListener('lock', () => { info.style.display = 'none'; });
controls.addEventListener('unlock', () => { info.style.display = 'block'; });

// Luces
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.6));
const lampLight = new THREE.PointLight(0xffffff, 1, 50); 
lampLight.position.set(0, WALL_HEIGHT - 1, 0);
lampLight.castShadow = true;
scene.add(lampLight);

// --- MUNDO FÍSICO ---
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -15, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;

const groundMaterial = new CANNON.Material("ground");
const ballMaterial = new CANNON.Material("ball");
const playerPhysicsMaterial = new CANNON.Material("player");

world.addContactMaterial(new CANNON.ContactMaterial(groundMaterial, ballMaterial, { friction: 0.5, restitution: 0.6 }));
world.addContactMaterial(new CANNON.ContactMaterial(groundMaterial, playerPhysicsMaterial, { friction: 0.0, restitution: 0.0 }));

const balls = [];       
const ballBodies = [];  
let ballGeometry = null; 

// --- JUGADOR ---
const playerRadius = 0.8;
const playerBody = new CANNON.Body({ mass: 70, material: playerPhysicsMaterial, fixedRotation: true, position: new CANNON.Vec3(0, 5, 10) });
playerBody.allowSleep = false; 
playerBody.addShape(new CANNON.Sphere(playerRadius));
playerBody.linearDamping = 0.9; 
world.addBody(playerBody);

let canJump = false; 

// --- MAPA ---
const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE), new THREE.MeshStandardMaterial({ map: grassTexture, side: THREE.DoubleSide }));
floorMesh.receiveShadow = true; floorMesh.rotation.x = -Math.PI / 2;
scene.add(floorMesh);

const groundBody = new CANNON.Body({ mass: 0, material: groundMaterial });
groundBody.addShape(new CANNON.Plane());
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

function createWall(x, y, z, w, h, d) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallVisualMaterial);
    mesh.position.set(x, y, z); mesh.castShadow = true; scene.add(mesh);
    const body = new CANNON.Body({ mass: 0, material: groundMaterial });
    body.addShape(new CANNON.Box(new CANNON.Vec3(w/2, h/2, d/2)));
    body.position.set(x, y, z); world.addBody(body);
}
const o = MAP_SIZE / 2; 
createWall(0, WALL_HEIGHT/2, -o, MAP_SIZE, WALL_HEIGHT, 1);
createWall(0, WALL_HEIGHT/2, o, MAP_SIZE, WALL_HEIGHT, 1);
createWall(o, WALL_HEIGHT/2, 0, 1, WALL_HEIGHT, MAP_SIZE);
createWall(-o, WALL_HEIGHT/2, 0, 1, WALL_HEIGHT, MAP_SIZE);
const roofMesh = new THREE.Mesh(new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE), new THREE.MeshStandardMaterial({ map: mapTexture, side: THREE.DoubleSide }));
roofMesh.position.y = WALL_HEIGHT; roofMesh.rotation.x = Math.PI/2; scene.add(roofMesh);

// Portería
function createGoalPart(x, y, z, w, h, d) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), goalPostMaterial);
    mesh.position.set(x, y, z); scene.add(mesh);
    const body = new CANNON.Body({ mass: 0, material: groundMaterial });
    body.addShape(new CANNON.Box(new CANNON.Vec3(w/2, h/2, d/2)));
    body.position.set(x, y, z); world.addBody(body);
}
createGoalPart(-GOAL_WIDTH/2, GOAL_HEIGHT/2, GOAL_Z_POS, POST_THICKNESS, GOAL_HEIGHT, POST_THICKNESS);
createGoalPart(GOAL_WIDTH/2, GOAL_HEIGHT/2, GOAL_Z_POS, POST_THICKNESS, GOAL_HEIGHT, POST_THICKNESS);
createGoalPart(0, GOAL_HEIGHT + POST_THICKNESS/2, GOAL_Z_POS, GOAL_WIDTH, POST_THICKNESS, POST_THICKNESS);

function createNet(w, h, x, y, z, rx, ry, mat) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z); 
    if(rx) mesh.rotation.x = rx; if(ry) mesh.rotation.y = ry;
    scene.add(mesh);
    const body = new CANNON.Body({ mass: 0, material: groundMaterial });
    body.addShape(new CANNON.Box(new CANNON.Vec3(w/2, h/2, 0.05)));
    body.position.set(x, y, z);
    if(rx) body.quaternion.setFromEuler(rx, 0, 0); if(ry) body.quaternion.setFromEuler(0, ry, 0);
    world.addBody(body);
}
createNet(GOAL_WIDTH, GOAL_HEIGHT, 0, GOAL_HEIGHT/2, GOAL_Z_POS - NET_DEPTH, 0, 0, netMatBack);
createNet(GOAL_WIDTH, NET_DEPTH, 0, GOAL_HEIGHT, GOAL_Z_POS - NET_DEPTH/2, -Math.PI/2, 0, netMatTop);
createNet(NET_DEPTH, GOAL_HEIGHT, -GOAL_WIDTH/2, GOAL_HEIGHT/2, GOAL_Z_POS - NET_DEPTH/2, 0, -Math.PI/2, netMatSide);
createNet(NET_DEPTH, GOAL_HEIGHT, GOAL_WIDTH/2, GOAL_HEIGHT/2, GOAL_Z_POS - NET_DEPTH/2, 0, Math.PI/2, netMatSide);

// --- PORTERO ---
const keeperBody = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: groundMaterial });
keeperBody.addShape(new CANNON.Box(KEEPER_PHYSICS_SIZE));
keeperBody.position.set(0, KEEPER_PHYSICS_SIZE.y, GOAL_Z_POS);
world.addBody(keeperBody);

const loader = new OBJLoader();
let keeperMesh = null;

loader.load('../resources/objects/IronMan.obj', (obj) => {
    keeperMesh = obj;
    keeperMesh.scale.set(KEEPER_SCALE, KEEPER_SCALE, KEEPER_SCALE); 
    keeperMesh.position.set(0, 0, GOAL_Z_POS);
    keeperMesh.traverse((c) => { if(c.isMesh) { c.castShadow=true; c.material = new THREE.MeshStandardMaterial({ color: 0xff0000, metalness: 0.8 }); } });
    scene.add(keeperMesh);

    // Inicializar la animación del portero con Tween.js
    initKeeperTween();
});

// Función para configurar Tween.js
function initKeeperTween() {
    const coords = { x: -GOALKEEPER_RANGE }; 

    // El porteror se mueve de -GOALKEEPER_RANGE a +GOALKEEPER_RANGE en el eje X
    const tween = new TWEEN.Tween(coords)
        .to({ x: GOALKEEPER_RANGE }, 1000) // ms en ir de un lado a otro
        .easing(TWEEN.Easing.Quadratic.InOut) // Movimiento suave (acelera y frena)
        .onUpdate(() => {
            keeperBody.position.x = coords.x;
        })
        .yoyo(true)         // Va y vuelve
        .repeat(Infinity)   // Nunca para
        .start();           // Iniciar animación
}

// --- BALONES ---
loader.load("../resources/objects/Ball.obj", (obj) => {
    obj.traverse((child) => {
        if (child.isMesh) { ballGeometry = child.geometry; ballGeometry.center(); }
    });
});

function shootBall() {
    if (!ballGeometry) return;
    if (balls.length >= MAX_BALLS) {
        const om = balls.shift(); const ob = ballBodies.shift();
        scene.remove(om); world.removeBody(ob);
    }

    const mesh = new THREE.Mesh(ballGeometry, new THREE.MeshStandardMaterial({ color: 0xffffff }));
    mesh.scale.set(0.5, 0.5, 0.5); mesh.castShadow = true; mesh.userData = { scored: false };
    scene.add(mesh); balls.push(mesh);

    const body = new CANNON.Body({ mass: 5, material: ballMaterial });
    body.addShape(new CANNON.Sphere(0.5));
    body.ccdSpeedThreshold = 1; body.ccdIterations = 2;

    // Lógica de "Pie del jugador"
    const viewDirection = new THREE.Vector3();
    camera.getWorldDirection(viewDirection);
    const spawnPos = new THREE.Vector3().copy(playerBody.position);
    spawnPos.y -= 0.2; 
    const flatForward = new THREE.Vector3(viewDirection.x, 0, viewDirection.z).normalize();
    spawnPos.addScaledVector(flatForward, 1.0); 
    body.position.copy(spawnPos);

    const targetPoint = new THREE.Vector3().copy(camera.position).add(viewDirection.multiplyScalar(25));
    const velocityVector = new THREE.Vector3().subVectors(targetPoint, spawnPos).normalize();

    body.velocity.set(velocityVector.x * 35, velocityVector.y * 35, velocityVector.z * 35);
    world.addBody(body); ballBodies.push(body);
}

// --- CONTROLES ---
const input = { forward: false, backward: false, left: false, right: false };
document.addEventListener('keydown', (e) => {
    switch(e.code) {
        case 'KeyW': input.forward = true; break;
        case 'KeyS': input.backward = true; break;
        case 'KeyA': input.left = true; break;
        case 'KeyD': input.right = true; break;
        case 'Space': if(canJump) { playerBody.velocity.y = JUMP_FORCE; canJump = false; } break;
    }
});
document.addEventListener('keyup', (e) => {
    switch(e.code) {
        case 'KeyW': input.forward = false; break;
        case 'KeyS': input.backward = false; break;
        case 'KeyA': input.left = false; break;
        case 'KeyD': input.right = false; break;
    }
});
document.addEventListener("mousedown", () => { if (controls.isLocked) shootBall(); else controls.lock(); });
window.addEventListener('resize', () => { camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// --- BUCLE DE ANIMACIÓN ---
const clock = new THREE.Clock();
const jumpRaycaster = new THREE.Raycaster();
const jumpRayDown = new THREE.Vector3(0, -1, 0); 

function animate(time) { // 'time' viene de requestAnimationFrame automáticamente
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);

    // Actualizar Tween.js
    TWEEN.update(time);

    // Salto
    jumpRaycaster.set(playerBody.position, jumpRayDown);
    const intersects = jumpRaycaster.intersectObjects(scene.children);
    canJump = false; 
    for (let i = 0; i < intersects.length; i++) {
        if (intersects[i].distance < playerRadius + 0.1) { canJump = true; break; }
    }

    // Portero visual
    if (keeperBody && keeperMesh) {
        keeperMesh.position.copy(keeperBody.position);
        keeperMesh.position.y -= KEEPER_PHYSICS_SIZE.y; 
        keeperMesh.quaternion.copy(keeperBody.quaternion);
    }
    
    // --- JUGADOR (MOVIMIENTO RELATIVO A LA CÁMARA) ---
    if (controls.isLocked) {
        // Obtener la dirección hacia donde mira la cámara
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;  // Anular movimiento vertical (para no volar al mirar al cielo)
        forward.normalize();

        // Obtener la dirección derecha relativa a la cámara
        const right = new THREE.Vector3();
        right.crossVectors(camera.up, forward).normalize(); // Producto cruz para sacar la derecha

        // Crear el vector de movimiento final sumando las teclas
        const moveVector = new THREE.Vector3(0, 0, 0);

        if (input.forward) moveVector.add(forward);       // W: Sumar vector frente
        if (input.backward) moveVector.sub(forward);      // S: Restar vector frente
        
        if (input.left) moveVector.add(right);            // A: Ir a la izquierda
        if (input.right) moveVector.sub(right);           // D: Ir a la derecha

        // Aplicar la velocidad al cuerpo físico
        if (moveVector.lengthSq() > 0) {
            moveVector.normalize(); // Evitar que moverse en diagonal sea más rápido
            playerBody.velocity.x = moveVector.x * PLAYER_SPEED;
            playerBody.velocity.z = moveVector.z * PLAYER_SPEED;
        } else {
            // Si no se tocan las teclas, frenar en seco (en X y Z)
            playerBody.velocity.x = 0;
            playerBody.velocity.z = 0;
        }
    }

    world.step(1/60, delta, 20);

    camera.position.copy(playerBody.position);
    camera.position.y += 2.2; 

    for (let i = 0; i < ballBodies.length; i++) {
        balls[i].position.copy(ballBodies[i].position);
        balls[i].quaternion.copy(ballBodies[i].quaternion);
        // Goles
        if (!balls[i].userData.scored && 
            ballBodies[i].position.z < GOAL_Z_POS - 0.5 && 
            ballBodies[i].position.z > GOAL_Z_POS - NET_DEPTH && 
            ballBodies[i].position.x > -GOAL_WIDTH/2 && 
            ballBodies[i].position.x < GOAL_WIDTH/2 &&
            ballBodies[i].position.y < GOAL_HEIGHT) {
            score++; scoreDiv.innerHTML = 'GOLES: ' + score;
            balls[i].userData.scored = true; balls[i].material.color.setHex(0x00ff00);
        }
    }

    renderer.render(scene, camera);
}
animate();