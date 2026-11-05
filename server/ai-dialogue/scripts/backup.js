import {createBackup,restoreBackup} from '../src/backup.js';
const [action,source,destination,...extra]=process.argv.slice(2);
if(!['create','restore'].includes(action)||!source||!destination||extra.length){
  console.error('Usage: node scripts/backup.js create|restore SOURCE NEW_DESTINATION');process.exitCode=1;
}else try{
  const result=(action==='create'?createBackup:restoreBackup)(source,destination);
  console.log(JSON.stringify({action,status:'ok',...result}));
}catch(error){console.error(JSON.stringify({action,status:'failed',code:error.code||(['invalid_backup','backup_too_large'].includes(error.message)?error.message:'invalid_or_unavailable_snapshot')}));process.exitCode=1;}
