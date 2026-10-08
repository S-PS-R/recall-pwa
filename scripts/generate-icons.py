"""Regenerate original Recall PWA icons with Pillow (optional developer tool)."""
from pathlib import Path
from PIL import Image, ImageDraw

output = Path(__file__).resolve().parent.parent / 'public'
for size, filename in [(192, 'icon-192.png'), (512, 'icon-512.png'), (180, 'apple-touch-icon.png')]:
    scale = 4
    canvas = Image.new('RGB', (size * scale, size * scale), '#185b49')
    unit = size * scale / 192
    def rect(box, radius, color):
        ImageDraw.Draw(canvas).rounded_rectangle(tuple(int(v * unit) for v in box), radius=int(radius * unit), fill=color)
    rect((48, 43, 121, 139), 10, '#a7ccaf')
    rect((66, 54, 143, 150), 10, '#fffdf4')
    draw = ImageDraw.Draw(canvas)
    draw.line([(int(x * unit), int(y * unit)) for x, y in [(84, 103), (99, 118), (126, 85)]], fill='#185b49', width=int(8 * unit), joint='curve')
    canvas.resize((size, size), Image.Resampling.LANCZOS).save(output / filename)
