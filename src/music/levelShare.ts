import LZString from 'lz-string';
import { parseNoteTarget } from './notation';
import type { ClefMode, LevelDefinition, NoteTarget } from './types';

interface CompactLevelPayload {
  v: 1;
  n: string;
  c: ClefMode;
  r: number;
  t: Array<[string, ('t' | 'b')?]>;
}

export function encodeLevelToParam(level: LevelDefinition): string {
  const payload: CompactLevelPayload = {
    v: 1,
    n: level.name.slice(0, 60),
    c: level.clef,
    r: level.repeats,
    t: level.notes.map((nt) =>
      nt.staff ? [nt.note, nt.staff === 'treble' ? 't' : 'b'] : [nt.note]
    ),
  };
  return LZString.compressToEncodedURIComponent(JSON.stringify(payload));
}

export function buildLevelShareUrl(level: LevelDefinition): string {
  const encoded = encodeLevelToParam(level);
  const url = new URL(window.location.href);
  url.hash = '';
  url.searchParams.set('level', encoded);
  return url.toString();
}

export function decodeLevelFromParam(encoded: string): LevelDefinition | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const data = JSON.parse(json) as Partial<CompactLevelPayload>;
    if (
      data.v !== 1 ||
      typeof data.n !== 'string' ||
      (data.c !== 'treble' && data.c !== 'bass' && data.c !== 'grand') ||
      !Array.isArray(data.t) ||
      data.t.length === 0
    ) {
      return null;
    }

    const notes: NoteTarget[] = [];
    for (const item of data.t) {
      if (!Array.isArray(item) || typeof item[0] !== 'string') continue;
      // Validate note parses cleanly
      parseNoteTarget(item[0]);
      const staff = item[1] === 't' ? 'treble' : item[1] === 'b' ? 'bass' : undefined;
      notes.push({ note: item[0], ...(staff ? { staff } : {}) });
    }

    if (notes.length === 0) return null;

    const repeats = typeof data.r === 'number' ? Math.max(1, Math.min(10, Math.round(data.r))) : 1;
    const clefLabel = data.c === 'grand' ? 'Grand Staff' : data.c === 'treble' ? 'Treble' : 'Bass';

    return {
      id: `shared-${Date.now().toString(36)}`,
      name: data.n.trim() || 'Shared Level',
      subtitle: `${clefLabel}: ${notes.length} note${notes.length === 1 ? '' : 's'} × ${repeats}`,
      clef: data.c,
      category: 'custom',
      notes,
      repeats,
      createdAt: Date.now(),
    };
  } catch {
    return null;
  }
}
