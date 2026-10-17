import { Camera, CameraOff, Info, Keyboard } from "lucide-react";
import ModeToggle from "./ModeToggle";
import InputSourceSwitch from "./InputSourceSwitch";
import LanguageSwitch from "./LanguageSwitch";
import type { AppMode, InputSource, Language, LocalRecognitionStatus, ServiceState, TrackingState } from "../types";

interface TopBarProps {
  mode: AppMode;
  onModeToggle: (mode: AppMode) => void;
  language: Language;
  onLanguageChange: (language: Language) => void;
  inputSource: InputSource;
  onInputSourceChange: (source: InputSource) => void;
  trackingStatus: TrackingState;
  inputLocked: boolean;
  recognitionStatus: LocalRecognitionStatus;
  serviceState: ServiceState;
  showWebcam: boolean;
  onWebcamToggle: () => void;
  showShortcuts: boolean;
  onShortcutsToggle: () => void;
  showHowItWorks: boolean;
  onHowItWorksToggle: () => void;
}

interface Dot {
  label: string;
  cls: string;
  title: string;
}

/** The quiet on-device indicator. */
function recognitionDot(status: LocalRecognitionStatus): Dot {
  switch (status) {
    case "loading":
      return { label: "Loading model", cls: "bg-warn dot-pulse", title: "Downloading the recognition model to your browser. You can draw meanwhile." };
    case "ready":
      return { label: "On your device", cls: "bg-ok", title: "Characters are recognised in your browser with ONNX Runtime Web. Strokes never leave the page." };
    case "failed":
      return { label: "Via server", cls: "bg-warn", title: "On-device recognition could not start in this browser; characters are sent to the server instead." };
    case "off":
    default:
      return { label: "Via server", cls: "bg-text-2", title: "On-device recognition is switched off; characters are sent to the server." };
  }
}

/** Server status, read as the correction service when recognition is local. */
function serviceDot(state: ServiceState, onDevice: boolean): Dot {
  if (onDevice) {
    switch (state) {
      case "checking":
        return { label: "Connecting", cls: "bg-warn dot-pulse", title: "Checking the text correction service." };
      case "waking":
        return { label: "Waking", cls: "bg-warn dot-pulse", title: "The correction service is waking up. Raw text is shown until it answers." };
      case "ready":
      case "degraded":
        return { label: "Online", cls: "bg-ok", title: "Text correction and suggestions are available." };
      case "offline":
      default:
        return { label: "Offline", cls: "bg-danger", title: "The correction service is unreachable. Recognition still works; raw text is shown." };
    }
  }
  switch (state) {
    case "checking":
      return { label: "Connecting", cls: "bg-warn dot-pulse", title: "Connecting to the recognition service." };
    case "waking":
      return { label: "Waking", cls: "bg-warn dot-pulse", title: "The service is waking up." };
    case "ready":
      return { label: "Online", cls: "bg-ok", title: "The recognition service is ready." };
    case "degraded":
      return { label: "No model", cls: "bg-danger", title: "The service is up but has no trained model." };
    case "offline":
    default:
      return { label: "Offline", cls: "bg-danger", title: "The recognition service is unreachable." };
  }
}

export default function TopBar({
  mode,
  onModeToggle,
  language,
  onLanguageChange,
  inputSource,
  onInputSourceChange,
  trackingStatus,
  inputLocked,
  recognitionStatus,
  serviceState,
  showWebcam,
  onWebcamToggle,
  showShortcuts,
  onShortcutsToggle,
  showHowItWorks,
  onHowItWorksToggle,
}: TopBarProps) {
  const onDevice = recognitionStatus === "ready" || recognitionStatus === "loading";
  const recognition = recognitionDot(recognitionStatus);
  const service = serviceDot(serviceState, onDevice);
  const cameraOn = inputSource === "camera";

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 overflow-x-auto border-b border-line px-5 thin-scrollbar md:gap-4">
      <div className="flex shrink-0 items-baseline gap-2">
        <span className="font-display text-[22px] font-medium tracking-tight text-text-0">AirScript</span>
        <span className="hidden whitespace-nowrap text-[11px] text-text-2 xl:inline">air writing, on paper</span>
      </div>

      <div className="mx-auto flex shrink-0 items-center gap-3">
        <ModeToggle mode={mode} onToggle={onModeToggle} />
        {mode === "writing" && <LanguageSwitch value={language} disabled={inputLocked} onChange={onLanguageChange} />}
        <InputSourceSwitch value={inputSource} trackingStatus={trackingStatus} disabled={inputLocked} onChange={onInputSourceChange} />
        {cameraOn && (
          <button
            onClick={onWebcamToggle}
            title={showWebcam ? "Hide camera preview" : "Show camera preview"}
            aria-pressed={showWebcam}
            className={`rounded-md p-1.5 transition-ui ${showWebcam ? "bg-desk-2 text-text-0" : "text-text-2 hover:text-text-1"}`}
          >
            {showWebcam ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
          </button>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <dl className="flex items-center gap-4 whitespace-nowrap text-xs">
          <div className="flex items-center gap-2" title={recognition.title}>
            <dt className="hidden text-text-2 lg:inline">Recognition</dt>
            <dd className="flex items-center gap-1.5 text-text-1">
              <span className={`h-2 w-2 shrink-0 rounded-full ${recognition.cls}`} />
              {recognition.label}
            </dd>
          </div>
          <div className="flex items-center gap-2" title={service.title}>
            <dt className="hidden text-text-2 lg:inline">{onDevice ? "Correction" : "Service"}</dt>
            <dd className="flex items-center gap-1.5 text-text-1">
              <span className={`h-2 w-2 shrink-0 rounded-full ${service.cls}`} />
              {service.label}
            </dd>
          </div>
        </dl>
        <button
          onClick={onHowItWorksToggle}
          aria-pressed={showHowItWorks}
          title="How it works: the pipeline and the measured accuracy"
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-xs transition-ui ${showHowItWorks ? "bg-desk-2 text-text-0" : "text-text-2 hover:text-text-1"}`}
        >
          <Info className="h-4 w-4 shrink-0" />
          <span className="hidden xl:inline">How it works</span>
        </button>
        <button
          onClick={onShortcutsToggle}
          aria-pressed={showShortcuts}
          title="Keyboard shortcuts (?)"
          className={`rounded-md p-1.5 transition-ui ${showShortcuts ? "bg-desk-2 text-text-0" : "text-text-2 hover:text-text-1"}`}
        >
          <Keyboard className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
