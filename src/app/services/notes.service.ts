import { Injectable } from '@angular/core';
import { Piano } from '@tonejs/piano';
import { Cursor } from 'opensheetmusicdisplay';

export type NoteObject = {
  value: number;
  key: string;
  timestamp: number;
  staffId: number;
  voice: number;
  fingering: string;
  isGrace: boolean;
};

@Injectable({
  providedIn: 'root',
})
export class NotesService {
  mapPressed: Map<string, number> = new Map();
  // Initialize maps of notes coming from Music Sheet
  mapRequired = new Map<string, NoteObject>();
  mapPrevRequired = new Map<string, NoteObject>();

  piano: Piano;

  keys: string[] = [];
  keyStates: string[] = [];
  keyFingers: string[] = [];

  timePlayStart: number = 0;
  autoplaySkip: number = 0;
  tempoInBPM: number = 120;

  constructor() {
    // create the piano and load 1 velocity steps to reduce memory consumption
    this.piano = new Piano({
      velocities: 1,
    });
    //connect it to the speaker output
    this.piano.toDestination();

    this.piano.load();
  }

  getMapRequired(): Map<string, NoteObject> {
    return this.mapRequired;
  }

  getMapPrevRequired(): Map<string, NoteObject> {
    return this.mapPrevRequired;
  }

  getMapPressed(): Map<string, number> {
    return this.mapPressed;
  }

  clear(): void {
    this.mapPressed.clear();
    this.mapRequired.clear();
    this.mapPrevRequired.clear();
  }

  press(name: string): void {
    this.mapPressed.set(name, 1);
  }

  release(name: string): void {
    this.mapPressed.delete(name);
  }

  // Check that new notes have been pressed since the last successful check (value===1)
  private checkRequiredNew(): boolean {
    for (const [, noteObj] of this.mapRequired) {
      if (noteObj.value === 0) {
        if (this.mapPressed.has(noteObj.key)) {
          if ((this.mapPressed.get(noteObj.key) ?? -1) > 1) return false;
        } else {
          return false;
        }
      }
    }
    return true;
  }

  // Check required notes, if successful go to next cursor
  checkRequired(): boolean {
    // Check only new notes, hold notes with pedals would be to difficult
    if (this.checkRequiredNew() === true) {
      // Check that no pressed key is unexpected (red key)
      for (const [key] of this.mapPressed) if (!this.mapRequired.has(key)) return false;
      // Mark all the notes as no longer new, go to next cycle
      for (const [key, value] of this.mapPressed) this.mapPressed.set(key, value + 1);
      return true;
    }
    return false;
  }

  // Calculate required notes deleting ones out of phase and keeping track of new notes
  calculateRequired(cursor: Cursor, upperStave: boolean, lowerStave: boolean, back = false): void {
    // Get current source time stamp
    const timestamp = cursor.iterator.CurrentSourceTimestamp.RealValue;
    // Keep track of previous to avoid red keys before release, increment value
    this.mapPrevRequired.clear();
    for (const [key, noteObj] of this.mapRequired) {
      this.mapPrevRequired.set(key, noteObj);
      this.mapRequired.set(key, { ...noteObj, value: noteObj.value + 1 });
    }
    // Delete expired notes
    for (const [key, value] of this.mapRequired) {
      if (back || timestamp >= value.timestamp) {
        this.mapRequired.delete(key);
      }
    }
    // Register new notes under the cursor
    cursor.VoicesUnderCursor().forEach((voice) => {
      voice.Notes.forEach((value) => {
        this.tempoInBPM = value.SourceMeasure.TempoInBPM;
        if ((value.ParentStaff.Id === 1 && upperStave == true) || (value.ParentStaff.Id === 2 && lowerStave == true)) {
          if (value.isRest() === false) {
            const noteString = value.halfTone.toString();
            const noteTimestamp = timestamp + value.Length.RealValue;
            const fingering = value.Fingering ? value.Fingering.value : '';

            // In case of tie, check that it is a start note
            if (typeof value.NoteTie === 'undefined' || value === value.NoteTie.StartNote) {
              this.mapRequired.set(noteString, {
                value: 0,
                key: noteString,
                timestamp: noteTimestamp,
                staffId: value.ParentStaff.Id,
                voice: voice.ParentVoice.VoiceId,
                fingering: fingering,
                isGrace: value.IsGraceNote,
              });
            } else {
              this.mapRequired.set(noteString, {
                value: 1,
                key: noteString,
                timestamp: noteTimestamp,
                staffId: value.ParentStaff.Id,
                voice: voice.ParentVoice.VoiceId,
                fingering: fingering,
                isGrace: value.IsGraceNote,
              });
            }
          }
        }
      });
    });
  }

  // Update note status for piano keyboard
  autoplayRequired(midiPress: (note: number, velocity: number) => void, midiRelease: (note: number) => void): void {
    // Release notes no longer required
    for (const [key] of this.mapPressed) {
      if (!this.mapRequired.has(key)) {
        midiRelease(parseInt(key) + 12);
      }
    }

    // Press new notes
    for (const [key, value] of this.mapRequired) {
      if (value.value === 0) {
        // If already pressed, release first
        if (this.mapPressed.has(key)) {
          midiRelease(parseInt(key) + 12);
        }
        midiPress(parseInt(key) + 12, 60);
      }
    }
  }

  // Update note status for piano keyboard
  updateNotesStatus(): void {
    this.keyStates = Array.from({ length: 88 }, () => 'unpressed');
    this.keyFingers = Array.from({ length: 88 }, () => '');

    if (this.getMapRequired().size) {
      for (const [key] of this.getMapPressed()) {
        let i = parseInt(key) - 9;
        if (this.getMapRequired().has(key) && this.getMapPrevRequired().has(key)) {
          this.keyStates[i] = 'keep';
        } else if (this.getMapRequired().has(key)) {
          this.keyStates[i] = 'pressed';
        } else if (this.getMapPrevRequired().has(key)) {
          this.keyStates[i] = 'pressed';
        } else {
          this.keyStates[i] = 'wrong';
        }
      }
      for (const [, value] of this.getMapRequired()) {
        this.keyFingers[parseInt(value.key) - 9] = value.fingering;
      }
      for (const [key, value] of this.getMapRequired()) {
        let i = parseInt(key) - 9;
        if (value.value === 0) {
          if (this.keyStates[i] == 'unpressed') {
            this.keyStates[i] = 'un_required';
          } else if ((this.getMapPressed().get(key) ?? -1) > 1) {
            this.keyStates[parseInt(value.key) - 9] = 'required';
          }
        }
      }
    } else {
      for (const [key] of this.getMapPressed()) {
        this.keyStates[parseInt(key) - 9] = 'pressed';
      }
    }
    // this.changeRef.detectChanges();
  }
}
