import { EventEmitter, Injectable } from '@angular/core';
import { NotesService } from './notes.service';
import { FeedbackService } from './feedback.service';
import { CursorService } from './cursor.service';

import MIDIAccess = WebMidi.MIDIAccess;
import MIDIConnectionEvent = WebMidi.MIDIConnectionEvent;
import MIDIMessageEvent = WebMidi.MIDIMessageEvent;
import MIDIInput = WebMidi.MIDIInput;
import MIDIOutput = WebMidi.MIDIOutput;

// the first note on a piano keyboard, A0, is 21
// TODO: un-hardcode the piano keyboard assumption
export const MIDIOffset = 21;

@Injectable({
  providedIn: 'root',
})
export class MidiService {
  public onChange: EventEmitter<any> = new EventEmitter<any>();

  device = 'none';
  available = true; // TODO: this is only to avoid the on-by-default error message
  private output?: MIDIOutput;

  // wakeLock used with Midi Input
  wakeLockObj?: WakeLockSentinel;
  wakeLockTimer?: number;

  private NOTE_ON = 9;
  private NOTE_OFF = 8;

  constructor(private notes: NotesService, private feedback: FeedbackService, private cursor: CursorService) {
    navigator.requestMIDIAccess?.({ sysex: true }).then((access) => {
      this.available = true;

      access.onstatechange = (event: MIDIConnectionEvent) => {
        this.onStateChange(event.target as MIDIAccess);
      };

      this.onStateChange(access);
    });
  }

  // if input is changed, create event listener on new input
  set input(input: MIDIInput) {
    if (input.name) this.device = input.name;
    input.onmidimessage = (event: MIDIMessageEvent) => {
      const cmd = event.data[0] >> 4;
      // const channel = event.data[0] & 0xf;

      let pitch = 0;
      if (event.data.length > 1) pitch = event.data[1];

      let velocity = 0;
      if (event.data.length > 2) velocity = event.data[2];

      if (cmd === this.NOTE_OFF || (cmd === this.NOTE_ON && velocity === 0)) {
        this.noteOff(event.timeStamp, pitch);
      } else if (cmd === this.NOTE_ON) {
        this.noteOn(event.timeStamp, pitch, velocity);
      }
    };
  }

  onStateChange(access: MIDIAccess): void {
    // refresh input and output devices
    this.input = Array.from(access.inputs.values()).filter((input) => !input.name?.includes('Midi Through'))[0];
    this.output = Array.from(access.outputs.values()).filter((outputs) => !outputs.name?.includes('Midi Through'))[0];
  }

  // note pressed at time for pitch
  noteOn(time: number, pitch: number, velocity: number): void {
    const name = pitch - MIDIOffset;
    this.notes.press(name);

    // wrong key pressed
    if (this.cursor.running && !this.notes.keys[name].required) {
      // this.feedback.addText('❌', 0, 20);
    }

    this.onChange.emit();
    this.refreshWakeLock();
  }

  // input note released
  noteOff(time: number, pitch: number): void {
    this.notes.release(pitch - MIDIOffset);
    this.onChange.emit();
  }

  pressNote(pitch: number, velocity: number): void {
    this.output?.send([0x90, pitch, velocity]);

    setTimeout(() => {
      this.noteOn(Date.now() - this.notes.timePlayStart, pitch, velocity);
    }, 0);
    this.notes.piano.keyDown({ midi: pitch });
  }

  // Release note on Output MIDI Device
  releaseNote(pitch: number): void {
    this.output?.send([0x80, pitch, 0x00]);
    setTimeout(() => {
      this.noteOff(Date.now() - this.notes.timePlayStart, pitch);
    }, 0);
    this.notes.piano.keyUp({ midi: pitch });
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
