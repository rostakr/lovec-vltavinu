export function prepareSpriteTexture(texture, cloneTexture = true) {
  if (!texture) return null;
  const spriteTexture = cloneTexture ? texture.clone?.() ?? texture : texture;
  if (!Number.isInteger(spriteTexture.channel) || spriteTexture.channel < 0) spriteTexture.channel = 0;
  if (spriteTexture !== texture) spriteTexture.needsUpdate = true;
  return spriteTexture;
}

export function prepareTerrainPlateTexture(texture, THREE, cloneTexture = true) {
  if (!texture) return null;
  const plateTexture = cloneTexture ? texture.clone?.() ?? texture : texture;
  if (!Number.isInteger(plateTexture.channel) || plateTexture.channel < 0) plateTexture.channel = 0;
  if (THREE?.ClampToEdgeWrapping !== undefined) {
    plateTexture.wrapS = THREE.ClampToEdgeWrapping;
    plateTexture.wrapT = THREE.ClampToEdgeWrapping;
  }
  plateTexture.repeat?.set?.(1, 1);
  plateTexture.offset?.set?.(0, 0);
  if (plateTexture !== texture) plateTexture.needsUpdate = true;
  return plateTexture;
}

export class HybridRenderer {
  constructor(options = {}) {
    const THREE = options.three;
    if (!THREE?.WebGLRenderer || !THREE?.Scene || !THREE?.OrthographicCamera) {
      throw new TypeError("HybridRenderer requires an injected Three.js namespace.");
    }
    if (!options.canvas) throw new TypeError("HybridRenderer requires a canvas element.");

    this.THREE = THREE;
    this.canvas = options.canvas;
    this.viewHeight = options.viewHeight ?? 720;
    this.pixelRatioCap = options.pixelRatioCap ?? 2;
    this.clearColor = options.clearColor ?? 0x08150e;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: false,
      antialias: options.antialias !== false,
      powerPreference: options.powerPreference ?? "high-performance"
    });
    this.renderer.setClearColor(this.clearColor, 1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, options.near ?? -1000, options.far ?? 1000);
    this.camera.position.set(0, 0, 100);
    this.camera.lookAt(0, 0, 0);

    this.layers = {
      ground: new THREE.Group(),
      props: new THREE.Group(),
      actors: new THREE.Group(),
      foreground: new THREE.Group(),
      effects: new THREE.Group()
    };
    this.layers.ground.renderOrder = 0;
    this.layers.props.renderOrder = 10;
    this.layers.actors.renderOrder = 20;
    this.layers.foreground.renderOrder = 30;
    this.layers.effects.renderOrder = 40;
    for (const layer of Object.values(this.layers)) this.scene.add(layer);

    this.width = 1;
    this.height = 1;
    this.pixelRatio = 1;
    this.resize(options.width ?? 1, options.height ?? 1, options.pixelRatio);
  }

  resize(width, height, pixelRatio = globalThis.devicePixelRatio ?? 1) {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.pixelRatio = Math.max(1, Math.min(this.pixelRatioCap, pixelRatio || 1));

    const aspect = this.width / this.height;
    const halfHeight = this.viewHeight / 2;
    const halfWidth = halfHeight * aspect;
    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.width, this.height, false);
    return { width: this.width, height: this.height, pixelRatio: this.pixelRatio, aspect };
  }

  setCameraCenter(x, y, zoom = 1) {
    this.camera.position.x = Number(x) || 0;
    this.camera.position.y = Number(y) || 0;
    this.camera.zoom = Math.max(0.05, Number(zoom) || 1);
    this.camera.updateProjectionMatrix();
  }

  add(object, layer = "actors") {
    const target = this.layers[layer];
    if (!target) throw new Error(`Unknown render layer: ${layer}`);
    target.add(object);
    return object;
  }

  remove(object) {
    if (!object?.parent) return false;
    object.parent.remove(object);
    return true;
  }

  createSprite(textureSource, options = {}) {
    const material = new this.THREE.SpriteMaterial({
      map: null,
      transparent: options.transparent !== false,
      alphaTest: options.alphaTest ?? 0.01,
      depthWrite: options.depthWrite ?? false,
      depthTest: options.depthTest ?? true,
      color: options.color ?? 0xffffff
    });
    const sprite = new this.THREE.Sprite(material);
    sprite.position.set(options.x ?? 0, options.y ?? 0, options.z ?? 0);
    sprite.scale.set(options.width ?? 64, options.height ?? 64, 1);
    sprite.center.set(options.anchorX ?? 0.5, options.anchorY ?? 0);
    sprite.userData.assetId = options.assetId ?? null;
    sprite.userData.baseScaleX = Math.abs(sprite.scale.x);

    const applyTexture = texture => {
      material.map = prepareSpriteTexture(texture, options.cloneTexture !== false);
      material.needsUpdate = true;
      return material.map;
    };
    if (textureSource?.then instanceof Function) {
      sprite.userData.textureReady = Promise.resolve(textureSource).then(applyTexture);
    } else {
      applyTexture(textureSource);
      sprite.userData.textureReady = Promise.resolve(material.map);
    }
    return sprite;
  }

  createTerrainPlate(textureSource, options = {}) {
    const width = Math.max(1, Number(options.width) || 1);
    const height = Math.max(1, Number(options.height) || 1);
    const material = new this.THREE.MeshBasicMaterial({
      map: null,
      transparent: options.transparent === true,
      opacity: options.opacity ?? 1,
      depthWrite: options.depthWrite !== false,
      depthTest: options.depthTest !== false,
      color: options.color ?? 0xffffff
    });
    const plate = new this.THREE.Mesh(new this.THREE.PlaneGeometry(width, height), material);
    const originX = Number(options.x) || 0;
    const originY = Number(options.y) || 0;
    plate.position.set(originX + width / 2, originY + height / 2, options.z ?? -10);
    plate.userData.assetId = options.assetId ?? null;
    plate.userData.terrainPlate = true;

    const applyTexture = texture => {
      material.map = prepareTerrainPlateTexture(texture, this.THREE, options.cloneTexture !== false);
      material.needsUpdate = true;
      return material.map;
    };
    if (textureSource?.then instanceof Function) {
      plate.userData.textureReady = Promise.resolve(textureSource).then(applyTexture);
    } else {
      applyTexture(textureSource);
      plate.userData.textureReady = Promise.resolve(material.map);
    }
    return plate;
  }

  createGroup(options = {}) {
    const group = new this.THREE.Group();
    group.position.set(options.x ?? 0, options.y ?? 0, options.z ?? 0);
    group.scale.setScalar(options.scale ?? 1);
    group.rotation.z = options.rotation ?? 0;
    return group;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  disposeObject(object) {
    object?.traverse?.(node => {
      node.geometry?.dispose?.();
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        if (!material) continue;
        for (const value of Object.values(material)) {
          if (value?.isTexture) value.dispose?.();
        }
        material.dispose?.();
      }
    });
  }

  dispose() {
    for (const layer of Object.values(this.layers)) {
      for (const child of [...layer.children]) {
        layer.remove(child);
        this.disposeObject(child);
      }
    }
    this.renderer.dispose();
  }
}
