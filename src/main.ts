import '@babylonjs/loaders/glTF';
import './styles/main.css';
import { Experience } from './core/Experience';

const canvas = document.getElementById('render-canvas') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui-root') as HTMLElement;

const experience = new Experience(canvas, uiRoot);
void experience.start();

// Acceso desde la consola del navegador para depurar (solo en desarrollo)
if (import.meta.env.DEV) {
  (window as unknown as { experience: Experience }).experience = experience;
}
