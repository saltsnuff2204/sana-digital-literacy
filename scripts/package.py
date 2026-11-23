from pathlib import Path
import zipfile
root=Path(__file__).resolve().parent.parent
out=root/'deliverables';out.mkdir(exist_ok=True)
excluded={'build','node_modules','.git','.expo','dist','native-dist','android','ios','test-results','playwright-report','deliverables','__pycache__'}
with zipfile.ZipFile(out/'Sana-source.zip','w',zipfile.ZIP_DEFLATED) as z:
    for f in root.rglob('*'):
        relative=f.relative_to(root)
        if any(part in excluded for part in relative.parts): continue
        if not f.is_file() or relative.as_posix().startswith('server/data/') or f.name=='.env' or f.suffix=='.log' or f.name.startswith('test-'): continue
        z.write(f,Path('sana')/relative)
with zipfile.ZipFile(out/'Sana-preview.zip','w',zipfile.ZIP_DEFLATED) as z:
    for folder in ['dist','server']:
        for f in (root/folder).rglob('*'):
            if f.is_file() and 'data' not in f.relative_to(root).parts and f.suffix!='.log': z.write(f,f.relative_to(root))
    z.writestr('START.txt','Requires Node.js 24+. Run: node server/server.mjs\nOpen http://127.0.0.1:8787\nThis is a local browser demonstration, not an APK or IPA.\n')
print('Created source and runnable preview archives')
