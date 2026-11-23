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
