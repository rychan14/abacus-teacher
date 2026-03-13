import * as THREE from 'three'
import type { AbacusColumn, BeadStep } from './abacus'
import { playBeadSound, triggerHaptic } from './feedback'

export interface SceneRefs {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  frameId: number
}
export interface RodMeshes {
  heavenBead: THREE.Mesh
  earthBeads: THREE.Mesh[]
}
const NUM_RODS = 5
const ROD_SPACING = 2.8
const ROD_HEIGHT = 10
const BEAD_RADIUS_X = 1.2
const BEAD_RADIUS_Y = 0.6

// Y positions
export const HEAVEN_HOME_Y = 2.6
export const HEAVEN_ACTIVE_Y = 1.5
export const EARTH_HOME_BASE_Y = -1.2
export const EARTH_ACTIVE_BASE_Y = 0
export const EARTH_STEP = 0.9

const FRAME_COLOR = 0x2a1a0e
const BEAM_COLOR = 0x1a1a1a
const ACCENT_COLORS = [0xc8a97e, 0xd4956b, 0xe8b87a, 0xc47e4a, 0xa0522d]
const HEAVEN_COLOR = 0xff8c00
const ACTIVE_EMISSIVE = 0xff4500

export function buildScene(container: HTMLDivElement): SceneRefs {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0d0d0d)

  const w = container.clientWidth || 800
  const h = container.clientHeight || 600
  const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000)
  camera.position.set(0, 0, 35)
  camera.lookAt(0, 0, 0)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setClearColor(0x0d0d0d, 1) // Solid dark background for visibility
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  // Ensure canvas fills container and is the only child
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'

  container.replaceChildren(renderer.domElement)

  // Lighting (kept for when we switch back to StandardMaterial)
  const ambient = new THREE.AmbientLight(0xffffff, 1.0)
  scene.add(ambient)

  const key = new THREE.DirectionalLight(0xffffff, 1.5)
  key.position.set(5, 15, 10)
  scene.add(key)

  const fill = new THREE.PointLight(0x4444ff, 0.4)
  fill.position.set(-8, -2, 6)
  scene.add(fill)

  const rim = new THREE.PointLight(0xff8833, 0.6)
  rim.position.set(0, -6, -5)
  scene.add(rim)

  let frameId = 0
  const tick = () => {
    frameId = requestAnimationFrame(tick)
    renderer.render(scene, camera)
  }
  tick()

  return { renderer, scene, camera, frameId }
}

