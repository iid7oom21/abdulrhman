import fs from 'node:fs';
import {openDb,migrate} from './db.js';
const config=JSON.parse(fs.readFileSync(process.env.CONFIG || new URL('../config.example.json',import.meta.url),'utf8'));
if(config.simulation!==true)throw new Error('live_payments_not_implemented');
const db=openDb(config.dbPath);
try{migrate(db);console.log('Local simulation schema updated; no payment gateway.');}finally{db.close();}
