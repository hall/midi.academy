import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  language: string = 'gb';

  // Music Sheet GUI
  checkboxStaveUp: boolean = true;
  checkboxStaveDown: boolean = true;
  checkboxAutoplay: boolean = false;
  checkboxColor: boolean = false;
  checkboxKeyboard: boolean = false;
  startMeasure = 0;
  endMeasure = 0;
  repeat: number = 0;
  zoom: number = 100;
  speed: number = 100;
  backgroundColor: string = '#ffffff';

  constructor(public _translate: TranslateService) {
    this._translate.use(this.language);

    // initialize values if they were previously persisted
    for (let p in this) {
      if (p.startsWith('_')) continue;
      let store = localStorage.getItem(p);
      if (store !== null) this[p] = JSON.parse(store);
    }
  }

  // save properties to local storage
  persist() {
    for (let p in this) {
      if (p.startsWith('_')) continue;
      localStorage.setItem(p, JSON.stringify(this[p]));
    }
  }

  useLanguage(event: any): void {
    this.language = event.detail.value;
    this._translate.use(event.detail.value);
  }

  updateZoom(value: number, osmd: OpenSheetMusicDisplay): void {
    this.zoom = value;
    osmd.Zoom = this.zoom / 100;
    osmd.render();
  }

  updateColor(checked: boolean, osmd: OpenSheetMusicDisplay): void {
    this.checkboxColor = checked;
    osmd.setOptions({
      coloringMode: this.checkboxColor ? 1 : 0,
    });
    osmd.render();
  }
}
