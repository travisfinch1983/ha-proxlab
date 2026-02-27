import type { CharacterCardV3 } from "./types";

/**
 * Parse a Character Card V3 (or V2) from a PNG file.
 *
 * SillyTavern and similar tools embed character data in the PNG tEXt chunk
 * with keyword "ccv3" (V3) or "chara" (V2). The value is base64-encoded JSON.
 *
 * This runs entirely browser-side — no backend needed.
 */
export async function parseCharacterCardPNG(
  file: File
): Promise<CharacterCardV3 | null> {
  try {
    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);

    // Validate PNG signature
    const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < 8; i++) {
      if (data[i] !== PNG_SIG[i]) return null;
    }

    // Walk PNG chunks looking for tEXt or iTXt
    let offset = 8;
    while (offset < data.length - 12) {
      const length = readUint32(data, offset);
      const chunkType = readString(data, offset + 4, 4);

      if (chunkType === "tEXt" || chunkType === "iTXt") {
        const chunkData = data.slice(offset + 8, offset + 8 + length);
        const result = extractFromTextChunk(chunkData, chunkType);
        if (result) return result;
      }

      // Move to next chunk: 4 (length) + 4 (type) + length + 4 (CRC)
      offset += 12 + length;
    }

    return null;
  } catch {
    return null;
  }
}

function extractFromTextChunk(
  data: Uint8Array,
  chunkType: string
): CharacterCardV3 | null {
  if (chunkType === "tEXt") {
    // tEXt: keyword\0value
    const nullIdx = data.indexOf(0);
    if (nullIdx < 0) return null;

    const keyword = readString(data, 0, nullIdx).toLowerCase();
    if (keyword !== "ccv3" && keyword !== "chara") return null;

    const valueBytes = data.slice(nullIdx + 1);
    const valueStr = new TextDecoder().decode(valueBytes);
    return decodeAndParse(valueStr, keyword);
  }

  if (chunkType === "iTXt") {
    // iTXt: keyword\0 compressionFlag compressionMethod language\0 translatedKeyword\0 text
    const nullIdx = data.indexOf(0);
    if (nullIdx < 0) return null;

    const keyword = readString(data, 0, nullIdx).toLowerCase();
    if (keyword !== "ccv3" && keyword !== "chara") return null;

    // Skip compression flag (1 byte), compression method (1 byte)
    let pos = nullIdx + 3;
    // Skip language tag (null-terminated)
    while (pos < data.length && data[pos] !== 0) pos++;
    pos++; // skip null
    // Skip translated keyword (null-terminated)
    while (pos < data.length && data[pos] !== 0) pos++;
    pos++; // skip null

    const valueStr = new TextDecoder().decode(data.slice(pos));
    return decodeAndParse(valueStr, keyword);
  }

  return null;
}

function decodeAndParse(
  value: string,
  keyword: string
): CharacterCardV3 | null {
  try {
    // Try base64 decode first
    let json: string;
    try {
      // atob returns a binary string (one byte per char). For proper UTF-8
      // decoding, convert to Uint8Array and use TextDecoder.
      const binaryStr = atob(value.trim());
      const bytes = Uint8Array.from(binaryStr, (c) => c.charCodeAt(0));
      json = new TextDecoder("utf-8").decode(bytes);
    } catch {
      // Maybe it's already plain JSON
      json = value;
    }

    const obj = JSON.parse(json);

    // V3 format: { spec: "chara_card_v3", data: { ... } }
    if (obj.spec === "chara_card_v3" && obj.data) {
      return mapToV3(obj.data);
    }

    // V2 format: { spec: "chara_card_v2", data: { ... } }
    if (obj.spec === "chara_card_v2" && obj.data) {
      return mapToV3(obj.data);
    }

    // Direct V2 fields (no spec wrapper)
    if (obj.name || obj.description || obj.personality) {
      return mapToV3(obj);
    }

    return null;
  } catch {
    return null;
  }
}

function mapToV3(data: Record<string, unknown>): CharacterCardV3 {
  return {
    name: String(data.name || ""),
    description: String(data.description || ""),
    personality: String(data.personality || ""),
    scenario: String(data.scenario || ""),
    first_mes: String(data.first_mes || ""),
    mes_example: String(data.mes_example || ""),
    system_prompt: String(data.system_prompt || ""),
    post_history_instructions: String(data.post_history_instructions || ""),
    alternate_greetings: Array.isArray(data.alternate_greetings)
      ? data.alternate_greetings.map(String)
      : [],
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    creator_notes: String(data.creator_notes || ""),
  };
}

function readUint32(data: Uint8Array, offset: number): number {
  return (
    ((data[offset] << 24) |
      (data[offset + 1] << 16) |
      (data[offset + 2] << 8) |
      data[offset + 3]) >>>
    0
  );
}

function readString(data: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...data.slice(offset, offset + length));
}
