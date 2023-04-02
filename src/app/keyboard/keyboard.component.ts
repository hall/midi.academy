import { Component } from '@angular/core';
import { NotesService } from '../services/notes.service';

@Component({
  selector: 'app-keyboard',
  templateUrl: './keyboard.component.html',
  styleUrls: ['./keyboard.component.scss'],
})
export class PianoKeyboardComponent {
  constructor(public notes: NotesService) {}
}
