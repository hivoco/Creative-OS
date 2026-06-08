import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import {
  AdditiveBlending,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshLambertMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  SpotLight,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'

import VantaGlobeModule from 'vanta/dist/vanta.globe.min'
import { LandingPageHeader } from './LandingPageHeader'

// `VertexColors` was removed from three but the vanta globe build still reads it.
const VertexColors = 2

const THREE = {
  AdditiveBlending,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshLambertMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  SpotLight,
  Vector2,
  Vector3,
  VertexColors,
  WebGLRenderer,
}

const GLOBE = VantaGlobeModule.default

type VantaInstance = { destroy: () => void }

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const effectRef = useRef<VantaInstance | null>(null)

  useEffect(() => {
    if (!heroRef.current || effectRef.current) return
    effectRef.current = GLOBE({
      el: heroRef.current,
      THREE,
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      minHeight: 200,
      minWidth: 200,
      scale: 1,
      scaleMobile: 1,
      backgroundAlpha: 1,
      backgroundColor: 0xf0f0f0,
      color: 0xadf799,
      color2: 0x727272,
      size: 1,
      points: 10,
      maxDistance: 20,
      spacing: 15,
      showDots: true,
    })
    return () => {
      effectRef.current?.destroy()
      effectRef.current = null
    }
  }, [])

  return (
    <section
      ref={heroRef}
      className="landing-hero relative min-h-svh w-full overflow-hidden"
    >
      <LandingPageHeader />

      <div className="absolute inset-y-0 left-0 flex items-center justify-center lg:px-16">
        <div className="max-w-3xl text-black">
          <h1 className="text-7xl font-medium leading-tight tracking-tight">
            HiVoco CreativeOS
          </h1>
          <p className="relative mt-4 text-4xl">
            World's 1st Auto-adaptive Platform
            <img
              className="absolute right-0 -bottom-4"
              src="/landing-page/image.png"
              width={26}
              alt=""
            />
          </p>
          <Link
            to="/login"
            className="mt-10 inline-flex items-center gap-3 rounded-full border border-dashed border-black bg-hv-green-light px-8 py-4 text-sm font-normal text-black transition hover:bg-hv-green"
          >
            EXPLORE
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </Link>
        </div>
      </div>
    </section>
  )
}
