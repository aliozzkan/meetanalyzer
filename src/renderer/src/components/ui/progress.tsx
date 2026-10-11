import { Progress as ProgressPrimitive } from '@base-ui/react/progress'

import * as React from 'react'

import { cn } from '@renderer/lib/utils'

function Progress({
  className,
  children,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>): React.JSX.Element {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      className={cn('flex w-full flex-wrap gap-2', className)}
      {...props}
    >
      {children}
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressPrimitive.Root>
  )
}

function ProgressTrack({
  className,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Track>): React.JSX.Element {
  return (
    <ProgressPrimitive.Track
      data-slot="progress-track"
      className={cn(
        'relative h-4 w-full overflow-hidden rounded-base border-2 border-border bg-secondary-background',
        className
      )}
      {...props}
    />
  )
}

function ProgressIndicator({
  className,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Indicator>): React.JSX.Element {
  return (
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      className={cn('h-full border-r-2 border-border bg-main transition-all', className)}
      {...props}
    />
  )
}

function ProgressLabel({
  className,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Label>): React.JSX.Element {
  return (
    <ProgressPrimitive.Label
      data-slot="progress-label"
      className={cn('text-sm font-heading text-foreground', className)}
      {...props}
    />
  )
}

function ProgressValue({
  className,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Value>): React.JSX.Element {
  return (
    <ProgressPrimitive.Value
      data-slot="progress-value"
      className={cn('ms-auto text-sm font-base text-foreground tabular-nums', className)}
      {...props}
    />
  )
}

export { Progress, ProgressTrack, ProgressIndicator, ProgressLabel, ProgressValue }
