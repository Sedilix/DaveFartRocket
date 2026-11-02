import * as THREE from 'three';
export class Dave {
    group;
    bodyMeshGroup; // for IK hip bounce without shifting collider root
    // Limbs and joints
    leftLegPivot;
    rightLegPivot;
    leftArmPivot;
    rightArmPivot;
    headGroup;
    // Mouth meshes
    smileMesh;
    shockedMesh;
    // Materials
    orangeShirtMat;
    pantsMat;
    shoeMat;
    skinMat;
    hairMat;
    eyesMat;
    // Propulsion gas puffs & debris
    gasPlumeGroup;
    activeGasPuffs = [];
    // Rapier physics
    rigidBody = null;
    collider = null;
    // Animation states
    walkPhase = 0;
    shockTimer = 0;
    isAirborne = false;
    altitude = 0;
    velocity = new THREE.Vector3();
    currentFartNumber = 1;
    constructor() {
        this.group = new THREE.Group();
        this.group.name = 'DaveRoot';
        // Materials with crisp flatShading
        this.orangeShirtMat = new THREE.MeshStandardMaterial({
            color: 0xff632b,
            flatShading: true,
            roughness: 0.6
        });
        this.pantsMat = new THREE.MeshStandardMaterial({
            color: 0x1f489c,
            flatShading: true,
            roughness: 0.7
        });
        this.shoeMat = new THREE.MeshStandardMaterial({
            color: 0x1c1c1c,
            flatShading: true,
            roughness: 0.8
        });
        this.skinMat = new THREE.MeshStandardMaterial({
            color: 0xf2c29b,
            flatShading: true,
            roughness: 0.5
        });
        this.hairMat = new THREE.MeshStandardMaterial({
            color: 0x4f301c,
            flatShading: true,
            roughness: 0.9
        });
        this.eyesMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
        // Inner group to hold hips & torso for IK hip bounce
        this.bodyMeshGroup = new THREE.Group();
        this.group.add(this.bodyMeshGroup);
        // 1. Build Legs & Shoes
        // Hip pivot is at y = 1.40. Legs are 1.20 long, shoes are 0.20 tall. Total = 1.40.
        // When upright and un-rotated, shoe bottom lands at exactly y = 0.00!
        this.leftLegPivot = this.createLegPivot(-0.24);
        this.rightLegPivot = this.createLegPivot(0.24);
        this.bodyMeshGroup.add(this.leftLegPivot);
        this.bodyMeshGroup.add(this.rightLegPivot);
        // 2. Build Torso (bright orange boxy t-shirt)
        // Sits above hips (y = 1.40 to y = 2.45)
        const torsoGeo = new THREE.BoxGeometry(0.88, 1.05, 0.52);
        const torsoMesh = new THREE.Mesh(torsoGeo, this.orangeShirtMat);
        torsoMesh.position.set(0, 1.40 + 1.05 / 2, 0); // y = 1.925
        torsoMesh.castShadow = true;
        torsoMesh.receiveShadow = true;
        this.bodyMeshGroup.add(torsoMesh);
        // Belt / shirt hem detail
        const beltGeo = new THREE.BoxGeometry(0.9, 0.08, 0.54);
        const beltMesh = new THREE.Mesh(beltGeo, new THREE.MeshStandardMaterial({ color: 0x181818, flatShading: true }));
        beltMesh.position.set(0, 1.41, 0);
        this.bodyMeshGroup.add(beltMesh);
        // 3. Build Arms (shoulders at y = 2.30)
        this.leftArmPivot = this.createArmPivot(-0.56);
        this.rightArmPivot = this.createArmPivot(0.56);
        this.bodyMeshGroup.add(this.leftArmPivot);
        this.bodyMeshGroup.add(this.rightArmPivot);
        // 4. Build Neck & Head
        this.headGroup = new THREE.Group();
        this.headGroup.position.set(0, 2.50, 0);
        this.bodyMeshGroup.add(this.headGroup);
        // Head block (faceted low-poly)
        const headGeo = new THREE.BoxGeometry(0.58, 0.62, 0.56);
        const headMesh = new THREE.Mesh(headGeo, this.skinMat);
        headMesh.position.set(0, 0.31, 0);
        headMesh.castShadow = true;
        this.headGroup.add(headMesh);
        // Brown hair (boxy cap + bangs)
        const hairGeo = new THREE.BoxGeometry(0.62, 0.20, 0.58);
        const hairMesh = new THREE.Mesh(hairGeo, this.hairMat);
        hairMesh.position.set(0, 0.55, 0);
        this.headGroup.add(hairMesh);
        // Brown beard/sideburns
        const beardGeo = new THREE.BoxGeometry(0.60, 0.22, 0.36);
        const beardMesh = new THREE.Mesh(beardGeo, this.hairMat);
        beardMesh.position.set(0, 0.16, 0.14);
        this.headGroup.add(beardMesh);
        // Brown mustache
        const mustacheGeo = new THREE.BoxGeometry(0.32, 0.08, 0.12);
        const mustacheMesh = new THREE.Mesh(mustacheGeo, this.hairMat);
        mustacheMesh.position.set(0, 0.26, 0.30);
        this.headGroup.add(mustacheMesh);
        // Blocky eyes
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);
        const leftEye = new THREE.Mesh(eyeGeo, this.eyesMat);
        leftEye.position.set(-0.16, 0.36, 0.30);
        const rightEye = new THREE.Mesh(eyeGeo, this.eyesMat);
        rightEye.position.set(0.16, 0.36, 0.30);
        this.headGroup.add(leftEye);
        this.headGroup.add(rightEye);
        // Dynamic mouth: Calm smile vs Shocked open rectangle
        const smileGeo = new THREE.BoxGeometry(0.20, 0.05, 0.04);
        this.smileMesh = new THREE.Mesh(smileGeo, new THREE.MeshBasicMaterial({ color: 0x6e2c2c }));
        this.smileMesh.position.set(0, 0.20, 0.30);
        this.headGroup.add(this.smileMesh);
        const shockedGeo = new THREE.BoxGeometry(0.24, 0.22, 0.08);
        this.shockedMesh = new THREE.Mesh(shockedGeo, new THREE.MeshBasicMaterial({ color: 0x111111 }));
        this.shockedMesh.position.set(0, 0.18, 0.30);
        this.shockedMesh.visible = false;
        this.headGroup.add(this.shockedMesh);
        // Gas plume group for particles
        this.gasPlumeGroup = new THREE.Group();
        this.group.add(this.gasPlumeGroup);
    }
    createLegPivot(xOffset) {
        const pivot = new THREE.Group();
        // Hip joint at y = 1.40
        pivot.position.set(xOffset, 1.40, 0);
        // Leg trouser segment (length 1.20, starts at 0, goes down to -1.20)
        const legGeo = new THREE.BoxGeometry(0.32, 1.20, 0.34);
        const legMesh = new THREE.Mesh(legGeo, this.pantsMat);
        legMesh.position.set(0, -0.60, 0);
        legMesh.castShadow = true;
        pivot.add(legMesh);
        // Shoe segment (height 0.20, starts at -1.20 down to -1.40)
        // Shoe sole sits at y = 1.40 - 1.40 = 0.00!
        const shoeGeo = new THREE.BoxGeometry(0.34, 0.20, 0.48);
        const shoeMesh = new THREE.Mesh(shoeGeo, this.shoeMat);
        shoeMesh.position.set(0, -1.30, 0.07);
        shoeMesh.castShadow = true;
        pivot.add(shoeMesh);
        return pivot;
    }
    createArmPivot(xOffset) {
        const pivot = new THREE.Group();
        // Shoulder joint at y = 2.30
        pivot.position.set(xOffset, 2.30, 0);
        // Orange short sleeve
        const sleeveGeo = new THREE.BoxGeometry(0.28, 0.35, 0.30);
        const sleeveMesh = new THREE.Mesh(sleeveGeo, this.orangeShirtMat);
        sleeveMesh.position.set(0, -0.175, 0);
        sleeveMesh.castShadow = true;
        pivot.add(sleeveMesh);
        // Peach arm and hand
        const forearmGeo = new THREE.BoxGeometry(0.22, 0.70, 0.24);
        const forearmMesh = new THREE.Mesh(forearmGeo, this.skinMat);
        forearmMesh.position.set(0, -0.65, 0);
        forearmMesh.castShadow = true;
        pivot.add(forearmMesh);
        return pivot;
    }
    initPhysics(physics) {
        if (!physics.ready)
            return;
        const { body, collider } = physics.createDaveCollider(this.group.position);
        this.rigidBody = body;
        this.collider = collider;
    }
    /**
     * Spawns propulsion low-poly gas burst directly beneath Dave
     */
    triggerFartVFX(fartNumber) {
        this.currentFartNumber = fartNumber;
        this.shockTimer = 1.8; // Open mouth in shock
        // 1. Spawns glowing yellow-green icosahedron gas sphere directly beneath Dave
        const scaleFactor = Math.min(6.5, 0.8 + Math.log2(Math.max(1, fartNumber)) * 0.45);
        const icosaGeo = new THREE.IcosahedronGeometry(0.45 * scaleFactor, 0);
        const icosaMat = new THREE.MeshStandardMaterial({
            color: 0xb5e523,
            emissive: 0x82b810,
            emissiveIntensity: 0.6,
            flatShading: true,
            roughness: 0.4
        });
        const mainBurst = new THREE.Mesh(icosaGeo, icosaMat);
        // Origin at Dave's hip/rear (y ~ 1.35, z ~ -0.3)
        mainBurst.position.set((Math.random() - 0.5) * 0.2, 1.35, -0.35);
        this.group.add(mainBurst);
        this.activeGasPuffs.push({
            mesh: mainBurst,
            velocity: new THREE.Vector3((Math.random() - 0.5) * 1.5, -2.5 - scaleFactor * 1.2, (Math.random() - 0.5) * 1.5),
            scaleSpeed: 2.2 * scaleFactor,
            rotationSpeed: new THREE.Vector3(3, 2, 4),
            life: 0,
            maxLife: 0.65
        });
        // 2. Trailing olive-green (#6b7c32) faceted smoke puffs downward
        const puffCount = Math.min(22, 4 + fartNumber);
        for (let i = 0; i < puffCount; i++) {
            const puffGeo = new THREE.DodecahedronGeometry(0.25 * (0.8 + Math.random() * 0.7) * (1 + scaleFactor * 0.25), 0);
            const puffMat = new THREE.MeshStandardMaterial({
                color: 0x6b7c32,
                roughness: 0.85,
                flatShading: true,
                transparent: true,
                opacity: 0.85
            });
            const puff = new THREE.Mesh(puffGeo, puffMat);
            puff.position.set((Math.random() - 0.5) * 0.6, 1.25 - Math.random() * 0.4, -0.3 + (Math.random() - 0.5) * 0.4);
            this.group.add(puff);
            const spread = 1.8 + scaleFactor * 0.5;
            this.activeGasPuffs.push({
                mesh: puff,
                velocity: new THREE.Vector3((Math.random() - 0.5) * spread, -(3.0 + Math.random() * 4.0 + scaleFactor * 2.0), (Math.random() - 0.5) * spread),
                scaleSpeed: 1.5 + Math.random() * 2.0,
                rotationSpeed: new THREE.Vector3(Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2),
                life: 0,
                maxLife: 0.8 + Math.random() * 0.7
            });
        }
    }
    update(dt, moveInput, physics) {
        const isMoving = Math.abs(moveInput.x) > 0.05 || Math.abs(moveInput.y) > 0.05;
        // Handle mouth shock timer
        if (this.shockTimer > 0) {
            this.shockTimer -= dt;
            this.shockedMesh.visible = true;
            this.smileMesh.visible = false;
            // Head tilt back in shock
            this.headGroup.rotation.x = -0.22;
        }
        else {
            this.shockedMesh.visible = false;
            this.smileMesh.visible = true;
            this.headGroup.rotation.x = 0;
        }
        if (this.isAirborne) {
            // Turn to face the chase camera (+z) so he never flies away showing his back or side
            this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, Math.round(this.group.rotation.y / (Math.PI * 2)) * Math.PI * 2, dt * 5);
            // BLAST / AIRBORNE POSE:
            // Both arms raised straight up in panic (rotation.x = Math.PI * 0.92) with dangling/kicking legs
            this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(this.leftArmPivot.rotation.x, -Math.PI * 0.88, dt * 8);
            this.leftArmPivot.rotation.z = THREE.MathUtils.lerp(this.leftArmPivot.rotation.z, -0.25, dt * 8);
            this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(this.rightArmPivot.rotation.x, -Math.PI * 0.88, dt * 8);
            this.rightArmPivot.rotation.z = THREE.MathUtils.lerp(this.rightArmPivot.rotation.z, 0.25, dt * 8);
            // Dangling/fluttering legs in wind
            const flailTime = performance.now() * 0.008;
            this.leftLegPivot.rotation.x = Math.sin(flailTime) * 0.35 + 0.15;
            this.leftLegPivot.rotation.z = -0.15;
            this.rightLegPivot.rotation.x = Math.cos(flailTime) * 0.35 + 0.15;
            this.rightLegPivot.rotation.z = 0.15;
            // Reset hip bounce offset when airborne
            this.bodyMeshGroup.position.y = THREE.MathUtils.lerp(this.bodyMeshGroup.position.y, 0, dt * 6);
            // Steer slightly while airborne
            if (isMoving) {
                this.group.position.x += moveInput.x * dt * 8;
                this.group.position.z -= moveInput.y * dt * 8;
            }
        }
        else {
            // GROUNDED WALK / IDLE POSE
            if (isMoving) {
                this.walkPhase += dt * 9.5;
                const swing = Math.sin(this.walkPhase) * 0.62;
                // Limb swing
                this.leftLegPivot.rotation.x = swing;
                this.leftLegPivot.rotation.z = 0;
                this.rightLegPivot.rotation.x = -swing;
                this.rightLegPivot.rotation.z = 0;
                this.leftArmPivot.rotation.x = -swing * 0.75;
                this.leftArmPivot.rotation.z = -0.08;
                this.rightArmPivot.rotation.x = swing * 0.75;
                this.rightArmPivot.rotation.z = 0.08;
                // CRITICAL INVERSE KINEMATICS REQUIREMENT:
                // Apply hip bounce: Math.abs(Math.sin(walkPhase)) * 0.12 so swinging feet never clip
                // through the street (y = 0.0) or curbs (y = 0.30)!
                // Legs are 1.4 long and swing +-0.62 rad about the hip, so the hip must DROP at full stride
                // (1.4 * (1 - cos)) to keep the feet on the ground; the shoe toe/heel dips a little extra.
                const legAngle = Math.abs(swing);
                this.bodyMeshGroup.position.y = -1.4 * (1 - Math.cos(legAngle)) + 0.14 * Math.sin(legAngle);
                // Face movement direction
                const angle = Math.atan2(moveInput.x, -moveInput.y);
                this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, angle, dt * 14);
                // Movement with Rapier CharacterController
                const walkSpeed = 5.2;
                const moveVec = new THREE.Vector3(moveInput.x * walkSpeed * dt, -9.81 * dt, -moveInput.y * walkSpeed * dt);
                if (this.rigidBody && this.collider && physics.ready) {
                    const controller = physics.getController();
                    if (controller) {
                        controller.computeColliderMovement(this.collider, moveVec);
                        const computed = controller.computedMovement();
                        const curr = this.rigidBody.translation();
                        const newPos = {
                            x: curr.x + computed.x,
                            y: curr.y + computed.y,
                            z: curr.z + computed.z
                        };
                        this.rigidBody.setNextKinematicTranslation(newPos);
                        // Dave origin is at shoe soles (y = center.y - 1.35)
                        this.group.position.set(newPos.x, newPos.y - 1.37, newPos.z); // 0.02 = character controller skin offset
                    }
                    else {
                        this.group.position.add(new THREE.Vector3(moveVec.x, 0, moveVec.z));
                    }
                }
                else {
                    this.group.position.x += moveVec.x;
                    this.group.position.z += moveVec.z;
                }
            }
            else {
                // IDLE POSE
                this.leftLegPivot.rotation.set(0, 0, 0);
                this.rightLegPivot.rotation.set(0, 0, 0);
                this.leftArmPivot.rotation.set(0, 0, -0.06);
                this.rightArmPivot.rotation.set(0, 0, 0.06);
                this.bodyMeshGroup.position.y = THREE.MathUtils.lerp(this.bodyMeshGroup.position.y, 0, dt * 8);
                // Gentle breathing motion
                const breathe = -Math.abs(Math.sin(performance.now() * 0.003)) * 0.015; // never lifts the shoes off the ground
                this.bodyMeshGroup.position.y += breathe;
            }
        }
        // Update active gas puffs
        for (let i = this.activeGasPuffs.length - 1; i >= 0; i--) {
            const p = this.activeGasPuffs[i];
            p.life += dt;
            if (p.life >= p.maxLife) {
                this.group.remove(p.mesh);
                p.mesh.geometry.dispose();
                if (Array.isArray(p.mesh.material)) {
                    p.mesh.material.forEach((m) => m.dispose());
                }
                else {
                    p.mesh.material.dispose();
                }
                this.activeGasPuffs.splice(i, 1);
                continue;
            }
            // Move particle
            p.mesh.position.addScaledVector(p.velocity, dt);
            p.mesh.rotation.x += p.rotationSpeed.x * dt;
            p.mesh.rotation.y += p.rotationSpeed.y * dt;
            p.mesh.rotation.z += p.rotationSpeed.z * dt;
            // Expand particle
            const scaleDelta = 1 + p.scaleSpeed * dt;
            p.mesh.scale.multiplyScalar(scaleDelta);
            // Fade particle
            const alpha = 1 - p.life / p.maxLife;
            const mat = p.mesh.material;
            if (mat.transparent) {
                mat.opacity = alpha;
            }
        }
    }
    setShoeSolePosition(x, y, z) {
        this.group.position.set(x, y, z);
        if (this.rigidBody) {
            this.rigidBody.setTranslation({ x, y: y + 1.35, z }, true);
        }
    }
}
//# sourceMappingURL=Dave.js.map