export function setupInteraction(
  container: HTMLDivElement,
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  rods: RodMeshes[],
  getColumns: () => AbacusColumn[],
  onManualChange: (colIndex: number, heaven: boolean, earth: number) => void,
) {
  const raycaster = new THREE.Raycaster()
  const mouse = new THREE.Vector2()
  let selectedBead: THREE.Mesh | null = null
  let initialY = 0
  let initialMouseY = 0
  let isDragging = false

  const getMousePos = (e: MouseEvent | TouchEvent) => {
    const rect = container.getBoundingClientRect()
    const clientX =
      'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
    const clientY =
      'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY
    return {
      x: ((clientX - rect.left) / rect.width) * 2 - 1,
      y: -((clientY - rect.top) / rect.height) * 2 + 1,
      rawY: clientY,
    }
  }

  const onStart = (e: MouseEvent | TouchEvent) => {
    const pos = getMousePos(e)
    mouse.x = pos.x
    mouse.y = pos.y
    initialMouseY = pos.rawY

    raycaster.setFromCamera(mouse, camera)
    const intersects = raycaster.intersectObjects(scene.children, true)

    const bead = intersects.find((i) => i.object.userData.type)
      ?.object as THREE.Mesh
    if (bead) {
      selectedBead = bead
      initialY = bead.position.y
      isDragging = true
      container.style.cursor = 'grabbing'
    }
  }

  const onMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging || !selectedBead) return
    e.preventDefault()

    const pos = getMousePos(e)
    const deltaY = (pos.rawY - initialMouseY) * -0.05 // Sensitivity adjustment

    const type = selectedBead.userData.type
    const rodIndex = selectedBead.userData.rodIndex
    const rod = rods[rodIndex]

    let newY = initialY + deltaY

    if (type === 'heaven') {
      newY = Math.max(HEAVEN_ACTIVE_Y, Math.min(HEAVEN_HOME_Y, newY))
      selectedBead.position.y = newY
    } else {
      const beadIndex = selectedBead.userData.beadIndex
      const earthBeads = rod.earthBeads

      // Clamp the dragged bead to the absolute earth section limits
      const absoluteMinY = EARTH_HOME_BASE_Y - 3 * EARTH_STEP
      const absoluteMaxY = EARTH_ACTIVE_BASE_Y - beadIndex * EARTH_STEP
      newY = Math.max(absoluteMinY, Math.min(absoluteMaxY, newY))

      selectedBead.position.y = newY

      // Pushing logic: ensure beads don't pass through each other
      // Pushing UP (beads with smaller index have higher Y)
      for (let j = beadIndex - 1; j >= 0; j--) {
        const current = earthBeads[j + 1]
        const above = earthBeads[j]
        if (above.position.y < current.position.y + EARTH_STEP) {
          above.position.y = current.position.y + EARTH_STEP
        }
      }
      // Pushing DOWN (beads with larger index have lower Y)
      for (let j = beadIndex + 1; j < 4; j++) {
        const current = earthBeads[j - 1]
        const below = earthBeads[j]
        if (below.position.y > current.position.y - EARTH_STEP) {
          below.position.y = current.position.y - EARTH_STEP
        }
      }

      // Final clamp for the whole stack to the frame boundaries
      if (earthBeads[0].position.y > EARTH_ACTIVE_BASE_Y) {
        const shift = earthBeads[0].position.y - EARTH_ACTIVE_BASE_Y
        for (let j = 0; j < 4; j++) earthBeads[j].position.y -= shift
      }
      const bottomLimit = EARTH_HOME_BASE_Y - 3 * EARTH_STEP
      if (earthBeads[3].position.y < bottomLimit) {
        const shift = bottomLimit - earthBeads[3].position.y
        for (let j = beadIndex; j < 4; j++) earthBeads[j].position.y += shift
      }
    }
  }

  const onEnd = () => {
    if (!isDragging || !selectedBead) return
    isDragging = false
    container.style.cursor = 'auto'

    const type = selectedBead.userData.type
    const rodIndex = selectedBead.userData.rodIndex
    const col = getColumns()[rodIndex]

    if (type === 'heaven') {
      const distToActive = Math.abs(selectedBead.position.y - HEAVEN_ACTIVE_Y)
      const distToHome = Math.abs(selectedBead.position.y - HEAVEN_HOME_Y)
      const newState = distToActive < distToHome

      if (newState !== col.heavenBead) {
        triggerHaptic(10)
        playBeadSound(500, 0.05)
      }
      onManualChange(rodIndex, newState, col.earthBeads)
    } else {
      const beadIndex = selectedBead.userData.beadIndex
      const currentY = selectedBead.position.y

      // Determine how many beads should be active based on the dragged bead's position
      // If we drag bead i to active area, then at least i+1 beads are active
      // If we drag bead i to home area, then at most i beads are active

      const homeY = EARTH_HOME_BASE_Y - beadIndex * EARTH_STEP
      const activeY = EARTH_ACTIVE_BASE_Y - beadIndex * EARTH_STEP

      const distToActive = Math.abs(currentY - activeY)
      const distToHome = Math.abs(currentY - homeY)

      let newEarthCount = col.earthBeads
      if (distToActive < distToHome) {
        // Wants to be active
        newEarthCount = Math.max(col.earthBeads, beadIndex + 1)
      } else {
        // Wants to be home
        newEarthCount = Math.min(col.earthBeads, beadIndex)
      }

      if (newEarthCount !== col.earthBeads) {
        triggerHaptic(10)
        playBeadSound(400, 0.05)
      }
      onManualChange(rodIndex, col.heavenBead, newEarthCount)
    }

    selectedBead = null
  }

  container.addEventListener('mousedown', onStart)
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onEnd)

  container.addEventListener('touchstart', onStart, { passive: false })
  window.addEventListener('touchmove', onMove, { passive: false })
  window.addEventListener('touchend', onEnd)

  return () => {
    container.removeEventListener('mousedown', onStart)
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onEnd)

    container.removeEventListener('touchstart', onStart)
    window.removeEventListener('touchmove', onMove)
    window.removeEventListener('touchend', onEnd)
  }
}

