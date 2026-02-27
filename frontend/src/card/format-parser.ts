/** Text segment types for SillyTavern-style formatting */
export type TextSegmentType = "normal" | "narration" | "speech" | "thoughts";

export interface TextSegment {
  type: TextSegmentType;
  text: string;
}

/**
 * Parse message content into typed segments for styled rendering.
 *
 * Markers:
 *   ```text```  → thoughts (italic + bold + purple)
 *   *text*      → narration (italic + grey)
 *   "text"      → speech (orange)
 *   (none)      → normal (default)
 *
 * Scanning order matters: ``` is checked first (longest delimiter).
 */
export function parseFormattedText(content: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let i = 0;
  let normalBuf = "";

  const flush = () => {
    if (normalBuf) {
      segments.push({ type: "normal", text: normalBuf });
      normalBuf = "";
    }
  };

  while (i < content.length) {
    // 1. Check for ``` (thoughts) — longest delimiter first
    if (content[i] === "`" && content.slice(i, i + 3) === "```") {
      const end = content.indexOf("```", i + 3);
      if (end !== -1) {
        flush();
        segments.push({ type: "thoughts", text: content.slice(i + 3, end) });
        i = end + 3;
        continue;
      }
    }

    // 2. Check for * (narration)
    if (content[i] === "*") {
      const end = content.indexOf("*", i + 1);
      if (end !== -1) {
        flush();
        segments.push({ type: "narration", text: content.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    // 3. Check for " (speech)
    if (content[i] === '"') {
      const end = content.indexOf('"', i + 1);
      if (end !== -1) {
        flush();
        segments.push({ type: "speech", text: content.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    // 4. Normal text — collect until next special marker
    normalBuf += content[i];
    i++;
  }

  flush();
  return segments;
}
