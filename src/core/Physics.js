import RAPIER from '@dimforge/rapier3d-compat';
export class PhysicsWorld {
    world;
    ready = false;
    characterController = null;
    staticColliders = [];
    async init() {
        await RAPIER.init();
        // Gravity: standard Earth gravity down
        const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
        this.world = new RAPIER.World(gravity);
        // Initialize character controller with auto-step up curbs (0.35m height, 0.2m min width) and ground snap
        this.characterController = this.world.createCharacterController(0.02);
        this.characterController.enableAutostep(0.38, 0.25, true);
        this.characterController.enableSnapToGround(0.35);
        this.characterController.setSlideEnabled(true);
        this.characterController.setMaxSlopeClimbAngle((55 * Math.PI) / 180);
        this.characterController.setMinSlopeSlideAngle((60 * Math.PI) / 180);
        this.ready = true;
    }
    getController() {
        return this.characterController;
    }
    createBoxCollider(pos, halfExtents, isKinematic = false) {
        const bodyDesc = isKinematic
            ? RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y, pos.z)
            : RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z);
        const body = this.world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z);
        const collider = this.world.createCollider(colliderDesc, body);
        this.staticColliders.push(collider);
        return { body, collider };
    }
    /** Remove a static collider (and its rigid body) previously made by createBoxCollider. */
    removeCollider(handle) {
        const i = this.staticColliders.indexOf(handle.collider);
        if (i >= 0)
            this.staticColliders.splice(i, 1);
        // Removing the rigid body also removes its attached colliders
        this.world.removeRigidBody(handle.body);
    }
    createDaveCollider(pos) {
        // Dave's feet at y = 0. Total height is ~2.7m (head top).
        // Capsule/cylinder collider: radius 0.45m, halfHeight 0.90m. Center at y = 1.35m.
        const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y + 1.35, pos.z);
        const body = this.world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.capsule(0.9, 0.45);
        const collider = this.world.createCollider(colliderDesc, body);
        return { body, collider };
    }
    step(dt) {
        if (!this.ready)
            return;
        this.world.timestep = Math.min(dt, 0.05);
        this.world.step();
    }
}
export const physicsWorld = new PhysicsWorld();
//# sourceMappingURL=Physics.js.map