export function buildAbacusFrame(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group()
  const frameMat = new THREE.MeshStandardMaterial({
    color: FRAME_COLOR,
    roughness: 0.6,
    metalness: 0.2,
  })

  const totalW = NUM_RODS * ROD_SPACING + 1.5
  const frameH = ROD_HEIGHT + 1.5

  // Top & bottom rails
  const railGeom = new THREE.BoxGeometry(totalW, 1.0, 1.0)
  const topRail = new THREE.Mesh(railGeom, frameMat)
  topRail.position.y = frameH / 2
  topRail.castShadow = true
  topRail.receiveShadow = true

  const botRail = new THREE.Mesh(railGeom, frameMat)
  botRail.position.y = -frameH / 2
  botRail.castShadow = true
  botRail.receiveShadow = true

  // Side posts
  const postGeom = new THREE.BoxGeometry(1.0, frameH, 1.0)
  const leftPost = new THREE.Mesh(postGeom, frameMat)
  leftPost.position.x = -totalW / 2
  leftPost.castShadow = true
  leftPost.receiveShadow = true

  const rightPost = new THREE.Mesh(postGeom, frameMat)
  rightPost.position.x = totalW / 2
  rightPost.castShadow = true
  rightPost.receiveShadow = true

  // Divider beam
  const beamMat = new THREE.MeshStandardMaterial({
    color: BEAM_COLOR,
    roughness: 0.4,
    metalness: 0.8,
  })
  const beamGeom = new THREE.BoxGeometry(totalW, 0.22, 0.9)
  const beam = new THREE.Mesh(beamGeom, beamMat)
  beam.position.y = 0.75
  beam.receiveShadow = true

  group.add(topRail, botRail, leftPost, rightPost, beam)
  scene.add(group)
  return group
}

export function buildRods(scene: THREE.Scene): RodMeshes[] {
  const rods: RodMeshes[] = []
  const rodGeom = new THREE.CylinderGeometry(0.05, 0.05, ROD_HEIGHT - 0.5, 12)
  const rodMat = new THREE.MeshStandardMaterial({
    color: 0x888888,
    metalness: 0.9,
    roughness: 0.1,
  })

  const beadGeom = new THREE.SphereGeometry(BEAD_RADIUS_X, 32, 20)
  beadGeom.scale(1, BEAD_RADIUS_Y / BEAD_RADIUS_X, 0.72)

  const startX = -((NUM_RODS - 1) / 2) * ROD_SPACING

  for (let r = 0; r < NUM_RODS; r++) {
    const x = startX + r * ROD_SPACING
    const group = new THREE.Group()
    group.position.x = x

    const rod = new THREE.Mesh(rodGeom, rodMat)
    rod.castShadow = true
    group.add(rod)

    // Heaven bead
    const heavenMat = new THREE.MeshStandardMaterial({
      color: HEAVEN_COLOR,
      roughness: 0.3,
      metalness: 0.1,
    })
    const heaven = new THREE.Mesh(beadGeom, heavenMat)
    heaven.position.y = HEAVEN_HOME_Y
    heaven.userData = { type: 'heaven', rodIndex: r, active: false }
    heaven.castShadow = true
    heaven.receiveShadow = true
    group.add(heaven)

    // Earth beads
    const earthBeads: THREE.Mesh[] = []
    const earthColor = ACCENT_COLORS[r % ACCENT_COLORS.length]
    for (let i = 0; i < 4; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: earthColor,
        roughness: 0.3,
        metalness: 0.1,
      })
      const eb = new THREE.Mesh(beadGeom, mat)
      eb.position.y = EARTH_HOME_BASE_Y - i * EARTH_STEP
      eb.castShadow = true
      eb.receiveShadow = true
      eb.userData = { type: 'earth', rodIndex: r, beadIndex: i, active: false }
      group.add(eb)
      earthBeads.push(eb)
    }

    rods.push({ heavenBead: heaven, earthBeads })
    scene.add(group)
  }

  return rods
}

function heavenY(active: boolean) {
  return active ? HEAVEN_ACTIVE_Y : HEAVEN_HOME_Y
}

function earthY(i: number, active: boolean) {
  return active
    ? EARTH_ACTIVE_BASE_Y - i * EARTH_STEP
    : EARTH_HOME_BASE_Y - i * EARTH_STEP
}

