declare module 'react-simple-maps' {
  import type { ReactNode, SVGProps, MouseEvent } from 'react'

  interface ProjectionConfig {
    rotate?: [number, number, number]
    scale?: number
    center?: [number, number]
  }

  interface ComposableMapProps {
    projection?: string
    projectionConfig?: ProjectionConfig
    width?: number
    height?: number
    style?: React.CSSProperties
    children?: ReactNode
  }

  interface GeographiesRenderProps {
    geographies: Geography[]
    projection: unknown
    path: unknown
  }

  interface GeographiesProps {
    geography: string | object
    children: (props: GeographiesRenderProps) => ReactNode
    parseGeographies?: (features: unknown[]) => unknown[]
  }

  interface Geography {
    rsmKey: string
    [key: string]: unknown
  }

  interface GeographyProps extends SVGProps<SVGPathElement> {
    geography: Geography
    fill?: string
    stroke?: string
    strokeWidth?: number
    style?: {
      default?: React.CSSProperties
      hover?: React.CSSProperties
      pressed?: React.CSSProperties
    }
  }

  interface MarkerProps {
    coordinates: [number, number]
    children?: ReactNode
    onMouseEnter?: (event: MouseEvent) => void
    onMouseLeave?: (event: MouseEvent) => void
    onMouseMove?: (event: MouseEvent) => void
    onClick?: (event: MouseEvent) => void
    style?: React.CSSProperties
  }

  export function ComposableMap(props: ComposableMapProps): JSX.Element
  export function Geographies(props: GeographiesProps): JSX.Element
  export function Geography(props: GeographyProps): JSX.Element
  export function Marker(props: MarkerProps): JSX.Element
  export function ZoomableGroup(props: { children?: ReactNode; [key: string]: unknown }): JSX.Element
}
