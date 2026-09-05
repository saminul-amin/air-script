import { Camera, CameraOff, Keyboard } from "lucide-react";
import ModeToggle from "./ModeToggle";
import InputSourceSwitch from "./InputSourceSwitch";
import type { AppMode, InputSource, ServiceState, TrackingState } from "../types";

interface TopBarProps {
  mode: AppMode;
  onModeToggle: (mode: AppMode) => void;
  inputSource: InputSource;
  onInputSourceChange: (source: InputSource) => void;
  trackingStatus: TrackingState;
  inputLocked: boolean;
  serviceState: ServiceState;
  showWebcam: boolean;
  onWebcamToggle: () => void;
  showShortcuts: boolean;
  onShortcutsToggle: () => void;
}

const SERVICE: Record<ServiceState, { label: string; cls: string }> = {
  checking: { label: "Connecting", cls: "bg-warn dot-pulse" },
  waking: { label: "Waking service", cls: "bg-warn dot-pulse" },
  ready: { label: "Model ready", cls: "bg-ok" },
  degraded: { label: "No model", cls: "bg-danger" },
  offline: { label: "Offline", cls: "bg-danger" },
};

export default function TopBar({
  mode,
  onModeToggle,
  inputSource,
  onInputSourceChange,
  trackingStatus,
  inputLocked,
  serviceState,
  showWebcam,
  onWebcamToggle,
  showShortcuts,
  onShortcutsToggle,
}: TopBarProps) {
  const service = SERVICE[serviceState];
  const cameraOn = inputSource === "camera";

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line px-5">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-[22px] font-medium tracking-tight text-text-0">AirScript</span>
        <span className="hidden text-[11px] text-text-2 md:inline">air writing, on paper</span>
      </div>

      <div className="mx-auto flex items-center gap-3">
        <ModeToggle mode={mode} onToggle={onModeToggle} />
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

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2" title="Recognition service status">
          <span className={`h-2 w-2 rounded-full ${service.cls}`} />
          <span className="text-xs text-text-1">{service.label}</span>
        </div>
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
