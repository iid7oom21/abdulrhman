import {titles,parallax} from './screencraft-glass.js';
import {subtitles} from './screencraft-subtitles.js';
import {blocking} from './screencraft-blocking.js';

const rooms={titles,parallax,subtitles,blocking};
export default function mount(ui){rooms[ui.route](ui);}
