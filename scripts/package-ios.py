"""Package a macOS-built iPhone app for subsequent personal signing, not App Store upload."""
from pathlib import Path
import hashlib
import plistlib
import subprocess
import sys
import tempfile
import zipfile


def main():
    app = Path(sys.argv[1]).resolve()
    output = Path(sys.argv[2]).resolve()
    with (app / 'Info.plist').open('rb') as handle:
        info = plistlib.load(handle)
    if 'iPhoneOS' not in info.get('CFBundleSupportedPlatforms', []):
        raise SystemExit('Expected an iPhone device build, not a simulator app')
    executable = app / info['CFBundleExecutable']
    if not executable.is_file():
        raise SystemExit('Missing app executable')
    bundle = app / 'main.jsbundle'
    if not bundle.is_file() or bundle.stat().st_size < 1000:
        raise SystemExit('Missing embedded JavaScript: Release app must work without Metro')
    audio = list(app.rglob('*.mp3'))
    if len(audio) < 138:
        raise SystemExit(f'Missing offline narration: expected at least 138 MP3, found {len(audio)}')
    output.parent.mkdir(parents=True, exist_ok=True)
    # ditto preserves native executable permissions and framework symlinks.
    with tempfile.TemporaryDirectory(prefix='sana-ipa-') as temp:
        payload = Path(temp) / 'Payload'
        payload.mkdir()
        subprocess.run(['ditto', str(app), str(payload / app.name)], check=True)
        subprocess.run(['ditto', '-c', '-k', '--keepParent', '--norsrc',
                        str(payload), str(output)], check=True)
    with zipfile.ZipFile(output) as archive:
        assert f'Payload/{app.name}/Info.plist' in archive.namelist()
        assert archive.testzip() is None
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    output.with_suffix('.ipa.sha256').write_text(f'{digest}  {output.name}\n', encoding='utf-8')
    print(f'Created {output.name}: {output.stat().st_size:,} bytes, {len(audio)} audio files')
    print('UNSIGNED: install through a personal signing tool; not directly installable.')


if __name__ == '__main__':
    main()
