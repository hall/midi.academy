import { EventEmitter, Injectable } from '@angular/core';
import { NotesService } from './notes.service';
import { FeedbackService } from './feedback.service';

import MIDIAccess = WebMidi.MIDIAccess;
import MIDIConnectionEvent = WebMidi.MIDIConnectionEvent;
import MIDIMessageEvent = WebMidi.MIDIMessageEvent;
import MIDIInput = WebMidi.MIDIInput;
import MIDIOutput = WebMidi.MIDIOutput;

@Injectable({
  providedIn: 'root',
})
export class MidiService {
  public onChange: EventEmitter<any> = new EventEmitter<any>();

  // MIDI Devices
  available = true; // TODO: this is only to avoid the on-by-default error message
  inputs: MIDIInput[] = [];
  outputs: MIDIOutput[] = [];
  device = 'none';

  // Initialize maps of notes coming from MIDI Input
  mapNotesAutoPressed = new Map();

  // wakeLock used with Midi Input
  wakeLockObj?: WakeLockSentinel;
  wakeLockTimer?: number;

  constructor(private notes: NotesService, private feedback: FeedbackService) {
    // Initialize MIDI
    navigator.requestMIDIAccess?.({ sysex: true }).then(this.success.bind(this), () => {
      this.available = false;
    });
  }

  // Register MIDI Inputs' handlers and outputs
  initDev(access: MIDIAccess): void {
    access.inputs.forEach((input) => {
      if (!input.name?.includes('Midi Through')) this.inputs.push(input);
    });

    this.device = 'none';

    this.inputs.forEach((port) => {
      this.device = `${port.name} (${port.manufacturer})`;
      port.onmidimessage = (event: MIDIMessageEvent) => {
        const NOTE_ON = 9;
        const NOTE_OFF = 8;
        const cmd = event.data[0] >> 4;
        // const channel = event.data[0] & 0xf;
        let pitch = 0;
        if (event.data.length > 1) pitch = event.data[1];
        let velocity = 0;
        if (event.data.length > 2) velocity = event.data[2];
        if (cmd === NOTE_OFF || (cmd === NOTE_ON && velocity === 0)) {
          this.noteOff(event.timeStamp, pitch);
        } else if (cmd === NOTE_ON) {
          this.noteOn(event.timeStamp, pitch);
        }
      };
    });

    access.outputs.forEach((output) => {
      if (!output.name?.includes('Midi Through')) this.outputs.push(output);
    });
  }

  // Initialize MIDI event listeners
  success(access: MIDIAccess): void {
    this.available = true;

    access.onstatechange = (event: MIDIConnectionEvent) => {
      this.initDev(event.target as MIDIAccess);
    };

    this.initDev(access);
  }

  pressNote(pitch: number, velocity: number): void {
    this.mapNotesAutoPressed.set((pitch - 12).toFixed(), 1);
    const iter = this.outputs.values();
    for (let o = iter.next(); !o.done; o = iter.next()) {
      o.value.send([0x90, pitch, velocity], window.performance.now());
    }
    setTimeout(() => {
      this.noteOn(Date.now() - this.notes.timePlayStart, pitch);
    }, 0);
    if (this.outputs.values().next().done) {
      this.notes.piano.keyDown({ midi: pitch });
    }
  }

  // Release note on Output MIDI Device
  releaseNote(pitch: number): void {
    this.mapNotesAutoPressed.delete((pitch - 12).toFixed());
    const iter = this.outputs.values();
    for (let o = iter.next(); !o.done; o = iter.next()) {
      o.value.send([0x80, pitch, 0x00], window.performance.now());
    }
    setTimeout(() => {
      this.noteOff(Date.now() - this.notes.timePlayStart, pitch);
    }, 0);
    if (this.outputs.values().next().done) this.notes.piano.keyUp({ midi: pitch });
  }

  // note pressed at time for pitch
  noteOn(time: number, pitch: number /*, velocity: number*/): void {
    this.refreshWakeLock();
    const name = pitch - 12;
    this.notes.press(pitch - 12);

    // wrong key pressed
    if (!this.notes.keys[name].required) {
      this.feedback.addText('❌', 0, 20);
    }

    this.onChange.emit();
  }

  // Midi input note released
  noteOff(time: number, pitch: number): void {
    this.notes.release(pitch - 12);

    this.onChange.emit();
  }

  // Refresh wake lock for two minutes
  refreshWakeLock(): void {
    if (navigator.wakeLock) {
      if (!this.wakeLockObj) {
        navigator.wakeLock.request('screen').then((wakeLock) => {
          this.wakeLockObj = wakeLock;
          this.wakeLockObj.addEventListener('release', () => {
            this.wakeLockObj = undefined;
          });
        });
      }
      // Maintain wake lock for 2 minutes
      clearTimeout(this.wakeLockTimer);
      this.wakeLockTimer = window.setTimeout(() => {
        if (this.wakeLockObj) this.wakeLockObj.release();
      }, 120000);
    }
  }
}
