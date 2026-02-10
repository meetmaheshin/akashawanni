# Knowledge Bases

This directory contains text files for different knowledge bases used by the voice chatbot.

## File Format

- Each knowledge base is a `.txt` file named after the KB identifier (e.g., `ailancers.txt`)
- Each line in the file represents a separate knowledge entry
- Empty lines are ignored
- Use UTF-8 encoding

## Adding a New Knowledge Base

1. Create a new `.txt` file in this directory (e.g., `ecommerce.txt`)
2. Add your knowledge entries, one per line
3. The KB will be automatically available in the frontend dropdown
4. The system will create embeddings on first use

## Example Structure

```
knowledge_bases/
├── ailancers.txt       # AILancers marketplace info
├── ecommerce.txt       # E-commerce related knowledge
└── support.txt         # Customer support FAQs
```

## Usage

- **General Mode**: No KB file needed, AI answers without constraints
- **Specific KB**: Select from dropdown, AI uses RAG with that KB

## Tips

- Keep entries focused and concise
- Each line should be a complete, standalone piece of information
- Avoid very short entries (less than 10 words)
- For best results, aim for 20-50 entries per KB
