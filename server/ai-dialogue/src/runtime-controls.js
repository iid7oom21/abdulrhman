import fs from 'node:fs';

// Operator-owned configuration. No HTTP route writes this file or enables purchases.
export function runtimeControls(env=process.env){
  return ()=>{
    let providerCallsEnabled=env.RAVEN_MODEL_CALLS_ENABLED!=='0',controlAvailable=true;
    if(env.RAVEN_RUNTIME_CONTROL_PATH){
      try{
        if(fs.statSync(env.RAVEN_RUNTIME_CONTROL_PATH).size>1000)throw new Error('size');
        const state=JSON.parse(fs.readFileSync(env.RAVEN_RUNTIME_CONTROL_PATH,'utf8'));
        if(!state||state.version!==1||typeof state.providerCallsEnabled!=='boolean'||Object.keys(state).some(k=>!['version','providerCallsEnabled'].includes(k)))throw new Error('schema');
        providerCallsEnabled=providerCallsEnabled&&state.providerCallsEnabled;
      }catch{providerCallsEnabled=false;controlAvailable=false;}
    }
    return {providerCallsEnabled,controlAvailable,purchasesEnabled:false,entitlementUseEnabled:false,writtenDialogueAvailable:true};
  };
}
