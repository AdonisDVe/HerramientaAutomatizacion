import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TestList } from './test-list';

describe('TestList', () => {
  let component: TestList;
  let fixture: ComponentFixture<TestList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TestList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