export function syncBeadsInstant(rods: RodMeshes[], columns: AbacusColumn[]) {
  for (let r = 0; r < NUM_RODS; r++) {
    const col = columns[r]
    const rod = rods[r]

    rod.heavenBead.position.y = heavenY(col.heavenBead)
    rod.heavenBead.userData.active = col.heavenBead
    ;(rod.heavenBead.material as THREE.MeshStandardMaterial).emissive.setHex(
      col.heavenBead ? ACTIVE_EMISSIVE : 0x000000,
    )

    for (let i = 0; i < 4; i++) {
      const isActive = i < col.earthBeads
      rod.earthBeads[i].position.y = earthY(i, isActive)
      rod.earthBeads[i].userData.active = isActive
      ;(
        rod.earthBeads[i].material as THREE.MeshStandardMaterial
      ).emissive.setHex(isActive ? ACTIVE_EMISSIVE : 0x000000)
    }
  }
}

const STEP_DURATION = 220
const STEP_GAP = 180

export function animateSteps(
  rods: RodMeshes[],
  steps: BeadStep[],
  initialColumns: AbacusColumn[],
) {
  const digit = initialColumns.map(
    (col) => (col.heavenBead ? 5 : 0) + col.earthBeads,
  )

  for (const step of steps) {
    const rodIndex = NUM_RODS - 1 - step.column
    if (rodIndex >= 0 && rodIndex < NUM_RODS) digit[rodIndex] -= step.delta
  }

  steps.forEach((step, idx) => {
    const rodIndex = NUM_RODS - 1 - step.column
    if (rodIndex < 0 || rodIndex >= NUM_RODS) return

    const from = digit[rodIndex]
    const to = from + step.delta
    digit[rodIndex] = to

    const delay = idx * STEP_GAP
    const rod = rods[rodIndex]

    const fromHeavy = from >= 5
    const toHeavy = to >= 5
    const fromEarth = from % 5
    const toEarth = to % 5

    if (fromHeavy !== toHeavy) {
      scheduleAnimation(
        rod.heavenBead,
        heavenY(toHeavy),
        toHeavy ? ACTIVE_EMISSIVE : 0x000000,
        delay,
      )
    }

    const maxEarth = Math.max(fromEarth, toEarth)
    for (let i = 0; i < maxEarth; i++) {
      const wasActive = i < fromEarth
      const isActive = i < toEarth
      if (wasActive !== isActive) {
        scheduleAnimation(
          rod.earthBeads[i],
          earthY(i, isActive),
          isActive ? ACTIVE_EMISSIVE : 0x000000,
          delay,
        )
      }
    }
  })
}

function scheduleAnimation(
  mesh: THREE.Mesh,
  targetY: number,
  emissive: number,
  delay: number,
) {
  setTimeout(() => {
    if (!mesh.material) return
    ;(mesh.material as THREE.MeshStandardMaterial).emissive.setHex(emissive)
    mesh.userData.active = emissive !== 0x000000

    // Feedback
    triggerHaptic(5)
    playBeadSound(400 + Math.random() * 100, 0.02)

    animateY(mesh, targetY, STEP_DURATION)
  }, delay)
}

function animateY(mesh: THREE.Object3D, targetY: number, duration: number) {
  const startY = mesh.position.y
  const startTime = performance.now()

  const tick = () => {
    const t = Math.min((performance.now() - startTime) / duration, 1)
    mesh.position.y = startY + (targetY - startY) * easeOutElastic(t)
    if (t < 1) requestAnimationFrame(tick)
    else mesh.position.y = targetY
  }
  requestAnimationFrame(tick)
}

function easeOutElastic(x: number): number {
  const c4 = (2 * Math.PI) / 3
  if (x === 0) return 0
  if (x === 1) return 1
  return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1
}

export function handleResize(
  container: HTMLDivElement,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
) {
  const w = container.clientWidth
  const h = container.clientHeight
  if (w === 0 || h === 0) return

  renderer.setSize(w, h)
  camera.aspect = w / h

  // Adjust camera Z based on aspect ratio to keep the abacus in view
  const minZ = 18
  const aspectFactor = Math.max(1, w / h / 1.5)
  camera.position.z = minZ / Math.min(1, w / h)

  // Clamp Z to reasonable range
  camera.position.z = Math.min(Math.max(camera.position.z, 15), 40)

  camera.updateProjectionMatrix()
}
