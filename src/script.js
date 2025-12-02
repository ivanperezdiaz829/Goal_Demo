import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import * as CANNON from "cannon-es";

// -------------------------------------------------
// CONFIGURACIÓN GLOBAL
// -------------------------------------------------
const MAX_BALLS = 5;
const MAP_SIZE = 26;
const WALL_HEIGHT = 9;

// Configuración de la Portería
const GOAL_WIDTH = 10;
const GOAL_HEIGHT = 5;
const POST_THICKNESS = 0.2;
const GOAL_Z_POS = -7; 
const NET_DEPTH = 4; 

// Variables de Movimiento
const PLAYER_SPEED = 10;
const JUMP_FORCE = 5;

// -------------------------------------------------
// 1. ESCENA Y CÁMARA
// -------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111); 

const textureLoader = new THREE.TextureLoader();

// A. TEXTURAS
const grassTexture = textureLoader.load('../grass_texture.jpg');
grassTexture.wrapS = THREE.RepeatWrapping;
grassTexture.wrapT = THREE.RepeatWrapping;
grassTexture.repeat.set(4, 4);
grassTexture.colorSpace = THREE.SRGBColorSpace;

const concreteTexture = textureLoader.load('../Concrete.jpg');
concreteTexture.wrapS = THREE.RepeatWrapping;
concreteTexture.wrapT = THREE.RepeatWrapping;
concreteTexture.repeat.set(4, 2); 
concreteTexture.colorSpace = THREE.SRGBColorSpace;

const mapTexture = textureLoader.load('../metal.jpg');
mapTexture.wrapS = THREE.RepeatWrapping;
mapTexture.wrapT = THREE.RepeatWrapping;
mapTexture.repeat.set(1, 1);
mapTexture.colorSpace = THREE.SRGBColorSpace;

// Generador de red procedural
function createProceduralNetTexture(repeatX, repeatY) {
    const canvas = document.createElement('canvas');
    const size = 512; 
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = '#FFFFFF'; 
    ctx.lineWidth = 20; 
    ctx.beginPath();
    const step = 64; 
    const offset = ctx.lineWidth / 2;
    for (let i = offset; i <= size; i += step) {
        ctx.moveTo(i, 0); ctx.lineTo(i, size); 
        ctx.moveTo(0, i); ctx.lineTo(512, i); 
    }
    ctx.stroke();
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.minFilter = THREE.LinearMenuItemFilter; 
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

const netTextureBack = createProceduralNetTexture(10, 5); 
const netTextureSide = createProceduralNetTexture(4, 5); 
const netTextureTop = createProceduralNetTexture(10, 4);

// --- MATERIALES ---
const wallVisualMaterial = new THREE.MeshStandardMaterial({
    map: concreteTexture, roughness: 0.9, metalness: 0.1
});
const roofVisualMaterial = new THREE.MeshStandardMaterial({
    map: mapTexture, roughness: 0.5, side: THREE.DoubleSide
});
const goalPostMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.5
});
function createNetMaterial(texture) {
    return new THREE.MeshBasicMaterial({ 
        map: texture, transparent: true, side: THREE.DoubleSide, alphaTest: 0.5          
    });
}
const netMatBack = createNetMaterial(netTextureBack);
const netMatSide = createNetMaterial(netTextureSide);
const netMatTop  = createNetMaterial(netTextureTop);

// Cámara
const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 500);
// Ya no seteamos la posición de la cámara manualmente aquí, 
// la cámara seguirá al cuerpo físico del jugador.

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; 
document.body.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, document.body);

const info = document.createElement('div');
info.style.position = 'absolute';
info.style.top = '10px';
info.style.width = '100%';
info.style.textAlign = 'center';
info.style.color = '#fff';
info.style.fontFamily = 'sans-serif';
info.style.pointerEvents = 'none'; 
info.innerHTML = '<b>Click para Jugar</b><br>WASD: Moverse | ESPACIO: Saltar | Click: Disparar';
document.body.appendChild(info);

controls.addEventListener('lock', () => { info.style.display = 'none'; });
controls.addEventListener('unlock', () => { info.style.display = 'block'; });

