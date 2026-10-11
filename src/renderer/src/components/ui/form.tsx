/* eslint-disable react-refresh/only-export-components */
'use client'

import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerFieldState,
  type ControllerProps,
  type FieldPath,
  type FieldValues
} from 'react-hook-form'

import * as React from 'react'

import { Label } from '@renderer/components/ui/label'

import { cn } from '@renderer/lib/utils'

const Form = FormProvider

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> = {
  name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue>({} as FormFieldContextValue)

function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({ ...props }: ControllerProps<TFieldValues, TName>): React.JSX.Element {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

const useFormField = (): ControllerFieldState & {
  id: string
  name: string
  formItemId: string
  formDescriptionId: string
  formMessageId: string
} => {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState } = useFormContext()
  const formState = useFormState({ name: fieldContext.name })
  const fieldState = getFieldState(fieldContext.name, formState)

  if (!fieldContext) {
    throw new Error('useFormField should be used within <FormField>')
  }

  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState
  }
}

type FormItemContextValue = {
  id: string
}

const FormItemContext = React.createContext<FormItemContextValue>({} as FormItemContextValue)

function FormItem({ className, ...props }: React.ComponentProps<'div'>): React.JSX.Element {
  const id = React.useId()

  return (
    <FormItemContext.Provider value={{ id }}>
      <div data-slot="form-item" className={cn('grid gap-2', className)} {...props} />
    </FormItemContext.Provider>
  )
}

function FormLabel({ className, ...props }: React.ComponentProps<typeof Label>): React.JSX.Element {
  const { error, formItemId } = useFormField()

  return (
    <Label
      data-slot="form-label"
      data-error={!!error}
      className={cn('font-heading', className)}
      htmlFor={formItemId}
      {...props}
    />
  )
}

function FormControl({
  children,
  render,
  ...props
}: useRender.ComponentProps<'div'>): React.JSX.Element {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField()

  // Like Radix's `Slot`, the control merges its props into the single child
  // element (or the element passed to `render`).
  const renderElement = render ?? (React.isValidElement(children) ? children : undefined)

  return useRender({
    defaultTagName: 'div',
    render: renderElement,
    props: mergeProps<'div'>(
      {
        id: formItemId,
        'aria-describedby': !error
          ? `${formDescriptionId}`
          : `${formDescriptionId} ${formMessageId}`,
        'aria-invalid': !!error,
        children: renderElement ? undefined : children
      },
      props
    ),
    state: {
      slot: 'form-control'
    }
  })
}

function FormDescription({ className, ...props }: React.ComponentProps<'p'>): React.JSX.Element {
  const { formDescriptionId } = useFormField()

  return (
    <p
      data-slot="form-description"
      id={formDescriptionId}
      className={cn('text-sm font-base text-foreground', className)}
      {...props}
    />
  )
}

function FormMessage({ className, ...props }: React.ComponentProps<'p'>): React.JSX.Element | null {
  const { error, formMessageId } = useFormField()
  const body = error ? String(error?.message ?? '') : props.children

  if (!body) {
    return null
  }

  return (
    <p
      data-slot="form-message"
      id={formMessageId}
      className={cn('text-sm font-base text-red-500', className)}
      {...props}
    >
      {body}
    </p>
  )
}

export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField
}
