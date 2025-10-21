// wasm-merge-loader.js
// Purpose: Fetch and merge split wasm parts (index.wasm.part1/2/3)
// and provide a Module object with wasmBinary for the Godot/Emscripten loader.
// IMPORTANT: include this script *before* your original index.js in the HTML
// so that `Module` (and wasmBinary) are already available when index.js runs.

(async function(){
  try {
    const partFiles = [
      'index.wasm.part1',
      'index.wasm.part2',
      'index.wasm.part3'
    ];

    // fetch parts in parallel
    const parts = await Promise.all(partFiles.map(p => fetch(p).then(r => {
      if (!r.ok) throw new Error(`Failed to fetch ${p}: ${r.status}`);
      return r.arrayBuffer();
    })));

    // merge
    const total = parts.reduce((s, b) => s + b.byteLength, 0);
    const merged = new Uint8Array(total);
    let off = 0;
    for (const b of parts) {
      merged.set(new Uint8Array(b), off);
      off += b.byteLength;
    }

    // Create a global Module object expected by Emscripten / Godot loader
    // If a Module already exists, preserve its properties but ensure wasmBinary is set.
    window.Module = window.Module || {};
    // prefer not to overwrite existing handlers
    window.Module.wasmBinary = merged.buffer;
    window.Module.print = window.Module.print || console.log.bind(console);
    window.Module.printErr = window.Module.printErr || console.error.bind(console);

    // Provide a small helper to start Godot once the Godot loader defines the Godot() function.
    function startGodotWhenReady() {
      if (typeof Godot !== 'function') {
        // Godot loader hasn't run/defined yet — poll briefly
        setTimeout(startGodotWhenReady, 50);
        return;
      }

      try {
        // Call Godot(Module) to initialize the runtime automatically (same behavior as original build)
        Godot(window.Module);
      } catch (e) {
        console.error('Error while starting Godot with merged wasm:', e);
      }
    }

    // Start after DOM is ready so any code that expects the canvas/DOM is available
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startGodotWhenReady);
    } else {
      startGodotWhenReady();
    }

    console.log('wasm-merge-loader: merged wasm ready (', total, 'bytes)');
  } catch (err) {
    console.error('wasm-merge-loader failed:', err);
  }
})();
