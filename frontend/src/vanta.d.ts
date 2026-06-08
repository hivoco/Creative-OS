// Vanta ships no types; the globe effect is loaded as a UMD module and handed a
// `THREE` instance explicitly.
declare module 'vanta/dist/vanta.globe.min' {
  interface VantaOptions {
    el: HTMLElement
    THREE: unknown
    [key: string]: unknown
  }
  interface VantaInstance {
    destroy: () => void
  }
  const globe: { default: (opts: VantaOptions) => VantaInstance }
  export default globe
}
