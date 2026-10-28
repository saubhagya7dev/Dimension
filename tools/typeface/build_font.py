"""Build editable outlines + TTF/OTF/WOFF2 from the approved alphabet, not a substitute font."""
from pathlib import Path
from io import BytesIO
import json
import string
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import vtracer
from fontTools.fontBuilder import FontBuilder
from fontTools.ttLib import TTFont
from fontTools.svgLib.path import parse_path
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.reverseContourPen import ReverseContourPen
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output/typeface'
SOURCE = OUT / 'source/approved-alphabet-concept.png'
GLYPHS = OUT / 'source/glyphs'
GLYPHS.mkdir(parents=True, exist_ok=True)
image = Image.open(SOURCE).convert('RGB')
assert image.size == (1024, 1536), f'Unexpected concept size: {image.size}'
# Rows share a scale and baseline. Pointed extensions remain below the baseline;
# fitting every glyph to its own bounding box would distort the approved shapes.
ROWS = [
    ('ABCDEFG', [37,173,309,445,581,717,853,989], 410, 533, 426, 511),
    ('HIJKLMN', [37,173,309,445,581,717,853,989], 612, 741, 628, 712),
    ('OPQRST', [37,189,342,500,656,820,988], 812, 937, 829, 914),
    ('UVWXYZ', [37,185,337,516,679,833,988], 1020, 1141, 1040, 1122),
]
recordings, metrics, source_masks, reports = {}, {}, {}, []
for letters, columns, top, bottom, cap, baseline in ROWS:
    scale = 700 / (baseline - cap)
    for index, letter in enumerate(letters):
        crop_left, crop_right = columns[index] + 3, columns[index+1] - 3
        crop = image.crop((crop_left, top, crop_right, bottom))
        values = np.asarray(crop)
        white = np.min(values, axis=2) > 150
        ys, xs = np.where(white)
        assert len(xs) > 100, f'Empty glyph {letter}'
        x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max())+1, int(ys.max())+1
        assert x0>0 and y0>0 and x1<crop.width and y1<crop.height, f'Clipped source glyph {letter}'
        # Tight trace input + a safe margin; black foreground on white background.
        pad = 4
        binary = Image.fromarray(np.where(white[y0:y1,x0:x1], 0, 255).astype('uint8'))
        trace_input = Image.new('L', (binary.width+pad*2,binary.height+pad*2), 255)
        trace_input.paste(binary,(pad,pad))
        png_path = GLYPHS / f'{letter}-trace.png'
        svg_path = GLYPHS / f'{letter}.svg'
        trace_input.convert('RGB').save(png_path)
        vtracer.convert_image_to_svg_py(str(png_path),str(svg_path),colormode='binary',mode='polygon',filter_speckle=1,corner_threshold=60,length_threshold=1,max_iterations=10,splice_threshold=45,path_precision=4)
        png_path.unlink()
        root = ET.parse(svg_path).getroot()
        recording = RecordingPen()
        bearing = 42
        for path in root.iter('{http://www.w3.org/2000/svg}path'):
            # VTracer paths use a translate to preserve their local trace bounds.
            transform = path.attrib.get('transform','translate(0,0)')
            assert transform.startswith('translate('), transform
            dx,dy = map(float, transform[len('translate('):-1].replace(',',' ').split())
            tx = bearing + (dx-pad)*scale
            ty = (baseline-(top+y0)-dy+pad)*scale
            parse_path(path.attrib['d'], TransformPen(recording,(scale,0,0,-scale,tx,ty)))
        bounds_pen=BoundsPen(None);recording.replay(bounds_pen)
        assert bounds_pen.bounds, f'Missing outline for {letter}'
        b = bounds_pen.bounds
        # Preserve the actual outline width and normalize only the side bearing.
        shifted=RecordingPen(); recording.replay(TransformPen(shifted,(1,0,0,1,bearing-b[0],0)))
        recordings[letter]=shifted
        metrics[letter]=(round(b[2]-b[0]+bearing*2),bearing)
        source_masks[letter]=(white, (x0,y0,x1,y1), scale, top, baseline)
        reports.append({'letter':letter,'sourceCell':[crop_left,top,crop_right,bottom], 'sourceInk':[x0,y0,x1,y1], 'sourceBaseline':baseline,'scale':scale,'advance':metrics[letter][0],'bounds':[round(n,3) for n in b]})

