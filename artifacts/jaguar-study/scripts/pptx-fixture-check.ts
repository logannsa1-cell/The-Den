/*
 * Synthetic PPTX fixture check for src/lib/pptx.ts.
 * Run: npx tsx scripts/pptx-fixture-check.ts
 * Covers: master background image + decorative shape, layout title placeholder inheritance,
 * master text styles/theme fonts/colors, slide paragraph, picture crop, layer order,
 * and non-numeric presentation order (slide2.xml is presented first).
 */
import { createRequire } from 'node:module';
import JSZip from 'jszip';
import { parsePptx } from '../src/lib/pptx';

const require = createRequire(import.meta.url);
let DOMParserImpl: unknown;
try { DOMParserImpl = require('@xmldom/xmldom').DOMParser; }
catch { DOMParserImpl = require('../../../node_modules/.pnpm/@xmldom+xmldom@0.8.15/node_modules/@xmldom/xmldom').DOMParser; }
(globalThis as Record<string, unknown>).DOMParser = DOMParserImpl;

const A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const REL = (rels: [string, string, string][]) => `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.map(([id, type, t]) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${t}"/>`).join('')}</Relationships>`;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const xfrm = (x: number, y: number, w: number, h: number) => `<a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>`;
const slide = (title: string, body: string, pic: boolean) => `<p:sld ${A}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
  <p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="en"/><a:t>${title}</a:t></a:r></a:p></p:txBody></p:sp>
  <p:sp><p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>${xfrm(914400, 1828800, 7315200, 2743200)}</p:spPr><p:txBody><a:bodyPr anchor="ctr"/><a:p><a:pPr algn="just"/><a:r><a:rPr sz="2400"><a:latin typeface="Garamond"/></a:rPr><a:t>${body}</a:t></a:r></a:p></p:txBody></p:sp>
  ${pic ? `<p:pic><p:nvPicPr><p:cNvPr id="4" name="Pic"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rIdImg"/><a:srcRect l="10000" r="10000"/></p:blipFill><p:spPr>${xfrm(0, 0, 952500, 952500)}</p:spPr></p:pic>` : ''}
