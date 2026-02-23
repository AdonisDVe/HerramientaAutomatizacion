import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  // 1. IMPORTANTE: Aquí solo debe quedar RouterOutlet
  imports: [RouterOutlet], 
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('novum-qa-dashboard');
}