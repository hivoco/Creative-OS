import { Toaster as SonnerToaster, type ToasterProps } from 'sonner'

export const Toaster = (props: ToasterProps) => (
  <SonnerToaster
    theme="light"
    position="top-right"
    duration={2000}
    richColors
    closeButton
    {...props}
  />
)
