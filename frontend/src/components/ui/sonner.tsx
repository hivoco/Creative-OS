import { Toaster as SonnerToaster, type ToasterProps } from 'sonner'

export const Toaster = (props: ToasterProps) => (
  <SonnerToaster
    theme="light"
    position="top-right"
    richColors
    closeButton
    {...props}
  />
)