// Luces
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.6));
const lampLight = new THREE.PointLight(0xffffff, 1, 50); 
lampLight.position.set(0, WALL_HEIGHT - 1, 0);
lampLight.castShadow = true;
scene.add(lampLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.2);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

// -------------------------------------------------
// 2. MUNDO FÍSICO
// -------------------------------------------------
const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -15, 0) // Gravedad un poco más fuerte para saltos rápidos
});
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;

// Materiales Físicos
const groundMaterial = new CANNON.Material("ground");
const ballMaterial = new CANNON.Material("ball");
// [NUEVO] Material resbaladizo para el jugador (Fricción 0 para que no se pegue a paredes)
const playerPhysicsMaterial = new CANNON.Material("player");

const ballGroundContact = new CANNON.ContactMaterial(groundMaterial, ballMaterial, {
    friction: 0.5, restitution: 0.6
});
world.addContactMaterial(ballGroundContact);

// Contacto Jugador-Suelo (Sin fricción para deslizar suave, sin rebote)
const playerGroundContact = new CANNON.ContactMaterial(groundMaterial, playerPhysicsMaterial, {
    friction: 0.0, 
    restitution: 0.0
});
world.addContactMaterial(playerGroundContact);

const balls = [];       
const ballBodies = [];  
let ballGeometry = null; 

// -------------------------------------------------
// 3. JUGADOR (Cuerpo Físico)
// -------------------------------------------------
const playerRadius = 0.8;
const playerBody = new CANNON.Body({
    mass: 70, // Peso humano
    material: playerPhysicsMaterial,
    fixedRotation: true, // IMPORTANTE: Para que no ruede como una pelota
    position: new CANNON.Vec3(0, 2, 10) // Posición inicial
});
const playerShape = new CANNON.Sphere(playerRadius);
playerBody.addShape(playerShape);
// Amortiguación para que no deslice eternamente al soltar teclas
playerBody.linearDamping = 0.9; 
world.addBody(playerBody);

// Lógica de Salto
let canJump = false;
// Evento: cuando el jugador toca algo (el suelo)
playerBody.addEventListener("collide", (e) => {
    // Comprobamos si el contacto es con el suelo (normal hacia arriba)
    const contactNormal = new CANNON.Vec3();
    const contactEquation = e.contact.equations[0];
    if (contactEquation) {
        if (contactEquation.bi === playerBody) {
            contactEquation.ni.negate(contactNormal);
        } else {
            contactNormal.copy(contactEquation.ni);
        }
        // Si el contacto apunta hacia arriba (eje Y), es suelo
        if (contactNormal.dot(new CANNON.Vec3(0, 1, 0)) > 0.5) {
            canJump = true;
        }
    }
});


// -------------------------------------------------
// 4. CONSTRUCCIÓN DEL MAPA
// -------------------------------------------------
const planeGeometry = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE);
const planeMaterial = new THREE.MeshStandardMaterial({ map: grassTexture, side: THREE.DoubleSide });
const floorMesh = new THREE.Mesh(planeGeometry, planeMaterial);
floorMesh.receiveShadow = true;
floorMesh.rotation.x = -Math.PI / 2;
scene.add(floorMesh);

const groundShape = new CANNON.Plane();
const groundBody = new CANNON.Body({ mass: 0, material: groundMaterial });
groundBody.addShape(groundShape);
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

function createWall(x, y, z, width, height, depth) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geo, wallVisualMaterial);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    const shape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
    const body = new CANNON.Body({ mass: 0, material: groundMaterial });
    body.addShape(shape);
    body.position.set(x, y, z);
    world.addBody(body);
}

const offset = MAP_SIZE / 2; 
createWall(0, WALL_HEIGHT/2, -offset, MAP_SIZE, WALL_HEIGHT, 1);
createWall(0, WALL_HEIGHT/2, offset, MAP_SIZE, WALL_HEIGHT, 1);
createWall(offset, WALL_HEIGHT/2, 0, 1, WALL_HEIGHT, MAP_SIZE);
createWall(-offset, WALL_HEIGHT/2, 0, 1, WALL_HEIGHT, MAP_SIZE);

