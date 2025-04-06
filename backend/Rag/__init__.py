import os
from pathlib import Path
from typing import List, Tuple, Optional
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
from PyPDF2 import PdfReader

class RAGSystem:
    def __init__(self):
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        self.chunks: List[str] = []
        self.index: Optional[faiss.IndexFlatL2] = None
        
    def load_pdf(self, pdf_path: str) -> bool:
        try:
            reader = PdfReader(pdf_path)
            text = ""
            for page in reader.pages:
                text += page.extract_text()
            
            # Create chunks of reasonable size
            self.chunks = [text[i:i+512] for i in range(0, len(text), 512)]
            
            # Create embeddings
            embeddings = self.model.encode(self.chunks)
            
            # Initialize FAISS index
            dimension = embeddings.shape[1]
            self.index = faiss.IndexFlatL2(dimension)
            self.index.add(embeddings)
            
            return True
        except Exception as e:
            print(f"Error loading PDF: {e}")
            return False
    
    def get_relevant_chunks(self, query: str, k: int = 3) -> List[str]:
        if not self.index or not self.chunks:
            return []
            
        query_vector = self.model.encode([query])
        D, I = self.index.search(query_vector, k)
        
        return [self.chunks[i] for i in I[0]]

    def format_context(self, chunks: List[str]) -> str:
        return "\n\n".join([f"Chunk {i+1}:\n{chunk}" for i, chunk in enumerate(chunks)])

# Initialize global RAG system
rag_system = RAGSystem()
