import { TestBed } from '@angular/core/testing';

import { OsmdService } from './osmd.service';

describe('OsmdService', () => {
  let service: OsmdService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OsmdService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
