import { Injectable } from '@angular/core';
import { SettingsService } from './settings.service';

@Injectable({
  providedIn: 'root'
})
export class OsmdService {

  constructor(
    private settings: SettingsService
  ) { }

  resetFeedback(): void {
    let elems = document.getElementsByClassName('feedback');
    // Remove all elements
    while (elems.length > 0) {
      for (let i = 0; i < elems.length; i++) {
        const parent = elems[i].parentNode;
        if (parent) parent.removeChild(elems[i]);
      }
      elems = document.getElementsByClassName('feedback');
    }
  }

  hideFeedback(): void {
    document.querySelectorAll<HTMLElement>('.feedback').forEach(function (el) {
      el.style.visibility = 'hidden';
    });
  }

  showFeedback(): void {
    document.querySelectorAll<HTMLElement>('.feedback').forEach(function (el) {
      el.style.visibility = 'visible';
    });
  }

  // Present feedback text at cursor location
  textFeedback(text: string, x: number, y: number): void {
    const id =
      (document.getElementById('cursorImg-0')?.style.top ?? '') +
      x +
      '_' +
      (document.getElementById('cursorImg-0')?.style.left ?? '') +
      y +
      '_' +
      this.settings.repeat;
    const feedbackElementId = `feedback-${id}`;
    // find unique id in document
    if (document.getElementById(feedbackElementId)) {
      //const elem: HTMLElement = document.getElementById(feedbackElementId)
      //elem.innerHTML += text;
    } else {
      const elem: HTMLElement = document.createElement('p');
      elem.id = feedbackElementId;
      elem.className = 'feedback r' + this.settings.repeat;
      elem.style.position = 'absolute';
      elem.style.zIndex = '-1';
      elem.innerHTML = text;
      const parent = document.getElementById('osmdCanvasPage1');
      if (parent) parent.appendChild(elem);
      elem.style.top = parseInt(document.getElementById('cursorImg-0')?.style.top ?? '') - 40 - y + 'px';
      elem.style.left = parseInt(document.getElementById('cursorImg-0')?.style.left ?? '') + x + 'px';
    }
  }
}
