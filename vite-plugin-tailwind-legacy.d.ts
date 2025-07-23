declare module 'vite-plugin-tailwind-legacy' {
  import { Plugin } from 'vite';
  
  interface TailwindLegacyOptions {
    tailwindConfig?: string;
    inputCSS?: string,
    assetsDir?: string;
    publicPath?: string;
    injectInHTML?: boolean;
  }

  const TailwindLegacyPlugin: (options?: TailwindLegacyOptions) => Plugin;
  export default TailwindLegacyPlugin;
}
