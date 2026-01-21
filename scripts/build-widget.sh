#!/bin/bash

# Build script for chat widget
# Minifies JavaScript for production use

echo "Building chat widget..."

# Check if terser is installed
if ! command -v npx &> /dev/null; then
    echo "Error: npx not found. Please install Node.js"
    exit 1
fi

# Minify JavaScript
echo "Minifying JavaScript..."
npx terser widget/chat-widget.js \
  --compress \
  --mangle \
  --output widget/chat-widget.min.js

if [ $? -eq 0 ]; then
    echo "✓ JavaScript minified successfully"
    
    # Show file sizes
    original_size=$(wc -c < widget/chat-widget.js)
    minified_size=$(wc -c < widget/chat-widget.min.js)
    reduction=$(echo "scale=1; 100 - ($minified_size * 100 / $original_size)" | bc)
    
    echo ""
    echo "File sizes:"
    echo "  Original:  $(numfmt --to=iec-i --suffix=B $original_size)"
    echo "  Minified:  $(numfmt --to=iec-i --suffix=B $minified_size)"
    echo "  Reduction: ${reduction}%"
    echo ""
    echo "✓ Widget built successfully!"
else
    echo "✗ Failed to minify JavaScript"
    exit 1
fi
