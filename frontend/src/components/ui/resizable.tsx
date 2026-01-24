import { useState, useCallback, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

interface ResizablePanelGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: "horizontal" | "vertical"
}

const ResizablePanelGroup = ({
  className,
  direction = "horizontal",
  children,
  ...props
}: ResizablePanelGroupProps) => (
  <div
    className={cn(
      "flex h-full w-full",
      direction === "vertical" && "flex-col",
      className
    )}
    {...props}
  >
    {children}
  </div>
)

interface ResizablePanelProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultSize?: number
  minSize?: number
  maxSize?: number
}

const ResizablePanel = ({
  className,
  defaultSize,
  minSize,
  maxSize,
  style,
  children,
  ...props
}: ResizablePanelProps) => (
  <div
    className={cn("flex-1 min-h-0 min-w-0 overflow-hidden", className)}
    style={{
      ...(defaultSize ? { flexBasis: `${defaultSize}%`, flexGrow: 0 } : {}),
      ...(minSize ? { minWidth: `${minSize}%` } : {}),
      ...(maxSize ? { maxWidth: `${maxSize}%` } : {}),
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
)

interface ResizableHandleProps extends React.HTMLAttributes<HTMLDivElement> {
  withHandle?: boolean
  onResize?: (delta: number) => void
}

const ResizableHandle = ({
  className,
  onResize,
  ...props
}: ResizableHandleProps) => {
  const [isDragging, setIsDragging] = useState(false)
  const startXRef = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    startXRef.current = e.clientX
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current
      startXRef.current = e.clientX
      onResize?.(delta)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, onResize])

  return (
    <div
      className={cn(
        "relative flex w-1 items-center justify-center cursor-col-resize transition-colors",
        "hover:bg-primary/30",
        isDragging && "bg-primary/50",
        className
      )}
      onMouseDown={handleMouseDown}
      {...props}
    />
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
