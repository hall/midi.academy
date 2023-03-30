import { Component } from '@angular/core';
import { NotesService } from '../services/notes.service';

@Component({
  selector: 'app-keyboard',
  templateUrl: './keyboard.component.html',
  styleUrls: ['./keyboard.component.scss'],
})
export class PianoKeyboardComponent {

  constructor(public notes: NotesService) {
    this.notes.keys = [];
    this.notes.keyStates = [];
    this.notes.keyFingers = [];

    // Initialize keyboard to unpressed
    for (let i = 0; i < 88; i++) {
      this.notes.keyStates.push('unpressed');
      this.notes.keyFingers.push('');
    }
    // Generate keyboard
    this.notes.keys = this.notes.keys.concat(['white a', 'black as ', 'white b']);
    for (let i = 0; i < 7; i++) {
      this.notes.keys = this.notes.keys.concat([
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
      ]);
    }
    this.notes.keys = this.notes.keys.concat(['white c']);
  }

}
