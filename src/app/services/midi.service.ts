import { EventEmitter, Injectable } from '@angular/core';
import { NotesService } from './notes.service';
import { OsmdService } from './osmd.service';

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

  constructor(private notes: NotesService, private osmd: OsmdService) {
    // Initialize MIDI
    navigator.requestMIDIAccess?.({ sysex: true }).then(this.success.bind(this), () => {
      this.available = false;
    });
  }

  // Register MIDI Inputs' handlers and outputs
  initDev(access: MIDIAccess): void {
    const iterInputs = access.inputs.values();
    const inputs = [];
    for (let o = iterInputs.next(); !o.done; o = iterInputs.next()) {
      if (!o.value.name?.includes('Midi Through')) inputs.push(o.value);
    }
    this.device = 'none';

    for (let port = 0; port < inputs.length; port++) {
      this.device = inputs[port].name + ' (' + inputs[port].manufacturer + ')';
      inputs[port].onmidimessage = (event: MIDIMessageEvent) => {
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
    }

    const iterOutputs = access.outputs.values();
    const outputs = [];
    for (let o = iterOutputs.next(); !o.done; o = iterOutputs.next()) {
      if (!o.value.name?.includes('Midi Through')) outputs.push(o.value);
    }

    this.inputs = inputs;
    this.outputs = outputs;
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

  // Release note on Ouput MIDI Device
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

  // Midi input note pressed
  noteOn(time: number, pitch: number /*, velocity: number*/): void {
    this.refreshWakeLock();
    const halbTone = pitch - 12;
    const name = halbTone.toFixed();
    this.notes.press(name);

    // wrong key pressed
    if (!this.notes.getMapRequired().has(name)) {
      this.osmd.textFeedback('❌', 0, 20);
    }

    this.onChange.emit();
  }

  // Midi input note released
  noteOff(time: number, pitch: number): void {
    const halbTone = pitch - 12;
    const name = halbTone.toFixed();
    this.notes.release(name);

    this.onChange.emit();
  }

  // Refresh wakelock for two minutes
  refreshWakeLock(): void {
    if (navigator.wakeLock) {
      if (!this.wakeLockObj) {
        navigator.wakeLock.request('screen').then((wakeLock) => {
          this.wakeLockObj = wakeLock;
          this.wakeLockObj.addEventListener('release', () => {
            this.wakeLockObj = undefined;
          });
          //})
          //.catch((err) => {
          // console.log('wakelock failed to acquire: ' + err.message);
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
