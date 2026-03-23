import { useRef, useEffect, useState, useCallback } from "react";
import type { AppMode, Point } from "./types";
import { AnimatePresence, motion } from "framer-motion";
import DrawingCanvas from "./components/DrawingCanvas";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import OutputPanel from "./components/OutputPanel";
import StatusBar from "./components/StatusBar";
import GestureIndicator from "./components/GestureIndicator";
import ColorPicker from "./components/ColorPicker";
import WebcamPreview from "./components/WebcamPreview";
import ShortcutsPanel from "./components/ShortcutsPanel";
import SuggestionsPanel from "./components/SuggestionsPanel";
import useHandTracking from "./hooks/useHandTracking";
import useCanvas from "./hooks/useCanvas";
import useWordBuilder from "./hooks/useWordBuilder";
import useGestures from "./hooks/useGestures";
import useKeyboardShortcuts from "./hooks/useKeyboardShortcuts";
import useSuggestions from "./hooks/useSuggestions";
import { isDrawingGesture } from "./utils/drawing";
import { downloadTextFile } from "./utils/export";

const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;

export default function App() {
  const [mode, setMode] = useState<AppMode>("writing");

  const videoRef = useRef<HTMLVideoElement>(null);
  const { landmarks, isLoaded } = useHandTracking(videoRef);

  const [showWebcam, setShowWebcam] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const {
    canvasRef,
    drawSegment,
    finishStroke,
    resetPrev,
    clearCanvas,
    getSnapshot,
    exportCanvasPNG,
    undo,
    redo,
    canUndo,
    canRedo,
    strokeColor,
    setStrokeColor,
    lineWidth,
    setLineWidth,
    lastFilterReason,
  } = useCanvas();

  const [drawing, setDrawing] = useState(false);
  const { gesture, gestureLabel, processGesture, resetGesture } = useGestures();
  const wb = useWordBuilder(getSnapshot, clearCanvas);
  const sg = useSuggestions();

  // ── Update suggestions when word changes ─────────────────────────────
  useEffect(() => {
    if (mode === "writing") {
      sg.updateSuggestions(wb.word, wb.correctedText);
    } else {
      sg.clearSuggestions();
    }
  }, [wb.word, wb.correctedText, mode]);

  // ── Accept a suggestion: replace last partial word ──────────────────
  const handleAcceptSuggestion = useCallback(
    (word: string) => {
      // Find the last partial word in the raw character array
      const rawStr = wb.wordString;
      if (!rawStr) return;

      // If text ends with space, append the suggested word + space
      if (rawStr.endsWith(" ")) {
        // Next-word prediction: inject each char of the word
        for (const ch of word) {
          wb.injectChar(ch);
        }
        wb.addSpace();
        return;
      }

      // Prefix completion: find how many trailing non-space chars to replace
      const words = rawStr.split(" ");
      const partial = words[words.length - 1];
      // Remove chars for the partial word, then inject the full word
      for (let i = 0; i < partial.length; i++) {
        wb.undoLastChar();
      }
      for (const ch of word) {
        wb.injectChar(ch);
      }
      sg.clearSuggestions();
    },
    [wb, sg],
  );

  // ── Gesture callbacks ───────────────────────────────────────────────
  const gestureCallbacks = useCallback(() => {
    if (mode === "writing") {
      return { open_palm: wb.clearAll };
    }
    return { open_palm: clearCanvas };
  }, [mode, clearCanvas, wb.clearAll]);

  // ── Hand tracking → draw + gesture process ──────────────────────────
  useEffect(() => {
    if (!landmarks) {
      if (drawing) {
        setDrawing(false);
        const strokeResult = resetPrev();
        if (mode === "writing" && strokeResult.accepted) wb.onDrawingStop();
      }
      resetGesture();
      return;
    }

    processGesture(landmarks, gestureCallbacks());

    const shouldDraw = isDrawingGesture(landmarks);

    if (shouldDraw) {
      setDrawing(true);
      const tip = landmarks[8];
      drawSegment(tip.x * VIDEO_WIDTH, tip.y * VIDEO_HEIGHT);
      if (mode === "writing") wb.onStroke();
    } else {
      if (drawing) {
        const strokeResult = finishStroke();
        if (mode === "writing" && strokeResult.accepted) wb.onDrawingStop();
      }
      setDrawing(false);
    }
  }, [
    landmarks,
    drawing,
    mode,
    drawSegment,
    finishStroke,
    resetPrev,
    processGesture,
    resetGesture,
    gestureCallbacks,
    wb,
  ]);

  // ── Pointer / mouse / stylus handlers ───────────────────────────────
  const handlePointerDrawStart = useCallback(
    ({ x, y }: Point) => {
      setDrawing(true);
      drawSegment(x, y);
      if (mode === "writing") wb.onStroke();
    },
    [drawSegment, mode, wb],
  );

  const handlePointerDrawMove = useCallback(
    ({ x, y }: Point) => {
      drawSegment(x, y);
      if (mode === "writing") wb.onStroke();
    },
    [drawSegment, mode, wb],
  );

  const handlePointerDrawEnd = useCallback(() => {
    const strokeResult = finishStroke();
    setDrawing(false);
    if (mode === "writing" && strokeResult.accepted) wb.onDrawingStop();
  }, [finishStroke, mode, wb]);

  // ── Export ──────────────────────────────────────────────────────────
  const handleExportText = useCallback(() => {
    const text = wb.userEditedText ?? (wb.showCorrected && wb.correctedText ? wb.correctedText : wb.wordString);
    if (text) downloadTextFile(text);
  }, [wb.userEditedText, wb.showCorrected, wb.correctedText, wb.wordString]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────
  useKeyboardShortcuts({
    mode,
    setMode,
    undo,
    redo,
    clearCanvas,
    exportCanvasPNG,
    addSpace: wb.addSpace,
    undoLastChar: wb.undoLastChar,
    clearCurrentChar: wb.clearCurrentChar,
    clearAll: wb.clearAll,
    exportText: handleExportText,
    setStrokeColor,
    showShortcuts,
    setShowShortcuts,
  });

  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-[#0a0a1a] via-[#0d1033] to-[#0a0a20] flex flex-col">
      {/* Off-screen video for MediaPipe */}
      <video
        ref={videoRef}
        className="fixed top-0 left-0 w-1 h-1 opacity-[0.01]"
        autoPlay
        playsInline
        muted
      />

      {/* ── Floating Navbar ─────────────────────────────────────────── */}
      <Navbar
        mode={mode}
        onModeToggle={setMode}
        showWebcam={showWebcam}
        onWebcamToggle={() => setShowWebcam((v) => !v)}
        showShortcuts={showShortcuts}
        onShortcutsToggle={() => setShowShortcuts((v) => !v)}
      />

      {/* ── Shortcuts overlay ──────────────────────────────────────── */}
      <AnimatePresence>
        {showShortcuts && (
          <ShortcutsPanel onClose={() => setShowShortcuts(false)} />
        )}
      </AnimatePresence>

      {/* ── Main 3-column layout ────────────────────────────────────── */}
      <div className="flex-1 flex items-stretch gap-4 px-4 pt-[72px] pb-[56px]">
        {/* ── Left: Sidebar ─────────────────────────────────────────── */}
        <div className="hidden md:flex flex-col gap-3">
          <Sidebar
            mode={mode}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            onClearCanvas={clearCanvas}
            onExportPNG={exportCanvasPNG}
            isRecognizing={wb.isRecognizing}
            onRecognize={wb.recognizeNow}
            onAddSpace={wb.addSpace}
            onUndoChar={wb.undoLastChar}
            onClearChar={wb.clearCurrentChar}
            onClearAll={wb.clearAll}
            onExportText={handleExportText}
          />

          {/* Color picker in drawing mode (below sidebar) */}
          <AnimatePresence>
            {mode === "drawing" && (
              <ColorPicker
                strokeColor={strokeColor}
                lineWidth={lineWidth}
                onColorChange={setStrokeColor}
                onWidthChange={setLineWidth}
              />
            )}
          </AnimatePresence>
        </div>

        {/* ── Center: Canvas ────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
            className="relative w-full h-full max-w-[1000px] rounded-2xl overflow-hidden canvas-glow border border-white/8"
            style={{ aspectRatio: "4 / 3", maxHeight: "calc(100vh - 140px)" }}
          >
            <DrawingCanvas
              canvasRef={canvasRef}
              width={VIDEO_WIDTH}
              height={VIDEO_HEIGHT}
              whiteboard
              onPointerDrawStart={handlePointerDrawStart}
              onPointerDrawMove={handlePointerDrawMove}
              onPointerDrawEnd={handlePointerDrawEnd}
            />

            <GestureIndicator label={gestureLabel} />

            <WebcamPreview
              sourceVideoRef={videoRef}
              visible={showWebcam}
            />
          </motion.div>
        </div>

        {/* ── Right: Output panel (writing mode only) ───────────────── */}
        <AnimatePresence mode="wait">
          {mode === "writing" && (
            <div className="flex flex-col gap-3 w-[260px] shrink-0 h-full">
              <OutputPanel
                word={wb.word}
                wordString={wb.wordString}
                lastResult={wb.lastResult}
                isRecognizing={wb.isRecognizing}
                correctedText={wb.correctedText}
                rawText={wb.rawText}
                showCorrected={wb.showCorrected}
                isProcessing={wb.isProcessing}
                onToggleCorrected={wb.toggleCorrected}
                error={wb.error}
                userEditedText={wb.userEditedText}
                onTextEdit={wb.setUserEditedText}
                onEditDone={sg.learnFromEdit}
              />
              <SuggestionsPanel
                suggestions={sg.suggestions}
                nextWords={sg.nextWords}
                autocomplete={sg.autocomplete}
                onAccept={handleAcceptSuggestion}
                visible={wb.word.length > 0}
              />
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Floating Status Bar ─────────────────────────────────────── */}
      <StatusBar
        gesture={gesture}
        gestureLabel={gestureLabel}
        isDrawing={drawing}
        isLoaded={isLoaded}
        mode={mode}
        filterReason={lastFilterReason}
      />
    </div>
  );
}