</p:spTree></p:cSld></p:sld>`;

async function build() {
  const z = new JSZip();
  z.file('ppt/presentation.xml', `<p:presentation ${A}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rIdM"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="rIdB"/><p:sldId id="257" r:id="rIdA"/></p:sldIdLst><p:sldSz cx="9144000" cy="5143500"/></p:presentation>`);
  z.file('ppt/_rels/presentation.xml.rels', REL([['rIdA', 'slide', 'slides/slide1.xml'], ['rIdB', 'slide', 'slides/slide2.xml'], ['rIdM', 'slideMaster', 'slideMasters/slideMaster1.xml']]));
  z.file('ppt/slides/slide1.xml', slide('Second in order', 'Body of file slide1.', false));
  z.file('ppt/slides/slide2.xml', slide('Nigerian Contemporary Artists', 'Contemporary art in Nigeria means modern art styles in Nigeria.', true));
  for (const n of [1, 2]) z.file(`ppt/slides/_rels/slide${n}.xml.rels`, REL([['rIdL', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rIdImg', 'image', '../media/image1.png']]));
  z.file('ppt/slideLayouts/slideLayout1.xml', `<p:sldLayout ${A}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
    <p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr>${xfrm(1828800, 0, 5486400, 457200)}<a:solidFill><a:schemeClr val="tx1"/></a:solidFill></p:spPr><p:txBody><a:bodyPr anchor="ctr"/><a:lstStyle><a:lvl1pPr algn="ctr"><a:defRPr sz="2000" b="1"><a:solidFill><a:schemeClr val="bg1"/></a:solidFill></a:defRPr></a:lvl1pPr></a:lstStyle><a:p><a:r><a:t>Click to edit</a:t></a:r></a:p></p:txBody></p:sp>
    <p:sp><p:nvSpPr><p:cNvPr id="3" name="Card"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${xfrm(457200, 457200, 8229600, 4229100)}<a:prstGeom prst="rect"/><a:solidFill><a:srgbClr val="F7F7F5"/></a:solidFill><a:ln w="9525"><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:ln></p:spPr></p:sp>
  </p:spTree></p:cSld></p:sldLayout>`);
  z.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', REL([['rIdM', 'slideMaster', '../slideMasters/slideMaster1.xml']]));
  z.file('ppt/slideMasters/slideMaster1.xml', `<p:sldMaster ${A}><p:cSld><p:bg><p:bgPr><a:blipFill><a:blip r:embed="rIdBg"/><a:stretch/></a:blipFill></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
    <p:sp><p:nvSpPr><p:cNvPr id="2" name="Tab"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${xfrm(0, 2286000, 457200, 457200)}<a:prstGeom prst="rect"/><a:solidFill><a:schemeClr val="tx2"><a:lumMod val="75000"/></a:schemeClr></a:solidFill></p:spPr></p:sp>
    <p:sp><p:nvSpPr><p:cNvPr id="3" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr>${xfrm(0, 0, 100, 100)}</p:spPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>Master prompt</a:t></a:r></a:p></p:txBody></p:sp>
  </p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
    <p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="4400"><a:latin typeface="+mj-lt"/></a:defRPr></a:lvl1pPr></p:titleStyle><p:bodyStyle/><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>`);
  z.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', REL([['rIdT', 'theme', '../theme/theme1.xml'], ['rIdBg', 'image', '../media/wood.png']]));
  z.file('ppt/theme/theme1.xml', `<a:theme ${A} name="T"><a:themeElements><a:clrScheme name="c"><a:dk1><a:srgbClr val="111111"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="403020"/></a:dk2><a:lt2><a:srgbClr val="EEE8DD"/></a:lt2><a:accent1><a:srgbClr val="6B7B2A"/></a:accent1></a:clrScheme><a:fontScheme name="f"><a:majorFont><a:latin typeface="Book Antiqua"/></a:majorFont><a:minorFont><a:latin typeface="Garamond"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>`);
  z.file('ppt/media/image1.png', PNG);
  z.file('ppt/media/wood.png', PNG);
  return new Blob([await z.generateAsync({ type: 'uint8array' })]);
}

function assert(cond: unknown, msg: string) { if (!cond) { console.error(`FAIL: ${msg}`); process.exitCode = 1; } else console.log(`ok   ${msg}`); }

const deck = await parsePptx(await build());
const [s1, s2] = deck.slides;
assert(deck.slides.length === 2, 'two slides parsed');
assert(Math.round(deck.width) === 960 && Math.round(deck.height) === 540, 'slide size in stage px (960x540)');
assert(s1.path.endsWith('slide2.xml') && s2.path.endsWith('slide1.xml'), 'presentation order follows sldIdLst, not file numbers');
assert(s1.background.kind === 'image', 'master background image inherited');
const tab = s1.elements.find((e) => e.layer === 'master');
assert(tab && tab.fill.kind === 'solid' && tab.fill.color === 'rgb(48,36,24)', `master decorative shape with lumMod tx2 color (${tab && tab.fill.kind === 'solid' ? tab.fill.color : 'none'})`);
assert(!s1.elements.some((e) => e.text?.paragraphs.some((p) => p.runs.some((r) => /Master prompt|Click to edit/.test(r.text)))), 'layout/master placeholder prompts are not drawn');
const card = s1.elements.find((e) => e.layer === 'layout');
assert(card && card.line?.color === 'rgb(107,123,42)', 'layout card shape with accent line');
const title = s1.elements.find((e) => e.text?.paragraphs[0]?.runs[0]?.text === 'Nigerian Contemporary Artists');
assert(title && Math.round(title.x) === 192 && Math.round(title.w) === 576, 'title position inherited from layout placeholder');
const run = title?.text?.paragraphs[0].runs[0];
assert(run && run.sizePt === 20 && run.bold && run.color === 'rgb(255,255,255)' && run.font === 'Book Antiqua', 'title text style: layout lstStyle over master titleStyle + theme major font');
assert(title?.fill.kind === 'solid' && title.text?.paragraphs[0].align === 'center' && title.text.anchor === 'middle', 'title fill/alignment/anchor inherited');
const bodyIdx = s1.elements.findIndex((e) => e.text?.paragraphs[0]?.runs[0]?.text.startsWith('Contemporary art'));
const body = s1.elements[bodyIdx];
assert(body && body.text?.paragraphs[0].align === 'justify' && body.text.paragraphs[0].runs[0].font === 'Garamond' && body.text.paragraphs[0].runs[0].sizePt === 24, 'paragraph font/size/alignment');
const picIdx = s1.elements.findIndex((e) => !!e.image);
assert(picIdx > bodyIdx && s1.elements[picIdx].image!.crop[0] === 0.1, 'picture keeps document layer order and srcRect crop');
const order = s1.elements.map((e) => e.layer).join(',');
assert(/^(master,)+(layout,)+(slide,?)+$/.test(order), `layer order master → layout → slide (${order})`);
assert(!s2.elements.some((e) => e.image), 'second slide (slide1.xml) has no picture');
assert(deck.fonts.includes('Garamond') && deck.fonts.includes('Book Antiqua'), 'fonts reported for limitation note');
deck.urls.forEach((u) => URL.revokeObjectURL(u));
