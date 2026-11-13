import { WebMidi } from 'webmidi';
import type { Input } from 'webmidi';

export interface MidiDeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
}

export interface MidiNoteEvent {
  midi: number;
  noteName: string;
  velocity: number;
  deviceId: string;
}

export function isWebMidiSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.requestMIDIAccess === 'function'
  );
}

export class MidiEngine {
  private enabled = false;
  private noteCallbacks = new Set<(event: MidiNoteEvent) => void>();
  private deviceCallbacks = new Set<(devices: MidiDeviceInfo[]) => void>();
  private attachedInputIds = new Set<string>();

  public async enable(): Promise<MidiDeviceInfo[]> {
    if (!isWebMidiSupported()) {
      throw new Error(
        'Web MIDI is not supported in this browser. Use Chrome, Edge, or Firefox on desktop (or Chrome on Android), or switch to Microphone mode.'
      );
    }

    if (!WebMidi.enabled) {
      await WebMidi.enable({ sysex: false });
    }

    if (!this.enabled) {
      this.enabled = true;
      WebMidi.addListener('connected', this.handleTopologyChange);
      WebMidi.addListener('disconnected', this.handleTopologyChange);
    }

    this.bindInputs();
    return this.getDevices();
  }

  public getDevices(): MidiDeviceInfo[] {
    if (!WebMidi.enabled) return [];
    return WebMidi.inputs.map((input) => ({
      id: input.id,
      name: input.name || 'MIDI Keyboard',
      manufacturer: input.manufacturer || '',
    }));
  }

  public onNoteOn(cb: (event: MidiNoteEvent) => void): () => void {
    this.noteCallbacks.add(cb);
    return () => {
      this.noteCallbacks.delete(cb);
    };
  }

  public onDevicesChange(cb: (devices: MidiDeviceInfo[]) => void): () => void {
    this.deviceCallbacks.add(cb);
    return () => {
      this.deviceCallbacks.delete(cb);
    };
  }

  public disable(): void {
    if (WebMidi.enabled) {
      WebMidi.removeListener('connected', this.handleTopologyChange);
      WebMidi.removeListener('disconnected', this.handleTopologyChange);
      for (const input of WebMidi.inputs) {
        input.removeListener('noteon');
      }
      this.attachedInputIds.clear();
    }
    this.enabled = false;
  }

  private handleTopologyChange = (): void => {
    this.bindInputs();
    const devices = this.getDevices();
    for (const cb of this.deviceCallbacks) {
      cb(devices);
    }
  };

  private bindInputs(): void {
    if (!WebMidi.enabled) return;
    for (const input of WebMidi.inputs) {
      if (this.attachedInputIds.has(input.id)) continue;
      this.attachInput(input);
    }
  }

  private attachInput(input: Input): void {
    this.attachedInputIds.add(input.id);
    input.addListener('noteon', (e) => {
      // Ignore note-off disguised as noteon with velocity 0
      const rawVel = e.note.rawAttack ?? Math.round((e.note.attack ?? 0) * 127);
      if (rawVel <= 0) return;

      const evt: MidiNoteEvent = {
        midi: e.note.number,
        noteName: e.note.identifier,
        velocity: e.note.attack,
        deviceId: input.id,
      };
      for (const cb of this.noteCallbacks) {
        cb(evt);
      }
    });
  }
}

export const midiEngine = new MidiEngine();
