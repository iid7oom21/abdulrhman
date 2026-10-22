// Test-only journey inputs. Never imported by the application or its HTML.
import { FILE_MANIFEST, ACTIVITIES } from '../modules/expansion-data.js';
export const SOLUTION_PAYLOADS = {
  A01:{face:'back',lamp:'uv',code:'B17-R'},A02:{fragments:['header','site','receipt','signature'],template:'LC-14'},
  A03:{morse:'MA22',caesar:'OPEN'},A04:{code:'4826'},A05:{examined:['crop','full'],detail:'EXT-02',exit:'outside'},
  A06:{lockSite:'EXT-02',latchSite:'AR-01'},A07:{region:'NORTH',document:'RC31',container:'BOX',cabinet:'7'},A08:{answer:'b'},
  A09:{route:'9364',phrase:'افتح درج الوارد الثاني'},A10:{acrostic:'درج ب',word:'استلام',code:'2479'},A11:{code:'042'},
  A12:{request:'E05',reason:'attachments-and-recipient'},A13:{lucian:'delivery',elias:'inspection',elena:'inventory',nora:'receipt',attachments:['E02','E03','E04'],fourth:'E05'},
  A14:{answer:'d'},A15:{sample:'elena',limit:'handling'},A16:{events:['intake','scan','review']},A17:{code:'5862'},
  A18:{clockOffset:7,alignment:36,position:'01:13'},A19:{direction:'reverse',location:'درج المراجعة الثالث',excerptSource:'E13',relation:'same-source'},
  A20:{strips:['intake','faces','sealed','review'],corner:'bottom-right',faces:'2'},A21:{code:'3814',word:'SOURCE'},A22:{version:'V1',key:'3148'},
  A23:{file:'back-v1',computedHashes:Object.fromEntries(FILE_MANIFEST.map(f=>[f.id,f.sha256]))},A24:{messages:['deposit','referral','copy','receipt','attach']},
  A25:{people:['elena','elias','nora','lucian'],code:'6284'},A26:{operations:['signatures','statement','export'],answer:'a',support:['E01','E07']},
  A27:{maintenance:'before',inventory:'after',memo:'before',origin:'unknown'},A28:{verdict:'rejected',support:['E10','E11','E14']},
  A29:{signatures:'authentic',production:'adrian',fire:'unknown',handling:'handling',omission:'unproven'},
  A30:{lockSource:'E03:1',auditSource:'E07:4',limitSource:'E08:4'},A31:{key:'7314'},A32:{answer:'c',support:['E07','E08'],attachment:'back-v1'},
};
export const solutionPayload = id => structuredClone(SOLUTION_PAYLOADS[id]);
export function acceptedPrefix(count) {
  return ACTIVITIES.slice(0, count).map(activity => ({activityId:activity.id,payload:solutionPayload(activity.id)}));
}
