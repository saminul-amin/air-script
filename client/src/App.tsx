import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AppMode, InputSource, Language, Point, Sample } from "./types";
import TopBar from "./components/TopBar";
import ConnectionStrip from "./components/ConnectionStrip";
import ToolRail from "./components/ToolRail";
import Paper from "./components/Paper";
import TypesetLine from "./components/TypesetLine";
import LastCharacterCard from "./components/LastCharacterCard";
import SuggestionsPanel from "./components/SuggestionsPanel";
import SampleRow from "./components/SampleRow";
import RecorderPanel from "./components/RecorderPanel";
import ShortcutsPanel from "./components/ShortcutsPanel";
import useHandTracking from "./hooks/useHandTracking";
import useCanvas, { DEFAULT_LINE_WIDTH } from "./hooks/useCanvas";
import { BENGALI_INK_WIDTH } from "./data/samples";
import useWordBuilder from "./hooks/useWordBuilder";
import useGestures from "./hooks/useGestures";
import useKeyboardShortcuts from "./hooks/useKeyboardShortcuts";
import useSuggestions from "./hooks/useSuggestions";
import useServiceStatus from "./hooks/useServiceStatus";
import useLocalRecognizer from "./hooks/useLocalRecognizer";
import useSampleReplay from "./hooks/useSampleReplay";
import useRecorder from "./hooks/useRecorder";
import { isDrawingGesture } from "./utils/drawing";
import { downloadTextFile } from "./utils/export";
import { CANVAS_WIDTH, CANVAS_HEIGHT, RECOGNITION_MODE, RECORD_MODE } from "./config";
import { useMotion, DUR } from "./motion";

