#!/usr/bin/env python3
"""Create fixed-geometry, transparent raster assets from generated image sheets.

The original images come from Create Image; this script only slices, masks,
repositions, and resamples artwork for the game's existing PixiJS coordinate system.
No illustration is drawn in Python. Assets are output in premultiplication-safe RGBA.
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageOps, ImageEnhance
import numpy as np

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'sources'
ASSETS = ROOT / 'assets'
ATLAS = ROOT / 'atlases'
for path in (ASSETS/'vial', ASSETS/'toppers', ASSETS/'liquid'/'tiles', ASSETS/'liquid'/'bands', ASSETS/'effects', ATLAS):
    path.mkdir(parents=True, exist_ok=True)

SCALE = 4
VIAL_SIZE=(400,1088)
TOPPER_SIZE=(400,72)
TILE_SIZE=(256,256)
BAND_SIZE=(284,237)
EFFECT_SIZE=(128,128)
COLORS = ['coral','amber','lemon','lime','emerald','teal','sky','cobalt','violet','magenta','rose','cocoa']
PALETTE = ['#ef5aa9','#f4852d','#f7cb32','#a3ed35','#38bf57','#20c7b9','#38c9ee','#317df2','#a253ea','#df37bc','#df4269','#a98251']

# Source atlas: first row flowers, waves, stripes, stars; second leaves,
# hearts, bubbles, diamonds; third spirals, zigzags, moons, constellations.
PATTERN_SOURCE = {
    'coral':(0,0), 'lemon':(0,1), 'cobalt':(0,2), 'violet':(0,3),
    'emerald':(1,0), 'rose':(1,1), 'sky':(1,2), 'amber':(1,3),
    'teal':(2,0), 'lime':(2,1), 'magenta':(2,2), 'cocoa':(2,3),
}
source_texture=Image.open(SOURCE/'neon_fantasy_pattern_texture_atlas.png').convert('RGBA')
# Crops sampled strictly *inside* the generated atlas outlines, so no borders
# or surrounding transparency bleed into a tile.
COL_BOUNDS=[(40,361),(375,697),(715,1034),(1049,1371)]
ROW_BOUNDS=[(39,353),(371,676),(693,1011)]
liquid_tiles={}
for color,(row,col) in PATTERN_SOURCE.items():
    left,right=COL_BOUNDS[col];top,bottom=ROW_BOUNDS[row]
    tile=source_texture.crop((left,top,right,bottom)).convert('RGB').resize(TILE_SIZE,Image.Resampling.LANCZOS)
    if color=='cocoa':
        # Re-tint indigo constellations to the warm brown used by the actual game.
        rgb=np.array(tile,dtype=np.float32)
        luminance=(rgb[...,0]*.2126+rgb[...,1]*.7152+rgb[...,2]*.0722)/255.0
        brightness=np.clip(.35+.6*luminance,0,1)
        base=np.array([169,130,81],dtype=np.float32)
        light=np.array([255,225,159],dtype=np.float32)
        rgb=base[None,None,:]*(1-brightness[...,None])+light[None,None,:]*brightness[...,None]
        tile=Image.fromarray(np.clip(rgb,0,255).astype('uint8'),'RGB')
    tile_rgba=tile.convert('RGBA')
    liquid_tiles[color]=tile_rgba
    tile_rgba.save(ASSETS/'liquid'/'tiles'/f'{color}.png')
    # Exactly one capacity-four band at 4x logical resolution.
    tile_rgba.resize(BAND_SIZE,Image.Resampling.LANCZOS).save(ASSETS/'liquid'/'bands'/f'{color}.png')

# Main vial is already correctly aligned to the 100x272 app viewBox. It was
# rasterized from the artwork generated in the earlier mad-alchemist preview.
# Keep transparent glass so the shader can render every pour underneath it.
source_frame=Image.open(SOURCE/'mad-alchemist-preview.png').convert('RGBA')
assert source_frame.size==VIAL_SIZE
frame=source_frame.copy()
frame.save(ASSETS/'vial'/'glass_front.png')

# Back glass: same silhouette, only a whisper of transparent violet within the
# canonical interior polygon, preserving visibility of shader-rendered liquid.
# The foreground rim, highlights, and base belong to glass_front only.
back=Image.new('RGBA',VIAL_SIZE,(0,0,0,0))
mask=Image.new('L',VIAL_SIZE,0)
interior_polygon=[(58,88),(342,88),(342,856),(334,916),(314,964),(282,1004),(242,1028),(200,1036),(158,1028),(118,1004),(86,964),(66,916),(58,856)]
ImageDraw.Draw(mask).polygon(interior_polygon,fill=14)
back.paste(Image.new('RGBA',VIAL_SIZE,(113,56,156,14)),(0,0),mask)
back.save(ASSETS/'vial'/'glass_back.png')

# Alternative glossy edge pass: sample color characteristics from the generated
# style sheet, but retain exact alpha and shape from the canonical game sprite.
# This is optional; glass_front.png is the safest production-aligned version.
style_sheet=Image.open(SOURCE/'a_polished_high_detail_game_asset_sheet_ui_style.png').convert('RGBA')
style_crop=style_sheet.crop((79,84,207,465)).resize(VIAL_SIZE,Image.Resampling.LANCZOS)
combined=np.array(frame,dtype=np.float32)
style=np.array(style_crop,dtype=np.float32)
# Do not allow generated background pixels to become opaque.
strong=(combined[...,3]>=100)
combined[strong,:3] = .72*combined[strong,:3]+.28*style[strong,:3]
gloss=Image.fromarray(np.clip(combined,0,255).astype(np.uint8),'RGBA')
gloss.save(ASSETS/'vial'/'glass_front_glossy_variant.png')

# Accessory icon atlas: semantic bounding boxes in generated source.
# Each is independently extracted with true transparent alpha; stray low-alpha
# image-generation fringe is removed before fitting into the hard 18-unit cap budget.
source_accessories=Image.open(SOURCE/'whimsical_golden_magical_accessory_icons.png').convert('RGBA')
TOPPER_CROPS={
    'cork':(55,66,296,330),
    'wax':(398,42,661,330),
    'crystal':(1108,9,1357,335),
    'orb':(56,370,300,675),
    'moon':(405,370,663,682),
}

def clean_crop(img:Image.Image,box:tuple[int,int,int,int],threshold:int=35)->Image.Image:
    region=img.crop(box).copy().convert('RGBA')
    arr=np.array(region)
    # True alpha independent of black checker or backdrop artifacts.
    alpha=arr[...,3].astype('float32')
    alpha=np.where(alpha<threshold,0,(alpha-threshold)/(255-threshold)*255)
    arr[...,3]=np.clip(alpha,0,255).astype(np.uint8)
    region=Image.fromarray(arr,'RGBA')
    bbox=region.getbbox()
    return region.crop(bbox) if bbox else region

topper_assets={}
for name,box in TOPPER_CROPS.items():
    cut=clean_crop(source_accessories,box,threshold=52)
    # Width ≤300 px; height ≤60 px leaves at least 12 transparent pixels.
    fit_scale=min(296/max(1,cut.width),60/max(1,cut.height))
    newsize=(max(1,round(cut.width*fit_scale)),max(1,round(cut.height*fit_scale)))
    cut=cut.resize(newsize,Image.Resampling.LANCZOS)
    canvas=Image.new('RGBA',TOPPER_SIZE)
    canvas.alpha_composite(cut,((400-newsize[0])//2,72-newsize[1]))
    topper_assets[name]=canvas
    canvas.save(ASSETS/'toppers'/f'{name}.png')

# Effects are decorative particle cards, not precomputed pour animation frames.
# Dynamic pouring and foam must remain procedural so they follow source/target.
source_fx=Image.open(SOURCE/'magical_potion_alchemy_sprite_sheet.png').convert('RGBA')
EFFECT_CROPS={
    'bubble_small':(61,695,193,849),
    'bubble_cluster':(542,634,783,891),
    'sparkle_single':(18,1013,183,1180),
    'sparkle_burst':(368,958,623,1229),
    'foam_cluster':(626,996,878,1195),
    'splash_drops':(894,1001,1075,1180),
}
fx_assets={}
for name,box in EFFECT_CROPS.items():
    cut=clean_crop(source_fx,box,threshold=42)
    fit_scale=min(118/max(1,cut.width),118/max(1,cut.height))
    size=(max(1,round(cut.width*fit_scale)),max(1,round(cut.height*fit_scale)))
    cut=cut.resize(size,Image.Resampling.LANCZOS)
    canvas=Image.new('RGBA',EFFECT_SIZE)
    canvas.alpha_composite(cut,((128-size[0])//2,(128-size[1])//2))
    fx_assets[name]=canvas
    canvas.save(ASSETS/'effects'/f'{name}.png')

# Exact fixed-grid source atlases; their transparent gutters have no gridlines.
liquid_atlas=Image.new('RGBA',(4*256,3*256))
for color,(row,col) in PATTERN_SOURCE.items():
    liquid_atlas.alpha_composite(liquid_tiles[color],(col*256,row*256))
liquid_atlas.save(ATLAS/'liquid_4x3.png')

topper_atlas=Image.new('RGBA',(5*400,72))
for index,name in enumerate(TOPPER_CROPS):
    topper_atlas.alpha_composite(topper_assets[name],(index*400,0))
topper_atlas.save(ATLAS/'toppers_5x1.png')

fx_atlas=Image.new('RGBA',(3*128,2*128))
for i,(name,asset) in enumerate(fx_assets.items()):
    fx_atlas.alpha_composite(asset,((i%3)*128,(i//3)*128))
fx_atlas.save(ATLAS/'effects_3x2.png')

vial_atlas=Image.new('RGBA',(3*400,1088))
for col,v in enumerate((back,frame,gloss)):
    vial_atlas.alpha_composite(v,(col*400,0))
vial_atlas.save(ATLAS/'vial_layers_3x1.png')

# Geometry-accurate reusable compositor for demonstration and review only.
# The liquid shader should still be responsible for moving liquid in production.
liquid_mask=Image.new('L',VIAL_SIZE,0)
ImageDraw.Draw(liquid_mask).polygon(interior_polygon,fill=255)

def compose_vial(colors:list[str],stopper:str|None=None)->Image.Image:
    composite=back.copy()
    liquid=Image.new('RGBA',VIAL_SIZE)
    for i,color in enumerate(colors[:4]):
        if color in liquid_tiles:
            band=Image.open(ASSETS/'liquid'/'bands'/f'{color}.png')
            liquid.alpha_composite(band,(58,88+(4-len(colors)+i)*237))
    liquid.putalpha(Image.fromarray(np.minimum(np.array(liquid.getchannel('A')),np.array(liquid_mask)), 'L'))
    composite.alpha_composite(liquid)
    composite.alpha_composite(frame)
    if stopper is not None:
        composite.alpha_composite(topper_assets[stopper],(0,0))
    return composite

# Full examples suitable for checking clipping and transparent edges.
examples=ASSETS/'examples'
examples.mkdir(parents=True,exist_ok=True)
example_colors=[
 ['coral','sky','lime','cobalt'],['sky','magenta','lemon','violet'],
 ['lime','cobalt','rose','amber'],['lemon','violet','cocoa','sky'],
 ['rose','coral','amber','emerald'],['teal','cocoa','violet','cobalt'],
 ['teal','sky','rose','cocoa'],['rose','magenta','lemon','emerald'],
 ['lime','cocoa','rose','cobalt'],['magenta','lemon','violet','teal'],
 ['amber','emerald','teal','rose'],['sky','emerald','cocoa','amber'],[],[],
]
for i,colors in enumerate(example_colors):
    topper=list(TOPPER_CROPS)[i%5]
    example=compose_vial(colors,stopper=topper)
    example.save(examples/f'example_{i+1:02}.png')

# Contact sheet is just a developer preview; actual assets remain alpha PNGs.
preview=Image.new('RGBA',(1300,1980),(31,12,50,255))
for i in range(14):
    name=examples/f'example_{i+1:02}.png'
    rendered=Image.open(name).convert('RGBA').resize((152,414),Image.Resampling.LANCZOS)
    preview.alpha_composite(rendered,(46+(i%7)*172,200+(i//7)*482))
# Pattern/toppers swatches with alpha on purple underlays
for i,name in enumerate(COLORS):
    tile=liquid_tiles[name].resize((86,86),Image.Resampling.LANCZOS)
    preview.alpha_composite(tile,(54+(i%12)*103,1250))
for i,name in enumerate(TOPPER_CROPS):
    top=topper_assets[name].resize((210,38),Image.Resampling.LANCZOS)
    preview.alpha_composite(top,(70+i*245,1450))
for i,name in enumerate(EFFECT_CROPS):
    fx=fx_assets[name].resize((130,130),Image.Resampling.LANCZOS)
    preview.alpha_composite(fx,(120+i*185,1630))
preview.convert('RGB').save(ROOT/'preview.jpg',quality=94)

manifest={
 'format_version':1,
 'reference':{'repository':'paleite/water-sort-puzzle','skin':'mad-alchemist','logical_viewBox':[100,272],'scale':SCALE,'vial_size_px':list(VIAL_SIZE),
              'mouth':{'left':[12,18],'right':[88,18]},'liquid_bounds':{'left':14.5,'right':85.5,'top':22,'bottom':259},
              'liquid_band_height_logical':59.25,'liquid_band_height_px':237,
              'topper_visible_bounds_logical':{'x':[0,100],'y':[0,18]},
              'stopper_sprite_anchor_px':'top-left of vial (0,0); fully contained in first 72px'},
 'alpha':{'all_files_rgba':True,'background_alpha':0,'glass_interior':'translucent','liquid_tiles':'opaque by design'},
 'files':{'glass_back':'assets/vial/glass_back.png','glass_front':'assets/vial/glass_front.png','glass_front_glossy_variant':'assets/vial/glass_front_glossy_variant.png',
          'toppers':{x:f'assets/toppers/{x}.png' for x in TOPPER_CROPS},
          'liquid_tiles':{x:f'assets/liquid/tiles/{x}.png' for x in COLORS},
          'liquid_bands':{x:f'assets/liquid/bands/{x}.png' for x in COLORS},
          'effects':{x:f'assets/effects/{x}.png' for x in EFFECT_CROPS},
          'atlas':{'vial':'atlases/vial_layers_3x1.png','toppers':'atlases/toppers_5x1.png','liquids':'atlases/liquid_4x3.png','effects':'atlases/effects_3x2.png'}},
 'dimensions_px':{'vial_layers':[400,1088], 'toppers':[400,72], 'liquid_tiles':[256,256], 'liquid_bands':[284,237], 'effects':[128,128]},
 'source_tile_positions':PATTERN_SOURCE,
 'palette':dict(zip(COLORS,PALETTE)),
 'warnings':['The generated raster texture tiles are not mathematically seamless; tile repeat edges need checking.',
             'Dynamic pour streams, liquid masks, and slosh are rendered by PixiJS/GSAP, not animated PNG frames.',
             'These PNGs are normalized exports; original Create Image files do not reliably honor specified pixel sizes or alpha.']
}
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')

# Validate every deliverable's required pixel size and actual alpha channel.
expected={
    **{ASSETS/'vial'/f'{name}.png':VIAL_SIZE for name in ['glass_back','glass_front','glass_front_glossy_variant']},
    **{ASSETS/'toppers'/f'{name}.png':TOPPER_SIZE for name in TOPPER_CROPS},
    **{ASSETS/'liquid'/'tiles'/f'{name}.png':TILE_SIZE for name in COLORS},
    **{ASSETS/'liquid'/'bands'/f'{name}.png':BAND_SIZE for name in COLORS},
    **{ASSETS/'effects'/f'{name}.png':EFFECT_SIZE for name in EFFECT_CROPS},
}
for path,expected_size in expected.items():
    image=Image.open(path)
    assert image.mode=='RGBA' and image.size==expected_size,(path,image.mode,image.size)
    if 'toppers' in str(path) or 'effects' in str(path) or 'vial' in str(path):
        assert image.getpixel((0,0))[3]==0,(path,'background is not transparent')
print(f'Validated {len(expected)} individual RGBA assets. Atlas files and examples are additional.')
