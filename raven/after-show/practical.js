import motif from './practical-motif.js';
import shadows from './practical-shadows.js';
import performance from './practical-performance.js';
import popup from './practical-popup.js';

export default function mount(ui) {
  ({leitmotif:motif, shadows, performance, popup})[ui.route](ui);
}
