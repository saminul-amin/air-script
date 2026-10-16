# Real-strokes sets

Drop the JSON files exported by the in-app recorder (`/?record=1`) here, then run

    cd client && npm run evaluate:real-strokes

to evaluate them through the TypeScript preprocessing and ONNX Runtime (the
browser's own pipeline) and write `docs/accuracy-real-strokes.json`. Each file
holds, per sample, the label, the strokes and the PNG the recogniser saw.
