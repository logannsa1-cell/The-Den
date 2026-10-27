import fitz
from pathlib import Path

doc = fitz.open(next(Path("attached_assets").glob("*1793122779107.pdf")))
out = Path("/tmp/jaguar-reference")
out.mkdir(exist_ok=True)
text = "\n".join(page.get_text() for page in doc)
(out / "lesson.txt").write_text(text)
print(f"Pages: {len(doc)}, words: {len(text.split())}")
for i in range(min(2, len(doc))):
    doc[i].get_pixmap(matrix=fitz.Matrix(1.3, 1.3)).save(out / f"page-{i+1}.png")
print(text[:15000])
