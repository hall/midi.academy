import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';

import { NotesService } from '../services/notes.service';
import { MidiService } from '../services/midi.service';
import { PianoKeyboardComponent } from '../keyboard/keyboard.component';
import { SettingsService } from '../services/settings.service';
import { FeedbackService } from '../services/feedback.service';
import { CursorService } from '../services/cursor.service';
import { version } from '../../../package.json';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomePageComponent implements OnInit {
  @ViewChild(IonContent, { static: false }) content!: IonContent;
  @ViewChild(PianoKeyboardComponent) public keyboard?: PianoKeyboardComponent;
  osmd!: OpenSheetMusicDisplay;

  public version = version;

  fileLoadError: boolean = false;
  fileLoaded: boolean = false;
  isMobileLayout = false;

  @HostListener('document:keypress', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.key == ' ') {
      if (this.cursor.running) this.cursor.stop(this.osmd.cursor);
      else this.play(false);
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  onUnload(): void {
    this.settings.persist();
  }

  constructor(
    public notes: NotesService,
    public midi: MidiService,
    public settings: SettingsService,
    private feedback: FeedbackService,
    public cursor: CursorService,
    public changeRef: ChangeDetectorRef
  ) {
    midi.onChange.subscribe(() => {
      if (this.notes.checkRequired()) this.cursor.moveToNext(this.osmd.cursor);
    });
  }

  ngOnInit(): void {
    this.osmd = new OpenSheetMusicDisplay('osmdContainer', {
      // scroll page when cursor moves out of view
      followCursor: true,
    });
    // adjust zoom for mobile devices
    if (window.innerWidth <= 991) {
      this.isMobileLayout = true;
      this.settings.zoom = 70;
      this.osmd.zoom = this.settings.zoom / 100;
    }
    window.onresize = () => (this.isMobileLayout = window.innerWidth <= 991);
    this.changeRef.detectChanges();
  }

  // load selected file(s) from user's device
  loadFiles(files: Blob[]): void {
    for (let i = 0; i < files.length; i++) {
      const reader = new FileReader();
      reader.onload = (event: ProgressEvent<FileReader>) => {
        this.loadURL(event.target?.result?.toString() ?? '');
      };

      reader.readAsBinaryString(files[i]);
    }
  }

  // load remote URL
  loadURL(url: string): void {
    this.osmd.load(url).then(
      () => {
        this.osmd.render();
        this.fileLoaded = true;
        this.fileLoadError = false;
        this.reset();
      },
      () => {
        this.fileLoaded = false;
        this.fileLoadError = true;
      }
    );
  }

  // reset selection on measures and set the cursor to the origin
  reset(): void {
    this.cursor.stop(this.osmd.cursor);
    this.settings.checkboxStaveUp = true;
    this.settings.checkboxStaveDown = true;
    this.settings.startMeasure = 1;
    this.settings.endMeasure = this.osmd.Sheet.SourceMeasures.length;
  }

  // start playback, if autoplay then play notes automatically,
  // otherwise, wait for user input (i.e., "practice mode")
  play(autoplay = true): void {
    this.feedback.reset();
    this.content.scrollToTop();
    this.cursor.start(this.osmd.cursor, autoplay);
  }
}
