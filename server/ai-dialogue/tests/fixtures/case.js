// Entirely fictional mechanics fixture; no production story, cast or solution.
export const L = value => ({ar:value,en:value});
export function fixturePack(version = 'fixture-v1') {
  return {
    schemaVersion:1,caseId:'fixture',contentVersion:version,locales:['ar','en'],defaultLocale:'ar',
    initialSceneId:'desk',initialFlags:{read:false},initialMaterials:[],
    materials:{
      card:{title:L('Card A'),body:L('PUBLIC_CARD_BODY'),type:'document',source:L('Fixture tray')},
      sealed:{title:L('Sealed card'),body:L('UNSEEN_MATERIAL_SENTINEL'),type:'document',source:L('Fixture cabinet')},
    },
    scenes:{
      desk:{title:L('Desk'),body:L('Compare a card.'),
        lines:[{speaker:L('Guide'),text:L('GATED_LINE_SENTINEL'),requires:{flag:'read',equals:true}}],
        actions:[
          {id:'read',label:L('Read card'),requires:{not:{flag:'read',equals:true}},effects:{grant:['card'],set:{read:true}}},
          {id:'missing-false',label:L('Must stay hidden'),requires:{flag:'not_initialized',equals:false}},
          {id:'share',label:L('Share card'),requires:{hasMaterial:'card'},effects:{share:[{materialId:'card',recipient:'guide'}]}},
          {id:'bad-share',label:L('Impossible share'),effects:{share:[{materialId:'sealed',recipient:'guide'}]}},
          {id:'draft',label:L('Draft summary'),fields:[
            {id:'text',type:'textarea',label:L('Summary'),required:true,maxLength:50},
            {id:'position',type:'select',label:L('Position'),required:true,options:[{value:'unknown',label:L('Not known')},{value:'partial',label:L('Partial')}]},
            {id:'sources',type:'materialRefs',label:L('Sources'),required:true},
          ],effects:{capture:'summary'}},
          {id:'deposit',label:L('Confirm fictional deposit'),effects:{receipt:{kind:'submission',title:L('Fictional acknowledgement'),fromCapture:'summary'}}},
          {id:'correct',label:L('Confirm fictional correction'),effects:{receipt:{kind:'correction',title:L('Fictional correction'),fromCapture:'summary',relatesTo:'submission'}}},
          {id:'finish',label:L('End fixture'),target:'end',requires:{all:[{flag:'read',equals:true},{any:[{hasMaterial:'card'},{hasMaterial:'sealed'}]}]}},
        ]},
      end:{title:L('Fixture end'),body:L('FUTURE_SCENE_SENTINEL'),lines:[],actions:[]},
    },
  };
}
export const action = (revision, actionId, values = {}, id = 'operation-' + revision) => ({id,revision,contentVersion:'fixture-v1',actionId,values});
