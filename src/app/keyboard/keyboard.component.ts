import { Component } from '@angular/core';
import { NotesService } from '../services/notes.service';

@Component({
  selector: 'app-keyboard',
  templateUrl: './keyboard.component.html',
  styleUrls: ['./keyboard.component.scss'],
})
export class PianoKeyboardComponent {
  constructor(public notes: NotesService) {
    // initialize keyboard state
    this.notes.keyStates = Array.from({ length: 88 }, () => 'unpressed');
    this.notes.keyFingers = Array.from({ length: 88 }, () => '');

    // generate keys
    this.notes.keys = ['white a', 'black as', 'white b']
      .concat(
        Array.from({ length: 7 }, () => [
          'white c',
          'black cs',
          'white d',
          'black ds',
          'white e',
          'white f',
          'black fs',
          'white g',
          'black gs',
          'white a',
          'black as',
          'white b',
        ]).flat()
      )
      .concat(['white c']);
  }
}