order=['.notdef','space',*string.ascii_uppercase]
cmap={32:'space', **{ord(c):c for c in string.ascii_uppercase}, **{ord(c.lower()):c for c in string.ascii_uppercase}}
missing=RecordingPen()
for points in [[(40,0),(40,700),(540,700),(540,0)],[(100,60),(480,60),(480,640),(100,640)]]:
    missing.moveTo(points[0])
    for p in points[1:]:missing.lineTo(p)
    missing.closePath()
recordings['.notdef']=missing; recordings['space']=RecordingPen()
metrics['.notdef']=(580,40);metrics['space']=(320,0)
features='languagesystem DFLT dflt; languagesystem latn dflt; feature kern {\n'
for a,b,value in [('A','V',-60),('V','A',-60),('A','W',-45),('W','A',-45),('A','Y',-45),('Y','A',-45),('T','A',-35),('A','T',-35),('L','T',-30),('L','Y',-35),('F','A',-30)]:
    features+=f'pos {a} {b} {value};\n'
features+='} kern;'

def build(ttf):
    builder=FontBuilder(1000,isTTF=ttf)
    builder.setupGlyphOrder(order);builder.setupCharacterMap(cmap)
    if ttf:
        glyphs={}
        for name in order:
            pen=TTGlyphPen(None)
            recordings[name].replay(ReverseContourPen(Cu2QuPen(pen,max_err=.45)))
            glyphs[name]=pen.glyph()
        builder.setupGlyf(glyphs)
    else:
        charstrings={}
        for name in order:
            pen=T2CharStringPen(metrics[name][0],None)
            recordings[name].replay(pen)
            charstrings[name]=pen.getCharString(private=None,globalSubrs=None)
        builder.setupCFF('DimensionDisplay-Bold',{'FullName':'Dimension Display Bold','FamilyName':'Dimension Display','Weight':'Bold'},charstrings,{})
    builder.setupHorizontalMetrics(metrics)
    builder.setupHorizontalHeader(ascent=880,descent=-180,lineGap=80)
    builder.setupNameTable({'familyName':'Dimension Display','styleName':'Bold','uniqueFontIdentifier':'Dimension Display Bold 1.000','fullName':'Dimension Display Bold','psName':'DimensionDisplay-Bold','version':'Version 1.000','copyright':'Copyright 2026 Dimension. All rights reserved.','description':'Custom uppercase display typeface from the approved Dimension alphabet. Lowercase codepoints map to uppercase letterforms.'})
    builder.setupOS2(version=4,sTypoAscender=880,sTypoDescender=-180,sTypoLineGap=80,usWinAscent=880,usWinDescent=180,sCapHeight=700,sxHeight=700,usWeightClass=700,usWidthClass=7,fsType=0,fsSelection=(1<<5)|(1<<7))
    builder.setupPost(keepGlyphNames=True)
    builder.font['head'].macStyle=1
    builder.font['head'].fontRevision=1.0
    addOpenTypeFeaturesFromString(builder.font,features)
    filename=OUT/f'DimensionDisplay-Bold.{"ttf" if ttf else "otf"}'
    builder.save(filename)
    return filename

ttf_path,otf_path=build(True),build(False)
webfont=TTFont(ttf_path);webfont.flavor='woff2';webfont.save(OUT/'DimensionDisplay-Bold.woff2')
# Reopen compiled formats, inspect the cmap, and rasterize both independently.
for path in [ttf_path,otf_path,OUT/'DimensionDisplay-Bold.woff2']:
    font=TTFont(path,checkChecksums=2)
    font.ensureDecompiled()
    assert font['maxp'].numGlyphs==28
    assert all(font.getBestCmap()[ord(c)]==c for c in string.ascii_uppercase)
    assert all(font.getBestCmap()[ord(c.lower())]==c for c in string.ascii_uppercase)
    assert font['OS/2'].fsType==0
    assert 'GPOS' in font
    font.close()

