import { motion } from "framer-motion";
import { useEffect } from "react";
import { ExternalLink, X } from "lucide-react";
import { ACCURACY } from "../data/accuracy.generated";
import type { AccuracySummary } from "../../scripts/accuracy-sync-lib";
import emnistMatrix from "../assets/confusion-matrix-emnist.png";
import bengaliMatrix from "../assets/confusion-matrix-bengali.png";
import { useMotion, DUR } from "../motion";

interface HowItWorksPanelProps {
  onClose: () => void;
}

const REPO = "https://github.com/saminul-amin/air-script";

const pct = (v: number) => `${(v * 100).toFixed(2)} %`;

function AccuracyTable({ title, summary, lang }: { title: string; summary: AccuracySummary; lang: "en" | "bn" }) {
  const glyph = lang === "bn" ? "font-bengali" : "font-mono";
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[13px] font-medium text-text-0">{title}</h3>
      <p className="text-[11px] text-text-2">
        {summary.dataset} · {summary.samples.toLocaleString()} samples · measured {summary.evaluatedOn}
      </p>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="text-left text-[11px] text-text-2">
            <th className="py-1 font-medium">Model</th>
            <th className="py-1 text-right font-medium">Top-1</th>
            <th className="py-1 text-right font-medium">Top-3</th>
          </tr>
        </thead>
        <tbody>
          {summary.models.map((m) => (
            <tr key={m.name} className="border-t border-line">
              <td className="py-1 text-text-1">{m.name}</td>
              <td className="py-1 text-right font-mono text-text-0">{pct(m.top1)}</td>
              <td className="py-1 text-right font-mono text-text-0">{pct(m.top3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[11px] leading-relaxed text-text-2">
        Most confused (true → predicted, share of the true class):{" "}
        {summary.mostConfused.map((c, i) => (
          <span key={`${c.from}-${c.to}`}>
            {i > 0 && ", "}
            <span lang={lang} className={`${glyph} text-text-1`}>
              {c.from}→{c.to}
            </span>{" "}
            {(c.share * 100).toFixed(0)} %
          </span>
        ))}
        .
      </p>
    </section>
  );
}

/**
 * "How it works": the pipeline and the measured numbers, inside the app, so
 * nobody has to open the repository to see them. Everything numeric here is
 * generated from docs/accuracy-*.json (scripts/sync-accuracy.ts).
 */
export default function HowItWorksPanel({ onClose }: HowItWorksPanelProps) {
  const { rise } = useMotion();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      {...rise(8, DUR.slow)}
      role="dialog"
      aria-modal="true"
      aria-label="How it works"
      className="absolute inset-x-4 top-16 bottom-4 z-40 mx-auto flex max-w-3xl flex-col overflow-hidden rounded-xl border border-line bg-desk-1 shadow-2xl"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3">
        <span className="label">How it works</span>
        <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-text-2 transition-ui hover:bg-desk-2 hover:text-text-0">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="thin-scrollbar flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-4 text-[12px] leading-relaxed text-text-1">
        <section className="flex flex-col gap-2">
          <h3 className="text-[13px] font-medium text-text-0">What happens to a stroke</h3>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5">
            <li>
              <span className="text-text-0">Capture.</span> Mouse, touch, pen, or a fingertip tracked by MediaPipe Hands in your browser. Strokes shorter than a
              flick are dropped as noise.
            </li>
            <li>
              <span className="text-text-0">Preprocess, on your device.</span> After a one-second pause the strokes are painted white on black and run through the same
              ten steps the Python service uses: blur, threshold, dilate, crop to the ink with 20 % padding, square, resize to 28 × 28. The TypeScript port
              matches the Python pipeline bit for bit on 70 test images.
            </li>
            <li>
              <span className="text-text-0">Recognise, on your device.</span> A small convolutional network (three convolutions, two linear layers, about 1.9 M
              parameters) runs in ONNX Runtime Web. English: 47 EMNIST Balanced classes. Bengali: 84 BanglaLekha-Isolated classes. The int8 export is 1.7 MB and
              takes tens of milliseconds per character; nothing you draw leaves the page.
            </li>
            <li>
              <span className="text-text-0">Correct (English) or compose (Bengali).</span> English characters go to the server, which resolves look-alikes from
              context (0 → O inside a word), fixes spelling with SymSpell and suggests words. Bengali is composed locally: a vowel written after a consonant
              becomes its sign (ক + ই → কি). There is no Bengali correction yet.
            </li>
          </ol>
        </section>

        <AccuracyTable title="Accuracy — English" summary={ACCURACY.english} lang="en" />
        <figure className="flex flex-col gap-1.5">
          <img src={emnistMatrix} alt="Confusion matrix on the EMNIST Balanced test split" className="w-full rounded-lg border border-line" loading="lazy" />
          <figcaption className="text-[11px] text-text-2">
            EMNIST merges fifteen lowercase letters into their capitals, so L contains handwritten l: the L / 1 / I and O / 0 confusions are the same shapes, left
            to the correction step.
          </figcaption>
        </figure>

        <AccuracyTable title="Accuracy — Bengali" summary={ACCURACY.bengali} lang="bn" />
        <figure className="flex flex-col gap-1.5">
          <img src={bengaliMatrix} alt="Confusion matrix on held-out BanglaLekha-Isolated writers" className="w-full rounded-lg border border-line" loading="lazy" />
          <figcaption className="text-[11px] text-text-2">
            Test writers were never seen in training. Basic letters and digits are strong; the errors concentrate in the 24 compound characters, which share
            sub-shapes at 28 × 28.
          </figcaption>
        </figure>

        <section className="flex flex-col gap-2">
          <h3 className="text-[13px] font-medium text-text-0">Accuracy — strokes drawn in this app</h3>
          {ACCURACY.realStrokes ? (
            <AccuracyTable title="" summary={ACCURACY.realStrokes} lang="en" />
          ) : (
            <p>
              Not measured yet. A benchmark figure is not a real-world figure: these strokes are smoother, thicker and drawn with a mouse or in the air, not
              scanned from paper. A labelled set drawn in the app is being collected; the number will appear here once it is evaluated through this same
              pipeline.
            </p>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-[13px] font-medium text-text-0">What it cannot do</h3>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            <li>One character at a time: no cursive, no segmentation of words.</li>
            <li>English: no punctuation and no lowercase c i j k l m o p s u v w x y z (they read as capitals).</li>
            <li>Bengali: no vowel written independently right after a consonant inside a word (বই needs a space first), no conjuncts beyond the dataset's 24, no hasanta.</li>
            <li>The Bengali compound-character labels were read from the handwriting by eye and are not yet verified by a native speaker.</li>
          </ul>
        </section>

        <p className="text-[11px] text-text-2">
          Code, data pipeline, tests and the evaluation scripts that produced these numbers:{" "}
          <a href={REPO} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-text-1 underline decoration-line underline-offset-2 hover:text-text-0">
            github.com/saminul-amin/air-script <ExternalLink className="h-3 w-3" />
          </a>
          . MIT licence; datasets EMNIST (NIST) and BanglaLekha-Isolated (CC BY 4.0).
        </p>
      </div>
    </motion.div>
  );
}