function createGoalPart(x, y, z, w, h, d, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    scene.add(mesh);
    const body = new CANNON.Body({ mass: 0, material: groundMaterial });
    body.addShape(new CANNON.Box(new CANNON.Vec3(w/2, h/2, d/2)));
    body.position.set(x, y, z);
    world.addBody(body);
}

const halfGoalWidth = GOAL_WIDTH / 2;
const postY = GOAL_HEIGHT / 2;
createGoalPart(-halfGoalWidth, postY, GOAL_Z_POS, POST_THICKNESS, GOAL_HEIGHT, POST_THICKNESS, goalPostMaterial);
createGoalPart(halfGoalWidth, postY, GOAL_Z_POS, POST_THICKNESS, GOAL_HEIGHT, POST_THICKNESS, goalPostMaterial);
createGoalPart(0, GOAL_HEIGHT + POST_THICKNESS/2, GOAL_Z_POS, GOAL_WIDTH + POST_THICKNESS, POST_THICKNESS, POST_THICKNESS, goalPostMaterial);

function createNetWall(w, h, x, y, z, rotateX, rotateY, specificMaterial) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), specificMaterial);
    mesh.position.set(x, y, z);
    if(rotateX) mesh.rotation.x = rotateX;
    if(rotateY) mesh.rotation.y = rotateY;
    mesh.receiveShadow = true;
    mesh.renderOrder = 1; 
    scene.add(mesh);
    const thickness = 0.1;
    const body = new CANNON.Body({ mass: 0, material: groundMaterial });
    const shape = new CANNON.Box(new CANNON.Vec3(w/2, h/2, thickness/2));
    body.addShape(shape);
    body.position.set(x, y, z);
    if(rotateX) body.quaternion.setFromEuler(rotateX, 0, 0);
    if(rotateY) body.quaternion.setFromEuler(0, rotateY, 0);
    world.addBody(body);
}
const backNetZ = GOAL_Z_POS - NET_DEPTH; 
const midNetZ = GOAL_Z_POS - (NET_DEPTH / 2); 
createNetWall(GOAL_WIDTH, GOAL_HEIGHT, 0, GOAL_HEIGHT/2, backNetZ, 0, 0, netMatBack);
createNetWall(GOAL_WIDTH, NET_DEPTH, 0, GOAL_HEIGHT, midNetZ, -Math.PI/2, 0, netMatTop);
createNetWall(NET_DEPTH, GOAL_HEIGHT, -GOAL_WIDTH/2, GOAL_HEIGHT/2, midNetZ, 0, -Math.PI/2, netMatSide);
createNetWall(NET_DEPTH, GOAL_HEIGHT, GOAL_WIDTH/2, GOAL_HEIGHT/2, midNetZ, 0, Math.PI/2, netMatSide);

const roofGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE);
const roofMesh = new THREE.Mesh(roofGeo, roofVisualMaterial);
roofMesh.position.y = WALL_HEIGHT;
roofMesh.rotation.x = Math.PI / 2;
scene.add(roofMesh);
const roofShape = new CANNON.Plane();
const roofBody = new CANNON.Body({ mass: 0, material: groundMaterial });
roofBody.addShape(roofShape);
roofBody.quaternion.setFromEuler(Math.PI / 2, 0, 0); 
roofBody.position.y = WALL_HEIGHT;
world.addBody(roofBody);


// -------------------------------------------------
// 5. CARGA DE PELOTA
// -------------------------------------------------
const loader = new OBJLoader();
loader.load("../Ball.obj", (obj) => {
    obj.traverse((child) => {
        if (child.isMesh) {
            ballGeometry = child.geometry;
            ballGeometry.center();
        }
    });
});

