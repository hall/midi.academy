import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';

import { NotesService } from '../services/notes.service';
import { MidiService } from '../services/midi.service';
import { PianoKeyboardComponent } from '../keyboard/keyboard.component';
import { SettingsService } from '../services/settings.service';
import { OsmdService } from '../services/osmd.service';
import { version } from '../../../package.json';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomePageComponent implements OnInit {
  @ViewChild(IonContent, { static: false }) content!: IonContent;
  @ViewChild(PianoKeyboardComponent) public pianoKeyboard?: PianoKeyboardComponent;
  osmd!: OpenSheetMusicDisplay;

  public version = version;

  running: boolean = false;
  fileLoadError: boolean = false;
  fileLoaded: boolean = false;
  isMobileLayout = false;

  constructor(
    private notes: NotesService,
    public midi: MidiService,
    public settings: SettingsService,
    private osmdService: OsmdService,
    public changeRef: ChangeDetectorRef
  ) {
    midi.onChange.subscribe(this.osmdCursorPlayMoveNext());
  }

  ngOnInit(): void {
    this.osmd = new OpenSheetMusicDisplay('osmdContainer', {
      backend: 'svg',
      drawTitle: true,
      coloringMode: this.settings.checkboxColor ? 1 : 0,
      followCursor: true,
      useXMLMeasureNumbers: false,
      cursorsOptions: [
        { type: 1, color: '#33e02f', alpha: 0.8, follow: true },
        { type: 2, color: '#ccc', alpha: 0.8, follow: false },
      ],
    });
    // Adjust zoom for mobile devices
    if (window.innerWidth <= 991) {
      this.isMobileLayout = true;
      this.settings.zoom = 70;
      this.osmd.zoom = this.settings.zoom / 100;
    }
    window.onresize = () => (this.isMobileLayout = window.innerWidth <= 991);
    this.changeRef.detectChanges();
  }

  osmdLoadFiles(files: Blob[]): void {
    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
      this.osmdLoadURL(event.target?.result?.toString() ?? '');
    };
    files.forEach((file) => {
      reader.readAsBinaryString(file);
    });
  }

  osmdLoadURL(url: string): void {
    this.osmd.load(url).then(
      () => {
        this.osmd.render();
        this.fileLoaded = true;
        this.fileLoadError = false;
        this.osmdReset();
      },
      () => {
        this.fileLoaded = false;
        this.fileLoadError = true;
      }
    );
  }

  osmdCursorMoveNext(index: number): boolean {
    if (!this.running) return false;
    this.osmd.cursors[index].next();
    // Move to first valid measure
    if (this.settings.startMeasure > this.osmd.cursors[index].iterator.CurrentMeasureIndex + 1) {
      return this.osmdCursorMoveNext(index);
    }
    return true;
  }

  osmdCursorTempoMoveNext(): void {
    // Required to stop next calls if stop is pressed during play
    if (!this.running) return;
    if (!this.osmdEndReached(1)) this.osmdCursorMoveNext(1);
    let timeout = 0;
    // if ended reached check repeat and stat or stop
    if (this.osmdEndReached(1)) {
      // Calculate time to end of compass
      timeout =
        ((this.osmd.cursors[1].iterator.CurrentMeasure.AbsoluteTimestamp.RealValue +
          this.osmd.cursors[1].iterator.CurrentMeasure.Duration.RealValue -
          this.osmd.cursors[1].iterator.CurrentSourceTimestamp.RealValue) *
          4 *
          60000) /
        this.notes.tempoInBPM /
        (this.settings.speed / 100);
      setTimeout(() => {
        if (!this.osmdEndReached(0)) this.osmdService.textFeedback('🐢', 0, 40);
        this.osmd.cursors[1].hide();
      }, timeout);
    } else {
      // Move to Next
      const it2 = this.osmd.cursors[1].iterator.clone();
      it2.moveToNext();
      timeout =
        ((it2.CurrentSourceTimestamp.RealValue - this.osmd.cursors[1].iterator.CurrentSourceTimestamp.RealValue) *
          4 *
          60000) /
        this.notes.tempoInBPM /
        (this.settings.speed / 100);
      setTimeout(() => {
        this.osmdCursorTempoMoveNext();
      }, timeout);
    }
    // If auto play, then play notes
    if (this.settings.checkboxAutoplay) {
      // Skip when ties only occurred
      if (this.notes.autoplaySkip > 0) {
        this.notes.autoplaySkip--;
      } else this.notes.autoplayRequired(this.midi.pressNote.bind(this), this.midi.releaseNote.bind(this));
    }
  }

  osmdEndReached(cursorId: number): boolean {
    if (this.osmd.cursors[cursorId].iterator.EndReached) {
      return true;
    } else {
      const it2 = this.osmd.cursors[cursorId].iterator.clone();
      it2.moveToNext();
      if (it2.EndReached || this.settings.endMeasure < it2.CurrentMeasureIndex + 1) {
        return true;
      }
    }
    return false;
  }

  // Move cursor to next note
  osmdCursorPlayMoveNext(): void {
    // Required to stop next calls if stop is pressed during play
    if (!this.running) return;
    // if ended reached check repeat and stat or stop
    if (this.osmdEndReached(0)) {
      const timeout =
        ((this.osmd.cursors[0].iterator.CurrentMeasure.AbsoluteTimestamp.RealValue +
          this.osmd.cursors[0].iterator.CurrentMeasure.Duration.RealValue -
          this.osmd.cursors[0].iterator.CurrentSourceTimestamp.RealValue) *
          4 *
          60000) /
        this.notes.tempoInBPM /
        (this.settings.speed / 100);
      this.osmd.cursors[0].hide();
      setTimeout(() => {
        if (this.settings.repeat > 0) {
          this.settings.repeat--;
          this.osmdCursorStart();
        } else {
          this.osmdCursorStop();
          // this.settings.repeat = this.settings.repeatCfg;
        }
      }, timeout);
      return;
    }
    // Move to next
    if (!this.osmdCursorMoveNext(0)) return;
    // Calculate notes
    this.notes.calculateRequired(this.osmd.cursors[0], this.settings.checkboxStaveUp, this.settings.checkboxStaveDown);
    this.notes.tempoInBPM = this.notes.tempoInBPM;
    // Update keyboard
    if (this.pianoKeyboard) this.notes.updateNotesStatus();

    // If ties only move to next ans skip one additional autoplay
    if (this.notes.checkRequired()) {
      this.notes.autoplaySkip++;
      this.osmdCursorPlayMoveNext();
    }
  }

  osmdCursorStop(): void {
    this.settings.checkboxAutoplay = false;
    this.osmd.cursors.forEach((cursor) => {
      cursor.hide();
      cursor.reset();
    });
    this.osmdService.showFeedback();
    this.running = false;
    this.notes.clear();
    for (const [key] of this.midi.mapNotesAutoPressed) {
      this.midi.releaseNote(parseInt(key) + 12);
    }
    if (this.pianoKeyboard) this.notes.updateNotesStatus();
  }

  // Reset selection on measures and set the cursor to the origin
  osmdReset(): void {
    this.osmdCursorStop();
    this.settings.checkboxStaveUp = true;
    this.settings.checkboxStaveDown = true;
    this.settings.startMeasure = 1;
    this.settings.endMeasure = this.osmd.Sheet.SourceMeasures.length;
  }

  osmdPlay(autoplay = true, flashCount = 0): void {
    this.running = true;
    this.notes.autoplaySkip = 0;
    this.osmdService.resetFeedback();
    this.settings.checkboxAutoplay = autoplay;
    this.startFlashCount = flashCount;
    this.osmdCursorStart();
  }

  startFlashCount = 0;
  osmdPractice(): void {
    this.osmdPlay(false, 4);
  }

  // Resets the cursor to the first note
  osmdCursorStart(): void {
    this.content.scrollToTop();
    this.osmd.cursors.forEach((cursor, index) => {
      if (index != 0) cursor.show();
      cursor.reset();
    });
    // // Additional tasks in case of new start, not required in repetition
    // if (this.settings.repeat == this.settings.repeatCfg) {
    //   this.notes.clear();
    //   // free auto pressed notes
    //   for (const [key] of this.midi.mapNotesAutoPressed) {
    //     this.midi.releaseNote(parseInt(key) + 12);
    //   }
    // }

    this.osmdService.hideFeedback();

    if (this.settings.startMeasure > this.osmd.cursors[0].iterator.CurrentMeasureIndex + 1) {
      if (!this.osmdCursorMoveNext(0)) return;
      this.osmdCursorMoveNext(1);
    }
    // Calculate first notes
    this.notes.calculateRequired(
      this.osmd.cursors[0],
      this.settings.checkboxStaveUp,
      this.settings.checkboxStaveDown,
      true
    );
    this.notes.tempoInBPM = this.notes.tempoInBPM;
    // Update keyboard
    if (this.pianoKeyboard) this.notes.updateNotesStatus();
    this.osmdCursorStart2();
  }

  osmdCursorStart2(): void {
    if (this.startFlashCount > 0) {
      if (this.osmd.cursors[0].hidden) this.osmd.cursors[0].show();
      else this.osmd.cursors[0].hide();
      this.startFlashCount--;
      setTimeout(() => {
        this.osmdCursorStart2();
      }, 1000);
      return;
    }
    this.startFlashCount = 0;
    this.osmd.cursors[0].show();
    this.notes.timePlayStart = Date.now();
    // Skip initial rests
    if (this.notes.checkRequired()) {
      this.notes.autoplaySkip++;
      this.osmdCursorPlayMoveNext();
    }
    // if required play
    if (this.settings.checkboxAutoplay) {
      // Skip when ties only occured
      if (this.notes.autoplaySkip > 0) {
        this.notes.autoplaySkip--;
      } else this.notes.autoplayRequired(this.midi.pressNote.bind(this), this.midi.releaseNote.bind(this));
    }
    const it2 = this.osmd.cursors[0].iterator.clone();
    it2.moveToNext();
    const timeout =
      ((it2.CurrentSourceTimestamp.RealValue - this.osmd.cursors[0].iterator.CurrentSourceTimestamp.RealValue) *
        4 *
        60000) /
      this.notes.tempoInBPM /
      (this.settings.speed / 100);
    setTimeout(() => {
      this.osmdCursorTempoMoveNext();
    }, timeout);
  }
}
