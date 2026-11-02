import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

/** Character controller skin: the capsule rests this far above the ground. */
export const CONTROLLER_SKIN = 0.02;

export class PhysicsWorld {
  public world!: RAPIER.World;
  public ready = false;
  private characterController: RAPIER.KinematicCharacterController | null = null;

  async init(): Promise<void> {
    await RAPIER.init();
    // Gravity: standard Earth gravity down
    const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
    this.world = new RAPIER.World(gravity);

    // Initialize character controller with auto-step up curbs (0.35m height, 0.2m min width) and ground snap
    this.characterController = this.world.createCharacterController(CONTROLLER_SKIN);
    this.characterController.enableAutostep(0.38, 0.25, true);
    this.characterController.enableSnapToGround(0.35);
    this.characterController.setSlideEnabled(true);
    this.characterController.setMaxSlopeClimbAngle((55 * Math.PI) / 180);
    this.characterController.setMinSlopeSlideAngle((60 * Math.PI) / 180);

    this.ready = true;
  }

  public getController(): RAPIER.KinematicCharacterController | null {
    return this.characterController;
  }

  public createBoxCollider(
    pos: THREE.Vector3,
    halfExtents: THREE.Vector3,
    isKinematic = false
  ): { body: RAPIER.RigidBody; collider: RAPIER.Collider } {
    const bodyDesc = isKinematic
      ? RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y, pos.z)
      : RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z);

    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z);
    const collider = this.world.createCollider(colliderDesc, body);
    return { body, collider };
  }

  /** Fixed upright cylinder collider (round café tables). `pos` is the cylinder centre. */
  public createCylinderCollider(
    pos: THREE.Vector3,
    halfHeight: number,
    radius: number
  ): { body: RAPIER.RigidBody; collider: RAPIER.Collider } {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z));
    const collider = this.world.createCollider(RAPIER.ColliderDesc.cylinder(halfHeight, radius), body);
    return { body, collider };
  }

  /** Remove a static collider (and its rigid body) previously made by createBoxCollider. */
  public removeCollider(handle: { body: RAPIER.RigidBody; collider: RAPIER.Collider }) {
    // Removing the rigid body also removes its attached colliders
    this.world.removeRigidBody(handle.body);
  }

  public createDaveCollider(pos: THREE.Vector3): { body: RAPIER.RigidBody; collider: RAPIER.Collider } {
    // Dave's feet at y = 0. Total height is ~2.7m (head top).
    // Capsule collider: radius 0.45m, halfHeight 0.90m. Centre at 1.35m plus the controller skin,
    // which is where the character controller leaves it when standing on the ground.
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
      pos.x,
      pos.y + DAVE_CENTER_Y,
      pos.z
    );
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.capsule(0.9 * DAVE_SCALE, 0.45 * DAVE_SCALE);
    const collider = this.world.createCollider(colliderDesc, body);
    return { body, collider };
  }

  /**
   * True when Dave's capsule, centred at (x, y, z), overlaps no collider other than `ignore`.
   * Used to pick a free touchdown spot (parked cars, café tables, moving cars).
   */
  public isCapsuleFree(x: number, y: number, z: number, ignore?: RAPIER.RigidBody): boolean {
    if (!this.ready) return true;
    const hit = this.world.intersectionWithShape(
      { x, y, z },
      { x: 0, y: 0, z: 0, w: 1 },
      new RAPIER.Capsule(0.9 * DAVE_SCALE, 0.45 * DAVE_SCALE),
      undefined,
      undefined,
      undefined,
      ignore
    );
    return hit === null;
  }

  public step(dt: number) {
    if (!this.ready) return;
    this.world.timestep = Math.max(0.001, Math.min(dt, 0.05));
    this.world.step();
  }
}

/** Height of the capsule centre above the shoe soles while standing. */
/** Dave is modelled ~3.2 m tall; scaled to 1.78 m (a typical adult) next to cars and doors. */
export const DAVE_SCALE = 0.56;
export const DAVE_CENTER_Y = 1.35 * DAVE_SCALE + CONTROLLER_SKIN;

export const physicsWorld = new PhysicsWorld();
