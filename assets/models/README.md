# ONNX Models

This directory contains the ONNX model files for local embedding generation.

## Required Files

Download the all-MiniLM-L6-v2 model files from Hugging Face:

1. **Model** (choose one):
   - Full model (~90MB): https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/onnx/model.onnx
   - Quantized model (~22MB, recommended): https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx

2. **Tokenizer** (~700KB):
   - https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/tokenizer.json

## Quick Download

```bash
# Download quantized model (smaller, slightly less accurate but much faster)
curl -L -o model_quantized.onnx "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx"

# Download tokenizer
curl -L -o tokenizer.json "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/tokenizer.json"
```

## Model Info

- **Model**: all-MiniLM-L6-v2
- **Output dimensions**: 384
- **Max sequence length**: 256 tokens
- **Use case**: Semantic similarity for activity clustering

## File Locations

The model loader searches for files in these locations (in order):

1. `assets/models/` - Development
2. `~/.traq/models/` - User config
3. `/usr/share/traq/models/` - System-wide installation
