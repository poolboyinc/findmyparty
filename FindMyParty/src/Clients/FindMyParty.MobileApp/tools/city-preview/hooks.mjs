// Lets plain Node load the app's map code: `@/…` paths, imports without an extension, and a
// stand-in for react-native (the theme imports it, the map data does not use it).
import { registerHooks } from 'node:module';
import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), '../..');
const STUB = 'data:text/javascript,' + encodeURIComponent(
  'export const Platform = { OS: "ios", select: (o) => o.ios ?? o.default };' +
    'export const StyleSheet = { create: (s) => s, hairlineWidth: 1, absoluteFill: {}, flatten: (s) => s };' +
    'export const Dimensions = { get: () => ({ width: 393, height: 852, scale: 3, fontScale: 1 }) };' +
    'export const PixelRatio = { get: () => 3, roundToNearestPixel: (n) => n };' +
    'export default {};',
);

function asFile(path) {
  for (const candidate of [path, `${path}.ts`, `${path}.tsx`, join(path, 'index.ts'), join(path, 'index.tsx')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'react-native') return { url: STUB, shortCircuit: true };
    let path = null;
    if (specifier.startsWith('@/')) path = join(root, specifier.slice(2));
    else if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      path = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
    }
    const file = path && asFile(path);
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
