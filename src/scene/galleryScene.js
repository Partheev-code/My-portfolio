import * as THREE from 'three';

// Simple pseudo-random hash for procedural generation
function hash(x, z) {
  return Math.sin(x * 12.9898 + z * 78.233) * 43758.5453 % 1;
}

// Simple fractal noise using sines
function getNoise(x, z) {
  let y = 0;
  y += Math.sin(x * 0.05) * Math.cos(z * 0.05) * 20;
  y += Math.sin(x * 0.1 + 5) * Math.cos(z * 0.1 + 3) * 10;
  y += Math.sin(x * 0.2) * Math.cos(z * 0.2) * 5;
  return y;
}

export function createGalleryScene(scene) {
  const galleryGroup = new THREE.Group();
  
  // Placed far away to avoid universe overlap
  galleryGroup.visible = false;
  galleryGroup.position.set(0, -10000, 0);
  scene.add(galleryGroup);

  // ── 1. Atmosphere & Soft Daylight ──
  
  // A glowing, cool bright daylight ambient
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  galleryGroup.add(ambientLight);

  // The pale golden sun passing through the atmosphere
  const sunLight = new THREE.DirectionalLight(0xffffee, 2.0);
  sunLight.position.set(150, 60, -200); // Lowered slightly to cast elegant shadows
  sunLight.target.position.set(0, 0, 0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 600;
  sunLight.shadow.camera.left = -150;
  sunLight.shadow.camera.right = 150;
  sunLight.shadow.camera.top = 150;
  sunLight.shadow.camera.bottom = -150;
  sunLight.shadow.bias = -0.0005;
  galleryGroup.add(sunLight);
  galleryGroup.add(sunLight.target);

  // Physical sun sphere in the sky representing the soft daytime star
  const sunGeo = new THREE.SphereGeometry(15, 32, 32);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const sunMesh = new THREE.Mesh(sunGeo, sunMat);
  sunMesh.position.copy(sunLight.position);
  galleryGroup.add(sunMesh);

  // ── 1.5 Realistic Local Gradient Sky Dome ──
  // Matches a deep blue zenith to a lighter cyan horizon, calculated purely locally!
  const skyGeo = new THREE.SphereGeometry(1500, 32, 15);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(0x0a5cff) },    // Rich deeply vibrant blue
      bottomColor: { value: new THREE.Color(0x6bc4ff) }, // Bright beautiful sky-cyan
      exponent: { value: 0.6 }
    },
    vertexShader: `
      varying vec3 vLocalPosition;
      void main() {
        // We use local position because the entire gallery is at y = -10000!
        // World position would shatter the gradient math.
        vLocalPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float exponent;
      varying vec3 vLocalPosition;
      void main() {
        // normalize gives us a clean -1.0 to 1.0 across the sphere height natively
        float h = normalize(vLocalPosition).y;
        // Make sure we only blend from the horizon (0.0) upwards to zenith (1.0)
        float blend = max(pow(max(h, 0.0), exponent), 0.0);
        gl_FragColor = vec4(mix(bottomColor, topColor, blend), 1.0);
      }
    `,
    side: THREE.BackSide
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  galleryGroup.add(sky);

  // ── 2. Procedural Rolling Emerald Hills ──
  
  const terrainSize = 400;
  const segments = 100;
  const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, segments, segments);
  terrainGeo.rotateX(-Math.PI / 2);

  const posAttr = terrainGeo.attributes.position;
  const waterLevel = 2; // Everything below this becomes a lake

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    
    // Create rolling hills
    let y = getNoise(x, z);

    // Carve a smooth valley for the lake
    const distFromCenter = Math.sqrt(x*x + z*z);
    if (distFromCenter < 60) {
      const basin = Math.cos((distFromCenter / 60) * Math.PI) * 15;
      y -= Math.max(0, basin);
    }
    
    // Create a mountain peak towards the back right
    const distFromPeak = Math.sqrt(Math.pow(x - 100, 2) + Math.pow(z + 100, 2));
    if (distFromPeak < 120) {
      y += Math.pow(1 - (distFromPeak/120), 2) * 80;
    }

    posAttr.setY(i, y);
  }

  terrainGeo.computeVertexNormals();

  // Vibrant Emerald grass material matching the specific bright lime green seen in the user's image
  const terrainMat = new THREE.MeshStandardMaterial({
    color: 0x58c414, // Vivid bright lime/emerald green
    roughness: 0.9,
    metalness: 0.02,
    flatShading: true // Low-poly vibe
  });

  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.receiveShadow = true;
  terrain.castShadow = true;
  galleryGroup.add(terrain);

  // ── 3. Hyper-Realistic Animated Ocean/Lake ──
  
  const waterGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, 50, 50);
  waterGeo.rotateX(-Math.PI / 2);
  
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x189eaa, // Turquoise/teal typical of alpine lakes
    transmission: 0.9, 
    opacity: 1,
    metalness: 0.1,
    roughness: 0.0, // Crystal glossy mirror surface reflecting clouds!
    ior: 1.33,       
    thickness: 5.0,  
    side: THREE.DoubleSide
  });

  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.y = waterLevel; 
  water.receiveShadow = true;
  galleryGroup.add(water);

  const waterPos = water.geometry.attributes.position;
  const initialWaterY = new Float32Array(waterPos.count);
  for(let i = 0; i < waterPos.count; i++) {
    initialWaterY[i] = waterPos.getY(i);
  }

  // ── 4. Procedural Stylized Forest ──

  function createTree(x, z, scale) {
    const treeGroup = new THREE.Group();
    
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6e4b36, roughness: 1.0 });
    const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 3);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.5;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    treeGroup.add(trunk);

    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x2b6a22, flatShading: true, roughness: 0.8 });
    for(let i=0; i<3; i++) {
      const coneGeo = new THREE.ConeGeometry(3 - i*0.6, 4, 7);
      const cone = new THREE.Mesh(coneGeo, leavesMat);
      cone.position.y = 3.5 + i*2;
      cone.castShadow = true;
      treeGroup.add(cone);
    }
    
    let y = getNoise(x, z);
    const distFromCenter = Math.sqrt(x*x + z*z);
    if (distFromCenter < 60) {
        const basin = Math.cos((distFromCenter / 60) * Math.PI) * 15;
        y -= Math.max(0, basin);
    }
    const peakDist = Math.sqrt(Math.pow(x - 100, 2) + Math.pow(z + 100, 2));
    if (peakDist < 120) y += Math.pow(1 - (peakDist/120), 2) * 80;

    if (y > waterLevel + 1) {
      treeGroup.position.set(x, y, z);
      treeGroup.scale.setScalar(scale);
      galleryGroup.add(treeGroup);
    }
  }

  for(let i=0; i<150; i++) {
    const tx = (Math.random() - 0.5) * 350;
    const tz = (Math.random() - 0.5) * 350;
    const scale = 0.8 + Math.random() * 0.6;
    createTree(tx, tz, scale);
  }

  // ── 5. (Project showcases removed — shown via HTML sidebar overlay) ──

  // ── 6. Procedural Clouds ──
  const clouds = [];
  const cloudGeo = new THREE.DodecahedronGeometry(8, 1);
  // Using Lambert with a slight emissive boosts the whiteness so shadows aren't too gray
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x333333, flatShading: true });
  
  for (let i = 0; i < 15; i++) {
    const cluster = new THREE.Group();
    // A cloud is just a cluster of intersecting spheres
    for (let c = 0; c < 4 + Math.random() * 4; c++) {
      const puff = new THREE.Mesh(cloudGeo, cloudMat);
      puff.position.set(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 15
      );
      puff.scale.set(1, 0.6 + Math.random()*0.4, 1); // Flatten slightly
      puff.castShadow = true;
      cluster.add(puff);
    }
    
    // Position high in the sky backing up over the distant mountains (z between -100 and -250)
    cluster.position.set(
      (Math.random() - 0.5) * 350,
      60 + Math.random() * 30,
      -100 - Math.random() * 150
    );
    // Give each cloud a random drifting speed primarily to the side
    cluster.userData.speedX = 0.02 + Math.random() * 0.04;
    cluster.userData.speedZ = (Math.random() - 0.5) * 0.01;
    clouds.push(cluster);
    galleryGroup.add(cluster);
  }

  // ── 7. Flapping Birds ──
  const birds = [];
  const flockCenter = new THREE.Vector3(0, 50, 0); // Flying circularly above lake
  const birdGeo = new THREE.ConeGeometry(0.5, 2, 4);
  birdGeo.rotateX(Math.PI / 2); // point forward
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

  for (let i = 0; i < 20; i++) {
    const bird = new THREE.Group();
    
    // Body
    const body = new THREE.Mesh(birdGeo, birdMat);
    bird.add(body);
    
    // Left Wing (We make it a thin angled plane pointing out)
    const wingGeo = new THREE.PlaneGeometry(3, 1.5);
    wingGeo.translate(1.5, 0, 0); // Pivot at the body
    const lWing = new THREE.Mesh(wingGeo, birdMat);
    lWing.rotation.x = -Math.PI / 2; // Flat
    bird.add(lWing);
    
    // Right Wing
    const rWing = new THREE.Mesh(wingGeo, birdMat);
    rWing.rotation.x = -Math.PI / 2;
    rWing.scale.x = -1; // Mirror it!
    bird.add(rWing);

    bird.position.set(
      (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 30
    );
    
    bird.userData = {
      lWing, rWing, 
      flapSpeed: 10 + Math.random() * 5,
      phaseOffset: Math.random() * Math.PI * 2,
      orbitSpeed: 0.2 + Math.random() * 0.1,
      orbitRadius: 40 + Math.random() * 30,
      orbitAngle: Math.random() * Math.PI * 2,
      baseY: 45 + Math.random() * 15
    };
    
    birds.push(bird);
    galleryGroup.add(bird);
  }

  // Camera faces the curved arc of project showcases from a comfortable viewing distance
  const groundAtStart = getNoise(0, 20);
  const cameraStartPos = new THREE.Vector3(0, groundAtStart + 6, 20);
  const cameraTarget   = new THREE.Vector3(0, groundAtStart + 4, -30);

  function updateGallery(elapsed) {
      if (!galleryGroup.visible) return;

      // Water Ripple
      const time = elapsed * 1.5;
      const count = waterPos.count;
      for (let i = 0; i < count; i++) {
          const x = waterPos.getX(i);
          const z = waterPos.getZ(i);
          const wave = Math.sin(x * 0.2 + time) * 0.2 + Math.cos(z * 0.2 + time) * 0.2;
          waterPos.setY(i, initialWaterY[i] + wave);
      }
      waterPos.needsUpdate = true;

      // Cloud Drift
      clouds.forEach(cloud => {
        cloud.position.x += cloud.userData.speedX;
        cloud.position.z += cloud.userData.speedZ;
        // Wrap around if they drift too far
        if (cloud.position.x > 250) cloud.position.x = -250;
        if (cloud.position.x < -250) cloud.position.x = 250;
        if (cloud.position.z > 250) cloud.position.z = -250;
        if (cloud.position.z < -250) cloud.position.z = 250;
      });

      // Bird Flapping & Circling
      birds.forEach(bird => {
        const u = bird.userData;
        // The wings flap up and down along the Z axis (which points local UP since we rotated the wing flat)
        // Wait, the wing is rotated -Math.PI/2 on X so it lies flat on the XZ plane.
        // Therefore, rotating along Z tilts the wing UP and DOWN like a flap!
        const flapAmount = Math.sin(elapsed * u.flapSpeed + u.phaseOffset) * 0.5;
        u.lWing.rotation.y = flapAmount;
        u.rWing.rotation.y = -flapAmount;

        // Circular Orbiting
        u.orbitAngle += u.orbitSpeed * 0.016; // approx delta
        bird.position.x = flockCenter.x + Math.cos(u.orbitAngle) * u.orbitRadius;
        bird.position.z = flockCenter.z + Math.sin(u.orbitAngle) * u.orbitRadius;
        
        // Gentle bobbing height
        bird.position.y = u.baseY + Math.sin(elapsed * 2 + u.phaseOffset) * 2;
        
        // Aim Bird exactly along its tangent flight path (so it points forward while flying)
        const tangentX = -Math.sin(u.orbitAngle);
        const tangentZ = Math.cos(u.orbitAngle);
        bird.rotation.y = Math.atan2(tangentX, tangentZ);
      });
  }

  return {
    galleryGroup,
    cameraStartPos,
    cameraTarget,
    updateGallery
  };
}

