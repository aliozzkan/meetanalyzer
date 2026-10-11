import { cn } from '@renderer/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'animate-pulse rounded-base bg-secondary-background border-2 border-border',
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
