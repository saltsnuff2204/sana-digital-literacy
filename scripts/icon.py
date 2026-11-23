from PIL import Image, ImageDraw
from pathlib import Path
root = Path(__file__).resolve().parent.parent / 'assets'
im = Image.new('RGB',(1024,1024),'#6554D9'); d=ImageDraw.Draw(im)
d.rounded_rectangle((155,245,870,850),radius=180,fill='#FFE69D')
d.line((512,160,512,270),fill='#20243D',width=28)
d.ellipse((468,118,556,206),fill='#D9F4E9',outline='#20243D',width=15)
d.rounded_rectangle((185,300,840,740),radius=135,fill='white',outline='#20243D',width=25)
d.rounded_rectangle((335,420,385,525),radius=25,fill='#40348F')
d.rounded_rectangle((635,420,685,525),radius=25,fill='#40348F')
d.arc((438,495,587,625),0,180,fill='#40348F',width=20)
im.save(root/'icon.png');im.resize((64,64)).save(root/'favicon.png')
