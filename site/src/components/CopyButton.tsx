import { useToast } from "./Toast.tsx";

export function CopyIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

interface Props {
  /** Text put on the clipboard. */
  text: string;
  /** Visible label. */
  label?: string;
  /** Accessible name (defaults to the label). */
  ariaLabel?: string;
  /** Toast shown on success. */
  done: string;
  variant?: "primary" | "secondary";
  small?: boolean;
}

/** Copies text for pasting into the in-game AH search box. Nothing is ever sent to the game. */
export function CopyButton({ text, label = "Copy name", ariaLabel, done, variant = "primary", small }: Props) {
  const toast = useToast();
  return (
    <button
      type="button"
      className={`btn btn-${variant}${small ? " btn-small" : ""}`}
      aria-label={ariaLabel ?? label}
      onClick={async () => toast((await copy(text)) ? done : "Couldn't copy: your browser blocked the clipboard")}
    >
      <CopyIcon size={small ? 14 : 16} />
      {label}
    </button>
  );
}