function shootBall() {
    if (!ballGeometry) return;

    // 1. Gestión del límite de bolas
    if (balls.length >= MAX_BALLS) {
        const oldMesh = balls.shift();
        const oldBody = ballBodies.shift();
        scene.remove(oldMesh);
        if(oldMesh.material) oldMesh.material.dispose();
        world.removeBody(oldBody);
    }

    // 2. Crear Malla Visual
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff }); 
    const mesh = new THREE.Mesh(ballGeometry, material);
    mesh.scale.set(0.5, 0.5, 0.5); 
    mesh.castShadow = true;
    scene.add(mesh);
    balls.push(mesh);

    // 3. Crear Cuerpo Físico
    const shape = new CANNON.Sphere(0.5); 
    const body = new CANNON.Body({ mass: 5, material: ballMaterial });
    body.ccdSpeedThreshold = 1; 
    body.ccdIterations = 2;     
    body.addShape(shape);
    
    // --- AQUÍ ESTÁ EL CAMBIO CLAVE ---
    
    // A. Obtenemos la dirección hacia donde mira la cámara
    const shootDirection = new THREE.Vector3();
    camera.getWorldDirection(shootDirection); 

    // B. Calculamos la posición inicial
    // Sumamos la posición de la cámara + (Dirección * Distancia)
    // Usamos 1.5 unidades de distancia para asegurar que la pelota no choque con el cuerpo del jugador (radio 0.8)
    const spawnDistance = 1.5; 
    const spawnPos = new THREE.Vector3();
    spawnPos.copy(camera.position).add(shootDirection.clone().multiplyScalar(spawnDistance));

    body.position.copy(spawnPos);

    // C. Aplicamos la velocidad
    const velocity = 35; 
    body.velocity.set(
        shootDirection.x * velocity,
        shootDirection.y * velocity,
        shootDirection.z * velocity
    );

    // ----------------------------------

    world.addBody(body);
    ballBodies.push(body);
}

// -------------------------------------------------
// 6. INPUTS (WASD + SALTO + DISPARO)
// -------------------------------------------------
const input = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false
};

document.addEventListener('keydown', (e) => {
    switch(e.code) {
        case 'KeyW': input.forward = true; break;
        case 'KeyS': input.backward = true; break;
        case 'KeyA': input.left = true; break;
        case 'KeyD': input.right = true; break;
        case 'Space': 
            if(canJump) {
                playerBody.velocity.y = JUMP_FORCE; 
                canJump = false;
            }
            break;
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

document.addEventListener("mousedown", () => {
    if (controls.isLocked) shootBall();
    else controls.lock();
});

window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
});

// -------------------------------------------------
// 7. ANIMACIÓN Y FÍSICA
// -------------------------------------------------
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);
    
    // --- LÓGICA DE MOVIMIENTO FÍSICO ---
    if (controls.isLocked) {
        // 1. Obtenemos vectores locales de movimiento
        const inputVector = new THREE.Vector3(0, 0, 0);
        if (input.forward) inputVector.z -= 1;
        if (input.backward) inputVector.z += 1;
        if (input.left) inputVector.x -= 1;
        if (input.right) inputVector.x += 1;
        inputVector.normalize();

        // 2. Convertimos dirección local a dirección global basada en la cámara
        // Para que si miramos a la derecha y pulsamos W, vayamos a la derecha
        const euler = new THREE.Euler(0, camera.rotation.y, 0, 'YXZ');
        const direction = inputVector.applyEuler(euler);

        // 3. Aplicamos velocidad al cuerpo
        // Mantenemos la velocidad Y (gravedad/salto), solo cambiamos X y Z
        playerBody.velocity.x = direction.x * PLAYER_SPEED;
        playerBody.velocity.z = direction.z * PLAYER_SPEED;
    }

    world.step(1/60, delta, 20);

    // --- SINCRONIZACIÓN ---
    
    // 1. La cámara sigue al cuerpo físico
    camera.position.copy(playerBody.position);
    // Ajuste de altura de ojos (el cuerpo tiene radio 0.8, los ojos están un poco más arriba)
    camera.position.y += 0.6; 

    // 2. Balones
    for (let i = 0; i < ballBodies.length; i++) {
        balls[i].position.copy(ballBodies[i].position);
        balls[i].quaternion.copy(ballBodies[i].quaternion);
    }

    renderer.render(scene, camera);
}

animate();