export default function App() {
  const { t, reduce } = useMotion();
  const [mode, setMode] = useState<AppMode>("writing");
  const [language, setLanguage] = useState<Language>("en");

  // ── Input source: mouse/touch by default, camera on request ─────────
  const [inputSource, setInputSource] = useState<InputSource>("pointer");
  const videoRef = useRef<HTMLVideoElement>(null);
  const tracking = useHandTracking(videoRef, inputSource === "camera");
  const cameraOn = inputSource === "camera";

  // If the camera fails, fall back to pointer input so the app keeps working.
  useEffect(() => {
    if (tracking.status === "error") setInputSource("pointer");
  }, [tracking.status]);

  const [showWebcam, setShowWebcam] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const service = useServiceStatus();

  // ── On-device recognition: loads after first paint, falls back to the server ──
  const local = useLocalRecognizer(RECOGNITION_MODE === "device", language);

  const canvas = useCanvas();
  const {
    canvasRef,
    drawSegment,
    finishStroke,
    resetPrev,
    clearCanvas,
    getSnapshot,
    getSnapshotPixels,
    getStrokes,
    exportCanvasPNG,
    undo,
    redo,
    canUndo,
    canRedo,
    hasStrokes,
    strokeColor,
    setStrokeColor,
    lineWidth,
    setLineWidth,
    lastFilterReason,
  } = canvas;

  const [drawing, setDrawing] = useState(false);
  const { gesture, processGesture, resetGesture } = useGestures();
  const localRecognition = useMemo(
    () => (local.status === "off" ? undefined : { getSnapshotPixels, recognize: local.recognize }),
    [local.status, local.recognize, getSnapshotPixels],
  );
  const wb = useWordBuilder(getSnapshot, clearCanvas, localRecognition, language);
  const sg = useSuggestions();

  // Switching script starts a fresh line: the two models share no labels.
  const { clearAll } = wb;
  const handleLanguageChange = useCallback(
    (next: Language) => {
      if (next === language) return;
      clearAll();
      sg.clearSuggestions();
      setLanguage(next);
    },
    [language, clearAll, sg],
  );

  // ── Dev-only recorder (?record=1): strokes are labelled and kept, not recognised ──
  const recorder = useRecorder({ getStrokes, getSnapshot, clearCanvas });
  const recording = RECORD_MODE && mode === "writing";
  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        recorder.skip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [recording, recorder.skip]);
  // The word builder only hears about strokes when they are meant to be recognised.
  const onStroke = recording ? undefined : wb.onStroke;
  const onDrawingStop = recording ? undefined : wb.onDrawingStop;

  // ── Correction follows the service: retry what is owed once it is back ──
  const { correctionStatus, retryCorrection } = wb;
  const serviceRetry = service.retry;
  useEffect(() => {
    if (correctionStatus === "unavailable" && service.state === "ready") retryCorrection();
  }, [correctionStatus, service.state, retryCorrection]);
  useEffect(() => {
    // A correction just failed to reach a service we believed was up: re-probe.
    if (correctionStatus === "unavailable" && (service.state === "ready" || service.state === "degraded")) serviceRetry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [correctionStatus]);

  // ── Sample replay (demonstrates the pipeline with no input at all) ──
  const busyRef = useRef(false);
  busyRef.current = wb.isRecognizing || wb.isProcessing;
  const replay = useSampleReplay({
    drawSegment,
    finishStroke,
    onStroke: wb.onStroke,
    onDrawingStop: wb.onDrawingStop,
    busyRef,
    reset: wb.clearAll,
    setIgnorePauses: wb.setIgnorePauses,
  });

  const handleReplay = useCallback(
    (sample: Sample) => {
      setMode("writing");
      setInputSource("pointer");
      setLineWidth(sample.strokeWidth ?? (sample.language === "bn" ? BENGALI_INK_WIDTH : DEFAULT_LINE_WIDTH));
      replay.play(sample);
    },
    [replay, setLineWidth],
  );

  // The Bengali training data has thick strokes; draw Bengali with thicker ink.
  useEffect(() => {
    if (mode === "writing") setLineWidth(language === "bn" ? BENGALI_INK_WIDTH : DEFAULT_LINE_WIDTH);
  }, [language, mode, setLineWidth]);

  // ── Suggestions follow the word ──────────────────────────────────────
  useEffect(() => {
    // Word prediction is English-only (wordfreq + the personal dictionary).
    if (mode === "writing" && language === "en") sg.updateSuggestions(wb.word, wb.correctedText);
    else sg.clearSuggestions();
  }, [wb.word, wb.correctedText, mode, language]);

  const handleAcceptSuggestion = useCallback(
    (word: string) => {
      const rawStr = wb.wordString;
      if (!rawStr) return;
      if (rawStr.endsWith(" ")) {
        for (const ch of word) wb.injectChar(ch);
        wb.addSpace();
        return;
      }
      const partial = rawStr.split(" ").pop() ?? "";
      for (let i = 0; i < partial.length; i++) wb.undoLastChar();
      for (const ch of word) wb.injectChar(ch);
      sg.clearSuggestions();
    },
    [wb, sg],
  );

  // ── Gestures ────────────────────────────────────────────────────────
  const gestureCallbacks = useCallback(() => {
    if (mode === "writing") return { open_palm: wb.clearAll };
    return { open_palm: clearCanvas };
  }, [mode, clearCanvas, wb.clearAll]);

  const landmarks = cameraOn ? tracking.landmarks : null;
  useEffect(() => {
    if (!cameraOn) return;
    if (!landmarks) {
      if (drawing) {
        setDrawing(false);
        const strokeResult = resetPrev();
        if (mode === "writing" && strokeResult.accepted) onDrawingStop?.();
      }
      resetGesture();
      return;
    }

    processGesture(landmarks, gestureCallbacks());

    if (isDrawingGesture(landmarks)) {
      setDrawing(true);
      const tip = landmarks[8];
      drawSegment(tip.x * CANVAS_WIDTH, tip.y * CANVAS_HEIGHT);
      if (mode === "writing") onStroke?.();
    } else {
      if (drawing) {
        const strokeResult = finishStroke();
        if (mode === "writing" && strokeResult.accepted) onDrawingStop?.();
      }
      setDrawing(false);
    }
  }, [cameraOn, landmarks, drawing, mode, drawSegment, finishStroke, resetPrev, processGesture, resetGesture, gestureCallbacks, onStroke, onDrawingStop]);

  // ── Pointer input ───────────────────────────────────────────────────
  const handlePointerDrawStart = useCallback(
    ({ x, y }: Point) => {
      if (replay.isPlaying) return;
      setDrawing(true);
      drawSegment(x, y);
      if (mode === "writing") onStroke?.();
    },
    [drawSegment, mode, onStroke, replay.isPlaying],
  );

  const handlePointerDrawMove = useCallback(
    ({ x, y }: Point) => {
      if (replay.isPlaying) return;
      drawSegment(x, y);
      if (mode === "writing") onStroke?.();
    },
    [drawSegment, mode, onStroke, replay.isPlaying],
  );

  const handlePointerDrawEnd = useCallback(() => {
    if (replay.isPlaying) return;
    const strokeResult = finishStroke();
    setDrawing(false);
    if (mode === "writing" && strokeResult.accepted) onDrawingStop?.();
  }, [finishStroke, mode, onDrawingStop, replay.isPlaying]);

  // ── Export + shortcuts ──────────────────────────────────────────────
  const handleExportText = useCallback(() => {
    const text = wb.userEditedText ?? (wb.showCorrected && wb.correctedText ? wb.correctedText : wb.wordString);
    if (text) downloadTextFile(text);
  }, [wb.userEditedText, wb.showCorrected, wb.correctedText, wb.wordString]);

  useKeyboardShortcuts({
    mode,
    setMode,
    undo,
    redo,
    clearCanvas,
    exportCanvasPNG,
    addSpace: recording ? () => {} : wb.addSpace,
    undoLastChar: recording ? undo : wb.undoLastChar,
    clearCurrentChar: recording ? clearCanvas : wb.clearCurrentChar,
    clearAll: recording ? clearCanvas : wb.clearAll,
    exportText: recording ? recorder.exportJson : handleExportText,
    recognizeNow: recording ? recorder.saveAndNext : wb.recognizeNow,
    setStrokeColor,
    showShortcuts,
    setShowShortcuts,
  });

  const writing = mode === "writing";
  const hasSideContent = writing && !recording && (wb.lastResult !== null || sg.suggestions.length > 0 || sg.nextWords.length > 0 || sg.autocomplete !== null);

  return (
    <div className="relative flex h-full flex-col bg-desk-0 text-text-0">
      {/* Off-screen video for MediaPipe (only active while hand tracking is on) */}
      <video ref={videoRef} className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-[0.01]" autoPlay playsInline muted />

      <TopBar
        mode={mode}
        onModeToggle={setMode}
        language={language}
        onLanguageChange={handleLanguageChange}
        inputSource={inputSource}
        onInputSourceChange={setInputSource}
        trackingStatus={tracking.status}
        inputLocked={replay.isPlaying}
        recognitionStatus={local.status}
        serviceState={service.state}
        showWebcam={showWebcam}
        onWebcamToggle={() => setShowWebcam((v) => !v)}
        showShortcuts={showShortcuts}
        onShortcutsToggle={() => setShowShortcuts((v) => !v)}
      />

      <ConnectionStrip
        state={service.state}
        health={service.health}
        elapsedMs={service.elapsedMs}
        onDevice={local.status === "ready" || local.status === "loading"}
        onRetry={service.retry}
      />

      <AnimatePresence>{showShortcuts && <ShortcutsPanel onClose={() => setShowShortcuts(false)} />}</AnimatePresence>

      <main className="flex min-h-0 flex-1 gap-4 px-4 py-4 md:px-6">
        <ToolRail
          mode={mode}
          hasStrokes={hasStrokes}
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
          strokeColor={strokeColor}
          lineWidth={lineWidth}
          onColorChange={setStrokeColor}
          onWidthChange={setLineWidth}
        />

        {/* Centre: paper, typeset line, samples */}
        <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto thin-scrollbar">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={t(DUR.slow)}
            className="mx-auto w-full"
            style={{ maxWidth: "min(100%, calc((100vh - 21rem) * 4 / 3))" }}
          >
            <Paper
              canvasRef={canvasRef}
              videoRef={videoRef}
              mode={mode}
              cameraOn={cameraOn}
              showWebcam={showWebcam}
              trackingStatus={tracking.status}
              gesture={gesture}
              pointerEnabled={!cameraOn && !replay.isPlaying}
              onPointerDrawStart={handlePointerDrawStart}
              onPointerDrawMove={handlePointerDrawMove}
              onPointerDrawEnd={handlePointerDrawEnd}
              replayProgress={replay.progress}
              filterReason={lastFilterReason}
              isEmpty={!hasStrokes && wb.word.length === 0}
              modelLoading={local.status === "loading"}
            />
          </motion.div>

          {recording && (
            <RecorderPanel
              target={recorder.target}
              cursor={recorder.cursor}
              total={recorder.total}
              savedCount={recorder.savedCount}
              countForTarget={recorder.countForTarget}
              perClass={recorder.perClass}
              lastSaved={recorder.lastSaved}
              busy={recorder.busy}
              hasStrokes={hasStrokes}
              onSave={recorder.saveAndNext}
              onSkip={recorder.skip}
              onUndo={recorder.undoLast}
              onReset={recorder.reset}
              onExport={recorder.exportJson}
            />
          )}

          {writing && !recording && (
            <TypesetLine
              language={language}
              word={wb.word}
              wordString={wb.wordString}
              correctedText={wb.correctedText}
              rawText={wb.rawText}
              showCorrected={wb.showCorrected}
              isProcessing={wb.isProcessing}
              isRecognizing={wb.isRecognizing}
              correctionStatus={wb.correctionStatus}
              error={wb.error}
              userEditedText={wb.userEditedText}
              onToggleCorrected={wb.toggleCorrected}
              onTextEdit={wb.setUserEditedText}
              onEditDone={sg.learnFromEdit}
              onExport={handleExportText}
            />
          )}

          {!recording && <SampleRow language={language} onReplay={handleReplay} onStopReplay={replay.stop} isReplaying={replay.isPlaying} trackingError={tracking.error} />}
        </div>

        {/* Right column: collapses to nothing until there is content */}
        <AnimatePresence initial={false}>
          {hasSideContent && (
            <motion.aside
              key="side"
              initial={reduce ? { opacity: 0 } : { opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 280 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, width: 0 }}
              transition={t(DUR.slow)}
              className="hidden shrink-0 overflow-hidden lg:block"
            >
              <div className="flex w-[280px] flex-col gap-3">
                <LastCharacterCard result={wb.lastResult} isRecognizing={wb.isRecognizing} language={language} />
                <SuggestionsPanel suggestions={sg.suggestions} nextWords={sg.nextWords} autocomplete={sg.autocomplete} onAccept={handleAcceptSuggestion} />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
