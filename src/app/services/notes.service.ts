import { Injectable } from '@angular/core';
import { Piano } from '@tonejs/piano';
import { Cursor } from 'opensheetmusicdisplay';
import { MIDIOffset } from './midi.service';

// enum of possible note names
export enum NoteName {
  a = 'a',
  aS = 'aS',
  b = 'b',
  c = 'c',
  cS = 'cS',
  d = 'd',
  dS = 'dS',
  e = 'e',
  f = 'f',
  fS = 'fS',
  g = 'g',
  gS = 'gS',
}

// the state of a single key on the piano
type Key = {
  //
  timestamp: number;
  //
  staffId: number;
  //
  voice: number;
  // the note name
  note: NoteName;
  // is this a grace note
  grace: boolean;

  // whether the key is currently pressed
  pressed: boolean;
  // cycles since last pressed + 1
  pressedVal: number;
  // whether the key should be pressed for the current score
  required: boolean;
  // idk yet
  requiredVal: number;
  // which finger should press the key
  finger: string;
};

@Injectable({
  providedIn: 'root',
})
export class NotesService {
  // list of keys from 0-87
  public keys = Array<Key>(88);

  piano: Piano;

  timePlayStart: number = 0;
  tempoInBPM: number = 120;

  constructor() {
    this.keys = Array.from({ length: 88 }, (e, i) => {
      return {
        pressed: false,
        required: false,
        note: Object.keys(NoteName)[i % 12],
      } as Key;
    });

    // don't allow adding or removing keys
    // Object.seal(this.keys);

    // create the piano and load 1 velocity steps to reduce memory consumption
    this.piano = new Piano({
      velocities: 1,
    });
    //connect it to the speaker output
    this.piano.toDestination();

    this.piano.load();
  }

  clear(): void {
    this.keys.forEach((key) => {
      key.pressed = false;
      key.pressedVal = 0;

      key.required = false;
      key.requiredVal = 0;
    });
  }

  press(name: number): void {
    this.keys[name].pressed = true;
    this.keys[name].pressedVal = 1;
  }

  release(name: number): void {
    this.keys[name].pressed = false;
    this.keys[name].pressedVal = 0;
  }

  // Check that new notes have been pressed since the last successful check (value===1)
  private checkRequiredNew(): boolean {
    for (const key of this.keys.filter((key) => key.required)) {
      if (key.requiredVal === 0) {
        if (key.pressed) {
          if ((key.pressedVal ?? -1) > 1) {
            return false;
          }
        } else {
          return false;
        }
      }
    }
    return true;
  }

  // check whether all required notes have been pressed
  checkRequired(): boolean {
    // check only new notes, hold notes with pedals would be to difficult
    if (this.checkRequiredNew() === true) {
      // check that no pressed key is unexpected (red key)
      this.keys.forEach((key) => {
        if (key.pressed && !key.required) return false;
      });

      // mark all the notes as no longer new, go to next cycle
      this.keys.forEach((key) => {
        if (key.pressed) key.pressedVal++;
      });

      return true;
    }
    return false;
  }

  // calculate required notes, deleting ones out of phase and keeping track of new notes
  calculateRequired(cursor: Cursor, upperStave: boolean, lowerStave: boolean, back = false): void {
    // get current source time stamp
    const timestamp = cursor.iterator.CurrentSourceTimestamp.RealValue;

    this.keys
      .filter((key) => key.required)
      .forEach((key) => {
        key.requiredVal++;
      });

    // delete expired notes
    // TODO: merge with previous loop?
    this.keys
      .filter((key) => key.required)
      .forEach((key) => {
        if (back || timestamp >= key.timestamp) {
          key.required = false;
          key.requiredVal = 0;
        }
      });

    // register new notes under the cursor
    cursor.VoicesUnderCursor().forEach((voice) => {
      voice.Notes.forEach((note) => {
        this.tempoInBPM = note.SourceMeasure.TempoInBPM;
        if ((note.ParentStaff.Id === 1 && upperStave == true) || (note.ParentStaff.Id === 2 && lowerStave == true)) {
          if (note.isRest() === false) {
            // TODO: not sure why the halfTone is 9 off
            let key = this.keys[note.halfTone - 9];
            key.timestamp = timestamp + note.Length.RealValue;
            key.staffId = note.ParentStaff.Id;
            key.voice = voice.ParentVoice.VoiceId;
            key.finger = note.Fingering ? note.Fingering.value : '';
            key.grace = note.IsGraceNote;
            key.required = true;

            // in case of tie, check that it is a start note
            if (typeof note.NoteTie === 'undefined' || note === note.NoteTie.StartNote) {
              key.requiredVal = 0;
            } else {
              key.requiredVal = 1;
            }
          }
        }
      });
    });
  }

  // automatically play the correct notes (e.g., for playback without interaction)
  autoplay(midiPress: (note: number, velocity: number) => void, midiRelease: (note: number) => void): void {
    // release notes which are no longer required
    this.keys.forEach((key, index) => {
      if (key.pressed && !key.required) {
        midiRelease(index + MIDIOffset);
      }
    });

    // press new notes
    this.keys.forEach((key, index) => {
      if (key.required && key.requiredVal === 0) {
        // If already pressed, release first
        if (key.pressed) midiRelease(index + MIDIOffset);
        midiPress(index + MIDIOffset, 60);
      }
    });
  }
}
