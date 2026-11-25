import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';

const checkout=process.argv[2];
if (!checkout) throw new Error('Pass the path to the gh-pages checkout.');
const directory=path.join(checkout,'raven/late-night/ink/art/courier');
const manifest=JSON.parse(await readFile(path.join(directory,'manifest.json'),'utf8'));
const events=['departure','crossing','letter','arrival','shelter'];
const expected=['route',...events,...events.map(event=>'print-'+event)].sort();

function dimensions(file) {
  assert.equal(file.toString('ascii',0,4),'RIFF','Expected a RIFF image');
  assert.equal(file.toString('ascii',8,12),'WEBP','Expected a WebP image');
  assert.equal(file.readUInt32LE(4)+8,file.length,'Truncated RIFF container');
  for(let offset=12;offset+8<=file.length;) {
    const type=file.toString('ascii',offset,offset+4);
    const bytes=file.readUInt32LE(offset+4), data=offset+8;
    assert.ok(data+bytes<=file.length,'Truncated image chunk');
    if(type==='VP8 ') {
      assert.deepEqual([...file.subarray(data+3,data+6)],[0x9d,0x01,0x2a],'Invalid VP8 key frame');
      return [file.readUInt16LE(data+6)&0x3fff,file.readUInt16LE(data+8)&0x3fff];
    }
    if(type==='VP8L') {
      assert.equal(file[data],0x2f,'Invalid lossless image');
      const bits=file.readUInt32LE(data+1);
      return [(bits&0x3fff)+1,((bits>>>14)&0x3fff)+1];
    }
    offset=data+bytes+(bytes&1);
  }
  throw new Error('No still image in WebP container');
}

assert.ok(manifest.origin && manifest.usage && manifest.thirdPartyImages,'Missing the artwork source or usage statement');
assert.deepEqual(manifest.assets.map(a=>a.id).sort(),expected,'Incomplete or duplicate courier artwork');
const files=await readdir(directory);
assert.deepEqual(files.sort(),['manifest.json',...expected.map(id=>id+'.webp')].sort(),'Uncatalogued or missing files');
const fingerprints=new Set();
let total=0;
for(const asset of manifest.assets) {
  assert.equal(asset.file,asset.id+'.webp');
  assert.ok(asset.description.ar && asset.description.en,'Missing description for '+asset.id);
  const file=await readFile(path.join(directory,asset.file));
  const digest=createHash('sha256').update(file).digest('hex');
  assert.equal(asset.bytes,file.length,'Size mismatch for '+asset.file);
  assert.equal(asset.sha256,digest,'Checksum mismatch for '+asset.file);
  assert.ok(!fingerprints.has(digest),'Repeated artwork at '+asset.file);
  assert.deepEqual(dimensions(file),[asset.width,asset.height],'Wrong dimensions for '+asset.file);
  fingerprints.add(digest);
  total+=file.length;
}
console.log('Verified '+expected.length+' distinct courier images, '+total+' bytes.');
