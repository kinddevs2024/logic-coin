const fs = require('node:fs');
const path = require('node:path');
const marker = '// Logic Coin: defer initial-link notifications until the hook commits.';
function patchLinking(source) {
  if (source.includes(marker)) return source;
  const anchor = '    const independent = (0, native_1.useNavigationIndependentTree)();';
  if (source.split(anchor).length !== 2) throw Error('Expo Router linking hook changed; review patch before applying.');
  const call = 'onUnhandledLinking((0, extractPathFromURL_1.extractExpoPathFromURL)(prefixes, url));';
  if (source.split(call).length !== 4) throw Error('Unexpected Expo Router notification sites.');
  source = source.split(call).join('notifyUnhandledLink((0, extractPathFromURL_1.extractExpoPathFromURL)(prefixes, url));');
  return source.replace(anchor, `${anchor}
    ${marker}
    const committedRef = (0, react_1.useRef)(false);
    const pendingLinkRef = (0, react_1.useRef)(null);
    const notifyUnhandledLink = (0, react_1.useCallback)((path) => {
        if (committedRef.current) onUnhandledLinking(path);
        else pendingLinkRef.current = { path };
    }, [onUnhandledLinking]);
    (0, react_1.useEffect)(() => {
        committedRef.current = true;
        const pending = pendingLinkRef.current;
        pendingLinkRef.current = null;
        if (pending) onUnhandledLinking(pending.path);
        return () => { committedRef.current = false; };
    }, [onUnhandledLinking]);`);
}
function install() {
  let target;
  try { target = require.resolve('expo-router/build/fork/useLinking.native.js', { paths: [path.resolve(__dirname, '..')] }); }
  catch (error) { if (error.code === 'MODULE_NOT_FOUND') return; throw error; }
  const source = fs.readFileSync(target, 'utf8');
  const patched = patchLinking(source);
  if (patched !== source) fs.writeFileSync(target, patched);
  console.log('Expo Router initial-link lifecycle patch applied.');
}
module.exports = { patchLinking };
if (require.main === module) install();
