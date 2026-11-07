#!/usr/bin/env python3
"""Deterministically cut the normalized RGBA atlases into exact pixel assets.

Usage: python slice_atlases.py
Requires Pillow. No scaling, padding guesses, or background removal occurs here;
build_assets.py creates the normalized, transparent atlases from the source art.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
SPEC = {
    'vial_layers_3x1.png': {
        'cell_size': (400, 1088), 'grid_columns': 3,
        'names': ['glass_back', 'glass_front', 'glass_front_glossy_variant'],
        'destination': ROOT / 'assets' / 'vial',
    },
    'toppers_5x1.png': {
        'cell_size': (400, 72), 'grid_columns': 5,
        'names': ['cork', 'wax', 'crystal', 'orb', 'moon'],
        'destination': ROOT / 'assets' / 'toppers',
    },
    'liquid_4x3.png': {
        'cell_size': (256, 256), 'grid_columns': 4,
        'names': ['coral', 'lemon', 'cobalt', 'violet', 'emerald', 'rose',
                  'sky', 'amber', 'teal', 'lime', 'magenta', 'cocoa'],
        'destination': ROOT / 'assets' / 'liquid' / 'tiles',
    },
    'effects_3x2.png': {
        'cell_size': (128, 128), 'grid_columns': 3,
        'names': ['bubble_small', 'bubble_cluster', 'sparkle_single',
                  'sparkle_burst', 'foam_cluster', 'splash_drops'],
        'destination': ROOT / 'assets' / 'effects',
    },
}

for atlas_name, spec in SPEC.items():
    atlas = Image.open(ROOT / 'atlases' / atlas_name).convert('RGBA')
    width, height = spec['cell_size']
    spec['destination'].mkdir(parents=True, exist_ok=True)
    for index, name in enumerate(spec['names']):
        column, row = index % spec['grid_columns'], index // spec['grid_columns']
        bounds = (column * width, row * height, (column + 1) * width, (row + 1) * height)
        atlas.crop(bounds).save(spec['destination'] / f'{name}.png')
        print(f'{atlas_name} {bounds} -> {name}.png')
