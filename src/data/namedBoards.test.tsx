import {afterEach,expect,it} from 'vitest';
import {boardList,boardReturn,loadBoard,saveBoard} from './namedBoards';
const prefix='raven.studio.named-board.v1.';
function fixture(id:string){
  return {version:1,id,name:id,source:{kind:'cut',route:'edit',shots:['hand']},
    scenes:[{id:'cut-1',sceneNumber:1,title:'Hand',prompt:'Hold',duration:4,camera:'static-tripod',transition:'cut',thumbnail:'../raven/after-show/assets/hand.webp'}]};
}
afterEach(()=>localStorage.clear());
it('keeps other board names and later edits from another tab',()=>{
  for(const id of ['first','second'])localStorage.setItem(prefix+id,JSON.stringify(fixture(id)));
  const original=loadBoard('first')!;
  const edit=saveBoard(original,original.board.scenes.map(s=>({...s,prompt:'Turn'})))!;
  expect(edit.board.scenes[0].prompt).toBe('Turn');
  expect(saveBoard(original,[])).toBeNull();
  expect(loadBoard('second')!.board.scenes[0].prompt).toBe('Hold');
  expect(boardList().map(b=>b.name).sort()).toEqual(['first','second']);
  expect(boardReturn(edit.board.source,'ar')).toBe('../raven/after-show/?activity=edit&lang=ar');
});
it('ignores unrelated stores and rejects untrusted thumbnail paths',()=>{
  const record=fixture('first');record.scenes[0].thumbnail='https://outside.invalid/frame.jpg';
  localStorage.setItem(prefix+'first',JSON.stringify(record));
  localStorage.setItem('other-entry',JSON.stringify(fixture('other')));
  expect(loadBoard('first')).toBeNull();expect(boardList()).toEqual([]);
});

it('opens each manga in its own activity and rejects uncatalogued panel assets',()=>{
  const page={...fixture('press'),source:{kind:'manga',activity:'ink-page',piece:'edition-1'}};
  page.scenes[0].thumbnail='../raven/late-night/ink/art/panel-press.webp';
  localStorage.setItem(prefix+'press',JSON.stringify(page));
  const loaded=loadBoard('press')!;
  expect(boardReturn(loaded.board.source,'ar')).toBe('../raven/late-night/ink-page.html?piece=edition-1&lang=ar');
  const copy={...page,source:{...page.source,activity:'ink-courier'}};
  localStorage.setItem(prefix+'press',JSON.stringify(copy));
  expect(loadBoard('press')).toBeNull();
  copy.scenes[0].thumbnail='../raven/late-night/ink/art/courier/print-letter.webp';
  localStorage.setItem(prefix+'press',JSON.stringify(copy));
  expect(boardReturn(loadBoard('press')!.board.source,'en')).toBe('../raven/late-night/ink-courier.html?piece=edition-1&lang=en');
  copy.scenes[0].thumbnail='../raven/late-night/ink/art/courier/private.webp';
  localStorage.setItem(prefix+'press',JSON.stringify(copy));
  expect(loadBoard('press')).toBeNull();
});
