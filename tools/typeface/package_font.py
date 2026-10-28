"""Package the validated typeface and editable sources without touching the website."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[2]
folder = root / 'output/typeface'
archive = folder / 'DimensionDisplay-Bold-1.000.zip'
with ZipFile(archive, 'w', ZIP_DEFLATED) as bundle:
    for file in sorted(folder.rglob('*')):
        if file.is_file() and file.suffix != '.zip':
            bundle.write(file, Path('DimensionDisplay-Bold-1.000') / file.relative_to(folder))
print(archive)
