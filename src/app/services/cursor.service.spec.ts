import { TestBed } from '@angular/core/testing';

import { CursorService } from './cursor.service';

describe('CursorService', () => {
  let service: CursorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CursorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
