import { useMemo } from 'react'
import { PITCH } from '../utils/constants'

export function Goals() {
  const postRadius = 0.03
  const hw = PITCH.width / 2
  const goalW = PITCH.goalWidth / 2
  const goalH = PITCH.goalHeight

  const posts = useMemo(() => {
    const items: { position: [number, number, number]; rotation: [number, number, number]; height: number }[] = []

    for (const side of [-1, 1]) {
      const x = hw * side
      items.push({
        position: [x, goalH / 2, -goalW],
        rotation: [0, 0, 0],
        height: goalH,
      })
      items.push({
        position: [x, goalH / 2, goalW],
        rotation: [0, 0, 0],
        height: goalH,
      })
      items.push({
        position: [x, goalH, 0],
        rotation: [Math.PI / 2, 0, 0],
        height: PITCH.goalWidth,
      })
    }

    return items
  }, [])

  return (
    <group>
      {posts.map((post, i) => (
        <mesh key={i} position={post.position} rotation={post.rotation}>
          <cylinderGeometry args={[postRadius, postRadius, post.height, 8]} />
          <meshStandardMaterial color="#ddd" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
    </group>
  )
}