font=ImageFont.truetype(str(ttf_path),100)
otf_font=ImageFont.truetype(str(otf_path),100)
comparison=Image.new('RGB',(1600,1530),'#111214');draw=ImageDraw.Draw(comparison)
label=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',21)
heading=ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf',30)
draw.text((52,30),'DIMENSION DISPLAY / FONT VERIFICATION',font=heading,fill='#f2f1ee')
draw.text((52,80),'Top in each cell: approved concept   /   Bottom: compiled TTF',font=label,fill='#aaa')
coverage_report=[]
for idx,letter in enumerate(string.ascii_uppercase):
    col,row=idx%7,idx//7
    cx,cy=52+col*214,140+row*262
    draw.rectangle((cx,cy,cx+199,cy+246),outline='#363639')
    white,(x0,y0,x1,y1),scale,top,baseline=source_masks[letter]
    reference=Image.fromarray(np.where(white[y0:y1,x0:x1],255,0).astype('uint8'))
    ref_w=max(1,round(reference.width*scale*.1));ref_h=max(1,round(reference.height*scale*.1))
    reference=reference.resize((ref_w,ref_h),Image.Resampling.LANCZOS)
    comparison.paste('#f2f1ee',(cx+20,cy+20),reference)
    draw.text((cx+20,cy+215),letter,font=label,fill='#fc4e4e')
    draw.text((cx+16,cy+190),letter,font=font,fill='white',anchor='ls')
    # Compare isolated glyph silhouettes at the same tight scale, excluding layout.
    renders=[]
    for render_font in [font,otf_font]:
        tile=Image.new('L',(220,180),0)
        ImageDraw.Draw(tile).text((10,120),letter,font=render_font,fill=255,anchor='ls')
        bounds=tile.getbbox();assert bounds,letter
        renders.append(tile.crop(bounds))
    actual=renders[0].resize(reference.size,Image.Resampling.LANCZOS)
    ref=np.asarray(reference)>128;got=np.asarray(actual)>128
    iou=float(np.logical_and(ref,got).sum()/np.logical_or(ref,got).sum())
    size_delta=[abs(a-b) for a,b in zip(renders[0].size,renders[1].size)]
    assert max(size_delta)<=2, f'TTF/OTF geometry mismatch for {letter}: {size_delta}'
    coverage_report.append({'letter':letter,'silhouetteIoUAt100px':round(iou,5),'ttfOtfRasterSizeDeltaPx':size_delta})
draw.text((52,1230),'COMPILED FONT / WORD SPACING',font=label,fill='#aaa')
sample_font=ImageFont.truetype(str(ttf_path),92)
draw.text((52,1320),'CREATE  BEYOND',font=sample_font,fill='white',anchor='ls')
draw.text((52,1440),'DIMENSION',font=sample_font,fill='white',anchor='ls')
comparison.save(OUT/'dimension-display-verification.png')
(OUT/'source/glyph-metrics.json').write_text(json.dumps(reports,indent=2)+'\n')
(OUT/'validation.json').write_text(json.dumps({'family':'Dimension Display','style':'Bold','unitsPerEm':1000,'capHeight':700,'glyphs':28,'characters':'A–Z, lowercase aliases, space','glyphChecks':coverage_report},indent=2)+'\n')
print(json.dumps({'files':[str(p.name) for p in OUT.glob('DimensionDisplay*')],'glyphs':28,'averageSilhouetteIoUAt100px':sum(r['silhouetteIoUAt100px'] for r in coverage_report)/26,'minimumSilhouetteIoUAt100px':min(coverage_report,key=lambda r:r['silhouetteIoUAt100px'])},indent=2))
