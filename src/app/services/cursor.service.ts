import { Injectable } from '@angular/core';
import { Cursor } from 'opensheetmusicdisplay';
import { NotesService } from './notes.service';
import { FeedbackService } from './feedback.service';
import { SettingsService } from './settings.service';

@Injectable({
  providedIn: 'root',
})
export class CursorService {
  running: boolean = false;
  autoplaySkip: number = 0;
  autoplay: boolean = false;

  constructor(public settings: SettingsService, public feedback: FeedbackService, public notes: NotesService) {}

  // reset the cursor to the first note
  start(cursor: Cursor, autoplay = false): void {
    this.running = true;
    this.autoplaySkip = 0;
    this.autoplay = autoplay;

    cursor.show();
    cursor.reset();

    // TODO: Additional tasks in case of new start, not required in repetition
    // if (this.settings.repeat == this.settings.repeatCfg) {
    this.notes.clear();
    // free auto pressed notes
    // }

    this.feedback.hide();

    if (this.settings.startMeasure > cursor.iterator.CurrentMeasureIndex + 1) {
      this.moveToNext(cursor);
    }

    // calculate the first set of notes which need to be played
    this.notes.calculateRequired(cursor, this.settings.checkboxStaveUp, this.settings.checkboxStaveDown, true);

    this.notes.timePlayStart = Date.now();

    // Skip initial rests
    if (this.notes.checkRequired()) {
      this.autoplaySkip++;
      this.moveToNext(cursor);
    }

    // if required play
    if (this.autoplay) {
      // skip when ties only occurred
      if (this.autoplaySkip > 0) {
        this.autoplaySkip--;
      } else {
        this.notes.autoplay();
      }
    }

    const it2 = cursor.iterator.clone();
    it2.moveToNext();
    const timeout =
      ((it2.CurrentSourceTimestamp.RealValue - cursor.iterator.CurrentSourceTimestamp.RealValue) * 4 * 60000) /
      this.notes.tempoInBPM /
      (this.settings.speed / 100);
    setTimeout(() => {
      this.moveForward(cursor);
    }, timeout);
  }

  // stop playback and reset
  stop(cursor: Cursor): void {
    this.autoplay = false;
    cursor.hide();
    cursor.reset();
    this.feedback.show();
    this.running = false;
    this.notes.clear();
  }

  // move cursor to next note(s)
  moveToNext(cursor: Cursor): boolean {
    if (!this.running) return false;
    cursor.next();
    // Move to first valid measure
    if (this.settings.startMeasure > cursor.iterator.CurrentMeasureIndex + 1) {
      return this.moveToNext(cursor);
    }
    return true;
  }

  // move cursor to next set of notes
  moveForward(cursor: Cursor): void {
    // Required to stop next calls if stop is pressed during play
    if (!this.running) return;

    // if ended reached check repeat and stat or stop
    if (this.endReached(cursor)) {
      // Calculate time to end of compass
      let timeout =
        ((cursor.iterator.CurrentMeasure.AbsoluteTimestamp.RealValue +
          cursor.iterator.CurrentMeasure.Duration.RealValue -
          cursor.iterator.CurrentSourceTimestamp.RealValue) *
          4 *
          60000) /
        this.notes.tempoInBPM /
        (this.settings.speed / 100);
      setTimeout(() => {
        cursor.hide();
      }, timeout);
    } else {
      // Move to Next
      const it2 = cursor.iterator.clone();
      it2.moveToNext();
      let timeout =
        ((it2.CurrentSourceTimestamp.RealValue - cursor.iterator.CurrentSourceTimestamp.RealValue) * 4 * 60000) /
        this.notes.tempoInBPM /
        (this.settings.speed / 100);
      setTimeout(() => {
        this.moveForward(cursor);
      }, timeout);
    }
    this.notes.calculateRequired(cursor, this.settings.checkboxStaveUp, this.settings.checkboxStaveDown);

    // If auto play, then play notes
    if (this.autoplay) {
      // if there are only tie notes, skip this cycle
      if (this.autoplaySkip > 0) {
        this.autoplaySkip--;
      } else this.notes.autoplay();
    }
  }

  // return true if end has been reached, false otherwise
  endReached(cursor: Cursor): boolean {
    if (cursor.iterator.EndReached) return true;

    const it2 = cursor.iterator.clone();
    it2.moveToNext();
    if (it2.EndReached || this.settings.endMeasure < it2.CurrentMeasureIndex + 1) {
      return true;
    }

    return false;
  }
}
