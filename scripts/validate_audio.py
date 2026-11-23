import concurrent.futures, json, pathlib, subprocess
root=pathlib.Path(__file__).resolve().parent.parent
files=sorted((root/'assets/audio').glob('*.mp3'))
def check(file):
    p=subprocess.run(['ffmpeg','-v','error','-i',str(file),'-f','null','-'],capture_output=True)
    if p.returncode: raise RuntimeError(file.name+': '+p.stderr.decode(errors='replace'))
    r=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(file)],capture_output=True,check=True)
    duration=float(json.loads(r.stdout)['format']['duration'])
    assert duration>5, file.name
    return {'file':file.name,'seconds':round(duration,2),'bytes':file.stat().st_size}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: result=list(pool.map(check,files))
assert len(result)==138
(root/'generated/audio-validation.json').write_text(json.dumps(result,indent=2),encoding='utf8')
print(f'Validated {len(result)} MP3 files, {sum(x["seconds"] for x in result)/60:.1f} minutes, {sum(x["bytes"] for x in result)/1e6:.1f} MB')
