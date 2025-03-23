#!/usr/bin/env bash

# Exit immediately if any command fails
set -euo pipefail

readonly GIT_ROOT=$(git rev-parse --show-toplevel)
cd "$GIT_ROOT"

# Ensure ImageMagick is installed
if ! command -v magick &> /dev/null; then
    echo "ImageMagick 'magick' command not found. Please install ImageMagick."
    exit 1
fi

# Check input arguments
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <source_image>"
    exit 1
fi

# resolve absolute path to source image
source_image=$(realpath "$1")
output_dir="$GIT_ROOT/public"

# Ensure output directory exists
mkdir -p "$output_dir"

# Resize images using Lanczos interpolation and save with specific filenames
magick "$source_image" -filter Lanczos -resize 180x180 "$output_dir/apple-touch-icon.png"
magick "$source_image" -filter Lanczos -resize 16x16 "$output_dir/favicon-16x16.png"
magick "$source_image" -filter Lanczos -resize 32x32 "$output_dir/favicon-32x32.png"
magick "$source_image" -filter Lanczos -resize 96x96 "$output_dir/favicon-96x96.png"
magick "$source_image" -filter Lanczos -resize 192x192 "$output_dir/icon-192x192.png"
magick "$source_image" -filter Lanczos -resize 512x512 "$output_dir/icon-512x512.png"

# Generate favicon.ico containing multiple sizes
magick "$source_image" -filter Lanczos -resize 16x16,32x32,96x96 "$output_dir/favicon.ico"

echo "All favicon files have been generated successfully."
